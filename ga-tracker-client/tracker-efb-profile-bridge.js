/* Local data/telemetry adapter for the unmodified standalone profile renderer.
 * No warning emitters or mission state machine run in this surface. */
var map = null, routeWaypoints = [], activeAirspaces = [], globalAirports = null;
var currentDepElev = null, currentDestElev = null, currentStartICAO = '', currentDestICAO = '';
var freqCache = {}, runwayCache = {}, currentDepFreq = '', currentDestFreq = '', currentSName = '', currentDName = '';
window.gaChecklistHost = {
    supportsTool: function(tool) { return tool !== 'weather'; }
};
var vpProfileLockIdx = -1, vpProfileLockSig = '';
var currentMissionData = null, smoothedGS = 0, smoothedVS = 0, gpsState = 'connected';
var isAutoFollow = true, lastAutoFollowPanAt = 0, lastAutoFollowPanPos = null;
var liveNextLegIndex = 0, liveActiveWpIndex = null;
function clampLiveWpIndex(idx) {
    return Math.max(0, Math.min(Number(idx) || 0, Math.max(0, routeWaypoints.length - 1)));
}
function isGpsLive(maxAgeMs) {
    return !!(window.lastLiveGpsPos && Date.now() - window.lastLiveGpsPos.t < (maxAgeMs || 30000));
}
window.gaTerrainAvoidTileUrl = function(z,x,y) { return '/api/v1/terrain-tiles/' + z + '/' + x + '/' + y + '.png'; };
var calcNav = window.GANavigationWarnings.calcNav;
var getDestinationPoint = window.GANavigationWarnings.getDestinationPoint;
var applyAirspaceLimitHeuristics = window.GANavigationWarnings.applyAirspaceLimitHeuristics;
var getAirspaceStyle = window.GANavigationWarningPresentation.style;
var getAirspaceDisplayName = window.GANavigationWarningPresentation.displayName;
function formatAsLimit(lim) {
    if (!lim) return '?';
    if (lim.referenceDatum === 0 && lim.value === 0) return 'GND';
    if (lim.unit === 6) return 'FL ' + lim.value;
    var u = lim.unit === 1 ? 'FT' : 'M';
    var r = lim.referenceDatum === 1 ? ' MSL' : (lim.referenceDatum === 0 ? ' AGL' : '');
    return lim.value + ' ' + u + r;
}
(function () {
    var routeKey = '', lastMotion = null, airspaceKey = '', airspacePending = false, spaceRetryAt = 0;
    var airportPromise = null, airportLoadedAt = 0, predictionPending = false, predictionAt = 0, predictionLayer = null;
    // Coherent may have fetch but no AbortController or ReadableStream. Local
    // JSON transport uses XHR so profile cancellation works there as well.
    function createAbortController() {
        if (typeof AbortController === 'function') return new AbortController();
        var listeners=[];
        var signal={aborted:false,
            addEventListener:function(type,fn){if(type==='abort')listeners.push(fn);},
            removeEventListener:function(type,fn){listeners=listeners.filter(function(item){return item!==fn;});}};
        return {signal:signal,abort:function(){if(signal.aborted)return;signal.aborted=true;listeners.slice().forEach(function(fn){fn();});listeners=[];}};
    }
    function localResponse(payload, signal) {
        return new Promise(function(resolve,reject){
            var xhr=new XMLHttpRequest(), settled=false;
            function finish(error,value){
                if(settled)return;settled=true;
                if(signal)signal.removeEventListener('abort',abort);
                if(error)reject(error);else resolve(value);
            }
            function abort(){var error=new Error('Aborted');error.name='AbortError';finish(error);xhr.abort();}
            if(signal&&signal.aborted){abort();return;}
            xhr.open('POST','/api/v1/profile-data',true);xhr.timeout=20000;
            xhr.setRequestHeader('Content-Type','application/json');
            xhr.onload=function(){finish(null,{ok:xhr.status>=200&&xhr.status<300,status:xhr.status,
                headers:{get:function(name){return xhr.getResponseHeader(name);}},
                text:function(){return Promise.resolve(xhr.responseText);},
                clone:function(){return this;},
                json:function(){return Promise.resolve().then(function(){return JSON.parse(xhr.responseText);});}});};
            xhr.onerror=function(){finish(new Error('Profil-Daten nicht verfügbar'));};
            xhr.ontimeout=function(){finish(new Error('Profil-Daten Zeitüberschreitung'));};
            if(signal)signal.addEventListener('abort',abort);
            xhr.send(JSON.stringify(payload));
        });
    }
    function request(kind, payload, signal) {
        return localResponse(Object.assign({kind:kind},payload),signal).then(function(res){
            if(!res.ok)throw new Error('Profil-Daten nicht verfügbar ('+res.status+')');
            return res.json();
        });
    }
    function refreshAirspaces(points, mode, areaKey) {
        if(mode !== vpMode) return;
        if (!points || points.length < 2 || airspacePending || Date.now() < spaceRetryAt) return;
        var key = mode + ':' + (areaKey || points.map(function(p){return p.lat.toFixed(2)+','+p.lon.toFixed(2)}).join('|'));
        if (key === airspaceKey) return;
        airspacePending = true;
        var requestedRoute = routeKey;
        request('airspaces', { points: points }).then(function(value) {
            if(mode !== vpMode || requestedRoute !== routeKey) return;
            activeAirspaces = Array.isArray(value) ? value : [];
            airspaceKey = key; window._activeAirspacesVersion = (window._activeAirspacesVersion || 0) + 1;
            window._vpAsCache = null; renderMapProfile();
        }).catch(function(error) { spaceRetryAt = Date.now() + 10000; console.warn('[EFB Profile]', error.message); })
          .then(function(){airspacePending=false;});
    }
    window.gaProfileDataProvider = {
        createAbortController:createAbortController,
        planningAltitudeFt:function(){return Number(document.getElementById('altMapInput').textContent);},
        fetch: function(url, options) {
            return localResponse({kind:'resource',url:String(url),body:options && options.body},options && options.signal);
        },
        terrain: function(points, signal, mode) {
            refreshAirspaces(points, mode);
            return request('terrain', {points: points}, signal);
        }
    };
    window.gaChecklistHost.airportUpdated = function() {
        if (window.gaChecklistCurrentView && ['radio','place','airport-info'].indexOf(window.gaChecklistCurrentView()) >= 0) window.gaChecklistRefresh();
    };
    var navpointLoadSeq=0;
    window.gaFetchNavpoints = function(bounds) { var seq=++navpointLoadSeq; return request('navpoints', { points: [
        {lat: bounds.south, lon: bounds.west, distNM: 0}, {lat: bounds.north, lon: bounds.east, distNM: 0}
    ]}).then(function(points){if(seq===navpointLoadSeq)cachedNavData=points;return points;}); };
    window.gaAirportDetailsHost = {
        snapshots: function(bounds) { return request('airports', {points: [
            {lat: bounds.south, lon: bounds.west, distNM: 0}, {lat: bounds.north, lon: bounds.east, distNM: 0}
        ]}); },
        fetchWithTimeout: function(url, timeoutMs) {
            var controller = createAbortController();
            var timer = setTimeout(function(){controller.abort();}, timeoutMs);
            return window.gaProfileDataProvider.fetch(url, {signal: controller.signal}).then(function(value){clearTimeout(timer);return value;}, function(error){clearTimeout(timer);throw error;});
        }
    };
    window.gaAirportWeatherHost = {cache: {}, fetchWithTimeout: window.gaAirportDetailsHost.fetchWithTimeout};
    window.gaMapContextHost = {
        pane: 'gaGeometryPane',
        cachedFeature: function(latlng) {
            var candidates = Object.keys(globalAirports || {}).map(function(icao) {
                var apt = globalAirports[icao];
                if (Math.abs(apt.lat-latlng.lat) > 0.5 || Math.abs(apt.lon-latlng.lng) > 0.5) return null;
                // airports.json elevation is already feet, unlike OpenAIP's quantity.
                return normalizeMapContextAirportFeature(Object.assign({}, apt, {icao:icao,
                    elevation: apt.elevation == null ? null : {value:apt.elevation,unit:1}}));
            });
            return findNearestMapContextFeature(candidates,latlng);
        },
        terrain: function(latlng) { return request('terrain', {points:[{lat:latlng.lat,lon:latlng.lng,distNM:0}]}).then(function(rows){return rows[0] && rows[0].elevFt;}); }
    };
    // Point popups request the same raw snapshot for both independent sections;
    // coalesce them locally instead of fetching/normalizing separate UI models.
    var popupSnapshotPending = {};
    window.gaGetAviationSnapshotForBounds = function(bounds) {
        var key = JSON.stringify(bounds);
        if (!popupSnapshotPending[key]) popupSnapshotPending[key] = request('aviation', {points:[
            {lat:bounds.south,lon:bounds.west,distNM:0},{lat:bounds.north,lon:bounds.east,distNM:0}
        ]}).then(function(value){delete popupSnapshotPending[key];return value;},function(error){delete popupSnapshotPending[key];throw error;});
        return popupSnapshotPending[key];
    };
    window.gaGetAviationCollectionForBounds = function(collection,bounds) {
        return window.gaGetAviationSnapshotForBounds(bounds).then(function(value){return value[collection] || [];});
    };
    window.gaChecklistHost.fetch = window.gaProfileDataProvider.fetch;
    window.gaChecklistHost.createAbortController = createAbortController;
    window.gaMapRadarFetch = window.gaProfileDataProvider.fetch;
    window.fetchRouteAirspaces = function(points) {
        return request('airspaces', {points: points.map(function(p,i) {return {lat:p.lat,lon:p.lon == null ? p.lng : p.lon,distNM:i};})})
            .then(function(value) {activeAirspaces=Array.isArray(value)?value:[];window._activeAirspacesVersion=(window._activeAirspacesVersion||0)+1;window._vpAsCache=null;});
    };
    window.loadGlobalAirports = function() {
        if (globalAirports && Date.now() - airportLoadedAt < 3600000) return Promise.resolve();
        if (!airportPromise) airportPromise = request('resource', {url:'./airports.json'}).then(function(value){globalAirports=value;airportLoadedAt=Date.now();airportPromise=null;})
            .catch(function(error){airportPromise=null;throw error;});
        return airportPromise;
    };
    window.handleSliderChange = function(kind,value) {
        if(kind==='alt') {
            localStorage.setItem('ga_perf_alt',value);
            window.scheduleTerrainAvoidOverlayUpdate(true);
        }
        window.activateFastRender(); renderMapProfile();
    };
    window.handleRateChange = function(value) {
        vpClimbRate=value;vpDescentRate=value;localStorage.setItem('ga_perf_rate',value);
        window.activateFastRender();renderMapProfile();
    };
    window.gaEfbProfile = {
        disconnected:function(){
            window._hdgAutoActivated=false;window.lastLiveGpsPos=null;
            window.liveTrackerConnected=false;window.lastLiveFlightData=null;
            if(window.gaUpdateMapContextOwnAltitude)window.gaUpdateMapContextOwnAltitude(null);
            window.resetMapAutoZoomState();window.terrainAvoidHandleFlightState();
            if(predictionLayer)predictionLayer.clear();
            window.vpPredictionData=[];window.vpTrafficData=[];lastMotion=null;smoothedGS=0;smoothedVS=0;
            window.vpEnsureRouteMode();
        },
        update: function(snapshot, flight, leafletMap) {
            map=leafletMap;
            liveNextLegIndex=Number(snapshot && snapshot.navigation && snapshot.navigation.activeLegIndex) || 0;
            vpMapProfileVisible = !document.body.classList.contains('profile-hidden');
            var context=snapshot && snapshot.context || {};
            if(Number.isFinite(context.tasKts)&&context.tasKts>0)gaProfileDataProvider.tasKts=context.tasKts;
            var route=snapshot && snapshot.route, points=route && route.waypoints || [];
            var key=[context.departureIcao,context.destinationIcao,points.map(function(p){return p.lat+','+p.lon+','+airportElevation(p,p.icao || p.name);}).join('|')].join(':');
            if(key!==routeKey) {
                routeKey=key;routeWaypoints=points;
                renderRouteLegLabels();
                currentStartICAO=context.departureIcao || points[0] && points[0].name || '';currentDestICAO=context.destinationIcao || points.length && points[points.length-1].name || '';
                currentSName=points[0] && points[0].name || '';currentDName=points.length && points[points.length-1].name || '';
                currentDepElev=airportElevation(points[0],currentStartICAO);currentDestElev=airportElevation(points[points.length-1],currentDestICAO);
                var planned=snapshot && snapshot.profile;
                var alt=document.getElementById('altMapInput');
                if(alt)alt.textContent=Number(localStorage.getItem('ga_perf_alt')) || context.profileCruiseFt || planned && planned.cruiseAltitudeFt || 4500;
                vpClimbRate=Number(localStorage.getItem('ga_perf_rate')) || context.profileClimbFpm || 500;
                vpDescentRate=Number(localStorage.getItem('ga_perf_rate')) || context.profileDescentFpm || 500;
                document.getElementById('rateMapInput').textContent=vpClimbRate;
                if(points.length>=2)triggerVerticalProfileUpdate();
                else {
                    if(window.vpFetchController)window.vpFetchController.abort();
                    clearTimeout(vpProfileFastTimeout);clearTimeout(vpProfileSlowTimeout);
                    vpElevationData=null;window.vpElevationData=null;window._lastVpRouteKey=null;
                    vpHighResData=null;vpAltWaypoints=[];vpSegmentAlts=[];
                    clearTimeout(vpHighResFetchTimeout);
                    vpProfileLockIdx=-1;vpProfileLockSig='';vpLiveGpsFraction=-1;
                    if(vpMode!=='HDG') ['mapProfileCanvas','mapProfileCanvasBg'].forEach(function(id){
                        var canvas=document.getElementById(id);if(canvas)canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
                    });
                }
            }
            if(flight) {
                var at=Number(flight.capturedAt) || Date.now();
                var gps={lat:flight.lat,lon:flight.lon,alt:flight.altFt,hdg:flight.headingDeg,t:at,gs:flight.gsKts};
                window.lastLiveGpsPos=gps;
                if(window.gaUpdateMapContextOwnAltitude)window.gaUpdateMapContextOwnAltitude(gps.alt);
                window.liveTrackerConnected=true;
                // Same one-second altitude-derived V/S and EMA as sync.js.
                if(!lastMotion || at-lastMotion.t>15000 || calcNav(gps.lat,gps.lon,lastMotion.lat,lastMotion.lon).dist>10) {lastMotion=gps;smoothedGS=0;smoothedVS=0;}
                else if(at-lastMotion.t>1000) {
                    var vs=(gps.alt-lastMotion.alt)*60000/(at-lastMotion.t),gs=Number(flight.gsKts)||0;
                    smoothedGS=smoothedGS===0?gs:smoothedGS*.7+gs*.3;
                    smoothedVS=smoothedVS===0?vs:smoothedVS*.7+vs*.3;lastMotion=gps;
                }
                if(smoothedGS>20&&!window._hdgAutoActivated&&vpMode==='ROUTE') {window._hdgAutoActivated=true;vpToggleMode();}
                vpUpdateLiveProfilePosition(flight.lat,flight.lon,flight.altFt,flight.headingDeg,true);
                if(smoothedGS<=30) {
                    if(predictionLayer)predictionLayer.clear();
                    window.vpPredictionData=[];
                } else if(Date.now()-predictionAt>1000) {
                    predictionAt=Date.now();
                    var predictions=window.GAMapPrediction.points(gps,smoothedGS,smoothedVS);
                    window.vpPredictionData=predictions;
                    if(!predictionLayer)predictionLayer=window.GAMapPrediction.createLayer(L,map,{pane:'gaPreviewPane',renderer:L.svg({pane:'gaPreviewPane'})});
                    predictionLayer.render(gps,predictions);
                    // Map predictions need airspaces even with the profile hidden.
                    if(!vpMapProfileVisible && (vpMode==='HDG'||!window._lastVpRouteKey)) refreshAirspaces([gps].concat(predictions),vpMode,
                        gps.lat.toFixed(1)+'_'+gps.lon.toFixed(1));
                    if(!predictionPending) {
                        predictionPending=true;
                        request('terrain',{points:predictions}).then(function(terrain){
                            if(window.vpPredictionData!==predictions)return;
                            var results=predictions.map(function(p,i){
                                var elevation=terrain[i] && terrain[i].elevFt;
                                return {terrainFt:elevation,threat:window.GANavigationWarnings.terrainThreat(elevation,p.alt)};
                            });
                            window.GAMapPrediction.applyTerrain(predictions,results,_getAirspaceColorForPredPoint);
                            predictionLayer.colorize(predictions,_getAirspaceColorForPredPoint);
                            vpRequestMapProfileFrameNow();
                        }).catch(function(error){console.warn('[EFB Profile prediction]',error.message);})
                          .then(function(){predictionPending=false;});
                    }
                }
                // Identical spatial/time gates to standalone's GPS cache refresh.
                if(smoothedGS>30 && vpMapProfileVisible && (vpMode==='HDG'||!window._lastVpRouteKey)) {
                    var obsKey=gps.lat.toFixed(1)+'_'+gps.lon.toFixed(1),now=Date.now();
                    if(window._lastGpsObsKey!==obsKey||!window._lastGpsObsTime||now-window._lastGpsObsTime>120000) {
                        window._lastGpsObsKey=obsKey;window._lastGpsObsTime=now;
                        fetchGpsObstacles(gps.lat,gps.lon).catch(function(error){console.warn('[EFB Profile obstacles]',error.message);});
                    }
                    var cityKey=gps.lat.toFixed(2)+'_'+gps.lon.toFixed(2);
                    if(window._lastGpsCityKey!==cityKey) {
                        window._lastGpsCityKey=cityKey;
                        updateGpsCities(gps.lat,gps.lon).catch(function(error){console.warn('[EFB Profile cities]',error.message);});
                    }
                } else {window._lastGpsObsKey=null;window._lastGpsCityKey=null;}

            }
            window.terrainAvoidHandleFlightState();
            window.scheduleTerrainAvoidOverlayUpdate();
            if(vpMapProfileVisible) vpRequestMapProfileFrameNow();else vpPauseMapProfile('profile-hidden');
        }
    };
    document.addEventListener('DOMContentLoaded', function(){
        var rate=Number(localStorage.getItem('ga_perf_rate'))||500;
        vpClimbRate=rate;vpDescentRate=rate;document.getElementById('rateMapInput').textContent=rate;
    });
})();

var mapClickLoadSeq = 0;
var cachedNavData = [], openAipRegionState = {payload: {}}, storedAirportOverlayState = {};
function getAirportDatabaseForMapClicks() { return globalAirports; }
function getOpenAipNavaidCacheBounds() { return map && map.getBounds(); }
function getStaticOpenAipNavaidEntries() { return []; }
function getStaticOpenAipReportingPointEntries() { return []; }
function airportElevation(point, icao) {
    var value = point && point.elevationFt;
    if(value == null) value = globalAirports && globalAirports[icao] && globalAirports[icao].elevation;
    return value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
}
window.gaMapSingleClickHost = {
    load: function(tap) {
        var bounds = {south:tap.lat-.1,north:tap.lat+.1,west:tap.lng-.1,east:tap.lng+.1};
        var seq=++mapClickLoadSeq;
        return Promise.all([loadGlobalAirports(),
            gaGetAviationSnapshotForBounds(bounds).then(function(value){if(seq===mapClickLoadSeq)openAipRegionState.payload=value;}),
            gaFetchNavpoints(bounds).then(function(value){if(seq===mapClickLoadSeq)cachedNavData=value;})
        ].map(function(task){return task.catch(function(){return null;});}));
    }
};
