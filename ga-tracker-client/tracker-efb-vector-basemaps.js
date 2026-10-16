(function(root) {
  'use strict';
  var libraryPromise = null;
  var rendererUrl = '/efb/v1/assets/vector-renderer.js';
  var scripts = document.getElementsByTagName('script');
  for (var index = 0; index < scripts.length; index++) {
    var src = scripts[index].getAttribute('src') || '';
    if (src.indexOf('/vector-basemaps.js?') >= 0) rendererUrl += '?' + src.split('?')[1];
  }
  function loadLibrary() {
    if (root.GAEfbVectorRenderer) return Promise.resolve();
    if (!libraryPromise) libraryPromise = new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = rendererUrl;
      script.onload = function() { resolve(); };
      script.onerror = function() { script.remove(); libraryPromise = null; reject(new Error('map_library_unavailable')); };
      document.head.appendChild(script);
    });
    return libraryPromise;
  }
  root.GAEfbVectorBasemaps = {
    createLayer: function(definition, options) {
      var L = root.L;
      var Layer = L.Layer.extend({
        options: options,
        onAdd: function(map) {
          var self = this;
          var generation = this._generation = (this._generation || 0) + 1;
          var current = function() { return self._generation === generation && map.hasLayer(self); };
          this._container = L.DomUtil.create('div', 'ga-efb-vector-layer leaflet-zoom-animated');
          this._container.style.position = 'absolute';
          map.getPane(this.options.pane).appendChild(this._container);
          this.setOpacity(this.options.opacity == null ? 1 : this.options.opacity);
          this._status = L.control({ position: 'bottomleft' });
          this._status.onAdd = function() {
            var node = L.DomUtil.create('div', 'ga-vector-map-status');
            node.setAttribute('role', 'status');
            node.textContent = definition.label + ' wird geladen …';
            self._statusNode = node;
            return node;
          };
          this._status.addTo(map);
          var fail = function(error) {
            if (!current() || self._loaded) return;
            self._statusNode.textContent = 'Basiskarte nicht verfügbar. Bitte andere Karte wählen.';
            if (root.__gaEfbReport) root.__gaEfbReport('warn', 'vector-basemap', definition.style, error.message);
          };
          this._update();
          loadLibrary().then(function() {
            if (!current()) return null;
            var center = map.getCenter();
            return root.GAEfbVectorRenderer.create(self._container, {
              style: definition.style, center: [center.lng, center.lat], zoom: map.getZoom(),
              cancelled: function() { return !current(); },
              onError: fail,
              onReady: function() { if (current()) { self._loaded = true; self._status.remove(); } }
            });
          }).then(function(renderer) {
            if (!renderer) return;
            if (!current()) { renderer.destroy(); return; }
            self._renderer = renderer;
            self._update();
          }).catch(fail);
        },
        getEvents: function() {
          return { move: this._scheduleUpdate, zoomstart: this._zoomStart,
            zoomend: this._zoomEnd, zoomanim: this._animateZoom, resize: this._update };
        },
        _scheduleUpdate: function() {
          if (this._timer || this._zooming) return;
          var self = this;
          this._timer = setTimeout(function() { self._timer = null; self._update(); }, 60);
        },
        _zoomStart: function() { this._zooming = true; },
        _zoomEnd: function() { this._zooming = false; this._update(); },
        _animateZoom: function(event) {
          if (!this._container || !this._northWest) return;
          var position = this._map._latLngToNewLayerPoint(this._northWest, event.zoom, event.center);
          L.DomUtil.setTransform(this._container, position, this._map.getZoomScale(event.zoom, this._renderZoom));
        },
        _update: function() {
          if (!this._map || !this._container || this._zooming) return;
          var map = this._map, size = map.getSize();
          if (size.x < 1 || size.y < 1) return;
          var padding = size.multiplyBy(0.1), offset = padding.multiplyBy(-1);
          var rendered = size.add(padding.multiplyBy(2)).round();
          this._container.style.width = rendered.x + 'px';
          this._container.style.height = rendered.y + 'px';
          L.DomUtil.setTransform(this._container, map.containerPointToLayerPoint(offset), 1);
          this._northWest = map.containerPointToLatLng(offset);
          this._renderZoom = map.getZoom();
          if (this._renderer) {
            var center = map.getCenter();
            this._renderer.update([center.lng, center.lat], map.getZoom(), [rendered.x, rendered.y]);
          }
        },
        setOpacity: function(value) {
          this.options.opacity = value;
          if (this._container) this._container.style.opacity = String(value);
          return this;
        },
        onRemove: function() {
          this._generation = (this._generation || 0) + 1;
          clearTimeout(this._timer); this._timer = null;
          if (this._status) this._status.remove();
          if (this._renderer) this._renderer.destroy();
          if (this._container) this._container.remove();
          this._container = this._renderer = this._status = this._statusNode = null;
          this._loaded = this._zooming = false;
        }
      });
      return new Layer();
    }
  };
})(window);
