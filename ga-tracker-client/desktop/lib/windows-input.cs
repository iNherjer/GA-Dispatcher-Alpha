using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Read-only observation of one joystick button or key for the radio hold.
// Inputs are never consumed or injected, so the same button keeps working as PTT
// in the simulator, SayIntentions or Discord. Keys are only reported while the
// user explicitly learns a binding; otherwise only the bound input is watched.
namespace GAInput {
 public static class Helper {
  [StructLayout(LayoutKind.Sequential)]
  struct JOYINFOEX {
   public int dwSize, dwFlags, dwXpos, dwYpos, dwZpos, dwRpos, dwUpos, dwVpos, dwButtons, dwButtonNumber, dwPOV, dwReserved1, dwReserved2;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct JOYCAPSW {
   public ushort wMid, wPid;
   [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szPname;
   public uint wXmin, wXmax, wYmin, wYmax, wZmin, wZmax, wNumButtons, wPeriodMin, wPeriodMax, wRmin, wRmax, wUmin, wUmax, wVmin, wVmax, wCaps, wMaxAxes, wNumAxes, wMaxButtons;
   [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szRegKey;
   [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szOEMVxD;
  }
  [DllImport("winmm.dll")] static extern int joyGetPosEx(int id, ref JOYINFOEX info);
  [DllImport("winmm.dll", CharSet = CharSet.Unicode)] static extern int joyGetDevCapsW(IntPtr id, ref JOYCAPSW caps, int size);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);

  const int JOY_RETURNBUTTONS = 0x80, MAX_JOYSTICKS = 16;
  static readonly object writeLock = new object();
  static volatile string command = "idle";
  static volatile bool inputClosed;

  sealed class Device { public int Id, Buttons, ButtonCount; public ushort Mid, Pid; public string Name = ""; }

  static void Write(string json) { lock (writeLock) { Console.Out.WriteLine(json); Console.Out.Flush(); } }
  static string Quote(string value) {
   var b = new StringBuilder("\"");
   foreach (char c in value ?? "") {
    if (c == '"' || c == '\\') b.Append('\\').Append(c);
    else if (c < 0x20) b.Append("\\u").Append(((int)c).ToString("x4"));
    else b.Append(c);
   }
   return b.Append('"').ToString();
  }
  static string OemName(ushort mid, ushort pid) {
   try {
    string key = String.Format(@"System\CurrentControlSet\Control\MediaProperties\PrivateProperties\Joystick\OEM\VID_{0:X4}&PID_{1:X4}", mid, pid);
    foreach (var hive in new[] { Microsoft.Win32.Registry.CurrentUser, Microsoft.Win32.Registry.LocalMachine }) {
     using (var k = hive.OpenSubKey(key)) { var name = k == null ? null : k.GetValue("OEMName") as string; if (!String.IsNullOrEmpty(name)) return name; }
    }
   } catch (Exception) { }
   return "";
  }
  static Device Probe(int id) {
   var info = new JOYINFOEX { dwSize = Marshal.SizeOf(typeof(JOYINFOEX)), dwFlags = JOY_RETURNBUTTONS };
   if (joyGetPosEx(id, ref info) != 0) return null;
   var caps = new JOYCAPSW();
   var device = new Device { Id = id, Buttons = info.dwButtons };
   if (joyGetDevCapsW(new IntPtr(id), ref caps, Marshal.SizeOf(typeof(JOYCAPSW))) == 0) {
    device.Mid = caps.wMid; device.Pid = caps.wPid; device.ButtonCount = (int)caps.wNumButtons;
    device.Name = OemName(caps.wMid, caps.wPid);
    if (device.Name.Length == 0) device.Name = caps.szPname ?? "";
   }
   if (device.Name.Length == 0) device.Name = "Joystick " + (id + 1);
   return device;
  }
  static void Log(string text) { Write("{\"event\":\"log\",\"message\":" + Quote(text) + "}"); }
  static void LogDevices() {
   int found = 0;
   for (int id = 0; id < MAX_JOYSTICKS; id++) {
    var d = Probe(id);
    if (d == null) continue;
    found++;
    Log(String.Format("joystick id={0} vid={1:X4} pid={2:X4} buttons={3} name={4}", id, d.Mid, d.Pid, d.ButtonCount, d.Name));
   }
   Log("joysticks found=" + found);
  }
  static bool ReadButtons(int id, out int buttons) {
   var info = new JOYINFOEX { dwSize = Marshal.SizeOf(typeof(JOYINFOEX)), dwFlags = JOY_RETURNBUTTONS };
   buttons = 0;
   if (joyGetPosEx(id, ref info) != 0) return false;
   buttons = info.dwButtons; return true;
  }
  static bool KeyDown(int vk) { return (GetAsyncKeyState(vk) & 0x8000) != 0; }
  // Mouse buttons are excluded so a click in the app cannot become the binding.
  static bool LearnableKey(int vk) { return vk >= 0x08 && vk <= 0xFE && vk != 0x0A && vk != 0x0B; }

  // Locate the bound stick by vendor/product first: winmm ids can move after replugging.
  static int Locate(ushort mid, ushort pid, int fallback) {
   for (int id = 0; id < MAX_JOYSTICKS; id++) {
    var d = Probe(id);
    if (d != null && (mid != 0 || pid != 0) && d.Mid == mid && d.Pid == pid) return id;
   }
   if (fallback >= 0 && fallback < MAX_JOYSTICKS) {
    var d = Probe(fallback);
    if (d != null && ((mid == 0 && pid == 0) || (d.Mid == mid && d.Pid == pid))) return fallback;
   }
   return -1;
  }

  static void Learn(string current) {
   Log("learn start");
   LogDevices();
   var baseline = new Dictionary<int, int>();
   for (int id = 0; id < MAX_JOYSTICKS; id++) { var d = Probe(id); if (d != null) baseline[id] = d.Buttons; }
   var keys = new bool[256];
   for (int vk = 0; vk < 256; vk++) keys[vk] = LearnableKey(vk) && KeyDown(vk);
   DateTime deadline = DateTime.UtcNow.AddSeconds(15), rescan = DateTime.UtcNow.AddSeconds(2);
   while (command == current && !inputClosed) {
    if (DateTime.UtcNow > deadline) { Write("{\"event\":\"learn\",\"ok\":false,\"error\":\"timeout\"}"); command = "idle"; return; }
    foreach (var id in new List<int>(baseline.Keys)) {
     int buttons;
     if (!ReadButtons(id, out buttons)) { baseline.Remove(id); continue; }
     int pressed = buttons & ~baseline[id];
     baseline[id] = buttons;
     for (int bit = 0; bit < 32; bit++) {
      if ((pressed & (1 << bit)) == 0) continue;
      var d = Probe(id);
      Write("{\"event\":\"learn\",\"ok\":true,\"binding\":{\"type\":\"joystick\",\"device\":" + id + ",\"mid\":" + (d == null ? 0 : d.Mid) +
        ",\"pid\":" + (d == null ? 0 : d.Pid) + ",\"button\":" + bit + ",\"name\":" + Quote(d == null ? "Joystick" : d.Name) + "}}");
      command = "idle"; return;
     }
    }
    for (int vk = 0; vk < 256; vk++) {
     if (!LearnableKey(vk)) continue;
     bool down = KeyDown(vk);
     if (down && !keys[vk]) {
      Write("{\"event\":\"learn\",\"ok\":true,\"binding\":{\"type\":\"key\",\"vk\":" + vk + "}}");
      command = "idle"; return;
     }
     keys[vk] = down;
    }
    if (DateTime.UtcNow > rescan) {
     for (int id = 0; id < MAX_JOYSTICKS; id++) if (!baseline.ContainsKey(id)) { var d = Probe(id); if (d != null) baseline[id] = d.Buttons; }
     rescan = DateTime.UtcNow.AddSeconds(2);
    }
    Thread.Sleep(15);
   }
  }

  static void Watch(string current) {
   // watch joy <mid> <pid> <device> <button> | watch key <vk>
   string[] p = current.Substring(0, current.LastIndexOf(" #")).Split(' ');
   bool joystick = p.Length == 6 && p[1] == "joy", key = p.Length == 3 && p[1] == "key";
   if (!joystick && !key) { Write("{\"event\":\"error\",\"error\":\"binding_invalid\"}"); command = "idle"; return; }
   ushort mid = 0, pid = 0; int fallback = -1, button = 0, vk = 0;
   try {
    if (joystick) { mid = UInt16.Parse(p[2]); pid = UInt16.Parse(p[3]); fallback = Int32.Parse(p[4]); button = Int32.Parse(p[5]); }
    else vk = Int32.Parse(p[2]);
   } catch (Exception) { Write("{\"event\":\"error\",\"error\":\"binding_invalid\"}"); command = "idle"; return; }
   if (button < 0 || button > 31 || (key && !LearnableKey(vk))) { Write("{\"event\":\"error\",\"error\":\"binding_invalid\"}"); command = "idle"; return; }
   int id = joystick ? Locate(mid, pid, fallback) : -1;
   if (joystick) Log(String.Format("watch joystick vid={0:X4} pid={1:X4} storedId={2} button={3} locatedId={4}", mid, pid, fallback, button + 1, id));
   else Log("watch key vk=" + vk);
   if (joystick && id < 0) LogDevices();
   bool connected = !joystick || id >= 0, down = false;
   Write("{\"event\":\"device\",\"connected\":" + (connected ? "true" : "false") + "}");
   DateTime retry = DateTime.UtcNow.AddSeconds(3);
   while (command == current && !inputClosed) {
    bool now = false;
    if (key) now = KeyDown(vk);
    else if (id >= 0) {
     int buttons;
     if (ReadButtons(id, out buttons)) now = (buttons & (1 << button)) != 0;
     else { Log("joystick read failed id=" + id); id = -1; connected = false; Write("{\"event\":\"device\",\"connected\":false}"); }
    } else if (DateTime.UtcNow > retry) {
     // Probing unplugged winmm ids is slow; keep it rare.
     id = Locate(mid, pid, fallback); retry = DateTime.UtcNow.AddSeconds(3);
     if (id >= 0) { Log("joystick reconnected id=" + id); connected = true; Write("{\"event\":\"device\",\"connected\":true}"); }
    }
    if (now != down) { down = now; Write("{\"event\":\"" + (down ? "down" : "up") + "\"}"); }
    Thread.Sleep(10);
   }
   if (down) Write("{\"event\":\"up\"}");
  }

  public static void Run() {
   var reader = new Thread(() => {
    try {
     string line;
     while ((line = Console.In.ReadLine()) != null) {
      line = line.Trim();
      if (line == "learn" || line == "idle" || line.StartsWith("watch ")) command = line + " #" + Environment.TickCount;
     }
    } catch (Exception) { }
    inputClosed = true;
   });
   reader.IsBackground = true; reader.Start();
   Write("{\"event\":\"ready\",\"clr\":" + Quote(Environment.Version.ToString()) + ",\"os\":" + Quote(Environment.OSVersion.VersionString) + "}");
   while (!inputClosed) {
    string current = command;
    string verb = current.Split(' ')[0];
    try {
     if (verb == "learn") Learn(current);
     else if (verb == "watch") Watch(current);
     else Thread.Sleep(50);
    } catch (Exception error) {
     Write("{\"event\":\"error\",\"error\":" + Quote(error.GetType().Name + ": " + error.Message) + "}");
     Thread.Sleep(500);
    }
    if (verb != "idle" && command == current) command = "idle";
   }
  }
 }
}
