using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Read-only peak metering of Windows audio sessions (the bars of the volume
// mixer) for the automatic radio hold. Only levels are read; no audio is
// captured, recorded or changed.
namespace GAInput {
 [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MeterEnumerator {}
 [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IMeterDevices {
  void EnumAudioEndpoints(int flow, uint state, out IMeterDeviceCollection devices);
 }
 [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IMeterDeviceCollection { void GetCount(out uint count); void Item(uint index, out IMeterDevice device); }
 [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IMeterDevice { void Activate(ref Guid iid, uint context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object result); }
 [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IMeterSessionManager {
  void GetAudioSessionControl(IntPtr guid, uint flags, out IntPtr control);
  void GetSimpleAudioVolume(IntPtr guid, uint flags, out IntPtr volume);
  void GetSessionEnumerator(out IMeterSessions sessions);
 }
 [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IMeterSessions { void GetCount(out int count); void GetSession(int index, [MarshalAs(UnmanagedType.IUnknown)] out object session); }
 [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IMeterControl {
  void GetState(out int state);
  void GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
  void SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, IntPtr context);
  void GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
  void SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, IntPtr context);
  void GetGroupingParam(out Guid group);
  void SetGroupingParam(ref Guid group, IntPtr context);
  void RegisterAudioSessionNotification(IntPtr client);
  void UnregisterAudioSessionNotification(IntPtr client);
  void GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
  void GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
  void GetProcessId(out uint pid);
 }
 [ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IMeterPeak { void GetPeakValue(out float peak); }

 public static class AudioMeter {
  sealed class Session { public object Raw; public IMeterPeak Peak; public string Name; }
  sealed class Rule { public string Name; public float Threshold; public int MinMs; public bool Active; public DateTime LoudSince = DateTime.MinValue, LastLoud = DateTime.MinValue, StartedAt; public float Max; }

  const int RELEASE_MS = 1500;
  static readonly object sync = new object();
  static volatile string request = "off #0";
  static Thread worker;

  // meter off | meter watch <rules> | meter list [<rules>]; rules: <name>:<threshold>:<minMs>;...
  public static void Command(string line) {
   request = line.Substring("meter ".Length).Trim() + " #" + Environment.TickCount;
   lock (sync) {
    if (worker != null) return;
    worker = new Thread(Loop); worker.IsBackground = true;
    worker.SetApartmentState(ApartmentState.MTA);
    worker.Start();
   }
  }

  static void Release(object o) { if (o != null && Marshal.IsComObject(o)) Marshal.ReleaseComObject(o); }
  static string Format(float value) { return value.ToString("0.000", CultureInfo.InvariantCulture); }

  static List<Session> Discover(Dictionary<uint, string> names) {
   var list = new List<Session>();
   object enumerator = null; IMeterDeviceCollection devices = null;
   try {
    enumerator = new MeterEnumerator(); ((IMeterDevices)enumerator).EnumAudioEndpoints(0, 1, out devices);
    uint count; devices.GetCount(out count);
    for (uint d = 0; d < count; d++) {
     IMeterDevice device = null; object manager = null; IMeterSessions sessions = null;
     try {
      devices.Item(d, out device); Guid iid = typeof(IMeterSessionManager).GUID;
      device.Activate(ref iid, 23, IntPtr.Zero, out manager);
      ((IMeterSessionManager)manager).GetSessionEnumerator(out sessions); int length; sessions.GetCount(out length);
      for (int i = 0; i < length; i++) {
       object raw = null;
       try {
        sessions.GetSession(i, out raw); uint pid; ((IMeterControl)raw).GetProcessId(out pid);
        if (pid == 0) { Release(raw); continue; }
        string name;
        if (!names.TryGetValue(pid, out name)) {
         try { using (Process p = Process.GetProcessById((int)pid)) name = p.ProcessName; } catch (Exception) { name = ""; }
         names[pid] = name;
        }
        if (name.Length == 0) { Release(raw); continue; }
        list.Add(new Session { Raw = raw, Peak = (IMeterPeak)raw, Name = name }); raw = null;
       } catch (Exception) { } finally { Release(raw); }
      }
     } catch (Exception) { } finally { Release(sessions); Release(manager); Release(device); }
    }
   } finally { Release(devices); Release(enumerator); }
   return list;
  }

  static List<Rule> ParseRules(string spec) {
   var rules = new List<Rule>();
   foreach (string part in spec.Split(';')) {
    string[] p = part.Split(':');
    if (p.Length != 3 || p[0].Trim().Length == 0) continue;
    float threshold; int minMs;
    if (!Single.TryParse(p[1], NumberStyles.Float, CultureInfo.InvariantCulture, out threshold) || !Int32.TryParse(p[2], out minMs)) continue;
    rules.Add(new Rule { Name = p[0].Trim(), Threshold = Math.Max(0.001f, Math.Min(1f, threshold)), MinMs = Math.Max(0, Math.Min(10000, minMs)) });
   }
   return rules;
  }

  static void Loop() {
   var names = new Dictionary<uint, string>();
   List<Session> sessions = new List<Session>();
   List<Rule> rules = new List<Rule>();
   string applied = "";
   DateTime rediscover = DateTime.MinValue, report = DateTime.MinValue;
   try {
    while (true) {
     string current = request;
     int marker = current.LastIndexOf(" #");
     string body = marker >= 0 ? current.Substring(0, marker) : current;
     if (current != applied) {
      foreach (var r in rules) if (r.Active) Helper.Write("{\"event\":\"audio\",\"name\":" + Helper.Quote(r.Name) + ",\"active\":false,\"peak\":0}");
      bool listing = body == "list" || body.StartsWith("list ");
      rules = body.StartsWith("watch ") ? ParseRules(body.Substring(6)) : body.StartsWith("list ") ? ParseRules(body.Substring(5)) : new List<Rule>();
      applied = current;
      Helper.Log("meter mode=" + (body == "off" ? "off" : (listing ? "list" : "watch") + " rules=" + rules.Count));
      rediscover = DateTime.MinValue;
     }
     if (body == "off") {
      foreach (var s in sessions) Release(s.Raw);
      sessions.Clear();
      Thread.Sleep(200); continue;
     }
     DateTime now = DateTime.UtcNow;
     if (now > rediscover) {
      foreach (var s in sessions) Release(s.Raw);
      try { sessions = Discover(names); } catch (Exception error) { sessions = new List<Session>(); Helper.Log("meter discover failed " + error.GetType().Name + ": " + error.Message); }
      if (names.Count > 512) names.Clear();
      rediscover = now.AddSeconds(2);
     }
     var peaks = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase);
     foreach (var s in sessions) {
      float peak = 0;
      try { s.Peak.GetPeakValue(out peak); } catch (Exception) { peak = 0; }
      float known;
      if (!peaks.TryGetValue(s.Name, out known) || peak > known) peaks[s.Name] = peak;
     }
     foreach (var r in rules) {
      float peak; if (!peaks.TryGetValue(r.Name, out peak)) peak = 0;
      if (peak >= r.Threshold) {
       if (r.LoudSince == DateTime.MinValue) r.LoudSince = now;
       r.LastLoud = now; if (peak > r.Max) r.Max = peak;
       if (!r.Active && (now - r.LoudSince).TotalMilliseconds >= r.MinMs) {
        r.Active = true; r.StartedAt = r.LoudSince;
        Helper.Write("{\"event\":\"audio\",\"name\":" + Helper.Quote(r.Name) + ",\"active\":true,\"peak\":" + Format(peak) + "}");
       }
      } else {
       // A short dip below the threshold does not end a loud phase that is still being confirmed.
       if (!r.Active && r.LoudSince != DateTime.MinValue && (now - r.LastLoud).TotalMilliseconds > 250) { r.LoudSince = DateTime.MinValue; r.Max = 0; }
       if (r.Active && (now - r.LastLoud).TotalMilliseconds >= RELEASE_MS) {
        r.Active = false;
        Helper.Write("{\"event\":\"audio\",\"name\":" + Helper.Quote(r.Name) + ",\"active\":false,\"peak\":" + Format(r.Max) + ",\"ms\":" + (int)(r.LastLoud - r.StartedAt).TotalMilliseconds + "}");
        r.LoudSince = DateTime.MinValue; r.Max = 0;
       }
      }
     }
     if (now > report) {
      // Live levels for the settings view (4 Hz): rules in watch mode, every session in list mode.
      var b = new StringBuilder("{\"event\":\"levels\",\"sessions\":[");
      bool first = true;
      foreach (var entry in peaks) {
       bool include = body == "list" || body.StartsWith("list ");
       foreach (var r in rules) if (String.Equals(r.Name, entry.Key, StringComparison.OrdinalIgnoreCase)) include = true;
       if (!include) continue;
       if (!first) b.Append(','); first = false;
       b.Append("{\"name\":").Append(Helper.Quote(entry.Key)).Append(",\"peak\":").Append(Format(entry.Value)).Append('}');
      }
      Helper.Write(b.Append("]}").ToString());
      report = now.AddMilliseconds(250);
     }
     Thread.Sleep(50);
    }
   } catch (Exception error) {
    Helper.Log("meter stopped " + error.GetType().Name + ": " + error.Message);
    lock (sync) worker = null;
   }
  }
 }
}
