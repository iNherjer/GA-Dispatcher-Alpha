(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let status = null;
  let lastReleaseRoot = '';
  let scannedAssets = [];
  let editingAssetKey = '';
  let controls = [];

  function log(message, type = 'info') {
    const time = new Date().toLocaleTimeString('de-DE');
    $('log').textContent += `[${time}] ${type.toUpperCase().padEnd(5)} ${message}\n`;
    $('log').scrollTop = $('log').scrollHeight;
  }

  function result(id, message, ok = null) {
    const element = $(id);
    element.textContent = message;
    element.classList.toggle('ok', ok === true);
    element.classList.toggle('bad', ok === false);
  }

  function pill(id, text, stateName) {
    const element = $(id);
    element.textContent = text;
    element.className = `pill ${stateName || 'muted'}`;
  }

  async function request(pathname, options = {}) {
    const response = await fetch(pathname, options);
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload.error || `HTTP ${response.status}`);
      error.code = payload.code || '';
      throw error;
    }
    return payload;
  }

  function post(pathname, body = {}) {
    return request(pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  function renderStatus(data) {
    status = data;
    const repo = data.repository || {};
    pill('sdkPill', repo.sdkInstalled ? 'SDK bereit' : 'SDK fehlt', repo.sdkInstalled ? 'ok' : 'bad');
    pill('repoPill', repo.repoValid ? `${repo.repoSlug || 'Repository'} · ${repo.branch || '?'}` : 'Repository fehlt', repo.repoValid ? (repo.unrelatedChanges?.length ? 'warn' : 'ok') : 'bad');
    pill('ghPill', repo.ghAuthenticated ? 'GitHub angemeldet' : repo.ghAvailable ? 'GitHub-Anmeldung fehlt' : 'gh CLI fehlt', repo.ghAuthenticated ? 'ok' : 'bad');
    pill('simPill', data.simulatorRunning ? 'MSFS läuft' : 'MSFS geschlossen', data.simulatorRunning ? 'warn' : 'ok');
    $('repoPath').value = data.config.repoPath || '';
    $('sdkPath').value = data.config.sdkPath || '';
    $('remote').value = data.config.remote || 'origin';
    $('branch').value = data.config.branch || 'main';
    $('packageVersion').value = data.package.version || '';
    $('assetCount').textContent = data.assetCount;
    if (!$('assetScanPath').value && data.suggestedSourcePath) $('assetScanPath').value = data.suggestedSourcePath;
    const problems = [];
    if (!repo.sdkInstalled) problems.push('MSFS Package Tool nicht gefunden');
    if (!repo.repoValid) problems.push('Repository-Pfad fehlt');
    if (!repo.ghAuthenticated) problems.push('GitHub CLI nicht angemeldet');
    if (repo.unrelatedChanges?.length) problems.push(`${repo.unrelatedChanges.length} unabhängige Worktree-Änderung(en)`);
    result('environmentResult', problems.length ? problems.join(' · ') : `Bereit. Arbeitsdaten: ${data.dataRoot}`, problems.length ? false : true);
    const buildMessage = data.build.available
      ? `Kompiliertes Paket ${data.build.version} ist vollständig (${data.build.fileCount} Dateien).`
      : /^sim\.cfg fehlt für /i.test(data.build.error || '')
        ? 'Neue oder geänderte Quellen erkannt. Das vorhandene SDK-Projekt ist älter als der Katalog: zuerst „SDK-Projekt vorbereiten“, danach kompilieren.'
        : `Noch kein gültiger Build: ${data.build.error || 'nicht vorhanden'}`;
    result('buildResult', buildMessage, data.build.available);
    $('assetTable').innerHTML = data.assets.map((asset) => {
      const controlsSummary = (asset.controls || []).length
        ? asset.controls.map((control) => `${escapeHtml(control.label)}<br><code>${escapeHtml(control.simvar)}</code>`).join('<br>')
        : asset.animation?.type === 'door'
          ? `Tor (Legacy)<br><code>${escapeHtml(asset.animation.control?.simvar || '')}</code>`
          : '–';
      return `<tr><td><code>${escapeHtml(asset.key)}</code></td><td>${escapeHtml(asset.version)}</td><td>${escapeHtml(asset.kind || 'object')}</td><td>${escapeHtml(asset.label || asset.title)}<br><code>${escapeHtml(asset.title)}</code></td><td>${asset.workbenchVisible !== false ? 'ja' : 'nein'}${asset.homebasePlaceable !== false ? ' · Deko' : ''}</td><td>${asset.missionSpawnable ? 'ja' : 'nein'} ${asset.missionRoles?.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('') || ''}</td><td>${controlsSummary}</td><td>${asset.missionTags?.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('') || '–'}</td><td><button class="secondary" data-edit-key="${escapeHtml(asset.key)}">Bearbeiten</button></td></tr>`;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function selectedRoles() {
    return [...document.querySelectorAll('input[name="assetRole"]:checked')].map((input) => input.value);
  }

  function setRoles(roles) {
    const wanted = new Set(roles || []);
    document.querySelectorAll('input[name="assetRole"]').forEach((input) => { input.checked = wanted.has(input.value); });
  }

  function setAssetGroup(group) {
    const select = $('assetGroup');
    const known = [...select.options].some((option) => option.value === group);
    select.value = known ? group : 'Ausstattung';
  }

  function controlsForAsset(asset) {
    if (Array.isArray(asset.controls) && asset.controls.length) return structuredClone(asset.controls);
    const door = asset.animation?.type === 'door' ? asset.animation : null;
    if (!door) return [];
    return [{
      schemaVersion: 1,
      id: 'door',
      type: 'animation',
      label: door.label || 'Tor',
      transport: door.control?.transport || 'simconnect-lvar',
      simvar: door.control?.simvar || '',
      unit: door.control?.unit || 'number',
      scope: door.control?.scope || 'global',
      defaultState: door.defaultState || 'open',
      durationMs: door.durationMs,
      states: [
        { id: 'open', label: 'Öffnen', value: door.control?.values?.open ?? 0 },
        { id: 'closed', label: 'Schließen', value: door.control?.values?.closed ?? 1 }
      ]
    }];
  }

  function renderControls() {
    const target = $('controlsEditor');
    target.innerHTML = controls.map((control, controlIndex) => {
      const states = Array.isArray(control.states) ? control.states : [];
      const stateOptions = states.map((state) => `<option value="${escapeHtml(state.id)}"${state.id === control.defaultState ? ' selected' : ''}>${escapeHtml(state.id || '(leer)')}</option>`).join('');
      const stateRows = states.map((state, stateIndex) => `<div class="state-row">
        <input data-control-index="${controlIndex}" data-state-index="${stateIndex}" data-state-field="id" placeholder="ID" value="${escapeHtml(state.id)}">
        <input data-control-index="${controlIndex}" data-state-index="${stateIndex}" data-state-field="label" placeholder="Label" value="${escapeHtml(state.label)}">
        <input data-control-index="${controlIndex}" data-state-index="${stateIndex}" data-state-field="value" type="number" step="0.01" placeholder="Wert" value="${escapeHtml(state.value)}">
        <button type="button" class="danger-small" data-remove-state="${stateIndex}" data-control-index="${controlIndex}">Zustand löschen</button>
      </div>`).join('');
      return `<div class="control-card">
        <div class="control-head"><h4>${escapeHtml(control.label || control.id || `Control ${controlIndex + 1}`)}</h4><button type="button" class="danger-small" data-remove-control="${controlIndex}">Steuerung löschen</button></div>
        <div class="grid two">
          <label>Typ<select data-control-index="${controlIndex}" data-control-field="type"><option value="animation"${control.type === 'animation' ? ' selected' : ''}>Animation</option><option value="light"${control.type === 'light' ? ' selected' : ''}>Licht</option></select></label>
          <label>ID<input data-control-index="${controlIndex}" data-control-field="id" value="${escapeHtml(control.id)}"></label>
          <label>Label<input data-control-index="${controlIndex}" data-control-field="label" value="${escapeHtml(control.label)}"></label>
          <label>LVar<input data-control-index="${controlIndex}" data-control-field="simvar" value="${escapeHtml(control.simvar)}"></label>
          <label>Steuerungsbereich<select data-control-index="${controlIndex}" data-control-field="scope"><option value="global"${control.scope !== 'simobject' ? ' selected' : ''}>Global für alle Modellkopien</option><option value="simobject"${control.scope === 'simobject' ? ' selected' : ''}>Einzelnes SimObject</option></select></label>
          <label>Standardzustand<select data-control-index="${controlIndex}" data-control-field="defaultState">${stateOptions}</select></label>
          <label>Dauer ms<input data-control-index="${controlIndex}" data-control-field="durationMs" type="number" min="1" step="1" value="${escapeHtml(control.durationMs ?? '')}"></label>
        </div>
        <div>${stateRows}</div>
        <button type="button" class="secondary" data-add-state="${controlIndex}">Zustand hinzufügen</button>
      </div>`;
    }).join('');
    if (!controls.length) target.innerHTML = '<p class="note">Keine steuerbaren Funktionen definiert.</p>';
  }

  function addControl() {
    const sequence = controls.length + 1;
    controls.push({
      schemaVersion: 1,
      id: `control${sequence}`,
      type: 'animation',
      label: `Steuerung ${sequence}`,
      transport: 'simconnect-lvar',
      simvar: 'L:VFR_HOMEBASE_',
      unit: 'number',
      scope: 'global',
      defaultState: 'off',
      durationMs: 5000,
      states: [{ id: 'off', label: 'Aus', value: 0 }, { id: 'on', label: 'An', value: 1 }]
    });
    renderControls();
  }

  function populateAssetForm(asset, sourcePath, options = {}) {
    const isCatalogAsset = options.isCatalogAsset === true;
    $('assetKey').value = asset.key || '';
    $('assetKey').readOnly = isCatalogAsset;
    $('assetVersion').value = asset.version || '1.0.0';
    $('assetFolder').value = asset.folder || '';
    $('assetTitle').value = asset.title || '';
    $('assetLabel').value = asset.label || '';
    $('assetKind').value = asset.kind || 'object';
    setAssetGroup(asset.group || 'Ausstattung');
    $('assetSourcePath').value = sourcePath || '';
    $('assetTags').value = (asset.missionTags || []).join(', ');
    $('assetMissionSpawnable').checked = asset.missionSpawnable === true;
    $('assetWorkbenchVisible').checked = asset.workbenchVisible !== false;
    $('assetHomebasePlaceable').checked = asset.homebasePlaceable !== false;
    $('assetFootprintWidth').value = asset.footprint?.widthM ?? '';
    $('assetFootprintDepth').value = asset.footprint?.depthM ?? '';
    $('assetHeadingCorrection').value = asset.headingCorrectionDeg ?? 0;
    $('assetCollisionGuid').value = asset.collisionProfile?.modelLibGuid || '';
    $('assetCollisionSourceFolder').value = asset.collisionProfile?.sourceFolder || '';
    $('assetCollisionDefaultHeight').value = asset.collisionProfile?.defaultHeightOffsetFt ?? 0;
    $('assetCollisionHeightWarning').checked = asset.collisionProfile?.warnOnHeightOffset !== false;
    $('assetVegetationRadius').value = asset.vegetationExclusion?.radiusM ?? '';
    $('assetVegetationSegments').value = asset.vegetationExclusion?.segments ?? 48;
    $('assetVegetationFalloff').value = asset.vegetationExclusion?.falloffM ?? 0.5;
    $('assetMetadataOnly').checked = isCatalogAsset;
    controls = controlsForAsset(asset);
    renderControls();
    syncHangarDefinitionFields();
    setRoles(asset.missionRoles || []);
    $('importAssetBtn').textContent = isCatalogAsset ? 'Änderungen prüfen und übernehmen' : 'Asset prüfen und übernehmen';
  }

  function useScannedAsset(asset) {
    editingAssetKey = asset.existingKey || '';
    populateAssetForm({ ...asset.suggested, folder: asset.suggested?.folder || asset.folder, title: asset.suggested?.title || asset.title }, asset.sourcePath);
    result('importResult', asset.isReplacement
      ? `${asset.folder} ist bereits als ${asset.existingKey} ${asset.existingVersion} vorhanden. Neue Assetversion ${asset.suggestedVersion} wurde automatisch eingetragen.`
      : `${asset.folder} ausgelesen. Bitte Angaben prüfen und dann importieren.`, true);
    log(`Quelle ausgelesen: ${asset.sourcePath}`, 'ok');
  }

  function sourcePathForCatalogAsset(asset) {
    const root = String(status?.sourceRoot || '').replace(/[\\/]+$/, '');
    if (!root || !asset.folder) return '';
    return `${root}${root.includes('\\') ? '\\' : '/'}${asset.folder}`;
  }

  function editCatalogAsset(key) {
    const asset = status?.assets?.find((candidate) => candidate.key === key);
    if (!asset) return;
    editingAssetKey = asset.key;
    populateAssetForm(asset, sourcePathForCatalogAsset(asset), { isCatalogAsset: true });
    result('importResult', `${asset.label || asset.key} wird bearbeitet. Der Key bleibt fest; danach „Änderungen prüfen und übernehmen“ wählen.`, true);
    $('assetSourcePath').focus();
    log(`Katalog-Asset zum Bearbeiten geladen: ${asset.key}`, 'ok');
  }

  function syncHangarDefinitionFields() {
    const isHangar = $('assetKind').value === 'hangar';
    const supportsControls = ['hangar', 'object'].includes($('assetKind').value);
    $('hangarDefinitionFields').hidden = !isHangar;
    $('controlsDefinitionFields').hidden = !supportsControls;
    $('advancedDefinitionFields').hidden = !supportsControls;
    $('assetMissionSpawnable').disabled = isHangar;
    if (isHangar) $('assetMissionSpawnable').checked = false;
  }

  function controlsPayload() {
    if (!['hangar', 'object'].includes($('assetKind').value)) return [];
    return controls.map((control) => ({
      ...control,
      schemaVersion: 1,
      transport: 'simconnect-lvar',
      unit: 'number',
      scope: control.scope === 'simobject' ? 'simobject' : 'global',
      durationMs: control.durationMs === '' || control.durationMs == null ? undefined : Number(control.durationMs),
      states: (control.states || []).map((state) => ({ ...state, value: Number(state.value) }))
    }));
  }

  function footprintPayload() {
    if ($('assetKind').value !== 'hangar') return null;
    const widthM = $('assetFootprintWidth').value.trim();
    const depthM = $('assetFootprintDepth').value.trim();
    if (!widthM && !depthM) return null;
    return { widthM: Number(widthM), depthM: Number(depthM) };
  }

  function collisionProfilePayload() {
    const modelLibGuid = $('assetCollisionGuid').value.trim();
    const sourceFolder = $('assetCollisionSourceFolder').value.trim();
    if (!modelLibGuid && !sourceFolder) return null;
    return {
      schemaVersion: 1,
      mode: 'static-model-lib',
      modelLibGuid,
      sourceFolder,
      placement: 'coincident',
      defaultHeightOffsetFt: Number($('assetCollisionDefaultHeight').value || 0),
      warnOnHeightOffset: $('assetCollisionHeightWarning').checked
    };
  }

  function vegetationExclusionPayload() {
    const radiusM = $('assetVegetationRadius').value.trim();
    if (!radiusM) return null;
    return {
      schemaVersion: 1,
      shape: 'circle',
      radiusM: Number(radiusM),
      segments: Number($('assetVegetationSegments').value || 48),
      vegetationScale: 0,
      vegetationDensity: 0,
      falloffM: Number($('assetVegetationFalloff').value || 0.5),
      terrainAdjustment: 'none'
    };
  }

  function renderCandidates(data) {
    scannedAssets = data.assets || [];
    const target = $('assetCandidates');
    target.hidden = scannedAssets.length === 0;
    target.innerHTML = scannedAssets.map((asset, index) => {
      const detail = asset.valid
        ? `${asset.title} · ${asset.gltfFiles.length} glTF-Datei(en)${asset.existingKey ? ` · ersetzt ${asset.existingKey} ${asset.existingVersion} → ${asset.suggestedVersion}` : ''}`
        : (asset.errors || []).join(' · ');
      return `<div class="asset-candidate ${asset.valid ? '' : 'bad'}"><div><strong>${escapeHtml(asset.folder)}</strong><small>${escapeHtml(detail)}</small></div>${asset.valid ? `<button class="secondary" data-candidate="${index}">Daten übernehmen</button>` : ''}</div>`;
    }).join('');
    if (!scannedAssets.length) result('importResult', 'Keine Asset-Ordner im gewählten Quellenordner gefunden.', false);
  }

  async function scanSources(sourcePath = $('assetScanPath').value) {
    const response = await post('/api/assets/inspect', { sourcePath });
    $('assetScanPath').value = response.sourcePath;
    renderCandidates(response);
    result('importResult', `${response.validCount} verwendbare Asset-Quelle(n) erkannt.`, response.validCount > 0);
    log(`${response.validCount} Quellen ausgelesen: ${response.sourcePath}`, response.validCount ? 'ok' : 'error');
  }

  async function refresh() {
    try { renderStatus(await request('/api/status')); }
    catch (error) { result('environmentResult', error.message, false); log(error.message, 'error'); }
  }

  async function busy(button, work) {
    button.disabled = true;
    try { await work(); } catch (error) { log(error.message, 'error'); throw error; } finally { button.disabled = false; }
  }

  $('refreshBtn').addEventListener('click', refresh);
  $('saveConfigBtn').addEventListener('click', () => busy($('saveConfigBtn'), async () => {
    await post('/api/config', { repoPath: $('repoPath').value, sdkPath: $('sdkPath').value, remote: $('remote').value, branch: $('branch').value });
    log('Arbeitsumgebung gespeichert.', 'ok'); await refresh();
  }).catch(() => {}));
  $('openDataBtn').addEventListener('click', () => post('/api/open-path', { path: status?.dataRoot }).catch((error) => log(error.message, 'error')));
  $('saveVersionBtn').addEventListener('click', () => busy($('saveVersionBtn'), async () => {
    await post('/api/catalog/version', { version: $('packageVersion').value });
    log(`Paketversion auf ${$('packageVersion').value} gesetzt. Vor dem Release neu kompilieren.`, 'ok'); await refresh();
  }).catch(() => {}));
  $('scanAssetsBtn').addEventListener('click', () => busy($('scanAssetsBtn'), () => scanSources()).catch((error) => result('importResult', error.message, false)));
  $('assetCandidates').addEventListener('click', (event) => {
    const button = event.target.closest('[data-candidate]');
    if (button) useScannedAsset(scannedAssets[Number(button.dataset.candidate)]);
  });
  $('assetTable').addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-key]');
    if (button) editCatalogAsset(button.dataset.editKey);
  });
  $('addControlBtn').addEventListener('click', addControl);
  $('controlsEditor').addEventListener('input', (event) => {
    const target = event.target;
    const controlIndex = Number(target.dataset.controlIndex);
    if (!Number.isInteger(controlIndex) || !controls[controlIndex]) return;
    if (target.dataset.controlField) controls[controlIndex][target.dataset.controlField] = target.value;
    if (target.dataset.stateField) {
      const stateIndex = Number(target.dataset.stateIndex);
      const state = controls[controlIndex].states?.[stateIndex];
      if (!state) return;
      const oldId = state.id;
      state[target.dataset.stateField] = target.dataset.stateField === 'value' ? Number(target.value) : target.value;
      if (target.dataset.stateField === 'id' && controls[controlIndex].defaultState === oldId) controls[controlIndex].defaultState = target.value;
    }
  });
  $('controlsEditor').addEventListener('change', (event) => {
    const target = event.target;
    const controlIndex = Number(target.dataset.controlIndex);
    if (!Number.isInteger(controlIndex) || !controls[controlIndex]) return;
    if (target.dataset.controlField) controls[controlIndex][target.dataset.controlField] = target.value;
    if (target.dataset.stateField === 'id') renderControls();
  });
  $('controlsEditor').addEventListener('click', (event) => {
    const removeControl = event.target.closest('[data-remove-control]');
    if (removeControl) {
      controls.splice(Number(removeControl.dataset.removeControl), 1);
      renderControls();
      return;
    }
    const addState = event.target.closest('[data-add-state]');
    if (addState) {
      const control = controls[Number(addState.dataset.addState)];
      const index = (control.states?.length || 0) + 1;
      control.states ||= [];
      control.states.push({ id: `state${index}`, label: `Zustand ${index}`, value: index - 1 });
      renderControls();
      return;
    }
    const removeState = event.target.closest('[data-remove-state]');
    if (removeState) {
      const control = controls[Number(removeState.dataset.controlIndex)];
      control.states.splice(Number(removeState.dataset.removeState), 1);
      if (!control.states.some((state) => state.id === control.defaultState)) control.defaultState = control.states[0]?.id || '';
      renderControls();
    }
  });
  const dropZone = $('assetDropZone');
  ['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
  dropZone.addEventListener('drop', (event) => {
    const uri = event.dataTransfer.getData('text/uri-list').split('\n').find((value) => value.startsWith('file:'));
    const filePath = event.dataTransfer.files?.[0]?.path;
    const sourcePath = filePath || (uri ? decodeURIComponent(uri.replace(/^file:\/\//i, '').replace(/^\//, '')).replace(/\//g, '\\') : '');
    if (!sourcePath) {
      result('importResult', 'Der Browser konnte den Ordnerpfad nicht aus dem Drop lesen. Den Quellenordner unten eintragen und „Quellen auslesen“ wählen.', false);
      return;
    }
    $('assetScanPath').value = sourcePath;
    scanSources(sourcePath).catch((error) => result('importResult', error.message, false));
  });
  $('importAssetBtn').addEventListener('click', () => busy($('importAssetBtn'), async () => {
    const metadataOnly = editingAssetKey && $('assetMetadataOnly').checked;
    const confirmed = window.confirm(metadataOnly
      ? 'Nur die validierten Katalogmetadaten werden gespeichert; die vorhandene Rohmodellquelle bleibt unverändert. Fortfahren?'
      : editingAssetKey
        ? 'Die Katalogwerte und die Rohquelle dieses Assets werden aktualisiert. Fortfahren?'
      : 'Das geprüfte SimObject wird in die dauerhaften Publisher-Quellen kopiert und ein gleichnamiges Asset ersetzt. Fortfahren?');
    if (!confirmed) return;
    const payload = {
      confirmed: true,
      key: $('assetKey').value,
      version: $('assetVersion').value,
      folder: $('assetFolder').value,
      title: $('assetTitle').value,
      label: $('assetLabel').value,
      kind: $('assetKind').value,
      group: $('assetGroup').value,
      sourcePath: $('assetSourcePath').value,
      metadataOnly,
      missionSpawnable: $('assetMissionSpawnable').checked,
      workbenchVisible: $('assetWorkbenchVisible').checked,
      homebasePlaceable: $('assetHomebasePlaceable').checked,
      missionTags: $('assetTags').value,
      missionRoles: selectedRoles(),
      footprint: footprintPayload(),
      headingCorrectionDeg: Number($('assetHeadingCorrection').value || 0),
      controls: controlsPayload(),
      collisionProfile: collisionProfilePayload(),
      vegetationExclusion: vegetationExclusionPayload()
    };
    const response = await post('/api/assets/import', payload);
    result('importResult', response.metadataOnly
      ? `${response.asset.label} ${response.asset.version}: Metadaten gespeichert, Rohquelle unverändert.`
      : `${response.asset.label} ${response.asset.version} wurde als Rohquelle übernommen.`, true);
    log(response.metadataOnly
      ? `Asset ${response.asset.key}: nur Metadaten gespeichert.`
      : `Asset ${response.asset.key} importiert: ${response.sourcePath}${response.history ? ` · Sicherung ${response.history.version}: ${response.history.path}` : ''}`, 'ok'); await refresh();
  }).catch((error) => result('importResult', error.message, false)));
  $('assetKind').addEventListener('change', syncHangarDefinitionFields);
  $('prepareBtn').addEventListener('click', () => busy($('prepareBtn'), async () => {
    const response = await post('/api/project/prepare');
    result('buildResult', `SDK-Projekt ${response.version} mit ${response.assetCount} Assets vorbereitet: ${response.projectRoot}`, true);
    log('SDK-Projekt vollständig neu erzeugt.', 'ok');
  }).catch((error) => result('buildResult', error.message, false)));
  $('buildBtn').addEventListener('click', () => busy($('buildBtn'), async () => {
    if (status?.simulatorRunning && !window.confirm('MSFS läuft noch. Bitte den Simulator schließen. Soll der Build trotzdem angefordert werden, damit die Sicherheitsprüfung den Zustand erneut kontrolliert?')) return;
    result('buildResult', 'Offizieller SDK-Build läuft. Das kann mehrere Minuten dauern …');
    const response = await post('/api/build');
    result('buildResult', `Paket ${response.version} erfolgreich kompiliert und validiert: ${response.fileCount} Dateien.`, true);
    log(`SDK-Build erfolgreich: ${response.packageRoot}`, 'ok'); await refresh();
  }).catch((error) => result('buildResult', error.message, false)));
  $('prepareReleaseBtn').addEventListener('click', () => busy($('prepareReleaseBtn'), async () => {
    result('releaseResult', 'Vollpaket, Delta-ZIPs und Prüfsummen werden erzeugt …');
    const response = await post('/api/release/prepare', { version: $('packageVersion').value });
    lastReleaseRoot = response.releaseRoot;
    result('releaseResult', `Release ${response.packageVersion} vorbereitet: ${response.assetArchives.length} Asset-ZIPs und ein Vollpaket.`, true);
    $('releaseSummary').hidden = false;
    $('releaseSummary').textContent = `Geändert: ${response.changedAssets.join(', ') || 'keine'}\nEntfernt: ${response.removedAssets.join(', ') || 'keine'}\nVollpaket: ${response.fullArchive.name} (${Math.round(response.fullArchive.size / 1024)} KiB)\nOrdner: ${response.releaseRoot}`;
    log(`Release-Dateien erzeugt: ${response.releaseRoot}`, 'ok');
  }).catch((error) => result('releaseResult', error.message, false)));
  $('openReleaseBtn').addEventListener('click', () => {
    const target = lastReleaseRoot || status?.releasesRoot;
    post('/api/open-path', { path: target }).catch((error) => log(error.message, 'error'));
  });
  $('publishBtn').addEventListener('click', () => busy($('publishBtn'), async () => {
    const confirmed = window.confirm(
      `Assetrelease ${$('packageVersion').value} wirklich veröffentlichen?\n\n` +
      'Der Publisher pusht ausschließlich homebase/assets, erstellt ein GitHub-Release und schaltet danach den Stable-Kanal um. Bestehende Releases werden nicht überschrieben.'
    );
    if (!confirmed) return;
    result('releaseResult', 'Git- und GitHub-Veröffentlichung läuft …');
    const response = await post('/api/publish', { confirmed: true, version: $('packageVersion').value });
    result('releaseResult', `Release ${response.version} veröffentlicht: ${response.releaseUrl}`, true);
    log(`Assetrelease veröffentlicht: ${response.releaseUrl}`, 'ok'); await refresh();
  }).catch((error) => result('releaseResult', error.message, false)));
  $('clearLogBtn').addEventListener('click', () => { $('log').textContent = ''; });

  log('Homebase Asset Publisher gestartet.');
  syncHangarDefinitionFields();
  renderControls();
  refresh();
})();
