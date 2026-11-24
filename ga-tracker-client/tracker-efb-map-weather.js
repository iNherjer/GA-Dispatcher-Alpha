/* Coherent adapter for the shared weather symbols and VFR models. */
(function () {
    var MAP_WEATHER_SOURCE_KEY = 'ga_map_weather_source';
    var MAX_AGE_MS = 30 * 60 * 1000;

    window.getMapWeatherSource = function () {
        var source = localStorage.getItem(MAP_WEATHER_SOURCE_KEY);
        if (source === 'metar') return source;
        return window.GA_DWD_WEATHER_URL && source !== 'openmeteo' ? 'dwd' : 'openmeteo';
    };

    window.gaInstallEfbMapWeather = function (map, renderer) {
        var modelLayer = L.layerGroup().addTo(map);
        var vfrLayer = L.layerGroup().addTo(map);
        var sectorLayer = L.layerGroup().addTo(map);
        var sectorMode = localStorage.getItem('ga_vfr_index_model') !== 'internal';
        var sectorData, sectorRequest, sectorKey = '', sectorsLoadedAt = 0;
        var updateVfrOptions = function () {};
        var seenKey = '', loadedAt = 0, pending = null, timer = null;
        var visible = true;
        var dwdCheckAt = 0;
        var updateSourceButton = function () {
            var button = document.getElementById('btnToggleMapWeatherSource');
            if (!button) return;
            var source = window.getMapWeatherSource();
            var label = { dwd:'DWD ICON-EU', openmeteo:'Open-Meteo', metar:'METAR' }[source];
            button.textContent = '🌐 ' + label;
            button.title = window.GA_DWD_WEATHER_URL ? 'DWD ICON-EU / Open-Meteo / METAR' : 'Open-Meteo / METAR';
        };
        function checkDwdWeather() {
            if (window.GA_DWD_WEATHER_URL || Date.now() < dwdCheckAt) return;
            dwdCheckAt = Date.now() + 60000;
            window.gaCheckDwdWeather().then(function(available) {
                updateSourceButton();
                if (available) schedule();
            });
        }
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
        function fetchJson(url, signal) {
            return window.gaProfileDataProvider.fetch(url, {signal:signal}).then(function(response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            });
        }
        function metarSamples(bounds, signal) {
            var bbox = bounds.map(function(value) { return value.toFixed(3); }).join(',');
            return fetchJson('https://aviationweather.gov/api/data/metar?format=json&bbox=' + bbox, signal).then(function(rows) {
                if (!Array.isArray(rows)) return [];
                return rows.map(function(row) {
                    var covers = { FEW:25, SCT:50, BKN:80, OVC:100, VV:100 };
                    var clouds = [0,0,0];
                    (Array.isArray(row.clouds) ? row.clouds : []).forEach(function(cloud) {
                        if (cloud.base == null || !Number.isFinite(Number(cloud.base))) return;
                        var band = cloud.base < 3500 ? 0 : cloud.base < 10000 ? 1 : 2;
                        clouds[band] = Math.max(clouds[band], covers[cloud.cover] || 0);
                    });
                    return {lat:row.lat, lon:row.lon, wspd:row.wspd, wdir:row.wdir,
                        cloudLowPct:clouds[0], cloudMidPct:clouds[1], cloudHighPct:clouds[2]};
                });
            });
        }
        function clearSectors() {
            if (sectorRequest) sectorRequest.abort();
            sectorRequest = null;
            sectorKey = '';
            sectorLayer.clearLayers();
        }
        function loadSectors() {
            if (!sectorData) {
                sectorData = new Promise(function(resolve,reject) {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', '/efb/v1/assets/data/gafor-sector-dataset-de.json');
                    xhr.timeout = 8000;
                    xhr.onload = function() {
                        try {
                            if (xhr.status !== 200) throw new Error('GAFOR HTTP ' + xhr.status);
                            var data = JSON.parse(xhr.responseText);
                            resolve(Object.keys(data.sectors).map(function(id) {
                                var polygon = data.sectors[id];
                                return {id:id, polygon:polygon, bounds:L.latLngBounds(polygon), meta:data.sectorMeta[id]};
                            }));
                        } catch (error) { reject(error); }
                    };
                    xhr.onerror = xhr.ontimeout = function() { reject(new Error('GAFOR dataset unavailable')); };
                    xhr.send();
                }).catch(function(error) { sectorData = null; throw error; });
            }
            return sectorData;
        }
        function readSectorBatch(sectors, signal) {
            var probes = sectors.map(function(sector) { return sector.meta.probe; });
            var hour = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString().slice(0,16);
            var url = 'https://api.open-meteo.com/v1/forecast?models=best_match&timezone=UTC&wind_speed_unit=kn' +
                '&start_hour=' + hour + '&end_hour=' + hour +
                '&hourly=visibility,cloud_cover_low,cloud_cover_mid,cloud_cover,temperature_2m,dew_point_2m,relative_humidity_2m,weather_code,precipitation,wind_speed_10m' +
                '&latitude=' + probes.map(function(point) { return point.lat; }).join(',') +
                '&longitude=' + probes.map(function(point) { return point.lon; }).join(',');
            return fetchJson(url, signal).then(function(data) {
                return (Array.isArray(data) ? data : [data]).map(function(row, index) {
                    var sector = sectors[index], values = row && row.hourly;
                    if (!sector || !values || !values.visibility || !Number.isFinite(values.visibility[0])) return null;
                    return {sector:sector, category:vpClassifyGaforLike({
                        countryCode:'DE', sectorId:sector.id, sectorRefFt:sector.meta.refFt, terrainPointFt:row.elevation * 3.28084,
                        visibility:values.visibility[0], cloudLow:values.cloud_cover_low[0], cloudMid:values.cloud_cover_mid[0],
                        cloudTotal:values.cloud_cover[0], temp2mC:values.temperature_2m[0], dewPoint2mC:values.dew_point_2m[0],
                        rh2mPct:values.relative_humidity_2m[0], weatherCode:values.weather_code[0],
                        precipitation:values.precipitation[0], wind:values.wind_speed_10m[0]
                    })};
                });
            });
        }
        function refreshSectors() {
            loadSectors().then(function(all) {
                if (!visible || document.hidden || !sectorMode || !on('vfrIndex') || map.getZoom() < 5 || map.getZoom() >= 15) return;
                var bounds = map.getBounds();
                var sectors = all.filter(function(sector) { return sector.meta && sector.meta.probe && sector.bounds.intersects(bounds); });
                var key = sectors.map(function(sector) { return sector.id; }).join(',');
                if (!key) { clearSectors(); return; }
                if (sectorRequest && sectorRequest.key === key) return;
                if (sectorRequest) {
                    sectorRequest.abort();
                    sectorRequest = null;
                }
                if (key === sectorKey && Date.now() - sectorsLoadedAt < MAX_AGE_MS) return;
                var controller = window.gaProfileDataProvider.createAbortController();
                controller.key = key;
                sectorRequest = controller;
                var batches = [];
                for (var i = 0; i < sectors.length; i += 20) {
                    batches.push(readSectorBatch(sectors.slice(i,i+20), controller.signal));
                }
                return Promise.all(batches).then(function(rows) {
                    if (sectorRequest !== controller || controller.signal.aborted) return;
                    sectorLayer.clearLayers();
                    rows.forEach(function(batch) { batch.forEach(function(result) {
                        if (!result) return;
                        var sector = result.sector, cat = result.category;
                        L.polygon(sector.polygon, {pane:'gaWeatherPane', renderer:renderer,
                            interactive:false, color:cat.color, weight:2, fillOpacity:0.18}).addTo(sectorLayer);
                    }); });
                    sectorRequest = null;
                    sectorKey = key;
                    sectorsLoadedAt = Date.now();
                }, function(error) {
                    if (sectorRequest !== controller) return;
                    sectorRequest = null;
                    throw error;
                });
            }).catch(function(error) { console.warn('[EFB GAFOR]', error.message); });
        }
        function refresh() {
            timer = null;
            if (!visible || document.hidden) return;
            var wind = on('weather') && on('windBarbs');
            var clouds = on('weather') && on('cloudFields');
            var zoom = map.getZoom();
            var sectors = on('vfrIndex') && sectorMode && zoom >= 5 && zoom < 15;
            var vfr = on('vfrIndex') && !sectorMode && zoom >= 8 && zoom < 15;
            if (sectors) refreshSectors();
            else clearSectors();
            if (!wind && !clouds) modelLayer.clearLayers();
            if (!vfr) vfrLayer.clearLayers();
            if (!wind && !clouds && !vfr) {
                if (pending) pending.abort();
                pending = null;
                seenKey = '';
                if (sectors) timer = setTimeout(refresh, MAX_AGE_MS);
                return;
            }
            var source = window.getMapWeatherSource();
            var bounds = map.getBounds();
            var metarBounds = [bounds.getSouth(),bounds.getWest(),bounds.getNorth(),bounds.getEast()];
            var wantsModel = wind || clouds;
            var wantsMetar = wantsModel && source === 'metar' && zoom >= 6 &&
                metarBounds[1] < metarBounds[3] && metarBounds[1] >= -180 && metarBounds[3] <= 180;
            var grid = vfr || source !== 'metar' ? getMapWeatherGridPoints(8, 6) : {key:'', points:[]};
            if (!grid.points.length && !wantsMetar) {
                if (pending) pending.abort();
                pending = null;
                modelLayer.clearLayers();
                vfrLayer.clearLayers();
                seenKey = '';
                if (sectors) timer = setTimeout(refresh, MAX_AGE_MS);
                return;
            }
            var maxAge = wantsMetar ? 5 * 60000 : MAX_AGE_MS;
            var key = [grid.key, grid.points.map(function(point) { return point.lat + ',' + point.lon; }).join(';'),
                source, wind, clouds, vfr, wantsMetar && metarBounds.map(function(value) { return value.toFixed(1); }).join(',')].join('|');
            if (pending && pending.key === key) return;
            if (key === seenKey && Date.now() - loadedAt < maxAge) {
                if (pending) pending.abort();
                pending = null;
                timer = setTimeout(refresh, maxAge - (Date.now() - loadedAt));
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
            var openMeteo = vfr || (wantsModel && source === 'openmeteo') ? read(false) : Promise.resolve([]);
            var model = wantsMetar ? metarSamples(metarBounds, controller.signal).catch(function(error) {
                if (!controller.signal.aborted) console.warn('[EFB Map METAR]', error.message);
                return [];
            }) : source === 'metar' ? Promise.resolve([]) : wantsModel && source === 'dwd' ? read(true) : openMeteo;
            Promise.all([model,openMeteo]).then(function(results) {
                if (pending !== controller || controller.signal.aborted) return;
                pending = null;
                modelLayer.clearLayers();
                vfrLayer.clearLayers();
                if (wantsModel) results[0].forEach(function(sample) { displayModelWeather(sample,wind,clouds); });
                if (vfr) results[1].forEach(function(sample) { displayVfrWeather(sample,grid); });
                seenKey = key;
                loadedAt = Date.now();
                timer = setTimeout(refresh, maxAge);
            });
        }
        function schedule() {
            clearTimeout(timer);
            updateVfrOptions();
            if (visible && !document.hidden) {
                checkDwdWeather();
                timer = setTimeout(refresh, 450);
            }
            else {
                if (pending) pending.abort();
                pending = null;
                modelLayer.clearLayers();
                vfrLayer.clearLayers();
                clearSectors();
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
            var sources = window.GA_DWD_WEATHER_URL ? ['dwd','openmeteo','metar'] : ['openmeteo','metar'];
            localStorage.setItem(MAP_WEATHER_SOURCE_KEY, sources[(sources.indexOf(window.getMapWeatherSource()) + 1) % sources.length]);
            updateSourceButton();
            schedule();
        };
        updateSourceButton();
        schedule();
        return {
            isVfrOn:function(){ return on('vfrIndex'); },
            toggleVfr:function(){ window.toggleMapHint('vfrIndex'); },
            installOptions:function(panel) {
                var row = document.createElement('div');
                row.className = 'ga-map-satellite-options';
                var choice = document.createElement('select');
                choice.setAttribute('aria-label', 'VFR-Index');
                choice.add(new Option('GAFOR-Sektoren / Sectors (DE)', 'gafor_sector'));
                choice.add(new Option('Kacheln / Tiles', 'internal'));
                choice.value = sectorMode ? 'gafor_sector' : 'internal';
                choice.addEventListener('change', function() {
                    sectorMode = choice.value === 'gafor_sector';
                    localStorage.setItem('ga_vfr_index_model', choice.value);
                    schedule();
                });
                row.appendChild(choice);
                panel.appendChild(row);
                updateVfrOptions = function() { row.hidden = !on('vfrIndex'); };
                updateVfrOptions();
            },
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
