/* Coherent adapter for the shared weather symbols and internal VFR grid model. */
(function () {
    var MAP_WEATHER_SOURCE_KEY = 'ga_map_weather_source';
    var MAX_AGE_MS = 30 * 60 * 1000;

    window.getMapWeatherSource = function () {
        return window.GA_DWD_WEATHER_URL && localStorage.getItem(MAP_WEATHER_SOURCE_KEY) === 'dwd' ? 'dwd' : 'openmeteo';
    };

    window.gaInstallEfbMapWeather = function (map, renderer) {
        var modelLayer = L.layerGroup().addTo(map);
        var vfrLayer = L.layerGroup().addTo(map);
        var seenKey = '', loadedAt = 0, pending = null, timer = null;
        var visible = true;
        var updateSourceButton = function () {
            var button = document.getElementById('btnToggleMapWeatherSource');
            if (!button) return;
            var source = window.getMapWeatherSource();
            var label = source === 'dwd' ? 'DWD ICON-EU' : 'Open-Meteo';
            button.textContent = '🌐 ' + label;
            button.disabled = !window.GA_DWD_WEATHER_URL;
            button.title = window.GA_DWD_WEATHER_URL ? 'DWD ICON-EU / Open-Meteo' : 'DWD ICON-EU: lokaler Wetterdienst nicht erreichbar';
        };
        function on(key) { return window.isMapHintEnabled(key); }
        function displayModelWeather(sample, wind, clouds) {
            if (!sample || !Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) return;
            if (clouds) {
                var cloud = createCloudFieldMarker(sample.lat, sample.lon, sample.cloudLowPct, sample.cloudMidPct, sample.cloudHighPct, 47);
                if (cloud) {
                    cloud.options.pane = 'gaWeatherPane';
                    cloud.addTo(modelLayer);
                }
            }
            if (wind && Number.isFinite(sample.wdir) && Number.isFinite(sample.wspd)) {
                L.marker([sample.lat,sample.lon], {
                    icon:buildWindBarbIcon(sample.wdir,sample.wspd),pane:'gaWeatherPane',interactive:false,keyboard:false
                }).addTo(modelLayer);
            }
        }
        function displayVfrWeather(sample, grid) {
            if (!sample || !Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) return;
            var category = vpClassifyInternalVfr(vpSampleToParts(sample));
            var halfLat = grid.latStep * 0.48, halfLon = grid.lonStep * 0.48;
            L.rectangle([
                [sample.lat-halfLat,sample.lon-halfLon], [sample.lat+halfLat,sample.lon+halfLon]
            ], {
                pane:'gaWeatherPane', renderer:renderer, interactive:false, color:category.color,
                weight:1, opacity:0.65, fillOpacity:0.20
            }).addTo(vfrLayer);
        }
        function refresh() {
            timer = null;
            if (!visible || document.hidden) return;
            var wind = on('weather') && on('windBarbs');
            var clouds = on('weather') && on('cloudFields');
            var zoom = map.getZoom();
            var vfr = on('vfrIndex') && zoom >= 8 && zoom < 15;
            if (!wind && !clouds) modelLayer.clearLayers();
            if (!vfr) vfrLayer.clearLayers();
            if (!wind && !clouds && !vfr) {
                if (pending) pending.abort();
                pending = null;
                seenKey = '';
                return;
            }
            var grid = getMapWeatherGridPoints(8, 6);
            if (!grid.points.length) {
                modelLayer.clearLayers();
                vfrLayer.clearLayers();
                seenKey = '';
                return;
            }
            var source = window.getMapWeatherSource();
            var key = [grid.key, grid.points.map(function(point) { return point.lat + ',' + point.lon; }).join(';'),
                source, wind, clouds, vfr].join('|');
            if (pending && pending.key === key) return;
            if (key === seenKey && Date.now() - loadedAt < MAX_AGE_MS) {
                timer = setTimeout(refresh, MAX_AGE_MS - (Date.now() - loadedAt));
                return;
            }
            if (pending) pending.abort();
            var controller = window.gaProfileDataProvider.createAbortController();
            controller.key = key;
            pending = controller;
            var options = { signal:controller.signal, maxConcurrency:3, includePressure:false };
            var read = function (dwd) {
                var fetchPoints = dwd ? window.fetchDwdWeatherPoints : window.fetchOpenMeteoWeatherPoints;
                return fetchPoints(grid.points, options).catch(function(error) {
                    if (!controller.signal.aborted) console.warn('[EFB Map Weather]', error.message);
                    return [];
                });
            };
            var wantsModel = wind || clouds;
            var openMeteo = vfr || (wantsModel && source === 'openmeteo') ? read(false) : Promise.resolve([]);
            var model = wantsModel && source === 'dwd' ? read(true) : openMeteo;
            Promise.all([model,openMeteo]).then(function(results) {
                if (pending !== controller || controller.signal.aborted) return;
                pending = null;
                modelLayer.clearLayers();
                vfrLayer.clearLayers();
                if (wantsModel) results[0].forEach(function(sample) { displayModelWeather(sample,wind,clouds); });
                if (vfr) results[1].forEach(function(sample) { displayVfrWeather(sample,grid); });
                seenKey = key;
                loadedAt = Date.now();
                timer = setTimeout(refresh, MAX_AGE_MS);
            });
        }
        function schedule() {
            clearTimeout(timer);
            if (visible && !document.hidden) timer = setTimeout(refresh, 450);
            else {
                if (pending) pending.abort();
                pending = null;
                modelLayer.clearLayers();
                vfrLayer.clearLayers();
                seenKey = '';
            }
        }
        map.on('moveend zoomend', schedule);
        document.addEventListener('visibilitychange', schedule);
        var board = map.getContainer().closest('#mapTableOverlay');
        if (board) {
            visible = board.classList.contains('active');
            new MutationObserver(function() {
                var next = board.classList.contains('active');
                if (next === visible) return;
                visible = next;
                schedule();
            }).observe(board,{attributes:true,attributeFilter:['class']});
        }
        window.gaRefreshEfbMapWeather = schedule;
        window.toggleMapWeatherSource = function () {
            if (!window.GA_DWD_WEATHER_URL) return;
            localStorage.setItem(MAP_WEATHER_SOURCE_KEY, window.getMapWeatherSource() === 'dwd' ? 'openmeteo' : 'dwd');
            updateSourceButton();
            schedule();
        };
        updateSourceButton();
        window.gaCheckDwdWeather().then(function(available) {
            updateSourceButton();
            if (available) schedule();
        });
        schedule();
        return {
            isVfrOn:function(){ return on('vfrIndex'); },
            toggleVfr:function(){ window.toggleMapHint('vfrIndex'); },
            fieldsState:function(){
                if (!on('weather')) return false;
                return on('windBarbs') === on('cloudFields') ? on('windBarbs') : 'mixed';
            },
            toggleFields:function(){
                var enabled = !this.fieldsState();
                if (enabled && !on('weather')) window.toggleMapHint('weather');
                ['windBarbs','cloudFields'].forEach(function(key){
                    if (on(key) !== enabled) window.toggleMapHint(key);
                });
            }
        };
    };
}());
