// Generated from map-zoom-control.js by sync-efb-web-assets.js. Do not edit.
// A spring-style zoom control: displacement controls speed, release stops it.
function installMapDragZoomControl(targetMap) {
  var container = targetMap.getContainer();
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-drag-zoom';
  button.title = 'Ziehen: Zoom · Antippen: Follow und Autozoom umschalten';
  button.setAttribute('aria-label', 'Kartenzoom: halten und ziehen. Antippen schaltet Follow und Autozoom um. Pfeiltasten zoomen ebenfalls.');
  button.innerHTML = '<svg viewBox="0 0 24 48" aria-hidden="true"><path d="m9 7 3-3 3 3M9 41l3 3 3-3"/><g class="map-drag-zoom-magnifier"><circle cx="10" cy="22" r="6"/><path d="m14.5 26.5 5 5"/></g><path class="map-drag-zoom-location" d="m4 23 16-9-7 19-2-9z"/></svg>';
  var refreshFollowIndicator = () => {
    var following = typeof isAutoFollow !== 'undefined' && isAutoFollow;
    button.classList.toggle('is-following', following);
    button.setAttribute('aria-pressed', String(following));
    button.title = following ? 'Follow aktiv · Antippen: Follow aus · Ziehen: Zoom' : 'Antippen: Follow und Autozoom an · Ziehen: Zoom';
  };
  refreshFollowIndicator();
  window.addEventListener('ga-map-follow-changed', refreshFollowIndicator);
  container.appendChild(button);
  L.DomEvent.disableClickPropagation(button);
  L.DomEvent.disableScrollPropagation(button);
  var input = null;
  var draggingWasEnabled = false;
  var suppressClickUntil = 0;
  var lastInputKind = '';
  var startY = 0;
  var scale = 1;
  var speed = 0;
  var frame = 0;
  var lastTime = 0;
  var startedAt = 0;
  var moved = false;
  var zooming = false;
  var manualZoomStarted = false;
  var savedZoomSnap = null;
  var toggleFollow = () => {
    if (typeof toggleAutoFollow !== 'function') return;
    var enabled = typeof isAutoFollow !== 'undefined' && isAutoFollow;
    if (!enabled && typeof isMapAutoZoomEnabled === 'function' && !isMapAutoZoomEnabled() && typeof window.toggleMapHint === 'function') window.toggleMapHint('autoZoom');
    toggleAutoFollow(!enabled);
  };
  var markIntent = () => {
    if (typeof markMapAutoZoomUserZoomIntent === 'function') markMapAutoZoomUserZoomIntent();
  };
  var tick = now => {
    var _window$mapHints;
    if (input === null) return;
    if (((_window$mapHints = window.mapHints) === null || _window$mapHints === void 0 ? void 0 : _window$mapHints.zoomControl) !== true) {
      stop();
      return;
    }
    var elapsed = Math.min((now - lastTime) / 1000, 0.06);
    lastTime = now;
    if (speed) {
      if (!manualZoomStarted) {
        manualZoomStarted = true;
        // A deliberate drag owns zoom until the user enables autozoom again.
        if (typeof isMapAutoZoomEnabled === 'function' && isMapAutoZoomEnabled() && typeof window.toggleMapHint === 'function') window.toggleMapHint('autoZoom');
        if (typeof clearMapAutoZoomSmoothTimer === 'function') clearMapAutoZoomSmoothTimer();
        // Finish an already running CSS zoom before accepting manual frames.
        if (targetMap._animatingZoom) targetMap._onZoomTransitionEnd();
        targetMap._stop();
        if (savedZoomSnap === null) savedZoomSnap = targetMap.options.zoomSnap;
        // Follow's panTo must also preserve the manually chosen fractional zoom.
        targetMap.options.zoomSnap = 0;
      }
      markIntent();
      var zoom = Math.max(targetMap.getMinZoom(), Math.min(targetMap.getMaxZoom(), targetMap.getZoom() + speed * elapsed));
      if (zoom !== targetMap.getZoom()) {
        if (!zooming) {
          zooming = true;
          targetMap._moveStart(true, false);
        }
        // Use Leaflet's pinch path: transform existing tiles and retain
        // loaded levels, instead of resetting the view on every frame.
        targetMap._move(targetMap.getCenter(), zoom, {
          pinch: true,
          round: false
        });
        if (typeof rememberMapAutoZoomManualZoom === 'function') {
          rememberMapAutoZoomManualZoom(Date.now(), {
            userIntent: true
          });
        }
      }
    }
    frame = requestAnimationFrame(tick);
  };
  var stop = () => {
    if (input === null) return;
    var released = input;
    input = null;
    speed = 0;
    cancelAnimationFrame(frame);
    button.classList.remove('is-active');
    if (zooming) {
      zooming = false;
      // Commit the final tile level without a full view reset; permit
      // Leaflet to prune obsolete levels again after the gesture.
      targetMap.fire('zoom');
      targetMap._moveEnd(true);
    }
    if (draggingWasEnabled && targetMap.dragging) targetMap.dragging.enable();
    draggingWasEnabled = false;
    try {
      if (released.kind === 'pointer' && button.hasPointerCapture && button.hasPointerCapture(released.id)) {
        button.releasePointerCapture(released.id);
      }
    } catch (_) {} // Capture is optional in Coherent; window listeners own completion.
  };
  var eventPoint = (event, ending) => {
    var kind = event.type.indexOf('touch') === 0 ? 'touch' : event.type.indexOf('pointer') === 0 ? 'pointer' : 'mouse';
    var source = event;
    if (kind === 'touch') {
      var touches = ending ? event.changedTouches : event.touches;
      if (!touches || !touches.length) return null;
      source = null;
      for (var i = 0; i < touches.length; i++) {
        if (!input || touches[i].identifier === input.id) {
          source = touches[i];
          break;
        }
      }
      if (!source) return null;
    }
    return {
      kind,
      id: kind === 'touch' ? source.identifier : kind === 'pointer' ? event.pointerId : 0,
      x: source.clientX,
      y: source.clientY
    };
  };
  var matches = point => input && point && input.kind === point.kind && input.id === point.id;
  var begin = event => {
    var _window$mapHints2;
    if (input || ((_window$mapHints2 = window.mapHints) === null || _window$mapHints2 === void 0 ? void 0 : _window$mapHints2.zoomControl) !== true || event.isPrimary === false) return;
    if (event.button != null && event.button !== 0) return;
    if (event.touches && event.touches.length !== 1) return;
    var point = eventPoint(event, false);
    if (!point) return;
    if (point.kind === 'mouse' && lastInputKind !== 'mouse' && Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    lastInputKind = point.kind;
    event.preventDefault();
    event.stopPropagation();
    // Leaflet's public stop() rounds fractional zooms via zoomSnap.
    // Only cancel running motion here; keep the exact manual zoom level.
    targetMap._stop();
    input = point;
    startY = point.y;
    startedAt = performance.now();
    moved = false;
    manualZoomStarted = false;
    suppressClickUntil = Date.now() + 900;
    scale = button.getBoundingClientRect().height / button.offsetHeight || 1;
    draggingWasEnabled = !!(targetMap.dragging && targetMap.dragging.enabled());
    if (draggingWasEnabled) targetMap.dragging.disable();
    try {
      if (point.kind === 'pointer' && button.setPointerCapture) button.setPointerCapture(point.id);
    } catch (_) {}
    button.classList.add('is-active');
    markIntent();
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  };
  var move = event => {
    if (!input) return;
    if (event.touches && event.touches.length !== 1) {
      stop();
      return;
    }
    var point = eventPoint(event, false);
    if (!matches(point)) return;
    event.preventDefault();
    event.stopPropagation();
    // Coherent/VR may emit mousemove after the button was released outside.
    if (point.kind === 'mouse' && event.buttons === 0) {
      stop();
      return;
    }
    var distance = (startY - point.y) / scale;
    if (Math.abs(distance) > 20 || Math.abs(point.x - input.x) / scale > 20) moved = true;
    var amount = Math.min(1, Math.max(0, Math.abs(distance) - 20) / 110);
    speed = Math.sign(distance) * amount * amount * 2.5;
  };
  var end = event => {
    if (!matches(eventPoint(event, true))) return;
    event.preventDefault();
    event.stopPropagation();
    var released = eventPoint(event, true);
    var tap = event.type.indexOf('cancel') < 0 && !moved && Math.abs(released.y - startY) / scale <= 20 && Math.abs(released.x - input.x) / scale <= 20 && performance.now() - startedAt < 350;
    suppressClickUntil = Date.now() + 900;
    stop();
    if (tap) toggleFollow();
  };
  ['pointerdown', 'mousedown', 'touchstart'].forEach(name => button.addEventListener(name, begin, {
    passive: false
  }));
  ['pointermove', 'mousemove', 'touchmove'].forEach(name => window.addEventListener(name, move, {
    passive: false
  }));
  ['pointerup', 'pointercancel', 'mouseup', 'touchend', 'touchcancel'].forEach(name => window.addEventListener(name, end, {
    passive: false
  }));
  var lostCapture = event => {
    if (input && input.kind === 'pointer' && input.id === event.pointerId) stop();
  };
  button.addEventListener('lostpointercapture', lostCapture);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail === 0 && Date.now() >= suppressClickUntil) toggleFollow();
  });
  button.addEventListener('keydown', event => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    event.stopPropagation();
    markIntent();
    targetMap.setZoom(targetMap.getZoom() + (event.key === 'ArrowUp' ? 0.5 : -0.5), {
      animate: false
    });
  });
  var onVisibility = () => {
    if (document.hidden) stop();
  };
  var restoreZoomSnap = () => {
    if (savedZoomSnap !== null) {
      targetMap.options.zoomSnap = savedZoomSnap;
      savedZoomSnap = null;
    }
  };
  var onSettingChanged = () => {
    var _window$mapHints3;
    if (((_window$mapHints3 = window.mapHints) === null || _window$mapHints3 === void 0 ? void 0 : _window$mapHints3.zoomControl) !== true) {
      stop();
      restoreZoomSnap();
    }
  };
  window.addEventListener('ga-map-zoom-control-changed', onSettingChanged);
  window.addEventListener('pagehide', stop);
  window.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', onVisibility);
  targetMap.on('unload', () => {
    stop();
    restoreZoomSnap();
    window.removeEventListener('ga-map-follow-changed', refreshFollowIndicator);
    window.removeEventListener('blur', stop);
    window.removeEventListener('pagehide', stop);
    window.removeEventListener('ga-map-zoom-control-changed', onSettingChanged);
    ['pointermove', 'mousemove', 'touchmove'].forEach(name => window.removeEventListener(name, move));
    ['pointerup', 'pointercancel', 'mouseup', 'touchend', 'touchcancel'].forEach(name => window.removeEventListener(name, end));
    document.removeEventListener('visibilitychange', onVisibility);
    button.remove();
  });
}
