/* Standalone prediction points and Leaflet presentation shared by App/EFB.
 * Terrain data is supplied by the host; this renderer never emits warnings. */
(function(root, factory) {
    const api = factory(typeof module === 'object' && module.exports ? require('./navigation-warning-core') : root.GANavigationWarnings);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GAMapPrediction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(navigation) {
    function points(gps, gs, vs) {
        return [1, 2, 5, 10].map(min => {
            const distNM = gs * (min / 60);
            const pt = navigation.getDestinationPoint(gps.lat, gps.lon, distNM, gps.hdg);
            const alt = Math.max(0, gps.alt + vs * min);
            return {lat:pt.lat, lon:pt.lon, min, distNMAhead:distNM, altFt:alt, alt, threat:'green'};
        });
    }
    function applyTerrain(predictions, results, airspaceColor) {
        predictions.forEach((point, i) => {
            const result = results[i];
            if (!result) return;
            point.threat = result.threat;
            point.terrainFt = result.terrainFt;
            point.asColor = result.threat === 'green' && airspaceColor ? airspaceColor(point) || null : null;
        });
    }
    function createLayer(L, map, pathOptions = {}) {
        let line = null, markers = [];
        function colorize(predictions, airspaceColor) {
            let worst = 'green';
            for (const point of predictions) {
                if (point.threat === 'red') { worst = 'red'; break; }
                if (point.threat === 'amber') worst = 'amber';
            }
            if (line) line.setStyle({color:worst === 'red' ? '#ff2222' : worst === 'amber' ? '#ffaa00' : '#ffffff'});
            markers.forEach((marker, i) => {
                const point = predictions[i];
                // The original map still colors airspace when terrain is unknown;
                // the profile's asColor stays limited to confirmed green terrain.
                const color = point?.threat === 'red' ? '#ff2222' : point?.threat === 'amber' ? '#ffaa00'
                    : point?.asColor || (point && airspaceColor && airspaceColor(point)) || '#ffffff';
                marker.setStyle({color, fillColor:color});
            });
        }
        function render(gps, predictions) {
            const coords = [[gps.lat, gps.lon], ...predictions.map(p => [p.lat, p.lon])];
            if (!line) line = L.polyline(coords, {...pathOptions,
                color:'#ffffff', weight:2, opacity:0.7, dashArray:'8, 6', interactive:false}).addTo(map);
            else line.setLatLngs(coords);
            while (markers.length < predictions.length) {
                const marker = L.circleMarker([0, 0], {...pathOptions,
                    radius:4, color:'#ffffff', fillColor:'#ffffff', fillOpacity:0.9, weight:1.5, interactive:false}).addTo(map);
                marker.bindTooltip('', {permanent:true, direction:'top', offset:[0,-8], className:'prediction-tooltip'});
                markers.push(marker);
            }
            predictions.forEach((p, i) => { markers[i].setLatLng([p.lat,p.lon]); markers[i].setTooltipContent(`${p.min}m`); });
            // Keep the last terrain colors until the next lookup completes,
            // as in Standalone, instead of flashing white on each position update.
        }
        function clear() {
            if (line) line.remove();
            line = null;
            markers.forEach(marker => marker.remove());
            markers = [];
        }
        return {render, colorize, clear};
    }
    return {points, applyTerrain, createLayer};
});
