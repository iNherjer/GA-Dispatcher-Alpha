(function (root) {
  'use strict';

  function clampProgress(value) {
    var number = Number(value);
    return isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
  }

  function text(value, fallback) {
    var result = String(value == null ? '' : value).trim();
    return result || (fallback || '');
  }

  function formatHistoryTime(value) {
    if (value == null || value === '') return '';
    var raw = String(value).trim();
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw)) return raw;
    var timestamp = /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : Date.parse(raw);
    if (!isFinite(timestamp)) return raw;
    if (timestamp < 100000000000) timestamp *= 1000;
    var date = new Date(timestamp);
    if (!isFinite(date.getTime())) return raw;
    function pad(part) { return part < 10 ? '0' + part : String(part); }
    return pad(date.getDate()) + '.' + pad(date.getMonth() + 1) + '.' + date.getFullYear()
      + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }

  function buildViewModel(guidance) {
    var source = guidance && typeof guidance === 'object' ? guidance : {};
    var rows = Array.isArray(source.rows) ? source.rows : [];
    var history = Array.isArray(source.history) ? source.history : [];
    return {
      visible: source.visible === true,
      title: text(source.title, 'Training'),
      phaseLabel: text(source.phaseLabel),
      notice: text(source.notice),
      introduction: (function () {
        var instruction = text(source.instruction);
        var match = instruction.match(/^[\s\S]*?[.!?](?:\s|$)/);
        if (match) instruction = match[0].trim();
        return instruction.length > 150 ? instruction.slice(0, 147).trim() + '…' : instruction;
      })(),
      attempt: source.attempt == null ? '' : String(source.attempt),
      canRepeat: source.canRepeat === true,
      rows: rows.map(function (row, index) {
        row = row && typeof row === 'object' ? row : {};
        var status = ['pending', 'active', 'complete', 'error'].indexOf(row.status) >= 0 ? row.status : 'pending';
        return {
          number: index + 1,
          id: text(row.id, String(index + 1)),
          label: text(row.label, 'Schritt ' + (index + 1)),
          status: status,
          progress: clampProgress(row.progress),
          detail: text(row.detail)
        };
      }),
      history: history.map(function (entry) {
        entry = entry && typeof entry === 'object' ? entry : {};
        return { at: formatHistoryTime(entry.at), text: text(entry.text) };
      }).filter(function (entry) { return entry.text; })
    };
  }

  function el(doc, tag, className, value) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value);
    return node;
  }

  function getRoot(doc, id) {
    var node = doc.getElementById(id);
    if (node) return node;
    node = el(doc, 'section', 'training-guidance', null);
    node.id = id;
    node.hidden = true;
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    doc.body.appendChild(node);
    bindControls(node);
    return node;
  }

  function bindControls(node) {
    node.addEventListener('click', function (event) {
      var action = event.target && event.target.getAttribute && event.target.getAttribute('data-training-action');
      if (action === 'collapse') {
        var collapsed = node.classList.toggle('is-collapsed');
        var button = node.querySelector('[data-training-action="collapse"]');
        if (button) {
          button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
          button.textContent = collapsed ? 'Aufklappen' : 'Einklappen';
        }
      } else if (action === 'repeat') {
        if (typeof node._trainingRepeat === 'function') {
          var button = event.target;
          var result = node._trainingRepeat();
          if (result && typeof result.then === 'function') {
            button.disabled = true;
            result.then(function () { button.disabled = false; }, function () { button.disabled = false; });
          }
        }
      } else if (action === 'history') {
        var history = node.querySelector('.training-guidance-history');
        var historyButton = node.querySelector('[data-training-action="history"]');
        if (history) history.hidden = !history.hidden;
        if (historyButton) {
          var isOpen = history && !history.hidden;
          historyButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          historyButton.textContent = (isOpen ? 'Verlauf ausblenden (' : 'Verlauf anzeigen (') + node._trainingHistoryCount + ')';
        }
      }
    });

    var handle = node;
    var start = null;
    handle.addEventListener('pointerdown', function (event) {
      if (!event.target || !event.target.closest || !event.target.closest('.training-guidance-head')) return;
      if (event.target && event.target.closest && event.target.closest('button')) return;
      if (event.button != null && event.button !== 0) return;
      var rect = node.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, id: event.pointerId };
      if (node.setPointerCapture && event.pointerId != null) node.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', function (event) {
      if (!start || (start.id != null && event.pointerId !== start.id)) return;
      var left = Math.max(8, Math.min(root.innerWidth - node.offsetWidth - 8, start.left + event.clientX - start.x));
      var top = Math.max(8, Math.min(root.innerHeight - 40, start.top + event.clientY - start.y));
      node.style.left = left + 'px';
      node.style.top = top + 'px';
      node.style.right = 'auto';
      node.style.bottom = 'auto';
    });
    function finish() {
      if (!start) return;
      start = null;
      try { root.localStorage.setItem('ga_training_guidance_position', JSON.stringify({ left: node.style.left, top: node.style.top })); } catch (_) {}
    }
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    root.addEventListener('resize', function () {
      if (!node.hidden && node.isConnected) {
        var rect = node.getBoundingClientRect();
        node.style.left = Math.max(8, Math.min(root.innerWidth - rect.width - 8, rect.left)) + 'px';
        node.style.top = Math.max(8, Math.min(root.innerHeight - 40, rect.top)) + 'px';
      }
    });
  }

  function restorePosition(node) {
    if (node._trainingPositionRestored) return;
    node._trainingPositionRestored = true;
    try {
      var saved = JSON.parse(root.localStorage.getItem('ga_training_guidance_position') || 'null');
      if (saved && typeof saved.left === 'string' && typeof saved.top === 'string') {
        node.style.left = saved.left;
        node.style.top = saved.top;
        node.style.right = 'auto';
        node._trainingHasSavedPosition = true;
      }
    } catch (_) {}
  }

  function renderRows(doc, rows) {
    var list = el(doc, 'ol', 'training-guidance-rows');
    rows.forEach(function (row) {
      var item = el(doc, 'li', 'training-guidance-row is-' + row.status);
      item.setAttribute('data-step-id', row.id);
      var number = el(doc, 'span', 'training-guidance-number', row.number);
      number.setAttribute('aria-hidden', 'true');
      var copy = el(doc, 'div', 'training-guidance-row-copy');
      var label = el(doc, 'span', 'training-guidance-row-label', row.label);
      if (row.status === 'complete') label.classList.add('is-struck');
      var detail = el(doc, 'span', 'training-guidance-row-detail', row.detail);
      var track = el(doc, 'div', 'training-guidance-progress', null);
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(Math.round(row.progress * 100)));
      var fill = el(doc, 'span', 'training-guidance-progress-fill', null);
      fill.style.width = Math.round(row.progress * 100) + '%';
      track.appendChild(fill);
      copy.appendChild(label);
      if (row.detail) copy.appendChild(detail);
      copy.appendChild(track);
      item.appendChild(number);
      item.appendChild(copy);
      list.appendChild(item);
    });
    return list;
  }

  function renderHistory(doc, history) {
    var list = el(doc, 'ol', 'training-guidance-history-list');
    history.forEach(function (entry) {
      var row = el(doc, 'li', 'training-guidance-history-entry');
      if (entry.at) row.appendChild(el(doc, 'time', 'training-guidance-history-time', entry.at));
      row.appendChild(el(doc, 'span', '', entry.text));
      list.appendChild(row);
    });
    return list;
  }

  function render(guidance, options) {
    if (!root.document) return null;
    var view = buildViewModel(guidance);
    var id = options && options.id || 'trainingGuidanceBanner';
    var node = getRoot(root.document, id);
    node._trainingRepeat = options && options.onRepeat;
    node.hidden = !view.visible;
    if (!view.visible) return node;
    var signature = JSON.stringify(view);
    if (node._trainingSignature === signature) return node;
    node._trainingSignature = signature;
    var previousHistory = node.querySelector('.training-guidance-history');
    var historyWasOpen = !!previousHistory && !previousHistory.hidden;
    var previousBody = node.querySelector('.training-guidance-body');
    var previousScrollTop = previousBody ? previousBody.scrollTop : 0;
    node._trainingHistoryCount = view.history.length;
    restorePosition(node);
    node.classList.toggle('has-error', view.rows.some(function (row) { return row.status === 'error'; }));
    node.setAttribute('aria-label', view.title + (view.phaseLabel ? ', ' + view.phaseLabel : ''));
    while (node.firstChild) node.removeChild(node.firstChild);

    var header = el(root.document, 'header', 'training-guidance-head', null);
    var titleBlock = el(root.document, 'div', 'training-guidance-title-block', null);
    titleBlock.appendChild(el(root.document, 'strong', 'training-guidance-title', view.title));
    if (view.phaseLabel) titleBlock.appendChild(el(root.document, 'span', 'training-guidance-phase', view.phaseLabel));
    header.appendChild(titleBlock);
    if (view.attempt) header.appendChild(el(root.document, 'span', 'training-guidance-attempt', 'Versuch ' + view.attempt));
    var collapse = el(root.document, 'button', 'training-guidance-collapse', node.classList.contains('is-collapsed') ? 'Aufklappen' : 'Einklappen');
    collapse.type = 'button';
    collapse.setAttribute('data-training-action', 'collapse');
    collapse.setAttribute('aria-expanded', node.classList.contains('is-collapsed') ? 'false' : 'true');
    header.appendChild(collapse);
    node.appendChild(header);

    var body = el(root.document, 'div', 'training-guidance-body', null);
    if (view.notice) body.appendChild(el(root.document, 'p', 'training-guidance-notice', view.notice));
    if (view.introduction) {
      var instruction = el(root.document, 'p', 'training-guidance-instruction', view.introduction);
      body.appendChild(instruction);
    }
    body.appendChild(renderRows(root.document, view.rows));
    var actions = el(root.document, 'div', 'training-guidance-actions', null);
    if (view.canRepeat) {
      var repeat = el(root.document, 'button', 'training-guidance-repeat', 'Anweisung wiederholen');
      repeat.type = 'button'; repeat.setAttribute('data-training-action', 'repeat'); actions.appendChild(repeat);
    }
    if (view.history.length) {
      var historyButton = el(root.document, 'button', 'training-guidance-history-toggle', (historyWasOpen ? 'Verlauf ausblenden (' : 'Verlauf anzeigen (') + view.history.length + ')');
      historyButton.type = 'button'; historyButton.setAttribute('data-training-action', 'history'); historyButton.setAttribute('aria-expanded', historyWasOpen ? 'true' : 'false');
      actions.appendChild(historyButton);
    }
    if (actions.childNodes.length) body.appendChild(actions);
    if (view.history.length) {
      var history = el(root.document, 'div', 'training-guidance-history', null);
      history.hidden = !historyWasOpen;
      history.appendChild(renderHistory(root.document, view.history));
      body.appendChild(history);
    }
    node.appendChild(body);
    body.scrollTop = previousScrollTop;
    if (node._trainingHasSavedPosition) {
      var rect = node.getBoundingClientRect();
      node.style.left = Math.max(8, Math.min(root.innerWidth - rect.width - 8, rect.left)) + 'px';
      node.style.top = Math.max(8, Math.min(root.innerHeight - rect.height - 8, rect.top)) + 'px';
      node.style.right = 'auto';
      try { root.localStorage.setItem('ga_training_guidance_position', JSON.stringify({ left: node.style.left, top: node.style.top })); } catch (_) {}
    }
    return node;
  }

  root.GATrainingGuidanceUi = { buildViewModel: buildViewModel, render: render };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GATrainingGuidanceUi;
})(typeof window !== 'undefined' ? window : globalThis);
