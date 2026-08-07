import {
  App,
  AppBootMode,
  AppInstallProps,
  AppSuspendMode,
  AppView,
  AppViewProps,
  Efb,
  RequiredProps,
  TVNode
} from '@efb/efb-api';
import { FSComponent, VNode } from '@microsoft/msfs-sdk';

import './VfrMultitool.scss';

declare const BASE_URL: string;
declare const EFB_APP_VERSION: string;
declare const TRACKER_API_URL: string;

type TrackerStatusPayload = {
  trackerVersion?: string;
  runtimeChannel?: string;
  relayConnected?: boolean;
  simulatorConnected?: boolean;
  telemetryAvailable?: boolean;
};

type FlightSnapshotPayload = {
  available?: boolean;
  capturedAt?: number;
  lat?: number;
  lon?: number;
  alt?: number;
  hdg?: number;
  flight?: { gsKts?: number; iasKts?: number; onGround?: boolean };
};

function payloadOf<T>(value: unknown, expectedType: string): T | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as { hello?: unknown; message?: { schema?: string; schemaVersion?: number; type?: string; payload?: T } };
  const hello = envelope.hello as { schema?: string; schemaVersion?: number; type?: string; payload?: { capabilities?: string[] } } | undefined;
  if (hello?.schema !== 'ga.tracker-efb' || hello.schemaVersion !== 1 || hello.type !== 'protocol.hello') return null;
  if (!Array.isArray(hello.payload?.capabilities)) return null;
  if (envelope.message?.schema !== 'ga.tracker-efb' || envelope.message.schemaVersion !== 1 || envelope.message.type !== expectedType) return null;
  return envelope.message.payload || null;
}

class VfrMultitoolView extends AppView<RequiredProps<AppViewProps, 'bus'>> {
  private connectionRef = FSComponent.createRef<HTMLSpanElement>();
  private trackerRef = FSComponent.createRef<HTMLSpanElement>();
  private relayRef = FSComponent.createRef<HTMLSpanElement>();
  private simulatorRef = FSComponent.createRef<HTMLSpanElement>();
  private positionRef = FSComponent.createRef<HTMLParagraphElement>();
  private flightRef = FSComponent.createRef<HTMLParagraphElement>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  public onOpen(): void { this.startPolling(); }
  public onResume(): void { this.startPolling(); }
  public onPause(): void { this.stopPolling(); }
  public onClose(): void { this.stopPolling(); }

  private startPolling(): void {
    if (this.active) return;
    this.active = true;
    void this.poll();
  }

  private stopPolling(): void {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private setConnection(text: string, state: 'online' | 'error' | ''): void {
    const node = this.connectionRef.getOrDefault();
    if (!node) return;
    node.textContent = text;
    node.className = `badge ${state}`.trim();
  }

  private setText(node: HTMLElement | null, text: string): void {
    if (node) node.textContent = text;
  }

  private async poll(): Promise<void> {
    try {
      const [statusResponse, snapshotResponse] = await Promise.all([
        fetch(`${TRACKER_API_URL}/api/v1/status`, { cache: 'no-store' }),
        fetch(`${TRACKER_API_URL}/api/v1/snapshot`, { cache: 'no-store' })
      ]);
      if (!this.active) return;
      if (!statusResponse.ok || !snapshotResponse.ok) throw new Error('tracker_unavailable');
      const status = payloadOf<TrackerStatusPayload>(await statusResponse.json(), 'tracker.status');
      const snapshot = payloadOf<FlightSnapshotPayload>(await snapshotResponse.json(), 'flight.snapshot');
      if (!status || !snapshot) throw new Error('protocol_mismatch');

      this.setConnection('Tracker verbunden', 'online');
      this.setText(this.trackerRef.getOrDefault(), `${status.trackerVersion || '–'} · ${status.runtimeChannel || '–'}`);
      this.setText(this.relayRef.getOrDefault(), status.relayConnected ? 'Verbunden' : 'Wartet');
      this.setText(this.simulatorRef.getOrDefault(), status.simulatorConnected ? 'Verbunden' : 'Nicht verbunden');
      if (snapshot.available && Number.isFinite(snapshot.lat) && Number.isFinite(snapshot.lon)) {
        this.setText(this.positionRef.getOrDefault(), `${Number(snapshot.lat).toFixed(5)}, ${Number(snapshot.lon).toFixed(5)} · ${Math.round(Number(snapshot.alt) || 0)} ft · ${Math.round(Number(snapshot.hdg) || 0)}°`);
        this.setText(this.flightRef.getOrDefault(), `GS ${Math.round(Number(snapshot.flight?.gsKts) || 0)} kt · IAS ${Math.round(Number(snapshot.flight?.iasKts) || 0)} kt · ${snapshot.flight?.onGround ? 'Am Boden' : 'In der Luft'}`);
      } else {
        this.setText(this.positionRef.getOrDefault(), 'Warte auf Positionsdaten aus dem Simulator.');
        this.setText(this.flightRef.getOrDefault(), '');
      }
    } catch (_) {
      if (!this.active) return;
      this.setConnection('Tracker nicht erreichbar', 'error');
      this.setText(this.trackerRef.getOrDefault(), '–');
      this.setText(this.relayRef.getOrDefault(), '–');
      this.setText(this.simulatorRef.getOrDefault(), '–');
      this.setText(this.positionRef.getOrDefault(), 'Bitte den VFR Multitool Tracker in einer EFB-kompatiblen Version starten.');
      this.setText(this.flightRef.getOrDefault(), '');
    }
    if (this.active) this.timer = setTimeout(() => void this.poll(), 1000);
  }

  public render(): VNode {
    return (
      <div class="vfr-multitool-app">
        <div class="hero">
          <div>
            <h1>VFR Multitool</h1>
            <span class="version">EFB v{EFB_APP_VERSION}</span>
          </div>
          <span ref={this.connectionRef} class="badge">Warte auf Tracker</span>
        </div>
        <section class="card status-grid">
          <div><span class="label">Tracker</span><span ref={this.trackerRef} class="value">–</span></div>
          <div><span class="label">Relay</span><span ref={this.relayRef} class="value">–</span></div>
          <div><span class="label">Simulator</span><span ref={this.simulatorRef} class="value">–</span></div>
          <div><span class="label">Modus</span><span class="value">Read-only</span></div>
        </section>
        <section class="card">
          <span class="label">Aktuelle Position</span>
          <p ref={this.positionRef} class="position">Warte auf Positionsdaten.</p>
          <p ref={this.flightRef} class="hint"></p>
        </section>
        <section class="card">
          <span class="label">Alpha-Stufe 1</span>
          <p class="hint">Diese erste Version liest nur Tracker-Status und Flugdaten. Missionsaktionen werden erst nach getrennten Capability- und Sicherheitstests freigeschaltet.</p>
        </section>
      </div>
    );
  }
}

class VfrMultitoolApp extends App {
  public get internalName(): string { return 'vfrmultitool'; }
  public get name(): string { return 'VFR Multitool'; }
  public get icon(): string { return `${BASE_URL}/Assets/app-icon.svg`; }
  public BootMode = AppBootMode.WARM;
  public SuspendMode = AppSuspendMode.SLEEP;

  public async install(_props: AppInstallProps): Promise<void> {
    await Efb.loadCss(`${BASE_URL}/VfrMultitool.css`);
  }

  public render(): TVNode<VfrMultitoolView> {
    return <VfrMultitoolView bus={this.bus} />;
  }
}

Efb.use(VfrMultitoolApp);
