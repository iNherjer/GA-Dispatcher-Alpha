param(
  [string]$Listen = "COM32",
  [int]$Baud = 921600,
  [string]$Forward = "",
  [int]$DurationSec = 120,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutDir = Join-Path $PSScriptRoot "thanos-sniff-$stamp"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$code = @"
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Ports;
using System.Linq;
using System.Text;
using System.Threading;
using System.Diagnostics;

public static class ThanosVirtualSniffer
{
    private static readonly object Gate = new object();
    private static SerialPort ListenPort;
    private static SerialPort ForwardPort;
    private static Stopwatch Clock;
    private static StreamWriter Csv;
    private static FileStream RawIn;
    private static FileStream RawOut;
    private static readonly List<double> IncomingDts = new List<double>();
    private static readonly List<int> IncomingLengths = new List<int>();
    private static long LastIncomingTicks = -1;
    private static long LastOutgoingTicks = -1;
    private static long IncomingBytes = 0;
    private static long OutgoingBytes = 0;
    private static int IncomingChunks = 0;
    private static int OutgoingChunks = 0;
    private static string OutputDir;

    public static void Run(string listenName, int baud, string forwardName, int durationSec, string outputDir)
    {
        OutputDir = outputDir;
        Clock = Stopwatch.StartNew();

        Csv = new StreamWriter(Path.Combine(outputDir, "chunks.csv"), false, new UTF8Encoding(false));
        Csv.WriteLine("elapsed_ms,dt_ms,direction,length,hex");
        RawIn = new FileStream(Path.Combine(outputDir, "to-controller.raw"), FileMode.Create, FileAccess.Write, FileShare.Read);
        RawOut = new FileStream(Path.Combine(outputDir, "from-controller.raw"), FileMode.Create, FileAccess.Write, FileShare.Read);

        ListenPort = CreatePort(listenName, baud);
        ListenPort.DataReceived += OnListenData;
        ListenPort.Open();

        if (!String.IsNullOrWhiteSpace(forwardName))
        {
            ForwardPort = CreatePort(forwardName, baud);
            ForwardPort.DataReceived += OnForwardData;
            ForwardPort.Open();
        }

        Console.WriteLine("Listening on " + listenName + " @ " + baud + " baud");
        if (ForwardPort != null) Console.WriteLine("Forwarding to real controller on " + forwardName);
        else Console.WriteLine("Sink mode: data is consumed but not forwarded to a real controller.");
        Console.WriteLine("Output: " + outputDir);
        Console.WriteLine("Running for " + durationSec + " seconds ...");

        long lastPrint = 0;
        while (Clock.Elapsed.TotalSeconds < durationSec)
        {
            Thread.Sleep(200);
            long nowMs = Clock.ElapsedMilliseconds;
            if (nowMs - lastPrint >= 5000)
            {
                lastPrint = nowMs;
                PrintLiveStats();
            }
        }

        Shutdown();
        WriteSummary(outputDir, listenName, baud, forwardName, durationSec);
    }

    private static SerialPort CreatePort(string name, int baud)
    {
        var port = new SerialPort(name, baud, Parity.None, 8, StopBits.One);
        port.Handshake = Handshake.None;
        port.DtrEnable = true;
        port.RtsEnable = true;
        port.ReadBufferSize = 1024 * 1024;
        port.WriteBufferSize = 1024 * 1024;
        port.ReadTimeout = 50;
        port.WriteTimeout = 50;
        return port;
    }

    private static void OnListenData(object sender, SerialDataReceivedEventArgs e)
    {
        try
        {
            while (ListenPort != null && ListenPort.IsOpen && ListenPort.BytesToRead > 0)
            {
                int n = Math.Min(ListenPort.BytesToRead, 65536);
                byte[] buffer = new byte[n];
                int read = ListenPort.Read(buffer, 0, n);
                if (read <= 0) return;
                if (read != buffer.Length) Array.Resize(ref buffer, read);
                LogChunk("to_controller", buffer, true);
                if (ForwardPort != null && ForwardPort.IsOpen)
                {
                    ForwardPort.Write(buffer, 0, buffer.Length);
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("[listen] " + ex.Message);
        }
    }

    private static void OnForwardData(object sender, SerialDataReceivedEventArgs e)
    {
        try
        {
            while (ForwardPort != null && ForwardPort.IsOpen && ForwardPort.BytesToRead > 0)
            {
                int n = Math.Min(ForwardPort.BytesToRead, 65536);
                byte[] buffer = new byte[n];
                int read = ForwardPort.Read(buffer, 0, n);
                if (read <= 0) return;
                if (read != buffer.Length) Array.Resize(ref buffer, read);
                LogChunk("from_controller", buffer, false);
                if (ListenPort != null && ListenPort.IsOpen)
                {
                    ListenPort.Write(buffer, 0, buffer.Length);
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("[forward] " + ex.Message);
        }
    }

    private static void LogChunk(string direction, byte[] data, bool incoming)
    {
        lock (Gate)
        {
            long nowTicks = Clock.ElapsedTicks;
            double elapsedMs = Clock.Elapsed.TotalMilliseconds;
            long lastTicks = incoming ? LastIncomingTicks : LastOutgoingTicks;
            double dtMs = lastTicks < 0 ? 0.0 : ((nowTicks - lastTicks) * 1000.0 / Stopwatch.Frequency);

            if (incoming)
            {
                LastIncomingTicks = nowTicks;
                IncomingDts.Add(dtMs);
                IncomingLengths.Add(data.Length);
                IncomingBytes += data.Length;
                IncomingChunks++;
                RawIn.Write(data, 0, data.Length);
            }
            else
            {
                LastOutgoingTicks = nowTicks;
                OutgoingBytes += data.Length;
                OutgoingChunks++;
                RawOut.Write(data, 0, data.Length);
            }

            Csv.Write(elapsedMs.ToString("F3", CultureInfo.InvariantCulture));
            Csv.Write(",");
            Csv.Write(dtMs.ToString("F3", CultureInfo.InvariantCulture));
            Csv.Write(",");
            Csv.Write(direction);
            Csv.Write(",");
            Csv.Write(data.Length.ToString(CultureInfo.InvariantCulture));
            Csv.Write(",");
            Csv.Write(BitConverter.ToString(data).Replace("-", " "));
            Csv.WriteLine();
        }
    }

    private static void PrintLiveStats()
    {
        List<double> dts;
        int chunks;
        long bytes;
        lock (Gate)
        {
            dts = IncomingDts.Where(v => v > 0).ToList();
            chunks = IncomingChunks;
            bytes = IncomingBytes;
        }
        if (dts.Count == 0)
        {
            Console.WriteLine("No incoming data yet.");
            return;
        }
        var st = CalcStats(dts);
        Console.WriteLine(String.Format(CultureInfo.InvariantCulture,
            "to_controller: chunks={0} bytes={1} avg={2:F3}ms p99={3:F3}ms max={4:F3}ms hz={5:F1}",
            chunks, bytes, st.Avg, st.P99, st.Max, 1000.0 / st.Avg));
    }

    private static void Shutdown()
    {
        try { if (ListenPort != null) ListenPort.Close(); } catch {}
        try { if (ForwardPort != null) ForwardPort.Close(); } catch {}
        lock (Gate)
        {
            try { Csv.Flush(); Csv.Close(); } catch {}
            try { RawIn.Flush(); RawIn.Close(); } catch {}
            try { RawOut.Flush(); RawOut.Close(); } catch {}
        }
    }

    private struct Stats
    {
        public double Avg, P50, P95, P99, Max, Min;
        public int Gt2, Gt5, Gt10, Gt20, Gt50;
    }

    private static Stats CalcStats(List<double> values)
    {
        var sorted = values.OrderBy(v => v).ToList();
        double avg = values.Average();
        return new Stats {
            Avg = avg,
            Min = sorted.First(),
            P50 = Percentile(sorted, 50),
            P95 = Percentile(sorted, 95),
            P99 = Percentile(sorted, 99),
            Max = sorted.Last(),
            Gt2 = values.Count(v => v > 2.5),
            Gt5 = values.Count(v => v > 5),
            Gt10 = values.Count(v => v > 10),
            Gt20 = values.Count(v => v > 20),
            Gt50 = values.Count(v => v > 50)
        };
    }

    private static double Percentile(List<double> sorted, double p)
    {
        if (sorted.Count == 0) return 0;
        int idx = (int)Math.Ceiling((p / 100.0) * sorted.Count) - 1;
        idx = Math.Max(0, Math.Min(sorted.Count - 1, idx));
        return sorted[idx];
    }

    private static void WriteSummary(string outputDir, string listenName, int baud, string forwardName, int durationSec)
    {
        List<double> dts;
        List<int> lengths;
        lock (Gate)
        {
            dts = IncomingDts.Where(v => v > 0).ToList();
            lengths = new List<int>(IncomingLengths);
        }

        using (var w = new StreamWriter(Path.Combine(outputDir, "summary.txt"), false, new UTF8Encoding(false)))
        {
            w.WriteLine("THANOS VIRTUAL SNIFFER SUMMARY");
            w.WriteLine("==============================");
            w.WriteLine("Listen       : " + listenName);
            w.WriteLine("Forward      : " + (String.IsNullOrWhiteSpace(forwardName) ? "(none / sink mode)" : forwardName));
            w.WriteLine("Baud         : " + baud);
            w.WriteLine("Duration sec : " + durationSec);
            w.WriteLine("Incoming bytes  : " + IncomingBytes);
            w.WriteLine("Incoming chunks : " + IncomingChunks);
            w.WriteLine("Outgoing bytes  : " + OutgoingBytes);
            w.WriteLine("Outgoing chunks : " + OutgoingChunks);
            w.WriteLine("");

            if (dts.Count > 0)
            {
                var st = CalcStats(dts);
                w.WriteLine("Incoming chunk interval statistics");
                w.WriteLine("----------------------------------");
                w.WriteLine("avg ms : " + st.Avg.ToString("F3", CultureInfo.InvariantCulture));
                w.WriteLine("hz     : " + (1000.0 / st.Avg).ToString("F2", CultureInfo.InvariantCulture));
                w.WriteLine("min ms : " + st.Min.ToString("F3", CultureInfo.InvariantCulture));
                w.WriteLine("p50 ms : " + st.P50.ToString("F3", CultureInfo.InvariantCulture));
                w.WriteLine("p95 ms : " + st.P95.ToString("F3", CultureInfo.InvariantCulture));
                w.WriteLine("p99 ms : " + st.P99.ToString("F3", CultureInfo.InvariantCulture));
                w.WriteLine("max ms : " + st.Max.ToString("F3", CultureInfo.InvariantCulture));
                w.WriteLine(">2.5ms : " + st.Gt2);
                w.WriteLine(">5ms   : " + st.Gt5);
                w.WriteLine(">10ms  : " + st.Gt10);
                w.WriteLine(">20ms  : " + st.Gt20);
                w.WriteLine(">50ms  : " + st.Gt50);
                w.WriteLine("");
            }

            if (lengths.Count > 0)
            {
                w.WriteLine("Most common chunk lengths");
                w.WriteLine("-------------------------");
                foreach (var kv in lengths.GroupBy(v => v).OrderByDescending(g => g.Count()).Take(12))
                {
                    w.WriteLine(kv.Key + " bytes : " + kv.Count());
                }
            }

            w.WriteLine("");
            w.WriteLine("Files");
            w.WriteLine("-----");
            w.WriteLine("chunks.csv          raw timestamped chunks");
            w.WriteLine("to-controller.raw   exact bytes from DRSM toward controller");
            w.WriteLine("from-controller.raw exact bytes from controller, proxy mode only");
        }

        Console.WriteLine("Done. Summary: " + Path.Combine(outputDir, "summary.txt"));
    }
}
"@

Add-Type -TypeDefinition $code

[ThanosVirtualSniffer]::Run($Listen, $Baud, $Forward, $DurationSec, $OutDir)

Write-Host ""
Write-Host "Fertig. Ausgabeordner:"
Write-Host $OutDir
Write-Host ""
Write-Host "ENTER druecken zum Schliessen ..."
[Console]::ReadLine() | Out-Null
