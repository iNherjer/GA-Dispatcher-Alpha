using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

// Core Audio application-session volume, never endpoint/system master volume.
namespace GAMedia {
 [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class Enumerator {}
 [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IDevices {
  void EnumAudioEndpoints(int flow, uint state, out IDeviceCollection devices);
  void GetDefaultAudioEndpoint(int flow, int role, out IDevice device);
 }
 [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-C0A2B7EAAEC8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IDeviceCollection { void GetCount(out uint count); void Item(uint index, out IDevice device); }
 [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IDevice { void Activate(ref Guid iid, uint context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object result); }
 [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IManager {
  void GetAudioSessionControl(IntPtr guid, uint flags, out IntPtr control);
  void GetSimpleAudioVolume(IntPtr guid, uint flags, out IntPtr volume);
  void GetSessionEnumerator(out ISessions sessions);
 }
 [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface ISessions { void GetCount(out int count); void GetSession(int index, [MarshalAs(UnmanagedType.IUnknown)] out object session); }
 [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IControl {
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
 [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IVolume {
  void SetMasterVolume(float volume, ref Guid context);
  void GetMasterVolume(out float volume);
  void SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid context);
  void GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
 }
 public sealed class SessionVolume : IDisposable {
  sealed class Entry { public object Control; public IVolume Volume; public float Base, Last; }
  readonly Dictionary<string, Entry> entries = new Dictionary<string, Entry>();
  readonly Guid context = Guid.NewGuid();
  string processName = "";
  public bool Available { get { return entries.Count > 0; } }
  public float Volume { get { foreach (Entry e in entries.Values) return e.Base; return 0; } }
  static void Release(object o) { if (o != null && Marshal.IsComObject(o)) Marshal.ReleaseComObject(o); }
  public void Select(string name) { Restore(); processName = name ?? ""; }
  public void Tick(float factor, float requested) {
   Discover();
   foreach (Entry e in entries.Values) {
    try {
     float actual; e.Volume.GetMasterVolume(out actual);
     // Respect external mixer changes as a new user volume, including during ducking.
     if (Math.Abs(actual - e.Last) > 0.002f) e.Base = actual;
     if (requested >= 0) e.Base = requested;
     float target = e.Base * factor;
     // Fast attenuation; smooth return (~0.8 seconds from full attenuation).
     float value = target < actual ? target : Math.Min(target, actual + Math.Max(0.001f, e.Base * 0.125f));
     if (Math.Abs(value - actual) > 0.0001f) { Guid c = context; e.Volume.SetMasterVolume(value, ref c); }
     e.Last = value;
    } catch (COMException) { }
   }
  }
  void Discover() {
   if (processName.Length == 0) return;
   object enumerator = null; IDeviceCollection devices = null;
   var seen = new HashSet<string>();
   try {
    enumerator = new Enumerator(); ((IDevices)enumerator).EnumAudioEndpoints(0, 1, out devices);
    uint count; devices.GetCount(out count);
    for (uint d = 0; d < count; d++) {
     IDevice device = null; object manager = null; ISessions sessions = null;
     try {
      devices.Item(d, out device); Guid iid = typeof(IManager).GUID;
      device.Activate(ref iid, 23, IntPtr.Zero, out manager);
      ((IManager)manager).GetSessionEnumerator(out sessions); int length; sessions.GetCount(out length);
      for (int i = 0; i < length; i++) {
       object raw = null;
       try {
        sessions.GetSession(i, out raw); IControl control = (IControl)raw; uint pid; control.GetProcessId(out pid);
        string name;
        using (Process p = Process.GetProcessById((int)pid)) name = p.ProcessName;
        if (!String.Equals(name, processName, StringComparison.OrdinalIgnoreCase)) continue;
        string id; control.GetSessionInstanceIdentifier(out id); seen.Add(id);
        if (entries.ContainsKey(id)) continue;
        IVolume volume = (IVolume)control; float original; volume.GetMasterVolume(out original);
        entries.Add(id, new Entry { Control = control, Volume = volume, Base = original, Last = original });
        raw = null;
       } catch (Exception) { } finally { Release(raw); }
      }
     } finally { Release(sessions); Release(manager); Release(device); }
    }
   } finally { Release(devices); Release(enumerator); }
   var removed = new List<string>();
   foreach (string id in entries.Keys) if (!seen.Contains(id)) removed.Add(id);
   foreach (string id in removed) { RestoreEntry(entries[id]); Release(entries[id].Control); entries.Remove(id); }
  }
  void RestoreEntry(Entry e) {
   try {
    float actual; e.Volume.GetMasterVolume(out actual);
    if (Math.Abs(actual - e.Last) <= 0.002f) { Guid c = context; e.Volume.SetMasterVolume(e.Base, ref c); }
   } catch (COMException) { }
  }
  public void Restore() {
   foreach (Entry e in entries.Values) {
    try { RestoreEntry(e); } finally { Release(e.Control); }
   }
   entries.Clear();
  }
  public void Dispose() { Restore(); }
 }
}
