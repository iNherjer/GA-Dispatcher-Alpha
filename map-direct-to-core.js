/* Pure Direct-To route construction shared by App and tracker. No mission effects. */
(function(root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GAMapDirectToCore = api;
})(typeof window !== 'undefined' ? window : null, function() {
    'use strict';
    function buildRoute(startPoint, destAirport, startName, startIcao) {
        return [
            { lat: startPoint.lat, lng: startPoint.lng, lon: startPoint.lng,
                name: startName || startIcao || 'Start', icao: startIcao || undefined, elevationFt: startPoint.elevationFt == null ? null : startPoint.elevationFt },
            { lat: destAirport.lat, lng: destAirport.lon, lon: destAirport.lon,
                name: destAirport.name || destAirport.icao, icao: destAirport.icao, elevationFt: destAirport.elevationFt == null ? (destAirport.elevation == null ? null : destAirport.elevation) : destAirport.elevationFt }
        ];
    }
    function selectStart(options) {
        var points = options.route || [];
        if (points.length >= 2 && !options.forceGpsStart) {
            return { lat: points[0].lat, lng: points[0].lng == null ? points[0].lon : points[0].lng, existing: true, elevationFt: points[0].elevationFt };
        }
        if (options.gpsLive && options.position) return { lat: options.position.lat, lng: options.position.lon, existing: false };
        return null;
    }
    return { buildRoute: buildRoute, selectStart: selectStart };
});
