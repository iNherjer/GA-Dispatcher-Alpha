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

// Leaflet liegt bereits versioniert im Hauptprojekt und wird vom EFB-Build
// direkt gebuendelt. Die UMD-Datei besitzt absichtlich keine separaten TS-Typen.
// @ts-ignore
import LeafletImport from '../../../../../vendor/leaflet/leaflet.js';
import '../../../../../vendor/leaflet/leaflet.css';
// @ts-ignore
import MapShellCoreImport from '../../../map-shell-core.js';

import './VfrMultitool.scss';

declare const BASE_URL: string;
declare const EFB_APP_VERSION: string;
declare const TRACKER_API_URL: string;

const L: any = LeafletImport;
const MapShellCore: any = MapShellCoreImport;
const MAP_PREFERENCES_KEY = 'ga_efb_map_preferences_v1';

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

type NormalizedFlightSnapshot = {
  lat: number;
  lon: number;
  altFt: number;
  headingDeg: number;
  gsKts: number;
  iasKts: number;
  onGround: boolean;
  capturedAt: number;
};

type MissionSnapshotPayload = {
  available?: boolean;
  missionId?: string;
  state?: string;
  active?: boolean;
  phase?: string | null;
  sceneCount?: number;
};

type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevationFt: number | null;
  kind: string;
  required: boolean;
};

type TrackerMapSnapshot = {
  schema: string;
  version: number;
  missionId: string;
  runId: string;
  revision: number;
  route: { totalDistanceNm: number; waypoints: MapPoint[] };
  navigation: null | {
    activeLegIndex: number;
    nextWaypointId: string;
    nextWaypointName: string;
    bearingToNextDeg: number;
    distanceToNextNm: number;
    crossTrackNm: number;
    routeDistanceNm: number;
    remainingDistanceNm: number;
    progress: number;
  };
  profile: null | {
    mode: string;
    terrainAvailable: boolean;
    totalDistanceNm: number;
    cruiseAltitudeFt: number;
    points: Array<{
      waypointId: string;
      name: string;
      distanceNm: number;
      terrainFt: number | null;
      plannedAltFt: number;
    }>;
  };
  missionGeometry: { target: MapPoint | null; poiChain: MapPoint[] };
};

type MapPreferences = {
  baseLayer: string;
  overlays: string[];
  follow: boolean;
  theme: string;
  toolbarCollapsed: boolean;
  profileVisible: boolean;
};

function payloadOf<T>(value: unknown, expectedType: string, requiredCapability?: string): T | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as { hello?: unknown; message?: { schema?: string; schemaVersion?: number; type?: string; payload?: T } };
  const hello = envelope.hello as { schema?: string; schemaVersion?: number; type?: string; payload?: { capabilities?: string[] } } | undefined;
  if (hello?.schema !== 'ga.tracker-efb' || hello.schemaVersion !== 1 || hello.type !== 'protocol.hello') return null;
  if (!Array.isArray(hello.payload?.capabilities)) return null;
  if (requiredCapability && !hello.payload.capabilities.includes(requiredCapability)) return null;
  if (envelope.message?.schema !== 'ga.tracker-efb' || envelope.message.schemaVersion !== 1 || envelope.message.type !== expectedType) return null;
  return envelope.message.payload || null;
}

class VfrMultitoolView extends AppView<RequiredProps<AppViewProps, 'bus'>> {
  private appRootRef = FSComponent.createRef<HTMLDivElement>();
  private topbarRef = FSComponent.createRef<HTMLElement>();
  private toolbarToggleRef = FSComponent.createRef<HTMLButtonElement>();
  private connectionRef = FSComponent.createRef<HTMLSpanElement>();
  private trackerRef = FSComponent.createRef<HTMLSpanElement>();
  private relayRef = FSComponent.createRef<HTMLSpanElement>();
  private simulatorRef = FSComponent.createRef<HTMLSpanElement>();
  private positionRef = FSComponent.createRef<HTMLParagraphElement>();
  private flightRef = FSComponent.createRef<HTMLParagraphElement>();
  private missionRef = FSComponent.createRef<HTMLParagraphElement>();
  private missionPhaseRef = FSComponent.createRef<HTMLParagraphElement>();
  private missionScenesRef = FSComponent.createRef<HTMLParagraphElement>();

  private mapScreenRef = FSComponent.createRef<HTMLDivElement>();
  private mapControlsRef = FSComponent.createRef<HTMLDivElement>();
  private statusScreenRef = FSComponent.createRef<HTMLDivElement>();
  private mapTabRef = FSComponent.createRef<HTMLButtonElement>();
  private statusTabRef = FSComponent.createRef<HTMLButtonElement>();
  private mapCanvasRef = FSComponent.createRef<HTMLDivElement>();
  private layerDrawerRef = FSComponent.createRef<HTMLElement>();
  private layerButtonRef = FSComponent.createRef<HTMLButtonElement>();
  private layerStatusRef = FSComponent.createRef<HTMLParagraphElement>();
  private followButtonRef = FSComponent.createRef<HTMLButtonElement>();
  private profileButtonRef = FSComponent.createRef<HTMLButtonElement>();
  private themeButtonRef = FSComponent.createRef<HTMLButtonElement>();
  private toolsButtonRef = FSComponent.createRef<HTMLButtonElement>();
  private themeDrawerRef = FSComponent.createRef<HTMLElement>();
  private toolsDrawerRef = FSComponent.createRef<HTMLElement>();
  private profileBandRef = FSComponent.createRef<HTMLElement>();
  private profileSvgRef = FSComponent.createRef<SVGSVGElement>();
  private profileStatusRef = FSComponent.createRef<HTMLSpanElement>();
  private compassRef = FSComponent.createRef<HTMLElement>();
  private compassRoseRef = FSComponent.createRef<SVGGElement>();
  private compassHeadingRef = FSComponent.createRef<HTMLSpanElement>();
  private compassBearingRef = FSComponent.createRef<HTMLSpanElement>();
  private toolPanelRef = FSComponent.createRef<HTMLElement>();
  private toolTitleRef = FSComponent.createRef<HTMLElement>();
  private clockPanelRef = FSComponent.createRef<HTMLDivElement>();
  private clockUtcRef = FSComponent.createRef<HTMLTimeElement>();
  private clockLocalRef = FSComponent.createRef<HTMLTimeElement>();
  private stopwatchRef = FSComponent.createRef<HTMLTimeElement>();
  private stopwatchToggleRef = FSComponent.createRef<HTMLButtonElement>();
  private stopwatchMinuteHandRef = FSComponent.createRef<HTMLDivElement>();
  private stopwatchSecondHandRef = FSComponent.createRef<HTMLDivElement>();
  private stopwatchTenthHandRef = FSComponent.createRef<HTMLDivElement>();
  private calculatorPanelRef = FSComponent.createRef<HTMLDivElement>();
  private calculatorExpressionRef = FSComponent.createRef<HTMLDivElement>();
  private calculatorResultRef = FSComponent.createRef<HTMLDivElement>();
  private e6bPanelRef = FSComponent.createRef<HTMLDivElement>();
  private e6bFrameRef = FSComponent.createRef<HTMLIFrameElement>();
  private mapNoticeRef = FSComponent.createRef<HTMLDivElement>();
  private mapPositionRef = FSComponent.createRef<HTMLParagraphElement>();
  private mapFlightRef = FSComponent.createRef<HTMLParagraphElement>();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private mapInitTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private rendered = false;
  private screen: 'map' | 'status' = 'map';
  private map: any | null = null;
  private planeMarker: any | null = null;
  private routeLayer: any | null = null;
  private missionGeometryLayer: any | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeBound = false;
  private hasCenteredOnAircraft = false;
  private currentBaseLayerId = '';
  private baseLayers = new Map<string, any>();
  private overlayLayers = new Map<string, any>();
  private lastFlight: NormalizedFlightSnapshot | null = null;
  private lastMapSnapshot: TrackerMapSnapshot | null = null;
  private lastMapRevision = 0;
  private missionDisplayState: any = {};
  private tileErrorCount = 0;
  private mapLayoutRetryCount = 0;
  private preferences: MapPreferences = MapShellCore.normalizePreferences();
  private activeTool: 'clock' | 'calculator' | 'e6b' | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private stopwatchRunning = false;
  private stopwatchStartedAt = 0;
  private stopwatchElapsedMs = 0;
  private calculatorExpression = '';

  private readonly onWindowResize = (): void => {
    if (this.screen !== 'map') return;
    this.map?.invalidateSize({ pan: false });
    this.syncE6bFrameSize();
  };

  private readonly onWindowMessage = (event: MessageEvent): void => {
    if (event?.data?.type === 'ga-e6b-close') this.closeToolPanel();
  };

  public onOpen(): void { this.activate(); }
  public onResume(): void { this.activate(); }
  public onPause(): void { this.deactivate(false); }
  public onClose(): void { this.deactivate(true); }
  public onAfterRender(node: VNode): void {
    super.onAfterRender(node);
    this.rendered = true;
    this.bindDomInteractions();
    this.applyPreferencesToChrome();
    if (this.active) this.scheduleMapInitialization();
  }

  private bindButton(button: HTMLButtonElement | null, callback: () => void): void {
    if (!button) return;
    button.onclick = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      callback();
    };
  }

  private bindDomInteractions(): void {
    this.bindButton(this.mapTabRef.getOrDefault(), () => this.setScreen('map'));
    this.bindButton(this.statusTabRef.getOrDefault(), () => this.setScreen('status'));
    this.bindButton(this.toolbarToggleRef.getOrDefault(), () => this.setToolbarCollapsed(!this.preferences.toolbarCollapsed));
    this.bindButton(this.layerButtonRef.getOrDefault(), () => this.toggleLayerDrawer());
    this.bindButton(this.followButtonRef.getOrDefault(), () => this.setFollow(!this.preferences.follow, true));
    this.bindButton(this.profileButtonRef.getOrDefault(), () => this.setProfileVisible(!this.preferences.profileVisible));
    this.bindButton(this.themeButtonRef.getOrDefault(), () => this.toggleDrawer('theme'));
    this.bindButton(this.toolsButtonRef.getOrDefault(), () => this.toggleDrawer('tools'));

    const themeDrawer = this.themeDrawerRef.getOrDefault();
    this.bindButton(themeDrawer?.querySelector<HTMLButtonElement>('[data-theme-close]') || null, () => this.closeDrawers());
    themeDrawer?.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((button) => {
      this.bindButton(button, () => this.setTheme(String(button.dataset.theme || 'classic')));
    });

    const toolsDrawer = this.toolsDrawerRef.getOrDefault();
    this.bindButton(toolsDrawer?.querySelector<HTMLButtonElement>('[data-tools-close]') || null, () => this.closeDrawers());
    toolsDrawer?.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
      this.bindButton(button, () => this.openTool(String(button.dataset.tool || '')));
    });

    const toolPanel = this.toolPanelRef.getOrDefault();
    this.bindButton(toolPanel?.querySelector<HTMLButtonElement>('[data-tool-close]') || null, () => this.closeToolPanel());
    this.bindButton(this.stopwatchToggleRef.getOrDefault(), () => this.toggleStopwatch());
    this.bindButton(this.clockPanelRef.getOrDefault()?.querySelector<HTMLButtonElement>('[data-stopwatch-reset]') || null, () => this.resetStopwatch());
    this.calculatorPanelRef.getOrDefault()?.querySelectorAll<HTMLButtonElement>('[data-calc]').forEach((button) => {
      this.bindButton(button, () => this.handleCalculatorKey(String(button.dataset.calc || '')));
    });
    const e6bFrame = this.e6bFrameRef.getOrDefault();
    if (e6bFrame) e6bFrame.onload = (): void => this.syncE6bFrameSize();

    const drawer = this.layerDrawerRef.getOrDefault();
    if (!drawer) return;
    this.bindButton(drawer.querySelector<HTMLButtonElement>('[data-layer-close]'), () => this.closeLayerDrawer());
    drawer.querySelectorAll<HTMLButtonElement>('[data-base-layer]').forEach((button) => {
      this.bindButton(button, () => this.activateBaseLayer(String(button.dataset.baseLayer || '')));
    });
    drawer.querySelectorAll<HTMLButtonElement>('[data-overlay-layer]').forEach((button) => {
      this.bindButton(button, () => this.toggleOverlay(String(button.dataset.overlayLayer || '')));
    });
  }

  private activate(): void {
    this.preferences = this.readPreferences();
    this.applyPreferencesToChrome();
    this.startPolling();
    this.setScreen(this.screen);
    if (!this.resizeBound) {
      window.addEventListener('resize', this.onWindowResize);
      window.addEventListener('message', this.onWindowMessage);
      this.resizeBound = true;
    }
    this.startClock();
    this.scheduleMapInitialization();
  }

  private deactivate(removeMap: boolean): void {
    this.stopPolling();
    if (this.mapInitTimer) clearTimeout(this.mapInitTimer);
    this.mapInitTimer = null;
    if (this.resizeBound) {
      window.removeEventListener('resize', this.onWindowResize);
      window.removeEventListener('message', this.onWindowMessage);
      this.resizeBound = false;
    }
    this.stopClock();
    this.closeToolPanel();
    if (!removeMap) return;
    this.rendered = false;
    this.disposeMap();
  }

  private disposeMap(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    try { this.map?.remove(); } catch (_) {}
    this.map = null;
    this.planeMarker = null;
    this.routeLayer = null;
    this.missionGeometryLayer = null;
    this.baseLayers.clear();
    this.overlayLayers.clear();
    this.currentBaseLayerId = '';
    this.hasCenteredOnAircraft = false;
    this.mapLayoutRetryCount = 0;
  }

  private scheduleMapInitialization(delay = 0): void {
    if (!this.active || !this.rendered || this.screen !== 'map') return;
    if (this.mapInitTimer) clearTimeout(this.mapInitTimer);
    this.mapInitTimer = setTimeout(() => {
      this.mapInitTimer = null;
      if (this.map) {
        this.map.invalidateSize({ pan: false });
        if (this.preferences.follow && this.lastFlight) this.centerOnAircraft(false);
      } else {
        this.initializeMapSafely();
      }
    }, delay);
  }

  private initializeMapSafely(): void {
    if (!this.active || !this.rendered || this.screen !== 'map' || this.map) return;
    try {
      const host = this.mapCanvasRef.getOrDefault();
      if (!host) {
        this.scheduleMapInitialization(100);
        return;
      }
      const bounds = host.getBoundingClientRect();
      if (bounds.width < 2 || bounds.height < 2) {
        if (this.mapLayoutRetryCount === 0) {
          console.warn('[VFR Multitool EFB] Kartenflaeche wartet auf Layoutgroesse', {
            width: bounds.width,
            height: bounds.height
          });
        }
        this.mapLayoutRetryCount += 1;
        this.setLayerStatus('Kartenflaeche wird vorbereitet', '');
        this.setMapNotice('Kartenflaeche wird vorbereitet', '');
        this.scheduleMapInitialization(Math.min(1000, 100 + this.mapLayoutRetryCount * 50));
        return;
      }
      this.mapLayoutRetryCount = 0;
      this.ensureMap();
      if (!this.map) throw new Error('map_mount_missing');
      this.map.invalidateSize({ pan: false });
      if (this.preferences.follow && this.lastFlight) this.centerOnAircraft(false);
    } catch (error) {
      console.error('[VFR Multitool EFB] Karteninitialisierung fehlgeschlagen', error);
      this.disposeMap();
      this.setLayerStatus('Kartenmodul konnte nicht initialisiert werden', 'error');
      this.setMapNotice('Karte konnte nicht initialisiert werden | Details im EFB-Debugger', 'error');
    }
  }

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
    node.className = `connection-pill ${state}`.trim();
  }

  private setText(node: HTMLElement | null, text: string): void {
    if (node) node.textContent = text;
  }

  private setScreen(screen: 'map' | 'status'): void {
    this.screen = screen;
    this.mapScreenRef.getOrDefault()?.classList.toggle('is-hidden', screen !== 'map');
    this.mapControlsRef.getOrDefault()?.classList.toggle('is-hidden', screen !== 'map');
    this.statusScreenRef.getOrDefault()?.classList.toggle('is-hidden', screen !== 'status');
    this.mapTabRef.getOrDefault()?.classList.toggle('is-active', screen === 'map');
    this.statusTabRef.getOrDefault()?.classList.toggle('is-active', screen === 'status');
    this.closeLayerDrawer();
    this.closeDrawers();
    if (screen !== 'map') this.closeToolPanel();
    if (screen === 'map') this.scheduleMapInitialization();
  }

  private readPreferences(): MapPreferences {
    try {
      const raw = localStorage.getItem(MAP_PREFERENCES_KEY);
      return MapShellCore.normalizePreferences(raw ? JSON.parse(raw) : undefined);
    } catch (_) {
      return MapShellCore.normalizePreferences();
    }
  }

  private savePreferences(): void {
    try { localStorage.setItem(MAP_PREFERENCES_KEY, JSON.stringify(this.preferences)); } catch (_) {}
  }

  private applyPreferencesToChrome(): void {
    this.setTheme(this.preferences.theme, false);
    this.setToolbarCollapsed(this.preferences.toolbarCollapsed, false);
    this.setProfileVisible(this.preferences.profileVisible, false);
  }

  private setTheme(theme: string, persist = true): void {
    this.preferences = MapShellCore.normalizePreferences({ ...this.preferences, theme });
    const root = this.appRootRef.getOrDefault();
    if (root) {
      for (const entry of MapShellCore.THEMES) root.classList.remove(`theme-${entry.id}`);
      root.classList.add(`theme-${this.preferences.theme}`);
    }
    const drawer = this.themeDrawerRef.getOrDefault();
    drawer?.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((button) => {
      const active = button.dataset.theme === this.preferences.theme;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (persist) this.savePreferences();
  }

  private setToolbarCollapsed(collapsed: boolean, persist = true): void {
    this.preferences = { ...this.preferences, toolbarCollapsed: collapsed };
    this.topbarRef.getOrDefault()?.classList.toggle('is-collapsed', collapsed);
    this.appRootRef.getOrDefault()?.classList.toggle('toolbar-collapsed', collapsed);
    const button = this.toolbarToggleRef.getOrDefault();
    button?.setAttribute('aria-expanded', String(!collapsed));
    if (button) button.title = collapsed ? 'Menüleiste einblenden' : 'Menüleiste ausblenden';
    if (persist) this.savePreferences();
    setTimeout(() => this.map?.invalidateSize({ pan: false }), 180);
  }

  private setProfileVisible(visible: boolean, persist = true): void {
    this.preferences = { ...this.preferences, profileVisible: visible };
    this.profileBandRef.getOrDefault()?.classList.toggle('is-hidden', !visible);
    this.appRootRef.getOrDefault()?.classList.toggle('profile-hidden', !visible);
    const button = this.profileButtonRef.getOrDefault();
    button?.classList.toggle('is-active', visible);
    button?.setAttribute('aria-pressed', String(visible));
    this.setText(button, visible ? 'Profil (An)' : 'Profil (Aus)');
    if (persist) this.savePreferences();
    this.renderProfile();
  }

  private toggleDrawer(which: 'theme' | 'tools'): void {
    const target = which === 'theme' ? this.themeDrawerRef.getOrDefault() : this.toolsDrawerRef.getOrDefault();
    const other = which === 'theme' ? this.toolsDrawerRef.getOrDefault() : this.themeDrawerRef.getOrDefault();
    const opening = !target?.classList.contains('is-open');
    this.closeLayerDrawer();
    other?.classList.remove('is-open');
    other?.setAttribute('aria-hidden', 'true');
    target?.classList.toggle('is-open', opening);
    target?.setAttribute('aria-hidden', String(!opening));
    this.themeButtonRef.getOrDefault()?.classList.toggle('is-active', which === 'theme' && opening);
    this.toolsButtonRef.getOrDefault()?.classList.toggle('is-active', which === 'tools' && opening);
  }

  private closeDrawers(): void {
    for (const drawer of [this.themeDrawerRef.getOrDefault(), this.toolsDrawerRef.getOrDefault()]) {
      drawer?.classList.remove('is-open');
      drawer?.setAttribute('aria-hidden', 'true');
    }
    this.themeButtonRef.getOrDefault()?.classList.remove('is-active');
    this.toolsButtonRef.getOrDefault()?.classList.remove('is-active');
  }

  private openTool(tool: string): void {
    if (tool !== 'clock' && tool !== 'calculator' && tool !== 'e6b') return;
    this.activeTool = tool;
    this.closeDrawers();
    const titles = { clock: 'Uhr & Stoppuhr', calculator: 'Flugrechner', e6b: 'E6B Flight Computer' };
    this.setText(this.toolTitleRef.getOrDefault(), titles[tool]);
    this.toolPanelRef.getOrDefault()?.classList.add('is-open');
    this.toolPanelRef.getOrDefault()?.setAttribute('aria-hidden', 'false');
    this.clockPanelRef.getOrDefault()?.classList.toggle('is-hidden', tool !== 'clock');
    this.calculatorPanelRef.getOrDefault()?.classList.toggle('is-hidden', tool !== 'calculator');
    this.e6bPanelRef.getOrDefault()?.classList.toggle('is-hidden', tool !== 'e6b');
    this.updateClock();
    if (tool === 'e6b') {
      setTimeout(() => this.syncE6bFrameSize(), 0);
      setTimeout(() => this.syncE6bFrameSize(), 180);
    }
  }

  private syncE6bFrameSize(): void {
    if (this.activeTool !== 'e6b') return;
    const panel = this.e6bPanelRef.getOrDefault();
    const frame = this.e6bFrameRef.getOrDefault();
    if (!panel || !frame?.contentWindow) return;
    const bounds = panel.getBoundingClientRect();
    if (bounds.width < 10 || bounds.height < 10) return;
    const frontWidth = Math.max(180, Math.min(bounds.width, bounds.height * 510 / 590));
    const windWidth = Math.max(180, Math.min(bounds.width, bounds.height * 510 / 1000));
    try {
      frame.contentWindow.postMessage({ type: 'ga-e6b-set-base-size', frontWidth, windWidth }, '*');
      frame.contentWindow.postMessage({ type: 'ga-e6b-reset-view' }, '*');
    } catch (_) {}
  }

  private closeToolPanel(): void {
    this.activeTool = null;
    this.toolPanelRef.getOrDefault()?.classList.remove('is-open');
    this.toolPanelRef.getOrDefault()?.setAttribute('aria-hidden', 'true');
  }

  private startClock(): void {
    this.stopClock();
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 200);
  }

  private stopClock(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  }

  private updateClock(): void {
    const now = new Date();
    this.setText(this.clockUtcRef.getOrDefault(), `${now.toISOString().slice(11, 19)} UTC`);
    this.setText(this.clockLocalRef.getOrDefault(), now.toLocaleTimeString('de-DE', { hour12: false }));
    const elapsed = this.stopwatchElapsedMs + (this.stopwatchRunning ? Date.now() - this.stopwatchStartedAt : 0);
    const tenths = Math.floor(elapsed / 100) % 10;
    const seconds = Math.floor(elapsed / 1000) % 60;
    const minutes = Math.floor(elapsed / 60000) % 60;
    const hours = Math.floor(elapsed / 3600000);
    this.setText(this.stopwatchRef.getOrDefault(), `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`);
    this.setText(this.stopwatchToggleRef.getOrDefault(), this.stopwatchRunning ? 'Stopp' : 'Start');
    const elapsedSeconds = elapsed / 1000;
    const minuteHand = this.stopwatchMinuteHandRef.getOrDefault();
    const secondHand = this.stopwatchSecondHandRef.getOrDefault();
    const tenthHand = this.stopwatchTenthHandRef.getOrDefault();
    if (minuteHand) minuteHand.style.transform = `rotate(${elapsedSeconds / 60 * 6}deg)`;
    if (secondHand) secondHand.style.transform = `rotate(${elapsedSeconds * 6}deg)`;
    if (tenthHand) tenthHand.style.transform = `rotate(${elapsedSeconds * 360}deg)`;
  }

  private toggleStopwatch(): void {
    if (this.stopwatchRunning) {
      this.stopwatchElapsedMs += Date.now() - this.stopwatchStartedAt;
      this.stopwatchRunning = false;
    } else {
      this.stopwatchStartedAt = Date.now();
      this.stopwatchRunning = true;
    }
    this.updateClock();
  }

  private resetStopwatch(): void {
    this.stopwatchElapsedMs = 0;
    this.stopwatchStartedAt = Date.now();
    this.updateClock();
  }

  private handleCalculatorKey(key: string): void {
    if (key === 'clear') {
      this.calculatorExpression = '';
      this.setText(this.calculatorResultRef.getOrDefault(), '0');
    } else if (key === 'backspace') {
      this.calculatorExpression = this.calculatorExpression.slice(0, -1);
    } else if (key === 'equals') {
      try {
        const result = MapShellCore.evaluateCalculatorExpression(this.calculatorExpression);
        const formatted = Number(result.toPrecision(12)).toString();
        this.setText(this.calculatorResultRef.getOrDefault(), formatted);
        this.calculatorExpression = formatted;
      } catch (_) {
        this.setText(this.calculatorResultRef.getOrDefault(), 'ERR');
      }
    } else if (/^[0-9()+\-*/.%]$/.test(key) && this.calculatorExpression.length < 120) {
      this.calculatorExpression += key;
    }
    this.setText(this.calculatorExpressionRef.getOrDefault(), this.calculatorExpression || 'Bereit');
  }

  private setLayerStatus(text: string, state: 'ok' | 'error' | ''): void {
    const node = this.layerStatusRef.getOrDefault();
    if (!node) return;
    node.textContent = text;
    node.className = `layer-status ${state}`.trim();
  }

  private registerTileHealth(layer: any): void {
    layer.on?.('tileerror', () => {
      this.tileErrorCount += 1;
      if (this.tileErrorCount >= 3) this.setLayerStatus('Kartenquelle teilweise nicht erreichbar', 'error');
    });
    layer.on?.('tileload', () => {
      if (this.tileErrorCount > 0) this.tileErrorCount -= 1;
      if (this.tileErrorCount === 0) this.setLayerStatus('Online-Karten aktiv', 'ok');
    });
  }

  private createResilientTileLayer(definition: any, options: Record<string, unknown>): any {
    const fallbackUrl = String(definition.fallbackUrl || '');
    if (!fallbackUrl) return L.tileLayer(definition.url, options);
    const ResilientLayer = L.TileLayer.extend({
      createTile(this: any, coords: { x: number; y: number; z: number }, done: (error: Error | null, tile: HTMLImageElement) => void): HTMLImageElement {
        const tile = document.createElement('img');
        tile.alt = '';
        tile.decoding = 'async';
        tile.setAttribute('role', 'presentation');
        let fallback = false;
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const finish = (error: Error | null): void => {
          if (settled) return;
          settled = true;
          if (timeout) clearTimeout(timeout);
          tile.onload = null;
          tile.onerror = null;
          done(error, tile);
        };
        const useFallback = (): void => {
          if (fallback || settled) return;
          fallback = true;
          if (timeout) clearTimeout(timeout);
          tile.src = L.Util.template(fallbackUrl, { x: coords.x, y: coords.y, z: coords.z });
          timeout = setTimeout(() => finish(new Error('map_tile_fallback_timeout')), 7000);
        };
        tile.onload = () => finish(null);
        tile.onerror = () => fallback ? finish(new Error('map_tile_fallback_failed')) : useFallback();
        tile.src = this.getTileUrl(coords);
        timeout = setTimeout(useFallback, 4500);
        return tile;
      }
    });
    return new ResilientLayer(definition.url, options);
  }

  private ensureMap(): void {
    if (this.map) return;
    const host = this.mapCanvasRef.getOrDefault();
    if (!host) return;
    this.preferences = this.readPreferences();
    const center = MapShellCore.DEFAULT_CENTER;
    this.map = L.map(host, {
      attributionControl: true,
      maxZoom: 20,
      minZoom: 3,
      preferCanvas: true,
      zoomControl: false
    }).setView([center.lat, center.lon], center.zoom);
    this.map.createPane('efbBasePane').style.zIndex = '200';
    this.map.createPane('efbOverlayPane').style.zIndex = '360';
    this.map.createPane('efbRoutePane').style.zIndex = '500';
    this.map.createPane('efbMissionPane').style.zIndex = '540';
    this.map.createPane('efbAircraftPane').style.zIndex = '650';
    this.map.attributionControl?.setPrefix?.(false);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    for (const definition of MapShellCore.BASE_LAYERS) {
      const layer = this.createResilientTileLayer(definition, {
        ...definition.options,
        pane: 'efbBasePane'
      });
      this.registerTileHealth(layer);
      this.baseLayers.set(definition.id, layer);
    }
    for (const definition of MapShellCore.OVERLAY_LAYERS) {
      const options = { ...definition.options, pane: 'efbOverlayPane' };
      const layer = definition.kind === 'wms'
        ? L.tileLayer.wms(definition.url, options)
        : L.tileLayer(definition.url, options);
      this.registerTileHealth(layer);
      this.overlayLayers.set(definition.id, layer);
    }

    this.activateBaseLayer(this.preferences.baseLayer, false);
    for (const overlayId of this.preferences.overlays) this.setOverlayEnabled(overlayId, true, false);
    this.setFollow(this.preferences.follow, false);
    this.map.on('dragstart', () => this.setFollow(false, true));
    this.map.on('click', () => {
      this.closeLayerDrawer();
      this.closeDrawers();
    });
    this.resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.resizeObserver?.observe(host);
    this.syncLayerButtons();
    this.setLayerStatus('Online-Karten werden geladen', '');
    if (this.lastFlight) this.updateMapFlight(this.lastFlight);
    if (this.lastMapSnapshot) this.renderMapSnapshot(this.lastMapSnapshot, true);
  }

  private activateBaseLayer(layerId: string, persist = true): void {
    const normalized = MapShellCore.normalizePreferences({ ...this.preferences, baseLayer: layerId });
    const nextId = normalized.baseLayer;
    const nextLayer = this.baseLayers.get(nextId);
    if (!this.map || !nextLayer) return;
    if (this.currentBaseLayerId) {
      const current = this.baseLayers.get(this.currentBaseLayerId);
      if (current && this.map.hasLayer(current)) this.map.removeLayer(current);
    }
    nextLayer.addTo(this.map);
    this.currentBaseLayerId = nextId;
    this.preferences = { ...this.preferences, baseLayer: nextId };
    this.syncBaseLayerOpacity();
    this.tileErrorCount = 0;
    this.setLayerStatus('Online-Karten werden geladen', '');
    this.syncLayerButtons();
    if (persist) this.savePreferences();
  }

  private setOverlayEnabled(layerId: string, enabled: boolean, persist = true): void {
    const layer = this.overlayLayers.get(layerId);
    if (!this.map || !layer) return;
    if (enabled && !this.map.hasLayer(layer)) layer.addTo(this.map);
    if (!enabled && this.map.hasLayer(layer)) this.map.removeLayer(layer);
    const overlays = new Set(this.preferences.overlays);
    if (enabled) overlays.add(layerId);
    else overlays.delete(layerId);
    this.preferences = MapShellCore.normalizePreferences({ ...this.preferences, overlays: Array.from(overlays) });
    this.syncBaseLayerOpacity();
    this.syncLayerButtons();
    if (persist) this.savePreferences();
  }

  private syncBaseLayerOpacity(): void {
    const layer = this.baseLayers.get(this.currentBaseLayerId);
    layer?.setOpacity?.(MapShellCore.baseLayerOpacity(this.preferences));
  }

  private toggleOverlay(layerId: string): void {
    this.setOverlayEnabled(layerId, !this.preferences.overlays.includes(layerId), true);
  }

  private syncLayerButtons(): void {
    const drawer = this.layerDrawerRef.getOrDefault();
    if (!drawer) return;
    drawer.querySelectorAll<HTMLButtonElement>('[data-base-layer]').forEach((button) => {
      const active = button.dataset.baseLayer === this.preferences.baseLayer;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    drawer.querySelectorAll<HTMLButtonElement>('[data-overlay-layer]').forEach((button) => {
      const active = this.preferences.overlays.includes(String(button.dataset.overlayLayer || ''));
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  private toggleLayerDrawer(): void {
    const drawer = this.layerDrawerRef.getOrDefault();
    if (!drawer) return;
    const open = !drawer.classList.contains('is-open');
    this.closeDrawers();
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    this.layerButtonRef.getOrDefault()?.classList.toggle('is-active', open);
  }

  private closeLayerDrawer(): void {
    const drawer = this.layerDrawerRef.getOrDefault();
    drawer?.classList.remove('is-open');
    drawer?.setAttribute('aria-hidden', 'true');
    this.layerButtonRef.getOrDefault()?.classList.remove('is-active');
  }

  private setFollow(enabled: boolean, persist = true): void {
    this.preferences = { ...this.preferences, follow: enabled };
    const button = this.followButtonRef.getOrDefault();
    button?.classList.toggle('is-active', enabled);
    button?.setAttribute('aria-pressed', String(enabled));
    if (button) button.title = enabled ? 'Auto-Follow aktiv' : 'Auto-Follow aktivieren';
    if (persist) this.savePreferences();
    if (enabled && this.lastFlight) this.centerOnAircraft(true);
  }

  private centerOnAircraft(forceZoom: boolean): void {
    if (!this.map || !this.lastFlight) return;
    const zoom = forceZoom && this.map.getZoom() < 9 ? 10 : this.map.getZoom();
    this.map.setView([this.lastFlight.lat, this.lastFlight.lon], zoom, { animate: false });
    this.hasCenteredOnAircraft = true;
  }

  private createPlaneIcon(): any {
    return L.divIcon({
      className: 'efb-aircraft-marker',
      html: `<div class="efb-aircraft-glyph" aria-hidden="true"><img src="${BASE_URL}/Assets/aircraft-marker.svg" alt=""><span class="aircraft-center-dot"></span></div>`,
      iconAnchor: [0, 0],
      iconSize: [0, 0]
    });
  }

  private markPlaneStale(stale: boolean): void {
    this.planeMarker?.getElement?.()?.classList.toggle('is-stale', stale);
  }

  private setMapNotice(text: string, state: 'error' | ''): void {
    const notice = this.mapNoticeRef.getOrDefault();
    if (!notice) return;
    notice.textContent = text;
    notice.className = `map-notice ${state}`.trim();
    notice.classList.toggle('is-hidden', !text);
  }

  private updateMapFlight(snapshot: NormalizedFlightSnapshot): void {
    this.lastFlight = snapshot;
    this.setText(this.mapPositionRef.getOrDefault(), MapShellCore.formatCoordinateLine(snapshot));
    this.setText(this.mapFlightRef.getOrDefault(), MapShellCore.formatFlightLine(snapshot));
    if (!this.map) this.initializeMapSafely();
    if (!this.map) return;
    this.setMapNotice('', '');
    if (!this.planeMarker) {
      this.planeMarker = L.marker([snapshot.lat, snapshot.lon], {
        icon: this.createPlaneIcon(),
        interactive: false,
        keyboard: false,
        pane: 'efbAircraftPane',
        zIndexOffset: 1000
      }).addTo(this.map);
    } else {
      this.planeMarker.setLatLng([snapshot.lat, snapshot.lon]);
    }
    const glyph = this.planeMarker.getElement?.()?.querySelector?.('.efb-aircraft-glyph img') as HTMLElement | null;
    if (glyph) glyph.style.transform = `rotate(${snapshot.headingDeg}deg)`;
    this.markPlaneStale(false);
    if (this.preferences.follow) {
      if (!this.hasCenteredOnAircraft) this.centerOnAircraft(true);
      else this.map.panTo([snapshot.lat, snapshot.lon], { animate: false });
    }
    this.renderCompass();
    this.renderProfile();
  }

  private textTooltip(text: string): HTMLElement {
    const node = document.createElement('span');
    node.textContent = text;
    return node;
  }

  private renderMapSnapshot(snapshot: TrackerMapSnapshot, force = false): void {
    this.lastMapSnapshot = snapshot;
    this.renderCompass();
    this.renderProfile();
    if (!this.map) return;
    if (!force && snapshot.revision === this.lastMapRevision) return;
    this.lastMapRevision = snapshot.revision;
    if (this.routeLayer) this.map.removeLayer(this.routeLayer);
    if (this.missionGeometryLayer) this.map.removeLayer(this.missionGeometryLayer);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.missionGeometryLayer = L.layerGroup().addTo(this.map);
    const points = snapshot.route.waypoints.map((point) => [point.lat, point.lon]);
    if (points.length >= 2) {
      L.polyline(points, {
        pane: 'efbRoutePane',
        color: '#fff',
        opacity: 0.94,
        weight: 7
      }).addTo(this.routeLayer);
      L.polyline(points, {
        pane: 'efbRoutePane',
        color: '#f24a45',
        dashArray: '13 10',
        opacity: 1,
        weight: 4
      }).addTo(this.routeLayer);
    }
    snapshot.route.waypoints.forEach((point, index) => {
      const marker = L.circleMarker([point.lat, point.lon], {
        pane: 'efbRoutePane',
        radius: index === 0 || index === snapshot.route.waypoints.length - 1 ? 6 : 4,
        color: '#151d22',
        weight: 2,
        fillColor: index === 0 ? '#6cdb8b' : index === snapshot.route.waypoints.length - 1 ? '#f25f58' : '#f0c94c',
        fillOpacity: 1,
        interactive: false
      }).addTo(this.routeLayer);
      marker.bindTooltip(this.textTooltip(point.name || `WP ${index + 1}`), {
        className: 'efb-route-tooltip',
        direction: 'top',
        permanent: false
      });
    });
    const geometry = snapshot.missionGeometry;
    if (geometry.poiChain.length > 1) {
      L.polyline(geometry.poiChain.map((point) => [point.lat, point.lon]), {
        pane: 'efbMissionPane',
        color: '#65d6ff',
        dashArray: '4 8',
        opacity: 0.9,
        weight: 3
      }).addTo(this.missionGeometryLayer);
    }
    geometry.poiChain.forEach((point, index) => {
      const marker = L.circleMarker([point.lat, point.lon], {
        pane: 'efbMissionPane',
        radius: 4,
        color: '#072336',
        weight: 1,
        fillColor: '#65d6ff',
        fillOpacity: 0.9,
        interactive: false
      }).addTo(this.missionGeometryLayer);
      marker.bindTooltip(this.textTooltip(point.name || `POI ${index + 1}`), { className: 'efb-route-tooltip', direction: 'top' });
    });
    if (geometry.target) {
      const target = L.circleMarker([geometry.target.lat, geometry.target.lon], {
        pane: 'efbMissionPane',
        radius: 9,
        color: '#fff',
        weight: 2,
        fillColor: '#d8263c',
        fillOpacity: 0.9,
        interactive: false
      }).addTo(this.missionGeometryLayer);
      target.bindTooltip(this.textTooltip(geometry.target.name || 'Missionsziel'), { className: 'efb-route-tooltip', direction: 'top' });
    }
    if (!this.lastFlight && points.length >= 2) this.map.fitBounds(points, { padding: [40, 40], animate: false });
  }

  private clearMapSnapshot(): void {
    this.lastMapSnapshot = null;
    this.lastMapRevision = 0;
    if (this.map && this.routeLayer) this.map.removeLayer(this.routeLayer);
    if (this.map && this.missionGeometryLayer) this.map.removeLayer(this.missionGeometryLayer);
    this.routeLayer = null;
    this.missionGeometryLayer = null;
    this.renderCompass();
    this.renderProfile();
  }

  private renderCompass(): void {
    const heading = this.lastFlight?.headingDeg || 0;
    const navigation = this.lastMapSnapshot?.navigation;
    const rose = this.compassRoseRef.getOrDefault();
    if (rose) rose.setAttribute('transform', `rotate(${-heading} 150 150)`);
    const compass = this.compassRef.getOrDefault();
    const bearing = navigation?.bearingToNextDeg;
    compass?.style.setProperty('--bearing-relative', `${bearing === undefined ? 0 : bearing - heading}deg`);
    compass?.classList.toggle('has-bearing', bearing !== undefined && bearing !== null);
    this.setText(this.compassHeadingRef.getOrDefault(), `${String(Math.round(heading)).padStart(3, '0')} deg`);
    this.setText(this.compassBearingRef.getOrDefault(), navigation
      ? `${navigation.nextWaypointName || 'NEXT'} | ${navigation.bearingToNextDeg.toFixed(0)} deg | ${navigation.distanceToNextNm.toFixed(1)} NM`
      : 'Keine aktive Route');
  }

  private appendSvgElement(parent: SVGElement, name: string, attributes: Record<string, string>): SVGElement {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    parent.appendChild(element);
    return element;
  }

  private renderProfile(): void {
    const svg = this.profileSvgRef.getOrDefault();
    if (!svg || !this.preferences.profileVisible) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const profile = this.lastMapSnapshot?.profile;
    if (!profile || profile.points.length < 2 || profile.totalDistanceNm <= 0) {
      this.setText(this.profileStatusRef.getOrDefault(), 'Höhenband wartet auf eine aktive Route');
      return;
    }
    const width = 1000;
    const height = 145;
    const top = 12;
    const bottom = 124;
    const values = profile.points.flatMap((point) => [point.plannedAltFt, point.terrainFt || 0]);
    if (this.lastFlight) values.push(this.lastFlight.altFt);
    const maxAlt = Math.max(1000, Math.ceil(Math.max(...values) / 1000) * 1000);
    const xFor = (distance: number) => Math.max(0, Math.min(width, distance / profile.totalDistanceNm * width));
    const yFor = (altitude: number) => bottom - Math.max(0, Math.min(1, altitude / maxAlt)) * (bottom - top);
    this.appendSvgElement(svg, 'rect', { x: '0', y: '0', width: String(width), height: String(height), class: 'profile-sky' });
    for (let altitude = 0; altitude <= maxAlt; altitude += 1000) {
      const y = yFor(altitude);
      this.appendSvgElement(svg, 'line', { x1: '0', y1: String(y), x2: String(width), y2: String(y), class: 'profile-grid-line' });
      const label = this.appendSvgElement(svg, 'text', { x: '7', y: String(Math.max(11, y - 3)), class: 'profile-grid-label' });
      label.textContent = `${altitude / 1000}k`;
    }
    const terrainPoints = profile.points.filter((point) => point.terrainFt !== null);
    if (terrainPoints.length >= 2) {
      const path = [`M 0 ${bottom}`]
        .concat(profile.points.map((point) => `L ${xFor(point.distanceNm)} ${yFor(point.terrainFt || 0)}`))
        .concat([`L ${width} ${bottom} Z`]).join(' ');
      this.appendSvgElement(svg, 'path', { d: path, class: 'profile-terrain' });
    }
    const plannedPoints = profile.points.map((point) => `${xFor(point.distanceNm)},${yFor(point.plannedAltFt)}`).join(' ');
    this.appendSvgElement(svg, 'polyline', { points: plannedPoints, class: 'profile-plan-line' });
    profile.points.forEach((point) => {
      const x = xFor(point.distanceNm);
      this.appendSvgElement(svg, 'line', { x1: String(x), y1: String(bottom), x2: String(x), y2: String(bottom + 5), class: 'profile-waypoint-tick' });
    });
    if (this.lastFlight && this.lastMapSnapshot?.navigation) {
      const x = xFor(this.lastMapSnapshot.navigation.routeDistanceNm);
      const y = yFor(this.lastFlight.altFt);
      this.appendSvgElement(svg, 'circle', { cx: String(x), cy: String(y), r: '7', class: 'profile-aircraft' });
      this.appendSvgElement(svg, 'line', { x1: String(x), y1: String(y + 8), x2: String(x), y2: String(bottom), class: 'profile-aircraft-guide' });
    }
    const navigation = this.lastMapSnapshot?.navigation;
    this.setText(this.profileStatusRef.getOrDefault(), navigation
      ? `${navigation.nextWaypointName || 'NEXT'} | ${navigation.remainingDistanceNm.toFixed(1)} NM Rest | ${navigation.crossTrackNm.toFixed(2)} NM XTK`
      : `Planprofil | ${profile.totalDistanceNm.toFixed(1)} NM | ${Math.round(profile.cruiseAltitudeFt)} ft`);
  }

  private renderMission(snapshot: MissionSnapshotPayload | null): void {
    this.missionDisplayState = MapShellCore.advanceMissionDisplay(snapshot, this.missionDisplayState, Date.now());
    if (this.missionDisplayState.mode === 'unsupported') {
      this.setText(this.missionRef.getOrDefault(), 'Missionsanzeige benötigt Tracker v324 oder neuer.');
      this.setText(this.missionPhaseRef.getOrDefault(), '');
      this.setText(this.missionScenesRef.getOrDefault(), '');
      return;
    }
    if (this.missionDisplayState.mode === 'pending') {
      this.setText(this.missionRef.getOrDefault(), 'Missionsdaten werden synchronisiert.');
      this.setText(this.missionPhaseRef.getOrDefault(), '');
      this.setText(this.missionScenesRef.getOrDefault(), '');
      return;
    }
    if (this.missionDisplayState.mode === 'empty') {
      this.setText(this.missionRef.getOrDefault(), 'Noch keine Mission vom Web-Frontend empfangen.');
      this.setText(this.missionPhaseRef.getOrDefault(), '');
      this.setText(this.missionScenesRef.getOrDefault(), '');
      return;
    }
    const mission = this.missionDisplayState.snapshot as MissionSnapshotPayload | null;
    if (!mission?.missionId) return;
    const phaseLabels: Record<string, string> = {
      idle: 'Leerlauf',
      planned: 'Geplant',
      prepare: 'Vorbereitung',
      boarding: 'Boarding',
      boarded: 'Boarding abgeschlossen',
      active: 'Aktiv',
      end_ready: 'Am Ziel',
      closing: 'Wird abgeschlossen'
    };
    const stateLabels: Record<string, string> = {
      active: 'Aktiv',
      closing: 'Wird abgeschlossen',
      ended: 'Beendet',
      closed: 'Beendet',
      reset: 'Zurückgesetzt',
      cleared: 'Zurückgesetzt'
    };
    const phase = String(mission.phase || '').toLowerCase();
    const state = String(mission.state || '').toLowerCase();
    const sceneCount = Math.max(0, Math.round(Number(mission.sceneCount) || 0));
    this.setText(this.missionRef.getOrDefault(), String(mission.missionId));
    this.setText(this.missionPhaseRef.getOrDefault(), `Status ${stateLabels[state] || state || '-'} | Phase ${phaseLabels[phase] || phase || '-'}`);
    this.setText(this.missionScenesRef.getOrDefault(), sceneCount === 1 ? '1 lokale Simulatorszene aktiv' : `${sceneCount} lokale Simulatorszenen aktiv`);
  }

  private async poll(): Promise<void> {
    try {
      const [statusResponse, snapshotResponse, missionResponse, mapResponse] = await Promise.all([
        fetch(`${TRACKER_API_URL}/api/v1/status`, { cache: 'no-store' }),
        fetch(`${TRACKER_API_URL}/api/v1/snapshot`, { cache: 'no-store' }),
        fetch(`${TRACKER_API_URL}/api/v1/mission`, { cache: 'no-store' }).catch(() => null),
        fetch(`${TRACKER_API_URL}/api/v1/map`, { cache: 'no-store' }).catch(() => null)
      ]);
      if (!this.active) return;
      if (!statusResponse.ok || !snapshotResponse.ok) throw new Error('tracker_unavailable');
      const status = payloadOf<TrackerStatusPayload>(await statusResponse.json(), 'tracker.status');
      const snapshot = payloadOf<FlightSnapshotPayload>(await snapshotResponse.json(), 'flight.snapshot');
      if (!status || !snapshot) throw new Error('protocol_mismatch');
      const mission = missionResponse?.ok
        ? payloadOf<MissionSnapshotPayload>(await missionResponse.json(), 'mission.snapshot', 'mission.snapshot.v1')
        : null;
      const mapPayload = mapResponse?.ok
        ? payloadOf<any>(await mapResponse.json(), 'map.snapshot', 'map.snapshot.v1')
        : null;

      this.setConnection('Tracker verbunden', 'online');
      this.setText(this.trackerRef.getOrDefault(), `${status.trackerVersion || '-'} | ${status.runtimeChannel || '-'}`);
      this.setText(this.relayRef.getOrDefault(), status.relayConnected ? 'Verbunden' : 'Wartet');
      this.setText(this.simulatorRef.getOrDefault(), status.simulatorConnected ? 'Verbunden' : 'Nicht verbunden');
      const mapSnapshot = MapShellCore.normalizeFlightSnapshot(snapshot) as NormalizedFlightSnapshot | null;
      if (mapSnapshot) {
        this.setText(this.positionRef.getOrDefault(), MapShellCore.formatCoordinateLine(mapSnapshot));
        this.setText(this.flightRef.getOrDefault(), MapShellCore.formatFlightLine(mapSnapshot));
        this.updateMapFlight(mapSnapshot);
      } else {
        this.setText(this.positionRef.getOrDefault(), 'Warte auf Positionsdaten aus dem Simulator.');
        this.setText(this.flightRef.getOrDefault(), '');
        this.setText(this.mapPositionRef.getOrDefault(), 'Warte auf Simulatorposition');
        this.setText(this.mapFlightRef.getOrDefault(), 'Karte ist frei verschiebbar');
        this.setMapNotice('Warte auf Positionsdaten aus dem Simulator', '');
      }
      this.renderMission(mission);
      if (mapPayload?.available === true) {
        const normalizedMap = MapShellCore.normalizeTrackerMapSnapshot(mapPayload) as TrackerMapSnapshot | null;
        if (normalizedMap) this.renderMapSnapshot(normalizedMap);
      } else if (mapPayload?.available === false) {
        this.clearMapSnapshot();
      }
    } catch (_) {
      if (!this.active) return;
      this.setConnection('Tracker nicht erreichbar', 'error');
      this.setText(this.trackerRef.getOrDefault(), '-');
      this.setText(this.relayRef.getOrDefault(), '-');
      this.setText(this.simulatorRef.getOrDefault(), '-');
      this.setText(this.positionRef.getOrDefault(), 'Bitte den VFR Multitool Tracker in einer EFB-kompatiblen Version starten.');
      this.setText(this.flightRef.getOrDefault(), '');
      this.setText(this.missionRef.getOrDefault(), 'Keine Missionsdaten verfügbar.');
      this.setText(this.missionPhaseRef.getOrDefault(), '');
      this.setText(this.missionScenesRef.getOrDefault(), '');
      this.setText(this.mapPositionRef.getOrDefault(), this.lastFlight ? MapShellCore.formatCoordinateLine(this.lastFlight) : 'Tracker offline');
      this.setText(this.mapFlightRef.getOrDefault(), this.lastFlight ? 'Letzte bekannte Position' : 'Karte ist frei verschiebbar');
      this.setMapNotice('Tracker nicht erreichbar | Karte bleibt bedienbar', 'error');
      this.markPlaneStale(true);
    }
    if (this.active) this.timer = setTimeout(() => void this.poll(), 1000);
  }

  public render(): VNode {
    return (
      <div ref={this.appRootRef} class="vfr-multitool-app theme-classic">
        <header ref={this.topbarRef} class="app-topbar">
          <div class="topbar-content">
            <div class="map-toolbar-title-row">
              <strong>NAV STATION (KARTENTISCH)</strong>
              <span>VFR Multitool EFB v{EFB_APP_VERSION}</span>
            </div>
            <div class="map-toolbar-buttons">
              <button ref={this.mapTabRef} class="pb-btn is-active" type="button">Karte</button>
              <button ref={this.statusTabRef} class="pb-btn" type="button">Status</button>
              <button ref={this.profileButtonRef} class="pb-btn" type="button" aria-pressed="true">Profil (An)</button>
              <button ref={this.themeButtonRef} class="pb-btn" type="button">Design</button>
              <button ref={this.toolsButtonRef} class="pb-btn" type="button">Werkzeuge</button>
              <span ref={this.connectionRef} class="connection-pill">Warte auf Tracker</span>
            </div>
          </div>
          <button ref={this.toolbarToggleRef} class="topbar-toggle" type="button" aria-expanded="true" title="Menüleiste ausblenden">
            <span class="collapse-chevron" aria-hidden="true"></span>
          </button>
        </header>

        <div ref={this.mapScreenRef} class="ga-efb-map-view">
          <div ref={this.mapCanvasRef} class="ga-efb-map-canvas" aria-label="VFR Kartentisch"></div>
        </div>

        <div ref={this.mapControlsRef} class="ga-efb-map-controls">
          <button ref={this.layerButtonRef} class="map-fab layer-button" type="button" title="Kartenebenen">
            <span class="layer-stack" aria-hidden="true"></span><span>Layer</span>
          </button>
          <aside ref={this.layerDrawerRef} class="layer-drawer" aria-hidden="true">
            <div class="drawer-head">
              <div><span class="drawer-kicker">Kartentisch</span><strong>Kartenebenen</strong></div>
              <button type="button" title="Layer schließen" data-layer-close="true">X</button>
            </div>
            <span class="layer-group-title">Basiskarte</span>
            <div class="layer-list">
              <button type="button" data-base-layer="topo"><span></span>OpenTopo / Text</button>
              <button type="button" data-base-layer="terrain"><span></span>Terrain</button>
              <button type="button" data-base-layer="satellite"><span></span>Satellit</button>
              <button type="button" data-base-layer="dark"><span></span>Dunkel</button>
              <button type="button" data-base-layer="light"><span></span>Hell</button>
            </div>
            <span class="layer-group-title">Overlays</span>
            <div class="layer-list overlays">
              <button type="button" data-overlay-layer="aero"><span></span>VFR-Lufträume / Aero</button>
              <button type="button" data-overlay-layer="dfs"><span></span>DFS ICAO 1:500k</button>
              <button type="button" data-overlay-layer="faa"><span></span>FAA VFR Sectional</button>
              <button type="button" data-overlay-layer="dwd"><span></span>DWD Warnungen</button>
            </div>
            <p ref={this.layerStatusRef} class="layer-status">Online-Karten werden geladen</p>
          </aside>
          <aside ref={this.themeDrawerRef} class="chrome-drawer theme-drawer" aria-hidden="true">
            <div class="drawer-head">
              <div><span class="drawer-kicker">Darstellung</span><strong>App-Design</strong></div>
              <button type="button" title="Design schließen" data-theme-close="true">X</button>
            </div>
            <div class="theme-grid">
              <button type="button" data-theme="classic"><span class="theme-swatch classic"></span>Classic</button>
              <button type="button" data-theme="retro"><span class="theme-swatch retro"></span>Retro</button>
              <button type="button" data-theme="navcom"><span class="theme-swatch navcom"></span>NAV/COM</button>
              <button type="button" data-theme="ops1940"><span class="theme-swatch ops1940"></span>OPS 1940</button>
              <button type="button" data-theme="win95"><span class="theme-swatch win95"></span>Windows 95</button>
            </div>
          </aside>
          <aside ref={this.toolsDrawerRef} class="chrome-drawer tools-drawer" aria-hidden="true">
            <div class="drawer-head">
              <div><span class="drawer-kicker">Cockpit</span><strong>Werkzeuge</strong></div>
              <button type="button" title="Werkzeuge schließen" data-tools-close="true">X</button>
            </div>
            <div class="tool-launchers">
              <button type="button" data-tool="e6b"><strong>E6B</strong><span>Flight Computer</span></button>
              <button type="button" data-tool="clock"><strong>UTC</strong><span>Uhr &amp; Stoppuhr</span></button>
              <button type="button" data-tool="calculator"><strong>123</strong><span>Rechner</span></button>
            </div>
          </aside>
          <button ref={this.followButtonRef} class="map-fab follow-button" type="button" aria-pressed="true" title="Auto-Follow aktiv">
            <span class="follow-reticle" aria-hidden="true"></span><span>Follow</span>
          </button>
          <aside ref={this.compassRef} class="map-compass" aria-label="Kartenkompass">
            <div class="compass-course-marker" aria-hidden="true"></div>
            <svg viewBox="0 0 300 300" aria-hidden="true">
              <g ref={this.compassRoseRef} class="compass-rose">
                <circle class="compass-outer" cx="150" cy="150" r="143"></circle>
                <circle class="compass-inner" cx="150" cy="150" r="118"></circle>
                <line class="major" x1="150" y1="7" x2="150" y2="33"></line>
                <line class="major" x1="293" y1="150" x2="267" y2="150"></line>
                <line class="major" x1="150" y1="293" x2="150" y2="267"></line>
                <line class="major" x1="7" y1="150" x2="33" y2="150"></line>
                <line x1="251" y1="49" x2="234" y2="66"></line>
                <line x1="251" y1="251" x2="234" y2="234"></line>
                <line x1="49" y1="251" x2="66" y2="234"></line>
                <line x1="49" y1="49" x2="66" y2="66"></line>
                <text x="150" y="52">N</text><text x="248" y="158">E</text>
                <text x="150" y="258">S</text><text x="52" y="158">W</text>
                <text x="222" y="83">03</text><text x="222" y="225">15</text>
                <text x="78" y="225">21</text><text x="78" y="83">33</text>
              </g>
            </svg>
            <div class="compass-bearing-bug" aria-hidden="true"></div>
            <div class="compass-readout"><span ref={this.compassHeadingRef}>000 deg</span><small ref={this.compassBearingRef}>Keine aktive Route</small></div>
          </aside>
          <div ref={this.mapNoticeRef} class="map-notice">Warte auf Positionsdaten aus dem Simulator</div>
          <section ref={this.profileBandRef} class="profile-band" aria-label="Routen-Höhenband">
            <div class="profile-head">
              <span>Routenprofil</span>
              <span ref={this.profileStatusRef}>Höhenband wartet auf eine aktive Route</span>
            </div>
            <svg ref={this.profileSvgRef} viewBox="0 0 1000 145" preserveAspectRatio="none"></svg>
          </section>
          <div class="flight-strip">
            <div><span class="strip-label">Aktuelle Position</span><p ref={this.mapPositionRef}>Warte auf Simulatorposition</p></div>
            <p ref={this.mapFlightRef} class="strip-flight">Karte ist frei verschiebbar</p>
          </div>
          <aside ref={this.toolPanelRef} class="tool-panel" aria-hidden="true">
            <div class="tool-panel-head"><strong ref={this.toolTitleRef}>Werkzeug</strong><button type="button" data-tool-close="true">X</button></div>
            <div ref={this.clockPanelRef} class="clock-tool is-hidden">
              <div class="map-stopwatch-device">
                <div class="stopwatch-bezel">
                  <button ref={this.stopwatchToggleRef} class="stopwatch-crown stopwatch-crown-main" type="button">Start</button>
                  <button class="stopwatch-crown stopwatch-crown-reset" type="button" data-stopwatch-reset="true">Reset</button>
                  <div class="stopwatch-dial" aria-hidden="true">
                    <div class="stopwatch-tick-ring"></div>
                    <span class="stopwatch-number number-60">60</span><span class="stopwatch-number number-5">5</span>
                    <span class="stopwatch-number number-10">10</span><span class="stopwatch-number number-15">15</span>
                    <span class="stopwatch-number number-20">20</span><span class="stopwatch-number number-25">25</span>
                    <span class="stopwatch-number number-30">30</span><span class="stopwatch-number number-35">35</span>
                    <span class="stopwatch-number number-40">40</span><span class="stopwatch-number number-45">45</span>
                    <span class="stopwatch-number number-50">50</span><span class="stopwatch-number number-55">55</span>
                    <div class="stopwatch-digital-face"><time ref={this.stopwatchRef}>00:00:00.0</time></div>
                    <div ref={this.stopwatchMinuteHandRef} class="stopwatch-hand stopwatch-minute-hand"></div>
                    <div ref={this.stopwatchSecondHandRef} class="stopwatch-hand stopwatch-second-hand"></div>
                    <div ref={this.stopwatchTenthHandRef} class="stopwatch-hand stopwatch-tenth-hand"></div>
                    <div class="stopwatch-hub"></div>
                  </div>
                </div>
                <div class="stopwatch-time-grid"><div><span>UTC</span><time ref={this.clockUtcRef}>00:00:00 UTC</time></div><div><span>Lokal</span><time ref={this.clockLocalRef}>00:00:00</time></div></div>
              </div>
            </div>
            <div ref={this.calculatorPanelRef} class="calculator-tool is-hidden">
              <div class="calculator-case">
                <div class="calculator-topbar"><strong>FLIGHT COMPUTER</strong><span>GA-120</span></div>
                <div class="calculator-display"><div ref={this.calculatorExpressionRef} class="calc-expression">Bereit</div><div ref={this.calculatorResultRef} class="calc-result">0</div></div>
                <div class="calc-keypad calculator-keypad">
                  <button type="button" data-calc="clear">C</button><button type="button" data-calc="(">(</button><button type="button" data-calc=")">)</button><button type="button" data-calc="backspace">DEL</button>
                  <button type="button" data-calc="7">7</button><button type="button" data-calc="8">8</button><button type="button" data-calc="9">9</button><button class="operator" type="button" data-calc="/">/</button>
                  <button type="button" data-calc="4">4</button><button type="button" data-calc="5">5</button><button type="button" data-calc="6">6</button><button class="operator" type="button" data-calc="*">*</button>
                  <button type="button" data-calc="1">1</button><button type="button" data-calc="2">2</button><button type="button" data-calc="3">3</button><button class="operator" type="button" data-calc="-">-</button>
                  <button type="button" data-calc="0">0</button><button type="button" data-calc=".">.</button><button type="button" data-calc="%">%</button><button class="operator" type="button" data-calc="+">+</button>
                  <button class="equals" type="button" data-calc="equals">=</button>
                </div>
              </div>
            </div>
            <div ref={this.e6bPanelRef} class="e6b-tool is-hidden">
              <iframe ref={this.e6bFrameRef} title="E6B Flight Computer" src={`${BASE_URL}/Assets/E6B/e6b-flight-computer-efb.html#embedded-coherent`}></iframe>
            </div>
          </aside>
        </div>

        <div ref={this.statusScreenRef} class="ga-efb-status-view is-hidden">
          <div class="status-content">
            <section class="card status-grid">
              <div><span class="label">Tracker</span><span ref={this.trackerRef} class="value">-</span></div>
              <div><span class="label">Relay</span><span ref={this.relayRef} class="value">-</span></div>
              <div><span class="label">Simulator</span><span ref={this.simulatorRef} class="value">-</span></div>
              <div><span class="label">Modus</span><span class="value">Read-only</span></div>
            </section>
            <section class="card">
              <span class="label">Aktuelle Position</span>
              <p ref={this.positionRef} class="position">Warte auf Positionsdaten.</p>
              <p ref={this.flightRef} class="hint"></p>
            </section>
            <section class="card">
              <span class="label">Mission | Read-only</span>
              <p ref={this.missionRef} class="mission-id">Warte auf Missionsdaten.</p>
              <p ref={this.missionPhaseRef} class="hint"></p>
              <p ref={this.missionScenesRef} class="hint compact"></p>
            </section>
            <section class="card">
              <span class="label">Alpha-Stufe 4</span>
              <p class="hint">Kartentisch-Shell mit Route, Missionsgeometrie, planbasiertem Höhenband, Kompass, App-Designs sowie lokalen Uhr-, Rechner- und E6B-Werkzeugen. Der Tracker bleibt die autoritative Datenquelle.</p>
            </section>
          </div>
        </div>
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
