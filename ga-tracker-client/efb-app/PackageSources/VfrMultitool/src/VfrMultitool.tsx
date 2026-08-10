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

type MapPreferences = {
  baseLayer: string;
  overlays: string[];
  follow: boolean;
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
  private resizeObserver: ResizeObserver | null = null;
  private resizeBound = false;
  private hasCenteredOnAircraft = false;
  private currentBaseLayerId = '';
  private baseLayers = new Map<string, any>();
  private overlayLayers = new Map<string, any>();
  private lastFlight: NormalizedFlightSnapshot | null = null;
  private tileErrorCount = 0;
  private mapLayoutRetryCount = 0;
  private preferences: MapPreferences = MapShellCore.normalizePreferences();

  private readonly onWindowResize = (): void => {
    if (this.screen !== 'map' || !this.map) return;
    this.map.invalidateSize({ pan: false });
  };

  public onOpen(): void { this.activate(); }
  public onResume(): void { this.activate(); }
  public onPause(): void { this.deactivate(false); }
  public onClose(): void { this.deactivate(true); }
  public onAfterRender(node: VNode): void {
    super.onAfterRender(node);
    this.rendered = true;
    if (this.active) this.scheduleMapInitialization();
  }

  private activate(): void {
    this.startPolling();
    this.setScreen(this.screen);
    if (!this.resizeBound) {
      window.addEventListener('resize', this.onWindowResize);
      this.resizeBound = true;
    }
    this.scheduleMapInitialization();
  }

  private deactivate(removeMap: boolean): void {
    this.stopPolling();
    if (this.mapInitTimer) clearTimeout(this.mapInitTimer);
    this.mapInitTimer = null;
    if (this.resizeBound) {
      window.removeEventListener('resize', this.onWindowResize);
      this.resizeBound = false;
    }
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
      this.setMapNotice('Karte konnte nicht initialisiert werden · Details im EFB-Debugger', 'error');
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
    this.map.on('click', () => this.closeLayerDrawer());
    this.resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.resizeObserver?.observe(host);
    this.syncLayerButtons();
    this.setLayerStatus('Online-Karten werden geladen', '');
    if (this.lastFlight) this.updateMapFlight(this.lastFlight);
  }

  private activateBaseLayer(layerId: string, persist = true): void {
    const normalized = MapShellCore.normalizePreferences({ baseLayer: layerId, overlays: this.preferences.overlays, follow: this.preferences.follow });
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
    this.syncLayerButtons();
    if (persist) this.savePreferences();
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
      html: '<div class="efb-aircraft-glyph" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 2.5c1.3 0 2 1.1 2 2.7v7.2l10.2 6v3l-10.2-3.2v5.9l3.8 2.7v2.4L16 27.5l-5.8 1.7v-2.4l3.8-2.7v-5.9L3.8 21.4v-3l10.2-6V5.2c0-1.6.7-2.7 2-2.7z"/></svg></div>',
      iconAnchor: [22, 22],
      iconSize: [44, 44]
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
    const glyph = this.planeMarker.getElement?.()?.querySelector?.('.efb-aircraft-glyph') as HTMLElement | null;
    if (glyph) glyph.style.transform = `rotate(${snapshot.headingDeg}deg)`;
    this.markPlaneStale(false);
    if (this.preferences.follow) {
      if (!this.hasCenteredOnAircraft) this.centerOnAircraft(true);
      else this.map.panTo([snapshot.lat, snapshot.lon], { animate: false });
    }
  }

  private renderMission(snapshot: MissionSnapshotPayload | null): void {
    if (!snapshot) {
      this.setText(this.missionRef.getOrDefault(), 'Missionsanzeige benötigt Tracker v324 oder neuer.');
      this.setText(this.missionPhaseRef.getOrDefault(), '');
      this.setText(this.missionScenesRef.getOrDefault(), '');
      return;
    }
    if (!snapshot.available || !snapshot.missionId) {
      this.setText(this.missionRef.getOrDefault(), 'Noch keine Mission vom Web-Frontend empfangen.');
      this.setText(this.missionPhaseRef.getOrDefault(), '');
      this.setText(this.missionScenesRef.getOrDefault(), '');
      return;
    }
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
    const phase = String(snapshot.phase || '').toLowerCase();
    const state = String(snapshot.state || '').toLowerCase();
    const sceneCount = Math.max(0, Math.round(Number(snapshot.sceneCount) || 0));
    this.setText(this.missionRef.getOrDefault(), String(snapshot.missionId));
    this.setText(this.missionPhaseRef.getOrDefault(), `Status ${stateLabels[state] || state || '–'} · Phase ${phaseLabels[phase] || phase || '–'}`);
    this.setText(this.missionScenesRef.getOrDefault(), sceneCount === 1 ? '1 lokale Simulatorszene aktiv' : `${sceneCount} lokale Simulatorszenen aktiv`);
  }

  private async poll(): Promise<void> {
    try {
      const [statusResponse, snapshotResponse, missionResponse] = await Promise.all([
        fetch(`${TRACKER_API_URL}/api/v1/status`, { cache: 'no-store' }),
        fetch(`${TRACKER_API_URL}/api/v1/snapshot`, { cache: 'no-store' }),
        fetch(`${TRACKER_API_URL}/api/v1/mission`, { cache: 'no-store' }).catch(() => null)
      ]);
      if (!this.active) return;
      if (!statusResponse.ok || !snapshotResponse.ok) throw new Error('tracker_unavailable');
      const status = payloadOf<TrackerStatusPayload>(await statusResponse.json(), 'tracker.status');
      const snapshot = payloadOf<FlightSnapshotPayload>(await snapshotResponse.json(), 'flight.snapshot');
      if (!status || !snapshot) throw new Error('protocol_mismatch');
      const mission = missionResponse?.ok
        ? payloadOf<MissionSnapshotPayload>(await missionResponse.json(), 'mission.snapshot', 'mission.snapshot.v1')
        : null;

      this.setConnection('Tracker verbunden', 'online');
      this.setText(this.trackerRef.getOrDefault(), `${status.trackerVersion || '–'} · ${status.runtimeChannel || '–'}`);
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
    } catch (_) {
      if (!this.active) return;
      this.setConnection('Tracker nicht erreichbar', 'error');
      this.setText(this.trackerRef.getOrDefault(), '–');
      this.setText(this.relayRef.getOrDefault(), '–');
      this.setText(this.simulatorRef.getOrDefault(), '–');
      this.setText(this.positionRef.getOrDefault(), 'Bitte den VFR Multitool Tracker in einer EFB-kompatiblen Version starten.');
      this.setText(this.flightRef.getOrDefault(), '');
      this.setText(this.missionRef.getOrDefault(), 'Keine Missionsdaten verfügbar.');
      this.setText(this.missionPhaseRef.getOrDefault(), '');
      this.setText(this.missionScenesRef.getOrDefault(), '');
      this.setText(this.mapPositionRef.getOrDefault(), this.lastFlight ? MapShellCore.formatCoordinateLine(this.lastFlight) : 'Tracker offline');
      this.setText(this.mapFlightRef.getOrDefault(), this.lastFlight ? 'Letzte bekannte Position' : 'Karte ist frei verschiebbar');
      this.setMapNotice('Tracker nicht erreichbar · Karte bleibt bedienbar', 'error');
      this.markPlaneStale(true);
    }
    if (this.active) this.timer = setTimeout(() => void this.poll(), 1000);
  }

  public render(): VNode {
    return (
      <div class="vfr-multitool-app">
        <header class="app-topbar">
          <div class="brand">
            <strong>VFR Multitool</strong>
            <span>EFB v{EFB_APP_VERSION}</span>
          </div>
          <nav class="view-switch" aria-label="Ansicht wechseln">
            <button ref={this.mapTabRef} class="is-active" type="button" onClick={() => this.setScreen('map')}>Karte</button>
            <button ref={this.statusTabRef} type="button" onClick={() => this.setScreen('status')}>Status</button>
          </nav>
          <span ref={this.connectionRef} class="connection-pill">Warte auf Tracker</span>
        </header>

        <div ref={this.mapScreenRef} class="ga-efb-map-view">
          <div ref={this.mapCanvasRef} class="ga-efb-map-canvas" aria-label="VFR Kartentisch"></div>
        </div>

        <div ref={this.mapControlsRef} class="ga-efb-map-controls">
          <button ref={this.layerButtonRef} class="map-fab layer-button" type="button" title="Kartenebenen" onClick={() => this.toggleLayerDrawer()}>
            <span class="layer-stack" aria-hidden="true"></span><span>Layer</span>
          </button>
          <aside ref={this.layerDrawerRef} class="layer-drawer" aria-hidden="true">
            <div class="drawer-head">
              <div><span class="drawer-kicker">Kartentisch</span><strong>Kartenebenen</strong></div>
              <button type="button" title="Layer schließen" onClick={() => this.closeLayerDrawer()}>×</button>
            </div>
            <span class="layer-group-title">Basiskarte</span>
            <div class="layer-list">
              <button type="button" data-base-layer="topo" onClick={() => this.activateBaseLayer('topo')}><span></span>OpenTopo · Text</button>
              <button type="button" data-base-layer="terrain" onClick={() => this.activateBaseLayer('terrain')}><span></span>Terrain</button>
              <button type="button" data-base-layer="satellite" onClick={() => this.activateBaseLayer('satellite')}><span></span>Satellit</button>
              <button type="button" data-base-layer="dark" onClick={() => this.activateBaseLayer('dark')}><span></span>Dunkel</button>
              <button type="button" data-base-layer="light" onClick={() => this.activateBaseLayer('light')}><span></span>Hell</button>
            </div>
            <span class="layer-group-title">Overlays</span>
            <div class="layer-list overlays">
              <button type="button" data-overlay-layer="aero" onClick={() => this.toggleOverlay('aero')}><span></span>VFR-Lufträume / Aero</button>
              <button type="button" data-overlay-layer="dfs" onClick={() => this.toggleOverlay('dfs')}><span></span>DFS ICAO 1:500k</button>
              <button type="button" data-overlay-layer="faa" onClick={() => this.toggleOverlay('faa')}><span></span>FAA VFR Sectional</button>
              <button type="button" data-overlay-layer="dwd" onClick={() => this.toggleOverlay('dwd')}><span></span>DWD Warnungen</button>
            </div>
            <p ref={this.layerStatusRef} class="layer-status">Online-Karten werden geladen</p>
          </aside>
          <button ref={this.followButtonRef} class="map-fab follow-button" type="button" aria-pressed="true" title="Auto-Follow aktiv" onClick={() => this.setFollow(!this.preferences.follow, true)}>
            <span class="follow-reticle" aria-hidden="true"></span><span>Follow</span>
          </button>
          <div ref={this.mapNoticeRef} class="map-notice">Warte auf Positionsdaten aus dem Simulator</div>
          <div class="flight-strip">
            <div>
              <span class="strip-label">Aktuelle Position</span>
              <p ref={this.mapPositionRef}>Warte auf Simulatorposition</p>
            </div>
            <p ref={this.mapFlightRef} class="strip-flight">Karte ist frei verschiebbar</p>
          </div>
          <div class="map-alpha-note">Alpha Map Shell · Route und Missionslayer folgen</div>
        </div>

        <div ref={this.statusScreenRef} class="ga-efb-status-view is-hidden">
          <div class="status-content">
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
              <span class="label">Mission · Read-only</span>
              <p ref={this.missionRef} class="mission-id">Warte auf Missionsdaten.</p>
              <p ref={this.missionPhaseRef} class="hint"></p>
              <p ref={this.missionScenesRef} class="hint compact"></p>
            </section>
            <section class="card">
              <span class="label">Alpha-Stufe 3</span>
              <p class="hint">Erste Vollflächen-Karte mit Live-Flugzeug und ausgewählten Kartentisch-Layern. Route, Missionsgeometrie und weitere Werkzeuge folgen über versionierte Tracker-Snapshots.</p>
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
