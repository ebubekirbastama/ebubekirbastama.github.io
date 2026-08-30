// EBS Live V5.1 — reliability/security maintenance release
(() => {
  'use strict';

  const $ = (q) => document.querySelector(q);
  const $$ = (q) => [...document.querySelectorAll(q)];
  const params = new URLSearchParams(location.search);
  const watchId = params.get('watch');
  const obsMode = params.get('obs') === '1' || params.get('clean') === '1';

  const state = {
    peer: null,
    localStream: null,
    rawStreams: [],
    calls: new Map(),
    source: 'screen',
    startedAt: null,
    timer: null,
    compositorStop: null,
    audioContext: null,
    screenStream: null,
    screenVideoEl: null,
    templateVideos: null,
    templateLayout: null,
    templateBgImg: null,
    dualcamSlots: null,
    camCount: 2,
    liveEditActive: false,
    templateSelected: 'title',
    audioMixerConfig: null,
    audioMixerEngine: null,
    screenMicStream: null,
    screenAudioEngine: null,
    templateCustomImages: new Map(),
    hostReconnectTimer: null
  };

  const homeView = $('#homeView');
  const studioView = $('#studioView');
  const viewerView = $('#viewerView');
  const features = $('#features');
  const localVideo = $('#localVideo');
  const remoteVideo = $('#remoteVideo');
  const remotePlaceholder = $('#remotePlaceholder');
  const shareLink = $('#shareLink');
  const toast = $('#toast');

  $('#year').textContent = new Date().getFullYear();

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function setNetwork(text, ok = true) {
    $('#networkText').textContent = text;
    const dot = $('.status-pill i');
    if (dot) dot.style.background = ok ? '#20d98d' : '#ff4964';
  }

  function cleanViewerUrl(id) {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('watch', id);
    return u.toString();
  }

  function obsViewerUrl(id) {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('watch', id);
    u.searchParams.set('obs', '1');
    return u.toString();
  }

  async function copyFromInput(input, label) {
    const value = input.value;
    if (!value || value.includes('hazırlanıyor')) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast(label + ' kopyalandı');
    } catch {
      input.select();
      document.execCommand('copy');
      showToast(label + ' kopyalandı');
    }
  }

  function copyLink() { copyFromInput(shareLink, 'İzleme bağlantısı'); }
  function copyObsLink() {
    const obsInput = $('#obsLink');
    if (obsInput) copyFromInput(obsInput, 'OBS bağlantısı');
  }

  const dualcamPanel = $('#dualcamPanel');
  const templateEditorEl = $('.tpl-editor');
  const studioTemplateEditorHost = $('#studioTplEditorHost');
  const studioLiveTools = $('#studioLiveTools');
  const studioLiveDrawer = $('#studioLiveDrawer');
  const studioLiveBackdrop = $('#studioLiveBackdrop');
  const studioLiveToolTitle = $('#studioLiveToolTitle');
  const LIVE_TOOL_LABELS = {
    layers: 'Katmanlar', add: 'Element Ekle', texts: 'Metinler ve Konuklar',
    background: 'Arka Plan', layout: 'Düzen ve Boyutlar', audio: 'Ses Mikseri', file: 'JSON / Dosya'
  };

  function setStudioLiveTool(tool, openDrawer = true) {
    if (!studioLiveTools || !studioTemplateEditorHost) return;
    if (!LIVE_TOOL_LABELS[tool]) tool = 'layers';
    studioLiveTools.dataset.activeTool = tool;
    studioTemplateEditorHost.dataset.liveTool = tool;
    const audioHost = $('#studioAudioMixerHost');
    const isAudio = tool === 'audio';
    studioTemplateEditorHost.classList.toggle('hidden', isAudio);
    audioHost?.classList.toggle('hidden', !isAudio);
    if (studioLiveToolTitle) studioLiveToolTitle.textContent = LIVE_TOOL_LABELS[tool];
    $$('.studio-live-tool[data-live-tool]').forEach(btn => btn.classList.toggle('active', btn.dataset.liveTool === tool));
    if (openDrawer) studioLiveDrawer?.classList.remove('collapsed');
    studioLiveBackdrop?.classList.toggle('hidden', studioLiveDrawer?.classList.contains('collapsed') || innerWidth > 760);
    requestAnimationFrame(() => {
      if (isAudio) renderAudioMixerPanel();
      else if (state.templateLayout) renderTemplateEditor();
      if (isAudio) audioHost && (audioHost.scrollTop = 0);
      else studioTemplateEditorHost.scrollTop = 0;
    });
  }

  function collapseStudioLiveDrawer() {
    studioLiveDrawer?.classList.add('collapsed');
    studioLiveBackdrop?.classList.add('hidden');
  }

  function showStudioLiveTools(openDrawer = true) {
    studioLiveTools?.classList.remove('hidden');
    studioView?.classList.add('live-tools-active');
    setStudioLiveTool(studioLiveTools?.dataset.activeTool || 'layers', openDrawer);
    // Yayın ilk açıldığında yalnızca sol ikon rayı görünsün; kullanıcı bir ikona
    // dokunduğunda drawer açılır. Böylece canlı görüntü gereksiz yere kapanmaz.
    if (!openDrawer) collapseStudioLiveDrawer();
  }

  function hideStudioLiveTools() {
    studioLiveTools?.classList.add('hidden');
    studioLiveDrawer?.classList.remove('collapsed');
    studioLiveBackdrop?.classList.add('hidden');
    studioView?.classList.remove('live-tools-active');
  }


  function mountTemplateEditorInStudio(show = true) {
    if (!templateEditorEl || !studioTemplateEditorHost) return;
    if (templateEditorEl.parentElement !== studioTemplateEditorHost) studioTemplateEditorHost.appendChild(templateEditorEl);
    const audioOpen = studioLiveTools?.dataset.activeTool === 'audio';
    studioTemplateEditorHost.classList.toggle('hidden', !show || audioOpen);
    if (show && !audioOpen) requestAnimationFrame(() => renderTemplateEditor());
  }

  function hideStudioTemplateEditor() {
    studioTemplateEditorHost?.classList.add('hidden');
    $('#studioAudioMixerHost')?.classList.add('hidden');
    hideStudioLiveTools();
  }

  function restoreTemplateEditorHome() {
    if (templateEditorEl && dualcamPanel && templateEditorEl.parentElement !== dualcamPanel) dualcamPanel.appendChild(templateEditorEl);
    studioTemplateEditorHost?.classList.add('hidden');
    $('#studioAudioMixerHost')?.classList.add('hidden');
    hideStudioLiveTools();
    if (state.templateLayout) requestAnimationFrame(() => renderTemplateEditor());
  }
  let dualcamDevicesLoaded = false;
  let lastCams = [], lastMics = [];

  let dualcamUnlocked = false;

  async function unlockDeviceLabelsOnce() {
    if (dualcamUnlocked) return;
    try {
      // Tarayıcılar, hiçbir kameraya izin verilmeden enumerateDevices() çağrıldığında
      // gizlilik amacıyla yalnızca TEK bir yer tutucu (placeholder) cihaz döndürür.
      // Gerçek cihaz listesi (tüm kameralar + isimleri), köken (origin) için EN AZ BİR KEZ
      // kamera izni verildikten sonra açılır. Bu yüzden burada bir kerelik, genel bir
      // izin isteği yapılır (tarayıcı kendi "hangi kamerayı kullanayım" seçicisini gösterebilir,
      // bu normaldir — hangi kamerayı seçersen seç, sonrasında TÜM kameralar listede görünür).
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tmp.getTracks().forEach(t => t.stop());
      dualcamUnlocked = true;
    } catch (e) {
      // İzin verilmese de enumerateDevices tekrar denenecek (placeholder olarak dönebilir).
    }
  }

  function camCount() { return state.camCount; }

  function populateOneCamSelect(vSel, aSel, cams, mics, prevV, defaultIdx) {
    vSel.innerHTML = '';
    if (!cams.length) {
      vSel.innerHTML = '<option value="">Kamera bulunamadı</option>';
    } else {
      cams.forEach((d, i) => {
        const label = d.label || `Kamera ${i + 1} (isim izin sonrası görünür)`;
        vSel.appendChild(new Option(label, d.deviceId));
      });
      vSel.value = cams.some(c => c.deviceId === prevV) ? prevV : (cams[defaultIdx] ? cams[defaultIdx].deviceId : cams[0].deviceId);
    }
    aSel.innerHTML = '';
    const noneOpt = () => new Option('Ses yok', '');
    if (!mics.length) {
      aSel.appendChild(noneOpt());
    } else {
      aSel.appendChild(noneOpt());
      mics.forEach((d, i) => aSel.appendChild(new Option(d.label || `Mikrofon ${i + 1} (isim izin sonrası görünür)`, d.deviceId)));
      const cam = cams.find(c => c.deviceId === vSel.value);
      const paired = cam && mics.find(m => m.groupId === cam.groupId);
      aSel.value = paired ? paired.deviceId : (mics[defaultIdx] ? mics[defaultIdx].deviceId : mics[0].deviceId);
    }
    vSel.onchange = () => {
      const cam = cams.find(c => c.deviceId === vSel.value);
      const m = cam && mics.find(x => x.groupId === cam.groupId);
      if (m) aSel.value = m.deviceId;
      checkDuplicateCams();
    };
  }

  function checkDuplicateCams() {
    const n = camCount();
    const ids = [];
    for (let i = 1; i <= n; i++) { const v = $(`#dualCam${i}`)?.value; if (v) ids.push(v); }
    if (new Set(ids).size !== ids.length) showToast('Uyarı: Aynı kamera birden fazla alanda seçili, her alan farklı olmalı.');
  }

  const MAX_CAMS = 5, MIN_CAMS = 2;

  function renderCamRows() {
    const container = $('#camRowsContainer');
    if (!container) return;
    const n = camCount();
    container.innerHTML = '';
    for (let i = 1; i <= n; i++) {
      const row = document.createElement('div');
      row.className = 'dualcam-row';
      row.innerHTML = `
        <label>Kamera ${i} (Capture Card)<select id="dualCam${i}"></select></label>
        <label>Kamera ${i} Sesi<select id="dualCam${i}Audio"></select></label>`;
      container.appendChild(row);
    }
    const label = $('#camCountLabel');
    if (label) label.textContent = `${n} kamera ekli (en fazla ${MAX_CAMS})`;
    $('#addCamBtn')?.toggleAttribute('disabled', n >= MAX_CAMS);
    $('#removeCamBtn')?.toggleAttribute('disabled', n <= MIN_CAMS);
  }

  function renderGuestRows() {
    const container = $('#guestRowsContainer');
    if (!container) return;
    const oldValues = {};
    container.querySelectorAll('input[id]').forEach(el => oldValues[el.id] = el.value);
    const n = camCount();
    container.innerHTML = '';
    for (let i = 1; i <= n; i++) {
      const row = document.createElement('div');
      row.className = 'dualcam-row';
      row.innerHTML = `
        <label>Konuk ${i} Adı<input id="tplGuest${i}Name" type="text" placeholder="Ör. Konuk ${i}" maxlength="40"></label>
        <label>Konuk ${i} Ünvan / Görev<input id="tplGuest${i}Title" type="text" placeholder="Ör. Uzman" maxlength="40"></label>`;
      container.appendChild(row);
      if (oldValues[`tplGuest${i}Name`] != null) $(`#tplGuest${i}Name`).value = oldValues[`tplGuest${i}Name`];
      if (oldValues[`tplGuest${i}Title`] != null) $(`#tplGuest${i}Title`).value = oldValues[`tplGuest${i}Title`];
    }
  }

  async function populateDualCamDevices(force) {
    if (dualcamDevicesLoaded && !force) return;
    const refreshBtn = $('#dualcamRefreshBtn');
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '↻ Taranıyor…'; }
    await unlockDeviceLabelsOnce();
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      lastCams = devices.filter(d => d.kind === 'videoinput');
      lastMics = devices.filter(d => d.kind === 'audioinput');
      const cams = lastCams, mics = lastMics;
      const n = camCount();

      if (!cams.length) showToast('Hiç kamera/capture card algılanamadı.');
      else if (cams.length < n) showToast(`Yalnızca ${cams.length} kamera algılandı — ${n} kamera seçmen gerekiyor.`);

      for (let i = 1; i <= n; i++) {
        const vSel = $(`#dualCam${i}`), aSel = $(`#dualCam${i}Audio`);
        if (vSel && aSel) populateOneCamSelect(vSel, aSel, cams, mics, vSel.value, i - 1);
      }
      checkDuplicateCams();

      dualcamDevicesLoaded = true;
    } catch (e) {
      showToast('Kamera/mikrofon listesi alınamadı: ' + (e.message || e.name));
    } finally {
      if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = '↻ Cihazları Yenile'; }
    }
  }

  $('#dualcamRefreshBtn')?.addEventListener('click', () => populateDualCamDevices(true));
  navigator.mediaDevices?.addEventListener?.('devicechange', () => {
    if (!dualcamPanel.classList.contains('hidden')) populateDualCamDevices(true);
    else dualcamDevicesLoaded = false;
  });

  $('#addCamBtn')?.addEventListener('click', () => {
    if (state.camCount >= MAX_CAMS) return;
    state.camCount++;
    renderCamRows();
    renderGuestRows();
    ensureTemplateLayoutShape(state.camCount);
    renderTemplateEditor();
    dualcamDevicesLoaded = false;
    populateDualCamDevices(true);
    showToast(`Kamera ${state.camCount} eklendi.`);
  });

  $('#removeCamBtn')?.addEventListener('click', () => {
    if (state.camCount <= MIN_CAMS) return;
    showToast(`Kamera ${state.camCount} kaldırıldı.`);
    state.camCount--;
    renderCamRows();
    renderGuestRows();
    ensureTemplateLayoutShape(state.camCount);
    renderTemplateEditor();
    dualcamDevicesLoaded = false;
    populateDualCamDevices(true);
  });

  $$('.tpl-preset-btn').forEach(btn => btn.addEventListener('click', () => {
    applyLayoutPreset(btn.dataset.preset);
    renderTemplateEditor();
    showToast('Düzen uygulandı.');
  }));

  $$('.share-option').forEach(btn => btn.addEventListener('click', () => {
    $$('.share-option').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.source = btn.dataset.source;
    $('#cameraOverlayRow').classList.toggle('hidden', state.source !== 'screen');
    $('#cameraOverlayToggle').disabled = state.source !== 'screen';
    $('#micToggle').closest('.switch-row').classList.toggle('hidden', state.source === 'dualcam');
    dualcamPanel.classList.toggle('hidden', state.source !== 'dualcam');
    if (state.source === 'dualcam') {
      if (!$('#camRowsContainer').children.length) { renderCamRows(); renderGuestRows(); }
      populateDualCamDevices();
      if (!state.templateLayout) { resetTemplateLayout(camCount()); renderTemplateEditor(); }
    }
  }));

  async function getMicrophoneStream() {
    if (!$('#micToggle').checked) return null;
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  }

  async function buildScreenStream() {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 60 } }, audio: true });
    display.getVideoTracks()[0]?.addEventListener('ended', stopBroadcast);
    state.rawStreams.push(display);
    state.screenStream = display;
    const mic = await getMicrophoneStream();
    state.screenMicStream = mic;
    if (mic) state.rawStreams.push(mic);

    state.screenAudioEngine?.stop?.();
    state.screenAudioEngine = await createScreenAudioEngine(display, mic);
    const mixedAudioTrack = state.screenAudioEngine?.track || null;

    if ($('#cameraOverlayToggle').checked) {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      state.rawStreams.push(cam);
      return composeScreenAndCamera(display, cam, mixedAudioTrack);
    }

    const out = new MediaStream();
    display.getVideoTracks().forEach(t => out.addTrack(t));
    if (mixedAudioTrack) out.addTrack(mixedAudioTrack);
    return out;
  }

  async function buildCameraStream() {
    const cam = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 }, facingMode: 'user' },
      audio: $('#micToggle').checked ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false
    });
    state.rawStreams.push(cam);
    return cam;
  }

  async function createScreenAudioEngine(displayStream, micStream) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const initialTracks = [...displayStream.getAudioTracks(), ...(micStream ? micStream.getAudioTracks() : [])];
    if (!AudioCtx) {
      return {
        track: initialTracks[0] || null,
        replaceDisplayStream() {},
        stop() {}
      };
    }

    const ctx = new AudioCtx({ latencyHint: 'interactive' });
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    state.audioContext = ctx;
    const dest = ctx.createMediaStreamDestination();
    let displaySources = [];
    let micSources = [];

    const disconnectAll = (arr) => arr.forEach(node => { try { node.disconnect(); } catch (_) {} });
    const connectTracks = (tracks) => tracks.map(track => {
      const node = ctx.createMediaStreamSource(new MediaStream([track]));
      node.connect(dest);
      return node;
    });

    displaySources = connectTracks(displayStream.getAudioTracks());
    micSources = connectTracks(micStream ? micStream.getAudioTracks() : []);

    return {
      track: dest.stream.getAudioTracks()[0] || initialTracks[0],
      replaceDisplayStream(nextDisplay) {
        disconnectAll(displaySources);
        displaySources = connectTracks(nextDisplay.getAudioTracks());
      },
      setMicEnabled(enabled) {
        micStream?.getAudioTracks().forEach(t => { t.enabled = enabled; });
      },
      stop() {
        disconnectAll(displaySources);
        disconnectAll(micSources);
        displaySources = []; micSources = [];
      }
    };
  }

  async function composeScreenAndCamera(screen, camera, mixedAudioTrack) {
    const screenVideo = document.createElement('video');
    const camVideo = document.createElement('video');
    screenVideo.srcObject = screen;
    camVideo.srcObject = camera;
    screenVideo.muted = camVideo.muted = true;
    await Promise.all([screenVideo.play(), camVideo.play()]);
    state.screenVideoEl = screenVideo;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = 1920;
    canvas.height = 1080;
    let running = true;
    let lastFrameTs = 0;

    const draw = (ts = performance.now()) => {
      if (!running) return;
      requestAnimationFrame(draw);
      if (ts - lastFrameTs < 1000 / 30) return;
      lastFrameTs = ts;
      const sw = screenVideo.videoWidth || 1920, sh = screenVideo.videoHeight || 1080;
      const scale = Math.min(canvas.width / sw, canvas.height / sh);
      const dw = sw * scale, dh = sh * scale;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(screenVideo, (canvas.width - dw)/2, (canvas.height - dh)/2, dw, dh);

      const cw = 340, ratio = (camVideo.videoHeight || 720) / (camVideo.videoWidth || 1280), ch = cw * ratio;
      const x = canvas.width - cw - 38, y = canvas.height - ch - 38;
      ctx.save();
      roundRect(ctx, x-6, y-6, cw+12, ch+12, 24);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
      roundRect(ctx, x, y, cw, ch, 20); ctx.clip();
      ctx.drawImage(camVideo, x, y, cw, ch);
      ctx.restore();
    };
    requestAnimationFrame(draw);
    state.compositorStop = () => { running = false; };

    const out = canvas.captureStream(30);
    const outVTrack = out.getVideoTracks()[0];
    if (outVTrack) outVTrack.contentHint = 'motion';
    if (mixedAudioTrack) out.addTrack(mixedAudioTrack);
    return out;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x,y,w,h,r) : (ctx.rect(x,y,w,h));
  }

  function readTemplateData() {
    const val = (id) => ($(id)?.value || '').trim();
    const data = {
      title: val('#tplTitle') || 'YAYIN BAŞLIĞI BURAYA GELECEK',
      subtitle: val('#tplSubtitle') || 'Alt başlık / açıklama metni buraya gelecek',
      ticker: val('#tplTicker') || 'son durum • son durum • son durum • son durum',
      youtube: val('#tplYoutube') || '/kanaladiniz',
      twitter: val('#tplTwitter') || '/kanaladiniz',
      facebook: val('#tplFacebook') || '/kanaladiniz',
      instagram: val('#tplInstagram') || '/kanaladiniz'
    };
    for (let i = 1; i <= MAX_CAMS; i++) {
      data[`guest${i}Name`] = val(`#tplGuest${i}Name`) || `Konuk ${i}`;
      data[`guest${i}Title`] = val(`#tplGuest${i}Title`) || 'Ünvan / Görev';
    }
    return data;
  }

  const TPL_FIELD_IDS = ['tplTitle','tplSubtitle','tplTicker','tplYoutube','tplTwitter','tplFacebook','tplInstagram', ...Array.from({length: MAX_CAMS}, (_, i) => [`tplGuest${i + 1}Name`, `tplGuest${i + 1}Title`]).flat()];
  function readTemplateFieldsRaw() {
    const out = {};
    TPL_FIELD_IDS.forEach(id => { const el = $('#' + id); if (el) out[id] = el.value; });
    return out;
  }

  // ---- Şablon yerleşim motoru (kamera kutuları, başlık/alt başlık/ticker/sosyal medya konumları) ----
  function layoutRow(n, opts = {}) {
    const margin = opts.margin ?? 30 / 1920, gap = opts.gap ?? 20 / 1920, top = opts.top ?? 190 / 1080, boxH = opts.boxH ?? 540 / 1080;
    const boxW = (1 - margin * 2 - (n - 1) * gap) / n;
    const cams = [];
    for (let i = 0; i < n; i++) cams.push({ x: margin + i * (boxW + gap), y: top, w: boxW, h: boxH });
    return cams;
  }

  function layoutDual() {
    const boxW = 890 / 1920, boxH = 460 / 1080, gap = 40 / 1920, top = 190 / 1080;
    const x1 = (1 - boxW * 2 - gap) / 2, x2 = x1 + boxW + gap;
    return [{ x: x1, y: top, w: boxW, h: boxH }, { x: x2, y: top, w: boxW, h: boxH }];
  }

  function layoutGrid(n) {
    const cols = Math.ceil(n / 2), rows = 2;
    const margin = 30 / 1920, gap = 20 / 1920, top = 150 / 1080, rowGap = 20 / 1080;
    const boxW = (1 - margin * 2 - (cols - 1) * gap) / cols;
    const boxH = 260 / 1080;
    const cams = [];
    for (let i = 0; i < n; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      cams.push({ x: margin + col * (boxW + gap), y: top + row * (boxH + rowGap), w: boxW, h: boxH });
    }
    return cams;
  }

  function defaultCamsFor(n) {
    if (n === 2) return layoutDual();
    return layoutRow(n);
  }

  function applyLayoutPreset(preset) {
    if (!state.templateLayout) resetTemplateLayout(camCount());
    const n = camCount();
    let cams;
    if (preset === 'dual') cams = n === 2 ? layoutDual() : layoutRow(n);
    else if (preset === 'grid') cams = layoutGrid(n);
    else cams = layoutRow(n);
    state.templateLayout.layers.cams = cams.map(r => ({ ...r, visible: true }));
    syncGuestLayersToCams(true);
  }

  function guestLayerDefaults(camRect, kind) {
    const inset = Math.min(0.012, camRect.w * 0.04);
    const nameH = Math.min(0.052, Math.max(0.032, camRect.h * 0.12));
    const titleH = Math.min(0.042, Math.max(0.026, camRect.h * 0.09));
    if (kind === 'name') {
      return { x: camRect.x + inset, y: Math.max(camRect.y, camRect.y + camRect.h - nameH - titleH - 0.012), w: Math.max(0.08, camRect.w - inset * 2), h: nameH, visible: true, fontSize: 24 };
    }
    return { x: camRect.x + inset, y: Math.max(camRect.y, camRect.y + camRect.h - titleH - 0.008), w: Math.max(0.08, camRect.w - inset * 2), h: titleH, visible: true, fontSize: 16 };
  }

  function normalizeRect(rect, fallback) {
    // V4.3: Katman nesnesinin referansını KORU. Önceki sürüm her render'da
    // yeni obje ürettiği için canlı drag/delete handler'ları eski objeye bağlı kalıyordu.
    const source = rect && typeof rect === 'object' ? { ...rect } : {};
    const out = rect && typeof rect === 'object' ? rect : {};
    Object.assign(out, fallback, source);
    ['x','y','w','h'].forEach(k => { if (!Number.isFinite(Number(out[k]))) out[k] = fallback[k]; else out[k] = Number(out[k]); });
    out.w = Math.min(1, Math.max(0.025, out.w));
    out.h = Math.min(1, Math.max(0.02, out.h));
    out.x = Math.min(1 - out.w, Math.max(0, out.x));
    out.y = Math.min(1 - out.h, Math.max(0, out.y));
    if (typeof out.visible !== 'boolean') out.visible = true;
    if (typeof out.locked !== 'boolean') out.locked = false;
    return out;
  }

  function ensureTemplateLayoutShape(n) {
    n = n || camCount();
    if (!state.templateLayout) resetTemplateLayout(n);
    const T = state.templateLayout;
    T.bg = { fit: 'cover', x: 0.5, y: 0.5, scale: 1, opacity: 1, ...(T.bg || {}) };
    if (!['cover','contain','original'].includes(T.bg.fit)) T.bg.fit = 'cover';
    T.bg.x = Number.isFinite(Number(T.bg.x)) ? Number(T.bg.x) : 0.5;
    T.bg.y = Number.isFinite(Number(T.bg.y)) ? Number(T.bg.y) : 0.5;
    T.bg.scale = Math.min(3, Math.max(0.25, Number(T.bg.scale) || 1));
    T.bg.opacity = Math.min(1, Math.max(0, Number(T.bg.opacity) || 1));

    T.layers ||= {};
    const defaults = defaultCamsFor(n);
    // Düzeltme: kamera sayısı değiştiğinde ARTIK yalnızca yeni eklenen kamera(lar)
    // varsayılan konuma yerleşir; mevcut kameraların özel konum/boyut/kilit durumu
    // indeks bazında korunur (önceden tüm kameralar sıfırlanıyordu).
    const oldCams = Array.isArray(T.layers.cams) ? T.layers.cams : [];
    T.layers.cams = Array.from({ length: n }, (_, i) =>
      oldCams[i] ? normalizeRect(oldCams[i], { ...defaults[i], visible: true, locked: false })
                 : { ...defaults[i], visible: true, locked: false });
    T.layers.liveBadge = normalizeRect(T.layers.liveBadge, { x: 20 / 1920, y: 30 / 1080, w: 300 / 1920, h: 60 / 1080, visible: true, fontSize: 30, text: '● CANLI YAYIN' });
    T.layers.programName = normalizeRect(T.layers.programName, { x: .35, y: 22 / 1080, w: .30, h: 56 / 1080, visible: true, fontSize: 44, text: 'ÖZEL YAYIN' });
    T.layers.programTagline = normalizeRect(T.layers.programTagline, { x: .33, y: 76 / 1080, w: .34, h: 38 / 1080, visible: true, fontSize: 18, text: 'GÜNDEM • RÖPORTAJ • ANALİZ' });
    T.layers.liveBadge.text = String(T.layers.liveBadge.text ?? '● CANLI YAYIN');
    T.layers.programName.text = String(T.layers.programName.text ?? 'ÖZEL YAYIN');
    T.layers.programTagline.text = String(T.layers.programTagline.text ?? 'GÜNDEM • RÖPORTAJ • ANALİZ');
    T.layers.title = normalizeRect(T.layers.title, { x: 40 / 1920, y: 786 / 1080, w: 1840 / 1920, h: 90 / 1080, visible: true, fontSize: 54 });
    T.layers.subtitle = normalizeRect(T.layers.subtitle, { x: 40 / 1920, y: 876 / 1080, w: 1840 / 1920, h: 70 / 1080, visible: true, fontSize: 24 });
    T.layers.ticker = normalizeRect(T.layers.ticker, { x: 0, y: 730 / 1080, w: 1, h: 56 / 1080, visible: true, fontSize: 22 });
    T.layers.socials = normalizeRect(T.layers.socials, { x: 0, y: 946 / 1080, w: 1, h: 60 / 1080, visible: true, fontSize: 20 });
    const oldGuestNames = Array.isArray(T.layers.guestNames) ? T.layers.guestNames : [];
    const oldGuestTitles = Array.isArray(T.layers.guestTitles) ? T.layers.guestTitles : [];
    T.layers.guestNames = Array.from({ length: n }, (_, i) => {
      const fallback = guestLayerDefaults(T.layers.cams[i], 'name');
      return oldGuestNames[i] ? normalizeRect(oldGuestNames[i], fallback) : fallback;
    });
    T.layers.guestTitles = Array.from({ length: n }, (_, i) => {
      const fallback = guestLayerDefaults(T.layers.cams[i], 'title');
      return oldGuestTitles[i] ? normalizeRect(oldGuestTitles[i], fallback) : fallback;
    });
    T.layers.custom = Array.isArray(T.layers.custom) ? T.layers.custom.map((r, i) => normalizeRect(r, { x: .08, y: .12 + i * .05, w: .34, h: .07, visible: true, fontSize: 30, locked: false, text: `Metin ${i + 1}`, id: `custom-${Date.now()}-${i}` })) : [];
    T.layers.custom.forEach((r, i) => {
      r.id ||= `custom-${Date.now()}-${i}-${Math.random().toString(36).slice(2,7)}`;
      if (r.type === 'image') {
        r.src = typeof r.src === 'string' ? r.src : '';
        r.opacity = Math.min(1, Math.max(0, Number(r.opacity ?? 1)));
      } else {
        r.text = String(r.text ?? `Metin ${i + 1}`);
        r.fontSize = Math.min(120, Math.max(8, Number(r.fontSize) || 30));
      }
    });

    T.fontSizes = { title: 54, subtitle: 24, ticker: 22, guest: 24, guestTitle: 16, socials: 20, ...(T.fontSizes || {}) };
    T.layers.title.fontSize ||= T.fontSizes.title;
    T.layers.subtitle.fontSize ||= T.fontSizes.subtitle;
    T.layers.ticker.fontSize ||= T.fontSizes.ticker;
    T.layers.socials.fontSize ||= T.fontSizes.socials;
    T.layers.guestNames.forEach(r => r.fontSize ||= T.fontSizes.guest);
    T.layers.guestTitles.forEach(r => r.fontSize ||= T.fontSizes.guestTitle);
    return T;
  }

  function resetTemplateLayout(n) {
    n = n || camCount();
    const oldBgImage = state.templateLayout?.bgImage || null;
    const oldBg = state.templateLayout?.bg || { fit: 'cover', x: .5, y: .5, scale: 1, opacity: 1 };
    const cams = defaultCamsFor(n).map(r => ({ ...r, visible: true, locked: false }));
    state.templateLayout = {
      bgImage: oldBgImage,
      bg: { fit: 'cover', x: .5, y: .5, scale: 1, opacity: 1, ...oldBg },
      layers: {
        cams,
        liveBadge: { x: 20 / 1920, y: 30 / 1080, w: 300 / 1920, h: 60 / 1080, visible: true, fontSize: 30, text: '● CANLI YAYIN' },
        programName: { x: .35, y: 22 / 1080, w: .30, h: 56 / 1080, visible: true, fontSize: 44, text: 'ÖZEL YAYIN' },
        programTagline: { x: .33, y: 76 / 1080, w: .34, h: 38 / 1080, visible: true, fontSize: 18, text: 'GÜNDEM • RÖPORTAJ • ANALİZ' },
        title: { x: 40 / 1920, y: 786 / 1080, w: 1840 / 1920, h: 90 / 1080, visible: true, fontSize: 54 },
        subtitle: { x: 40 / 1920, y: 876 / 1080, w: 1840 / 1920, h: 70 / 1080, visible: true, fontSize: 24 },
        ticker: { x: 0, y: 730 / 1080, w: 1, h: 56 / 1080, visible: true, fontSize: 22 },
        socials: { x: 0, y: 946 / 1080, w: 1, h: 60 / 1080, visible: true, fontSize: 20 },
        guestNames: cams.map(c => guestLayerDefaults(c, 'name')),
        guestTitles: cams.map(c => guestLayerDefaults(c, 'title')),
        custom: []
      },
      fontSizes: { title: 54, subtitle: 24, ticker: 22, guest: 24, guestTitle: 16, socials: 20 }
    };
    state.templateSelected = 'title';
    syncTemplateControls();
  }

  function syncGuestLayersToCams(force = false) {
    ensureTemplateLayoutShape(camCount());
    const L = state.templateLayout.layers;
    L.cams.forEach((cam, i) => {
      if (force || !L.guestNames[i]) L.guestNames[i] = guestLayerDefaults(cam, 'name');
      if (force || !L.guestTitles[i]) L.guestTitles[i] = guestLayerDefaults(cam, 'title');
    });
  }

  // V4.4: DOM elementleri eski rect referanslarını taşımıyor.
  // Her işlem katmanı ID üzerinden güncel templateLayout state'inden tekrar bulur.
  function rectByLayerId(id) {
    if (!state.templateLayout?.layers || !id) return null;
    const L = state.templateLayout.layers;
    let m;
    if ((m = /^cam:(\d+)$/.exec(id))) return L.cams?.[Number(m[1])] || null;
    if ((m = /^guestName:(\d+)$/.exec(id))) return L.guestNames?.[Number(m[1])] || null;
    if ((m = /^guestTitle:(\d+)$/.exec(id))) return L.guestTitles?.[Number(m[1])] || null;
    if ((m = /^custom:(.+)$/.exec(id))) return L.custom?.find(r => String(r.id) === m[1]) || null;
    if (['liveBadge','programName','programTagline','title','subtitle','ticker','socials'].includes(id)) return L[id] || null;
    return null;
  }

  function makeDraggable(el, layerId, previewEl, onSelect, onCommit) {
    const currentRect = () => rectByLayerId(layerId);
    const applyPos = () => {
      const rect = currentRect();
      if (!rect) return;
      el.style.left = (rect.x * 100) + '%';
      el.style.top = (rect.y * 100) + '%';
      el.style.width = (rect.w * 100) + '%';
      el.style.height = (rect.h * 100) + '%';
    };
    applyPos();
    el.style.touchAction = 'none';
    el.style.pointerEvents = 'auto';

    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.tpl-resize,.tpl-live-remove,.tpl-live-lock,button,input,select,textarea')) return;
      const rect = currentRect();
      if (!rect) return;
      onSelect?.();
      if (rect.locked) {
        e.preventDefault();
        e.stopPropagation();
        showToast('Bu element kilitli. Taşımak için kilidi aç.');
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('dragging');
      try { el.setPointerCapture?.(e.pointerId); } catch (_) {}
      const pRect = previewEl.getBoundingClientRect();
      if (!pRect.width || !pRect.height) return;
      const startX = e.clientX, startY = e.clientY;
      const origX = rect.x, origY = rect.y;
      const onMove = (ev) => {
        const liveRect = currentRect();
        if (!liveRect || liveRect.locked) return;
        const dx = (ev.clientX - startX) / pRect.width;
        const dy = (ev.clientY - startY) / pRect.height;
        liveRect.x = Math.min(1 - liveRect.w, Math.max(0, origX + dx));
        liveRect.y = Math.min(1 - liveRect.h, Math.max(0, origY + dy));
        applyPos();
      };
      const onUp = (ev) => {
        el.classList.remove('dragging');
        try { el.releasePointerCapture?.(ev.pointerId); } catch (_) {}
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        renderLayerList();
        renderSelectedInspector();
        onCommit?.(currentRect());
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });

    const handle = document.createElement('div');
    handle.className = 'tpl-resize';
    handle.title = 'Boyutlandır';
    el.appendChild(handle);
    handle.addEventListener('pointerdown', (e) => {
      const rect = currentRect();
      if (!rect) return;
      onSelect?.();
      e.stopPropagation(); e.preventDefault();
      if (rect.locked) {
        showToast('Bu element kilitli. Boyutlandırmak için kilidi aç.');
        return;
      }
      el.classList.add('resizing');
      try { handle.setPointerCapture?.(e.pointerId); } catch (_) {}
      const pRect = previewEl.getBoundingClientRect();
      if (!pRect.width || !pRect.height) return;
      const startX = e.clientX, startY = e.clientY;
      const origW = rect.w, origH = rect.h;
      const onMove = (ev) => {
        const liveRect = currentRect();
        if (!liveRect || liveRect.locked) return;
        const dx = (ev.clientX - startX) / pRect.width;
        const dy = (ev.clientY - startY) / pRect.height;
        liveRect.w = Math.min(1 - liveRect.x, Math.max(0.025, origW + dx));
        liveRect.h = Math.min(1 - liveRect.y, Math.max(0.02, origH + dy));
        applyPos();
      };
      const onUp = (ev) => {
        el.classList.remove('resizing');
        try { handle.releasePointerCapture?.(ev.pointerId); } catch (_) {}
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        renderLayerList();
        renderSelectedInspector();
        onCommit?.(currentRect());
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });
  }

  function layerDescriptors() {
    ensureTemplateLayoutShape(camCount());
    const L = state.templateLayout.layers;
    const list = [];
    // Live editörde başlangıçta gelen katmanlarla sonradan eklenen katmanlar
    // aynı davranışı kullanır. isDefault yalnızca görsel ayırım içindir.
    L.cams.forEach((rect, i) => list.push({ id: `cam:${i}`, label: `Kamera ${i + 1}`, type: 'camera', rect, isDefault: true }));
    list.push({ id: 'liveBadge', label: 'Canlı Yayın Etiketi', type: 'layoutText', rect: L.liveBadge, isDefault: true });
    list.push({ id: 'programName', label: 'Program Üst Başlığı', type: 'layoutText', rect: L.programName, isDefault: true });
    list.push({ id: 'programTagline', label: 'Program Üst Alt Metni', type: 'layoutText', rect: L.programTagline, isDefault: true });
    list.push({ id: 'title', label: 'Başlık', type: 'text', rect: L.title, inputId: 'tplTitle', fontKey: 'title', isDefault: true });
    list.push({ id: 'subtitle', label: 'Alt Başlık', type: 'text', rect: L.subtitle, inputId: 'tplSubtitle', fontKey: 'subtitle', isDefault: true });
    list.push({ id: 'ticker', label: 'Kayan Metin', type: 'text', rect: L.ticker, inputId: 'tplTicker', fontKey: 'ticker', isDefault: true });
    L.guestNames.forEach((rect, i) => list.push({ id: `guestName:${i}`, label: `Konuk ${i + 1} Adı`, type: 'text', rect, inputId: `tplGuest${i + 1}Name`, fontKey: 'guest', isDefault: true }));
    L.guestTitles.forEach((rect, i) => list.push({ id: `guestTitle:${i}`, label: `Konuk ${i + 1} Ünvanı`, type: 'text', rect, inputId: `tplGuest${i + 1}Title`, fontKey: 'guestTitle', isDefault: true }));
    list.push({ id: 'socials', label: 'Sosyal Medya', type: 'socials', rect: L.socials, fontKey: 'socials', isDefault: true });
    L.custom.forEach((rect, i) => list.push({
      id: `custom:${rect.id}`,
      label: rect.type === 'image' ? `Görsel ${i + 1}` : `Serbest Metin ${i + 1}`,
      type: rect.type === 'image' ? 'image' : 'custom',
      rect, customIndex: i, isDefault: false
    }));
    return list;
  }

  function descriptorById(id) { return layerDescriptors().find(x => x.id === id) || null; }

  function descriptorText(desc) {
    if (!desc) return '';
    if (desc.type === 'image') return desc.rect.src ? 'Görsel katmanı' : 'Görsel bulunamadı';
    if (desc.type === 'custom' || desc.type === 'layoutText') return desc.rect.text || '';
    if (desc.inputId) return $('#' + desc.inputId)?.value || '';
    if (desc.type === 'socials') return [$('#tplYoutube')?.value, $('#tplTwitter')?.value, $('#tplFacebook')?.value, $('#tplInstagram')?.value].filter(Boolean).join(' • ');
    return '';
  }

  function setDescriptorText(desc, value) {
    if (!desc) return;
    if (desc.type === 'image') return;
    if (desc.type === 'custom' || desc.type === 'layoutText') desc.rect.text = value;
    else if (desc.inputId) { const input = $('#' + desc.inputId); if (input) input.value = value; }
  }

  function layerPreviewLabel(desc) {
    const txt = descriptorText(desc).trim();
    if (txt) return txt.length > 44 ? txt.slice(0, 44) + '…' : txt;
    return desc.label;
  }

  function renderAddElementOptions() {
    const sel = $('#tplAddElementType');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    sel.appendChild(new Option('Serbest Metin Kutusu', 'customText'));
    layerDescriptors().filter(d => d.rect.visible === false).forEach(d => sel.appendChild(new Option(`${d.label} (geri ekle)`, d.id)));
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  }

  function renderLayerList() {
    const box = $('#tplLayerList');
    if (!box) return;
    box.innerHTML = '';
    layerDescriptors().forEach(desc => {
      const row = document.createElement('div');
      row.className = 'tpl-layer-item' + (state.templateSelected === desc.id ? ' active' : '');
      const eye = document.createElement('button');
      eye.type = 'button'; eye.className = 'tpl-layer-eye'; eye.title = desc.rect.visible === false ? 'Göster' : 'Gizle';
      eye.textContent = desc.rect.visible === false ? '○' : '●';
      eye.addEventListener('click', (e) => { e.stopPropagation(); desc.rect.visible = desc.rect.visible === false; renderTemplateEditor(); });
      const name = document.createElement('div');
      name.className = 'tpl-layer-name';
      const t = layerPreviewLabel(desc);
      name.innerHTML = `<b>${desc.label}</b><small>${t.replace(/[<&]/g, m => m === '<' ? '&lt;' : '&amp;')}</small>`;
      name.addEventListener('click', () => selectTemplateLayer(desc.id));
      const lock = document.createElement('button');
      lock.type = 'button'; lock.className = 'tpl-layer-lock';
      lock.title = desc.rect.locked ? 'Kilidi aç' : 'Konum ve boyutu kilitle';
      lock.setAttribute('aria-label', lock.title);
      lock.textContent = desc.rect.locked ? '🔒' : '🔓';
      lock.addEventListener('click', (e) => {
        e.stopPropagation();
        const liveRect = rectByLayerId(desc.id);
        if (!liveRect) return;
        liveRect.locked = !liveRect.locked;
        state.templateSelected = desc.id;
        renderTemplateEditor();
        showToast(liveRect.locked ? `${desc.label} kilitlendi.` : `${desc.label} kilidi açıldı.`);
      });
      const pick = document.createElement('button'); pick.type = 'button'; pick.textContent = 'Düzenle';
      pick.addEventListener('click', () => selectTemplateLayer(desc.id));
      row.append(eye, name, lock, pick); box.appendChild(row);
    });
    renderAddElementOptions();
  }

  function selectTemplateLayer(id) {
    state.templateSelected = id;
    renderTemplateEditor();
  }

  function refreshLiveTemplateOverlay() {
    if (state.liveEditActive) renderLiveTemplateOverlay();
  }

  function removeTemplateDescriptor(descOrId) {
    const id = typeof descOrId === 'string' ? descOrId : descOrId?.id;
    if (!id) return;
    const desc = descriptorById(id);
    if (!desc) return;
    if (desc.type === 'custom' || desc.type === 'image') {
      const idx = state.templateLayout.layers.custom.findIndex(r => `custom:${r.id}` === id);
      if (idx >= 0) state.templateLayout.layers.custom.splice(idx, 1);
      state.templateSelected = 'title';
      showToast('Serbest element silindi.');
    } else {
      const liveRect = rectByLayerId(id);
      if (liveRect) liveRect.visible = false;
      showToast(`${desc.label} yayın alanından kaldırıldı.`);
    }
    renderTemplateEditor();
  }

  function renderSelectedInspector() {
    const desc = descriptorById(state.templateSelected);
    const title = $('#tplSelectedLabel'), text = $('#tplSelectedText'), textWrap = $('#tplSelectedTextWrap');
    const font = $('#tplSelectedFont'), fontVal = $('#tplSelectedFontValue'), vis = $('#tplSelectedVisible'), lock = $('#tplSelectedLocked'), del = $('#tplDeleteElementBtn');
    if (!title || !text || !font || !vis || !lock || !del) return;
    if (!desc) {
      title.textContent = 'Bir element seç'; text.value = ''; text.disabled = true; font.disabled = true; vis.disabled = true; lock.disabled = true; del.disabled = true;
      return;
    }
    title.textContent = desc.label;
    const canText = desc.type === 'text' || desc.type === 'custom' || desc.type === 'layoutText';
    textWrap?.classList.toggle('is-disabled', !canText);
    text.disabled = !canText;
    text.value = canText ? descriptorText(desc) : '';
    const fs = Math.round(Number(desc.rect.fontSize || state.templateLayout.fontSizes[desc.fontKey] || 24));
    font.disabled = desc.type === 'camera' || desc.type === 'image';
    font.value = Math.min(120, Math.max(8, fs));
    fontVal.textContent = (desc.type === 'camera' || desc.type === 'image') ? '—' : `${fs}px`;
    vis.disabled = false; vis.checked = desc.rect.visible !== false;
    lock.disabled = false; lock.checked = !!desc.rect.locked;
    del.disabled = false;
    del.textContent = (desc.type === 'custom' || desc.type === 'image') ? '− Elementi Sil' : '− Elementi Kaldır';
  }

  function backgroundDrawMetrics(imgW, imgH, W, H, bg) {
    let base = 1;
    if (bg.fit === 'cover') base = Math.max(W / imgW, H / imgH);
    else if (bg.fit === 'contain') base = Math.min(W / imgW, H / imgH);
    else base = W / 1920;
    const scale = base * (Number(bg.scale) || 1);
    const dw = imgW * scale, dh = imgH * scale;
    const x = (W - dw) / 2 + (Number(bg.x) - .5) * W;
    const y = (H - dh) / 2 + (Number(bg.y) - .5) * H;
    return { x, y, w: dw, h: dh };
  }

  function applyBackgroundPreview(img, preview) {
    if (!img?.naturalWidth || !preview) return;
    ensureTemplateLayoutShape(camCount());
    const r = preview.getBoundingClientRect();
    const m = backgroundDrawMetrics(img.naturalWidth, img.naturalHeight, r.width, r.height, state.templateLayout.bg);
    img.style.left = `${m.x}px`; img.style.top = `${m.y}px`; img.style.width = `${m.w}px`; img.style.height = `${m.h}px`;
    img.style.opacity = String(state.templateLayout.bg.opacity ?? 1);
  }

  function attachBackgroundDrag(img, preview) {
    img.addEventListener('pointerdown', (e) => {
      if (!state.templateLayout?.bgImage) return;
      e.preventDefault(); e.stopPropagation(); img.classList.add('dragging');
      const r = preview.getBoundingClientRect();
      const bg = state.templateLayout.bg;
      const sx = e.clientX, sy = e.clientY, ox = bg.x, oy = bg.y;
      const move = (ev) => {
        bg.x = Math.min(1.5, Math.max(-.5, ox + (ev.clientX - sx) / r.width));
        bg.y = Math.min(1.5, Math.max(-.5, oy + (ev.clientY - sy) / r.height));
        applyBackgroundPreview(img, preview);
      };
      const up = () => { img.classList.remove('dragging'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    });
  }

  function syncTemplateControls() {
    if (!state.templateLayout) return;
    ensureTemplateLayoutShape(camCount());
    const bg = state.templateLayout.bg;
    if ($('#tplBgFit')) $('#tplBgFit').value = bg.fit;
    if ($('#tplBgScale')) $('#tplBgScale').value = Math.round(bg.scale * 100);
    if ($('#tplBgScaleValue')) $('#tplBgScaleValue').textContent = `${Math.round(bg.scale * 100)}%`;
    const fs = state.templateLayout.fontSizes;
    [['fsTitle','title'],['fsSubtitle','subtitle'],['fsTicker','ticker'],['fsGuest','guest'],['fsGuestTitle','guestTitle'],['fsSocials','socials']].forEach(([id,key]) => { if ($('#'+id)) $('#'+id).value = fs[key]; });
  }

  function isSafeTemplateImageSrc(src) {
    return typeof src === 'string' && (/^data:image\//i.test(src) || /^blob:/i.test(src));
  }

  function hydrateTemplateCustomImages() {
    const cache = state.templateCustomImages;
    const validIds = new Set();
    (state.templateLayout?.layers?.custom || []).forEach(rect => {
      if (rect.type !== 'image' || !isSafeTemplateImageSrc(rect.src)) return;
      const id = String(rect.id);
      validIds.add(id);
      const cached = cache.get(id);
      if (cached?.__ebsSource === rect.src) return;
      const img = new Image();
      img.decoding = 'async';
      img.__ebsSource = rect.src;
      img.src = rect.src;
      cache.set(id, img);
    });
    [...cache.keys()].forEach(id => { if (!validIds.has(id)) cache.delete(id); });
  }

  function drawCustomTemplateLayer(ctx, rect, W, H) {
    if (!rect || rect.visible === false) return;
    if (rect.type === 'image') {
      const img = state.templateCustomImages.get(String(rect.id));
      if (!img?.complete || !img.naturalWidth) return;
      const x = rect.x * W, y = rect.y * H, w = rect.w * W, h = rect.h * H;
      ctx.save();
      ctx.globalAlpha = rect.opacity ?? 1;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
    }
  }

  function renderTemplateEditor() {
    const preview = $('#tplPreview');
    if (!preview || !state.templateLayout) return;
    ensureTemplateLayoutShape(camCount());
    hydrateTemplateCustomImages();
    preview.innerHTML = '';
    preview.style.backgroundImage = '';
    if (state.templateLayout.bgImage) {
      const img = document.createElement('img');
      img.className = 'tpl-bg-canvas-img';
      img.alt = '';
      img.src = state.templateLayout.bgImage;
      preview.appendChild(img);
      img.addEventListener('load', () => applyBackgroundPreview(img, preview), { once: true });
      if (img.complete) requestAnimationFrame(() => applyBackgroundPreview(img, preview));
      attachBackgroundDrag(img, preview);
    }
    layerDescriptors().forEach(desc => {
      if (desc.rect.visible === false) return;
      const el = document.createElement('div');
      el.dataset.layerId = desc.id;
      el.className = 'tpl-el' + (desc.type === 'camera' ? '' : ' text-el') + (desc.type === 'custom' ? ' custom-text-el' : '') + (desc.type === 'image' ? ' custom-image-el' : '') + (state.templateSelected === desc.id ? ' selected' : '') + (desc.rect.locked ? ' locked-layer' : '');
      if (desc.type === 'image' && isSafeTemplateImageSrc(desc.rect.src)) {
        const img = document.createElement('img');
        img.src = desc.rect.src; img.alt = ''; img.draggable = false;
        el.appendChild(img);
      } else {
        el.textContent = layerPreviewLabel(desc);
      }
      preview.appendChild(el);
      makeDraggable(el, desc.id, preview, () => { state.templateSelected = desc.id; renderLayerList(); renderSelectedInspector(); });
    });
    renderLayerList();
    renderSelectedInspector();
    syncTemplateControls();
    refreshLiveTemplateOverlay();
    refreshStudioLockAllButton();
  }

  $('#tplAddElementBtn')?.addEventListener('click', () => {
    if (!state.templateLayout) resetTemplateLayout(camCount());
    ensureTemplateLayoutShape(camCount());
    const type = $('#tplAddElementType')?.value || 'customText';
    if (type === 'customText') {
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      state.templateLayout.layers.custom.push({ id, text: 'Yeni Metin', x: .08, y: .14, w: .34, h: .075, visible: true, fontSize: 30 });
      state.templateSelected = `custom:${id}`;
      showToast('Serbest metin elementi eklendi.');
    } else {
      const d = descriptorById(type);
      if (d) { d.rect.visible = true; state.templateSelected = d.id; showToast(`${d.label} tekrar eklendi.`); }
    }
    renderTemplateEditor();
  });

  $('#tplSelectedText')?.addEventListener('input', (e) => {
    const d = descriptorById(state.templateSelected); if (!d) return;
    setDescriptorText(d, e.target.value); renderLayerList(); refreshLiveTemplateOverlay();
  });
  $('#tplSelectedFont')?.addEventListener('input', (e) => {
    const d = descriptorById(state.templateSelected); if (!d || d.type === 'camera') return;
    d.rect.fontSize = parseInt(e.target.value, 10);
    if (d.fontKey) state.templateLayout.fontSizes[d.fontKey] = d.rect.fontSize;
    $('#tplSelectedFontValue').textContent = `${d.rect.fontSize}px`;
    syncTemplateControls();
  });
  $('#tplSelectedVisible')?.addEventListener('change', (e) => {
    const d = descriptorById(state.templateSelected); if (!d) return;
    d.rect.visible = e.target.checked; renderTemplateEditor();
  });
  $('#tplSelectedLocked')?.addEventListener('change', (e) => {
    const d = descriptorById(state.templateSelected); if (!d) return;
    d.rect.locked = e.target.checked;
    renderTemplateEditor();
    showToast(d.rect.locked ? `${d.label} kilitlendi.` : `${d.label} kilidi açıldı.`);
  });
  $('#tplDeleteElementBtn')?.addEventListener('click', () => {
    removeTemplateDescriptor(state.templateSelected);
  });

  $('#tplBgInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (!state.templateLayout) resetTemplateLayout(camCount());
      ensureTemplateLayoutShape(camCount());
      state.templateLayout.bgImage = reader.result;
      state.templateLayout.bg = { fit: 'cover', x: .5, y: .5, scale: 1, opacity: 1 };
      if (state.templateBgImg) state.templateBgImg.remove();
      state.templateBgImg = new Image();
      state.templateBgImg.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;width:1px;height:1px';
      state.templateBgImg.src = reader.result;
      document.body.appendChild(state.templateBgImg);
      renderTemplateEditor();
      showToast('Arkaplan yüklendi. Resmi önizlemede sürükleyebilirsin.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  $('#tplBgClearBtn')?.addEventListener('click', () => {
    if (state.templateLayout) state.templateLayout.bgImage = null;
    if (state.templateBgImg) { state.templateBgImg.remove(); state.templateBgImg = null; }
    renderTemplateEditor();
  });

  $('#tplBgFit')?.addEventListener('change', (e) => {
    ensureTemplateLayoutShape(camCount()); state.templateLayout.bg.fit = e.target.value; renderTemplateEditor();
  });
  $('#tplBgScale')?.addEventListener('input', (e) => {
    ensureTemplateLayoutShape(camCount()); state.templateLayout.bg.scale = parseInt(e.target.value, 10) / 100;
    $('#tplBgScaleValue').textContent = `${e.target.value}%`; renderTemplateEditor();
  });
  $('#tplBgContainBtn')?.addEventListener('click', () => {
    ensureTemplateLayoutShape(camCount()); Object.assign(state.templateLayout.bg, { fit: 'contain', x: .5, y: .5, scale: 1 }); renderTemplateEditor(); showToast('Arkaplan tam ekrana sığdırıldı.');
  });
  $('#tplBgCoverBtn')?.addEventListener('click', () => {
    ensureTemplateLayoutShape(camCount()); Object.assign(state.templateLayout.bg, { fit: 'cover', x: .5, y: .5, scale: 1 }); renderTemplateEditor(); showToast('Arkaplan ekranı dolduracak şekilde ayarlandı.');
  });
  $('#tplBgCenterBtn')?.addEventListener('click', () => {
    ensureTemplateLayoutShape(camCount()); Object.assign(state.templateLayout.bg, { x: .5, y: .5 }); renderTemplateEditor(); showToast('Arkaplan ortalandı.');
  });

  $('#tplResetLayoutBtn')?.addEventListener('click', () => {
    resetTemplateLayout(camCount());
    renderTemplateEditor();
    showToast('Şablon yerleşimi sıfırlandı.');
  });

  const FONT_SLIDER_MAP = { fsTitle: 'title', fsSubtitle: 'subtitle', fsTicker: 'ticker', fsGuest: 'guest', fsGuestTitle: 'guestTitle', fsSocials: 'socials' };
  Object.entries(FONT_SLIDER_MAP).forEach(([id, key]) => {
    $('#' + id)?.addEventListener('input', (e) => {
      if (!state.templateLayout) resetTemplateLayout(camCount());
      ensureTemplateLayoutShape(camCount());
      const value = parseInt(e.target.value, 10);
      state.templateLayout.fontSizes[key] = value;
      const L = state.templateLayout.layers;
      if (key === 'title') L.title.fontSize = value;
      else if (key === 'subtitle') L.subtitle.fontSize = value;
      else if (key === 'ticker') L.ticker.fontSize = value;
      else if (key === 'socials') L.socials.fontSize = value;
      else if (key === 'guest') L.guestNames.forEach(r => r.fontSize = value);
      else if (key === 'guestTitle') L.guestTitles.forEach(r => r.fontSize = value);
      renderSelectedInspector();
    });
  });

  TPL_FIELD_IDS.forEach(id => $('#' + id)?.addEventListener('input', () => { renderLayerList(); renderSelectedInspector(); refreshLiveTemplateOverlay(); }));
  $('#guestRowsContainer')?.addEventListener('input', () => { renderLayerList(); renderSelectedInspector(); refreshLiveTemplateOverlay(); });

  $('#tplExportBtn')?.addEventListener('click', () => {
    if (!state.templateLayout) resetTemplateLayout(camCount());
    ensureTemplateLayoutShape(camCount());
    const data = { version: 5, camCount: camCount(), templateLayout: state.templateLayout, texts: readTemplateFieldsRaw(), audioMixer: ensureAudioMixerConfig(camCount()) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ebslive-sablon-v5.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('Şablon + ses mikseri ayarları JSON dosyasına aktarıldı.');
  });

  $('#tplImportInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const importingWhileLive = !!state.localStream && state.source === 'dualcam';
        const requestedCamCount = data.camCount ? Math.max(MIN_CAMS, Math.min(MAX_CAMS, data.camCount)) : null;
        const liveCamCountMismatch = importingWhileLive && requestedCamCount && requestedCamCount !== camCount();
        if (requestedCamCount && !importingWhileLive) {
          state.camCount = requestedCamCount;
          renderCamRows();
          renderGuestRows();
          dualcamDevicesLoaded = false;
          populateDualCamDevices(true);
        }
        if (data.texts) Object.entries(data.texts).forEach(([id, v]) => { const el = $('#' + id); if (el) el.value = v; });
        if (data.templateLayout) state.templateLayout = data.templateLayout;
        if (data.audioMixer) state.audioMixerConfig = normalizeAudioMixerConfig(data.audioMixer, camCount());
        else ensureAudioMixerConfig(camCount());
        ensureTemplateLayoutShape(camCount());
        if (state.templateLayout.bgImage && !isSafeTemplateImageSrc(state.templateLayout.bgImage)) state.templateLayout.bgImage = null;
        hydrateTemplateCustomImages();
        applyAudioMixerConfigToEngine();
        if (state.templateBgImg) { state.templateBgImg.remove(); state.templateBgImg = null; }
        if (state.templateLayout.bgImage) {
          state.templateBgImg = new Image();
          state.templateBgImg.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;width:1px;height:1px';
          state.templateBgImg.src = state.templateLayout.bgImage;
          document.body.appendChild(state.templateBgImg);
        }
        state.templateSelected = 'title';
        syncTemplateControls();
        renderTemplateEditor();
        showToast(liveCamCountMismatch
          ? `Şablon içe aktarıldı; canlı yayında kamera sayısı ${camCount()} olarak korundu.`
          : 'Şablon ve ses mikseri içe aktarıldı. Eski JSON formatları da desteklenir.');
      } catch (err) {
        showToast('Şablon dosyası okunamadı, geçerli bir .json seç.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });


  // =========================================================
  // V5 — PROFESYONEL SES MIKSERI / AUTOMIX
  // =========================================================
  const AUDIO_MIX_PRESETS = {
    interview: { label: 'Röportaj', autoMix: true, inactiveGainDb: -18, thresholdDb: -35, attackMs: 55, holdMs: 420, releaseMs: 780, gateThresholdDb: -52, gateDepthDb: -32 },
    panel:     { label: 'Panel', autoMix: true, inactiveGainDb: -14, thresholdDb: -37, attackMs: 50, holdMs: 560, releaseMs: 920, gateThresholdDb: -54, gateDepthDb: -28 },
    congress:  { label: 'Kongre', autoMix: true, inactiveGainDb: -12, thresholdDb: -32, attackMs: 70, holdMs: 900, releaseMs: 1350, gateThresholdDb: -48, gateDepthDb: -24 },
    manual:    { label: 'Manuel', autoMix: false }
  };

  function clampNum(v, min, max, fallback) {
    v = Number(v);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  }

  function dbToGain(db) { return Math.pow(10, Number(db || 0) / 20); }
  function gainToDb(gain) { return gain > 0 ? 20 * Math.log10(gain) : -90; }

  function defaultAudioChannel(i) {
    return { id: i + 1, gainDb: 0, delayMs: 0, muted: false, solo: false };
  }

  function defaultAudioMixerConfig(n = camCount()) {
    return {
      version: 1,
      mode: 'interview',
      enabled: true,
      autoMix: true,
      inactiveGainDb: -18,
      thresholdDb: -35,
      attackMs: 55,
      holdMs: 420,
      releaseMs: 780,
      gateEnabled: true,
      gateThresholdDb: -52,
      gateDepthDb: -32,
      compressorEnabled: true,
      compressorThresholdDb: -18,
      compressorRatio: 3,
      limiterEnabled: true,
      limiterThresholdDb: -2,
      masterGainDb: 0,
      browserProcessing: false,
      channels: Array.from({ length: n }, (_, i) => defaultAudioChannel(i))
    };
  }

  function normalizeAudioMixerConfig(raw, n = camCount()) {
    const base = defaultAudioMixerConfig(n);
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = { ...base, ...src };
    out.mode = AUDIO_MIX_PRESETS[out.mode] ? out.mode : 'interview';
    out.enabled = out.enabled !== false;
    out.autoMix = !!out.autoMix;
    out.inactiveGainDb = clampNum(out.inactiveGainDb, -40, 0, base.inactiveGainDb);
    out.thresholdDb = clampNum(out.thresholdDb, -60, -10, base.thresholdDb);
    out.attackMs = clampNum(out.attackMs, 10, 500, base.attackMs);
    out.holdMs = clampNum(out.holdMs, 0, 3000, base.holdMs);
    out.releaseMs = clampNum(out.releaseMs, 50, 5000, base.releaseMs);
    out.gateEnabled = out.gateEnabled !== false;
    out.gateThresholdDb = clampNum(out.gateThresholdDb, -80, -20, base.gateThresholdDb);
    out.gateDepthDb = clampNum(out.gateDepthDb, -60, 0, base.gateDepthDb);
    out.compressorEnabled = out.compressorEnabled !== false;
    out.compressorThresholdDb = clampNum(out.compressorThresholdDb, -60, 0, base.compressorThresholdDb);
    out.compressorRatio = clampNum(out.compressorRatio, 1, 20, base.compressorRatio);
    out.limiterEnabled = out.limiterEnabled !== false;
    out.limiterThresholdDb = clampNum(out.limiterThresholdDb, -12, 0, base.limiterThresholdDb);
    out.masterGainDb = clampNum(out.masterGainDb, -24, 12, base.masterGainDb);
    out.browserProcessing = !!out.browserProcessing;
    const oldChannels = Array.isArray(src.channels) ? src.channels : [];
    out.channels = Array.from({ length: n }, (_, i) => {
      const c = { ...defaultAudioChannel(i), ...(oldChannels[i] || {}) };
      c.id = i + 1;
      c.gainDb = clampNum(c.gainDb, -24, 12, 0);
      c.delayMs = clampNum(c.delayMs, 0, 500, 0);
      c.muted = !!c.muted;
      c.solo = !!c.solo;
      return c;
    });
    return out;
  }

  function ensureAudioMixerConfig(n = camCount()) {
    state.audioMixerConfig = normalizeAudioMixerConfig(state.audioMixerConfig, n);
    return state.audioMixerConfig;
  }

  function applyAudioMixerPreset(mode) {
    const cfg = ensureAudioMixerConfig();
    const preset = AUDIO_MIX_PRESETS[mode];
    if (!preset) return;
    Object.assign(cfg, preset, { mode });
    applyAudioMixerConfigToEngine();
    renderAudioMixerPanel();
    showToast(`${preset.label} ses profili uygulandı.`);
  }

  function setAudioParamTarget(param, value, seconds = .03) {
    if (!param || !state.audioContext) return;
    const now = state.audioContext.currentTime;
    try {
      param.cancelScheduledValues(now);
      param.setTargetAtTime(value, now, Math.max(.002, seconds));
    } catch (e) { try { param.value = value; } catch (_) {} }
  }

  function applyAudioMixerConfigToEngine() {
    const cfg = ensureAudioMixerConfig();
    const engine = state.audioMixerEngine;
    if (!engine) return;
    const anySolo = cfg.channels.some(c => c.solo);
    engine.channels.forEach((ch, i) => {
      const cc = cfg.channels[i] || defaultAudioChannel(i);
      if (ch.delayNode) setAudioParamTarget(ch.delayNode.delayTime, cc.delayMs / 1000, .02);
      const audible = !cc.muted && (!anySolo || cc.solo);
      if (ch.trimGain) setAudioParamTarget(ch.trimGain.gain, audible ? dbToGain(cc.gainDb) : 0, .015);
      if (ch.compressor) {
        ch.compressor.threshold.value = cfg.compressorEnabled ? cfg.compressorThresholdDb : 0;
        ch.compressor.knee.value = cfg.compressorEnabled ? 12 : 0;
        ch.compressor.ratio.value = cfg.compressorEnabled ? cfg.compressorRatio : 1;
        ch.compressor.attack.value = cfg.compressorEnabled ? .004 : .003;
        ch.compressor.release.value = cfg.compressorEnabled ? .22 : .05;
      }
    });
    if (engine.masterGain) setAudioParamTarget(engine.masterGain.gain, cfg.enabled ? dbToGain(cfg.masterGainDb) : 0, .02);
    if (engine.limiter) {
      engine.limiter.threshold.value = cfg.limiterEnabled ? cfg.limiterThresholdDb : 0;
      engine.limiter.knee.value = 0;
      engine.limiter.ratio.value = cfg.limiterEnabled ? 20 : 1;
      engine.limiter.attack.value = cfg.limiterEnabled ? .002 : .003;
      engine.limiter.release.value = cfg.limiterEnabled ? .08 : .05;
    }
  }

  function setAudioChannelMuted(index, muted) {
    const cfg = ensureAudioMixerConfig();
    if (!cfg.channels[index]) return;
    cfg.channels[index].muted = !!muted;
    applyAudioMixerConfigToEngine();
    updateAudioMixerUI();
  }

  function setAudioChannelSolo(index, solo) {
    const cfg = ensureAudioMixerConfig();
    if (!cfg.channels[index]) return;
    cfg.channels[index].solo = !!solo;
    applyAudioMixerConfigToEngine();
    updateAudioMixerUI();
  }

  function audioSliderRow(label, key, value, min, max, step, suffix = '') {
    return `<label class="audio-control-row"><span>${label}<b data-audio-value="${key}">${value}${suffix}</b></span><input type="range" data-audio-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  }

  function renderAudioMixerPanel() {
    const host = $('#studioAudioMixerHost');
    if (!host) return;
    const cfg = ensureAudioMixerConfig();
    const live = !!state.audioMixerEngine;
    host.innerHTML = `
      <div class="audio-mixer-shell">
        <div class="audio-mixer-status">
          <div><small>PRO AUDIO</small><strong>AutoMix + DSP</strong></div>
          <span class="audio-live-chip ${live ? 'online' : ''}">${live ? 'CANLI' : 'HAZIR'}</span>
        </div>
        <div class="audio-preset-grid">
          ${Object.entries(AUDIO_MIX_PRESETS).map(([id,p]) => `<button type="button" class="audio-preset-btn ${cfg.mode === id ? 'active' : ''}" data-audio-preset="${id}">${p.label}</button>`).join('')}
        </div>
        <div class="audio-master-card">
          <div class="audio-master-head"><span>MASTER</span><b id="audioActiveSpeaker">Aktif: ${state.audioMixerEngine?.activeLabel || '—'}</b></div>
          <div class="audio-meter master"><i id="audioMasterMeter"></i><span id="audioMasterDb">-∞ dB</span></div>
          <label class="audio-toggle-row"><span>AutoMix<small>Konuşana öncelik, diğer mikrofonları duck eder.</small></span><input id="audioAutoMix" type="checkbox" ${cfg.autoMix ? 'checked' : ''}><i></i></label>
          ${audioSliderRow('Pasif mikrofon', 'inactiveGainDb', cfg.inactiveGainDb, -40, 0, 1, ' dB')}
          ${audioSliderRow('Konuşma eşiği', 'thresholdDb', cfg.thresholdDb, -60, -10, 1, ' dB')}
          ${audioSliderRow('Master', 'masterGainDb', cfg.masterGainDb, -24, 12, .5, ' dB')}
        </div>
        <div class="audio-channel-list">
          ${cfg.channels.map((c,i) => `
            <section class="audio-channel-card" data-audio-channel="${i}">
              <div class="audio-channel-head">
                <div><span class="audio-channel-dot" id="audioDot${i}"></span><strong>Kamera ${i+1} Sesi</strong><small id="audioChannelState${i}">${c.muted ? 'MUTE' : c.solo ? 'SOLO' : 'Hazır'}</small></div>
                <div class="audio-channel-actions">
                  <button type="button" data-audio-action="mute" data-channel="${i}" class="${c.muted ? 'active danger' : ''}">M</button>
                  <button type="button" data-audio-action="solo" data-channel="${i}" class="${c.solo ? 'active' : ''}">S</button>
                </div>
              </div>
              <div class="audio-meter"><i id="audioMeter${i}"></i><span id="audioDb${i}">-∞ dB</span></div>
              ${audioSliderRow('Gain', `ch:${i}:gainDb`, c.gainDb, -24, 12, .5, ' dB')}
              ${audioSliderRow('Audio Delay', `ch:${i}:delayMs`, c.delayMs, 0, 500, 1, ' ms')}
              <div class="audio-channel-auto"><span>AutoMix kazancı</span><b id="audioAutoGain${i}">0 dB</b></div>
            </section>`).join('')}
        </div>
        <details class="audio-advanced">
          <summary>Gelişmiş DSP Ayarları</summary>
          <div class="audio-advanced-body">
            <label class="audio-toggle-row"><span>Noise Gate<small>Boşta salon uğultusunu azaltır.</small></span><input id="audioGateEnabled" type="checkbox" ${cfg.gateEnabled ? 'checked' : ''}><i></i></label>
            ${audioSliderRow('Gate eşiği', 'gateThresholdDb', cfg.gateThresholdDb, -80, -20, 1, ' dB')}
            ${audioSliderRow('Gate azaltma', 'gateDepthDb', cfg.gateDepthDb, -60, 0, 1, ' dB')}
            <label class="audio-toggle-row"><span>Compressor<small>Konuşma seviyesini dengeler.</small></span><input id="audioCompressorEnabled" type="checkbox" ${cfg.compressorEnabled ? 'checked' : ''}><i></i></label>
            ${audioSliderRow('Comp threshold', 'compressorThresholdDb', cfg.compressorThresholdDb, -60, 0, 1, ' dB')}
            ${audioSliderRow('Comp ratio', 'compressorRatio', cfg.compressorRatio, 1, 20, .5, ':1')}
            <label class="audio-toggle-row"><span>Peak Limiter<small>Ani piklerde çıkışı korur.</small></span><input id="audioLimiterEnabled" type="checkbox" ${cfg.limiterEnabled ? 'checked' : ''}><i></i></label>
            ${audioSliderRow('Limiter', 'limiterThresholdDb', cfg.limiterThresholdDb, -12, 0, .5, ' dB')}
            ${audioSliderRow('Attack', 'attackMs', cfg.attackMs, 10, 500, 5, ' ms')}
            ${audioSliderRow('Hold', 'holdMs', cfg.holdMs, 0, 3000, 25, ' ms')}
            ${audioSliderRow('Release', 'releaseMs', cfg.releaseMs, 50, 5000, 25, ' ms')}
            <label class="audio-toggle-row"><span>Tarayıcı AEC / NS / AGC<small>Capture card + UHF için genellikle kapalı tut. Değişiklik bir sonraki yayında uygulanır.</small></span><input id="audioBrowserProcessing" type="checkbox" ${cfg.browserProcessing ? 'checked' : ''}><i></i></label>
          </div>
        </details>
        <div class="audio-tip"><b>🎙 Capture Card + UHF önerisi</b><span>İki UHF mikrofon doğrudan kameraya bağlıysa AutoMix açık, pasif seviye -12/-18 dB arası iyi başlangıçtır. Yankı duyarsanız önce iki kanalın Audio Delay değerlerini hizalayın.</span></div>
      </div>`;

    host.querySelectorAll('[data-audio-preset]').forEach(btn => btn.addEventListener('click', () => applyAudioMixerPreset(btn.dataset.audioPreset)));
    host.querySelectorAll('[data-audio-action]').forEach(btn => btn.addEventListener('click', () => {
      const i = Number(btn.dataset.channel);
      if (btn.dataset.audioAction === 'mute') setAudioChannelMuted(i, !cfg.channels[i].muted);
      else setAudioChannelSolo(i, !cfg.channels[i].solo);
      renderAudioMixerPanel();
      renderDualcamStudioControls();
    }));
    host.querySelectorAll('input[data-audio-key]').forEach(input => input.addEventListener('input', () => {
      const key = input.dataset.audioKey;
      const value = Number(input.value);
      if (key.startsWith('ch:')) {
        const [, idx, prop] = key.split(':');
        cfg.channels[Number(idx)][prop] = value;
      } else cfg[key] = value;
      const suffix = key.endsWith('Ms') || key.includes('delayMs') ? ' ms' : key === 'compressorRatio' ? ':1' : ' dB';
      const valueEl = host.querySelector(`[data-audio-value="${CSS.escape(key)}"]`);
      if (valueEl) valueEl.textContent = `${value}${suffix}`;
      applyAudioMixerConfigToEngine();
    }));
    const toggleMap = {
      audioAutoMix: 'autoMix', audioGateEnabled: 'gateEnabled', audioCompressorEnabled: 'compressorEnabled',
      audioLimiterEnabled: 'limiterEnabled', audioBrowserProcessing: 'browserProcessing'
    };
    Object.entries(toggleMap).forEach(([id,key]) => host.querySelector('#'+id)?.addEventListener('change', e => {
      cfg[key] = e.target.checked;
      if (key === 'autoMix') cfg.mode = cfg.autoMix ? (cfg.mode === 'manual' ? 'interview' : cfg.mode) : 'manual';
      applyAudioMixerConfigToEngine();
      if (key === 'autoMix') renderAudioMixerPanel();
    }));
    updateAudioMixerUI();
  }

  function updateAudioMixerUI() {
    const engine = state.audioMixerEngine;
    const cfg = ensureAudioMixerConfig();
    const host = $('#studioAudioMixerHost');
    if (!host || host.classList.contains('hidden')) return;
    const anySolo = cfg.channels.some(c => c.solo);
    cfg.channels.forEach((c, i) => {
      const ch = engine?.channels?.[i];
      const db = ch?.meterDb ?? -90;
      const pct = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
      const meter = host.querySelector('#audioMeter'+i);
      if (meter) meter.style.width = pct + '%';
      const dbEl = host.querySelector('#audioDb'+i);
      if (dbEl) dbEl.textContent = db <= -80 ? '-∞ dB' : `${db.toFixed(1)} dB`;
      const autoDb = gainToDb(ch?.autoTarget ?? 1);
      const ag = host.querySelector('#audioAutoGain'+i);
      if (ag) ag.textContent = `${Math.max(-60, autoDb).toFixed(1)} dB`;
      const dot = host.querySelector('#audioDot'+i);
      if (dot) dot.classList.toggle('active', !!ch?.active);
      const stateEl = host.querySelector('#audioChannelState'+i);
      if (stateEl) stateEl.textContent = c.muted ? 'MUTE' : (anySolo && !c.solo) ? 'SOLO DIŞI' : c.solo ? 'SOLO' : ch?.active ? 'AKTİF' : 'Beklemede';
    });
    const masterDb = engine?.masterMeterDb ?? -90;
    const masterPct = Math.max(0, Math.min(100, (masterDb + 60) / 60 * 100));
    const mm = host.querySelector('#audioMasterMeter'); if (mm) mm.style.width = masterPct + '%';
    const md = host.querySelector('#audioMasterDb'); if (md) md.textContent = masterDb <= -80 ? '-∞ dB' : `${masterDb.toFixed(1)} dB`;
    const active = host.querySelector('#audioActiveSpeaker'); if (active) active.textContent = `Aktif: ${engine?.activeLabel || '—'}`;
  }

  async function buildDualCameraTemplateStream() {
    const n = camCount();
    if (!state.templateLayout || state.templateLayout.layers.cams.length < n) resetTemplateLayout(n);
    ensureTemplateLayoutShape(n);
    const mixerCfg = ensureAudioMixerConfig(n);

    const ids = [], audioIds = [];
    for (let i = 0; i < n; i++) {
      const id = $(`#dualCam${i + 1}`)?.value;
      if (!id) throw new Error(`Kamera ${i + 1} seçilmedi.`);
      ids.push(id);
      audioIds.push($(`#dualCam${i + 1}Audio`)?.value || '');
    }
    if (new Set(ids).size !== ids.length) throw new Error('Kameraların hepsi birbirinden farklı olmalı.');

    const constraintsFor = (deviceId, audioDeviceId) => ({
      video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: audioDeviceId ? {
        deviceId: { exact: audioDeviceId },
        echoCancellation: !!mixerCfg.browserProcessing,
        noiseSuppression: !!mixerCfg.browserProcessing,
        autoGainControl: !!mixerCfg.browserProcessing,
        channelCount: { ideal: 1 }
      } : false
    });

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = AudioCtx ? new AudioCtx({ latencyHint: 'interactive' }) : null;
    state.audioContext = audioCtx;
    if (audioCtx?.state === 'suspended') await audioCtx.resume().catch(() => {});
    const dest = audioCtx ? audioCtx.createMediaStreamDestination() : null;

    const masterGain = audioCtx ? audioCtx.createGain() : null;
    const limiter = audioCtx ? audioCtx.createDynamicsCompressor() : null;
    const masterAnalyser = audioCtx ? audioCtx.createAnalyser() : null;
    if (masterAnalyser) { masterAnalyser.fftSize = 512; masterAnalyser.smoothingTimeConstant = .25; }
    if (masterGain && limiter && masterAnalyser && dest) {
      masterGain.connect(limiter);
      limiter.connect(masterAnalyser);
      masterAnalyser.connect(dest);
    }

    const disconnected = {};
    const retryTimers = {};
    state.dualcamRetryTimers = retryTimers;
    state.dualcamDisconnected = disconnected;

    const engine = {
      audioCtx, dest, masterGain, limiter, masterAnalyser,
      channels: [], meterTimer: null, activeLabel: '—', masterMeterDb: -90,
      stop() {
        if (this.meterTimer) clearInterval(this.meterTimer);
        this.meterTimer = null;
        this.channels.forEach(ch => {
          try { ch.audioSourceNode?.disconnect(); } catch (e) {}
          [ch.delayNode,ch.analyser,ch.compressor,ch.trimGain,ch.gateGain,ch.autoGain].forEach(node => { try { node?.disconnect(); } catch(e){} });
        });
        try { masterGain?.disconnect(); limiter?.disconnect(); masterAnalyser?.disconnect(); } catch (e) {}
      }
    };
    state.audioMixerEngine = engine;

    function makeSlot(slotNum, deviceId, audioDeviceId, label) {
      const channelIndex = slotNum - 1;
      const videoEl = document.createElement('video');
      videoEl.muted = true;
      let audioSourceNode = null, currentStream = null;
      let frozen = false;
      const snapCanvas = document.createElement('canvas');
      const snapCtx = snapCanvas.getContext('2d');

      const delayNode = audioCtx ? audioCtx.createDelay(.5) : null;
      const analyser = audioCtx ? audioCtx.createAnalyser() : null;
      const compressor = audioCtx ? audioCtx.createDynamicsCompressor() : null;
      const trimGain = audioCtx ? audioCtx.createGain() : null;
      const gateGain = audioCtx ? audioCtx.createGain() : null;
      const autoGain = audioCtx ? audioCtx.createGain() : null;
      if (analyser) { analyser.fftSize = 512; analyser.smoothingTimeConstant = .15; }
      if (delayNode && analyser && compressor && trimGain && gateGain && autoGain && masterGain) {
        delayNode.connect(analyser);
        analyser.connect(compressor);
        compressor.connect(trimGain);
        trimGain.connect(gateGain);
        gateGain.connect(autoGain);
        autoGain.connect(masterGain);
      }
      const ch = {
        index: channelIndex, delayNode, analyser, compressor, trimGain, gateGain, autoGain,
        audioSourceNode: null, meterData: analyser ? new Float32Array(analyser.fftSize) : null,
        meterDb: -90, autoTarget: 1, gateTarget: 1, active: false,
        lastSpeechAt: 0, heldLevelDb: -90, lastGateAt: 0
      };
      engine.channels.push(ch);

      function connectAudio(stream) {
        if (!audioCtx || !dest || !delayNode) return;
        if (audioSourceNode) { try { audioSourceNode.disconnect(); } catch (e) {} audioSourceNode = null; ch.audioSourceNode = null; }
        const track = stream.getAudioTracks()[0];
        if (track) {
          audioSourceNode = audioCtx.createMediaStreamSource(new MediaStream([track]));
          ch.audioSourceNode = audioSourceNode;
          audioSourceNode.connect(delayNode);
        }
      }

      function attachStream(stream) {
        currentStream = stream;
        state.rawStreams.push(stream);
        videoEl.srcObject = stream;
        videoEl.play().catch(() => {});
        connectAudio(stream);
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack) vTrack.addEventListener('ended', () => handleDisconnect());
      }

      async function acquire(retry = true) {
        try {
          const acquired = await navigator.mediaDevices.getUserMedia(constraintsFor(deviceId, audioDeviceId));
          attachStream(acquired);
          return acquired;
        } catch (err) {
          // Ucuz USB capture card'larda birden fazla cihaz aynı anda açılmaya
          // çalışıldığında "NotReadableError / Could not start video source" geçici
          // bir donanım çakışması olarak sık görülür. Kısa bir bekleme sonrası
          // tek seferlik otomatik yeniden deneme çoğu zaman sorunu kendiliğinden çözer.
          if (retry && (err.name === 'NotReadableError' || err.name === 'TrackStartError')) {
            await new Promise((r) => setTimeout(r, 700));
            return acquire(false);
          }
          throw err;
        }
      }

      function handleDisconnect() {
        if (disconnected[slotNum]) return;
        disconnected[slotNum] = true;
        showToast(`${label} bağlantısı kesildi — yeniden bağlanmayı deniyorum…`);
        if (currentStream) {
          currentStream.getTracks().forEach(t => t.stop());
          state.rawStreams = state.rawStreams.filter(st => st !== currentStream);
          currentStream = null;
        }
        retryTimers[slotNum] = setInterval(async () => {
          try {
            await acquire();
            disconnected[slotNum] = false;
            clearInterval(retryTimers[slotNum]);
            retryTimers[slotNum] = null;
            showToast(`${label} yeniden bağlandı`);
          } catch (e) { /* cihaz henüz yok */ }
        }, 2500);
      }

      function toggleFreeze() {
        frozen = !frozen;
        if (frozen && videoEl.videoWidth) {
          snapCanvas.width = videoEl.videoWidth;
          snapCanvas.height = videoEl.videoHeight;
          snapCtx.drawImage(videoEl, 0, 0);
        }
        return frozen;
      }
      function toggleMute() {
        const cfg = ensureAudioMixerConfig(n);
        const next = !cfg.channels[channelIndex].muted;
        setAudioChannelMuted(channelIndex, next);
        return next;
      }
      function getFrame() { return frozen ? snapCanvas : videoEl; }
      return { acquire, toggleFreeze, toggleMute, getFrame, label, isFrozen: () => frozen, isMuted: () => !!ensureAudioMixerConfig(n).channels[channelIndex].muted };
    }

    const slots = [];
    for (let i = 0; i < n; i++) {
      disconnected[i + 1] = false;
      slots.push(makeSlot(i + 1, ids[i], audioIds[i], `Kamera ${i + 1}`));
    }
    await Promise.all(slots.map(slot => slot.acquire()));
    state.dualcamSlots = slots;
    applyAudioMixerConfigToEngine();

    const meterRmsDb = (analyser, data) => {
      if (!analyser || !data) return -90;
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / Math.max(1, data.length));
      return Math.max(-90, Math.min(6, rms > 0 ? 20 * Math.log10(rms) : -90));
    };
    const masterData = masterAnalyser ? new Float32Array(masterAnalyser.fftSize) : null;

    function processAudioMixer() {
      const cfg = ensureAudioMixerConfig(n);
      const nowMs = performance.now();
      const anySolo = cfg.channels.some(c => c.solo);

      engine.channels.forEach((ch, i) => {
        const rawDb = meterRmsDb(ch.analyser, ch.meterData);
        ch.meterDb = ch.meterDb <= -85 ? rawDb : ch.meterDb * .68 + rawDb * .32;
        const cc = cfg.channels[i];
        const audible = !cc.muted && (!anySolo || cc.solo);
        if (audible && ch.meterDb >= cfg.gateThresholdDb) ch.lastGateAt = nowMs;
        const gateOpen = !cfg.gateEnabled || (audible && (ch.meterDb >= cfg.gateThresholdDb || nowMs - ch.lastGateAt < 180));
        const desiredGate = gateOpen ? 1 : dbToGain(cfg.gateDepthDb);
        if (Math.abs(desiredGate - ch.gateTarget) > .001) {
          ch.gateTarget = desiredGate;
          setAudioParamTarget(ch.gateGain?.gain, desiredGate, desiredGate > (ch.gateGain?.gain.value || 0) ? .012 : .09);
        }
        if (audible && ch.meterDb >= cfg.thresholdDb) {
          ch.lastSpeechAt = nowMs;
          ch.heldLevelDb = ch.meterDb;
        }
      });

      let scores = engine.channels.map((ch, i) => {
        const cc = cfg.channels[i];
        const audible = !cc.muted && (!anySolo || cc.solo);
        if (!audible || !cfg.autoMix) return 0;
        const speakingNow = ch.meterDb >= cfg.thresholdDb;
        const held = ch.lastSpeechAt > 0 && nowMs - ch.lastSpeechAt <= cfg.holdMs;
        if (!speakingNow && !held) return 0;
        const levelDb = speakingNow ? ch.meterDb : ch.heldLevelDb;
        // 1.5 kuvvet, yakın mikrofonu çapraz sesten daha belirgin şekilde öne çıkarır.
        return Math.pow(dbToGain(levelDb), 3);
      });
      const scoreSum = scores.reduce((a,b) => a+b, 0);
      const inactive = dbToGain(cfg.inactiveGainDb);
      const activeIndexes = [];

      engine.channels.forEach((ch, i) => {
        let desired = 1;
        if (cfg.autoMix) desired = scoreSum > 0 ? Math.max(inactive, Math.sqrt(scores[i] / scoreSum)) : inactive;
        const cc = cfg.channels[i];
        if (cc.muted || (anySolo && !cc.solo)) desired = 0;
        const rising = desired > ch.autoTarget;
        ch.autoTarget = desired;
        setAudioParamTarget(ch.autoGain?.gain, desired, Math.max(.005, (rising ? cfg.attackMs : cfg.releaseMs) / 3000));
        ch.active = !!(desired >= dbToGain(-6) && ch.meterDb >= cfg.thresholdDb - 4 && !cc.muted && (!anySolo || cc.solo));
        if (ch.active) activeIndexes.push(i);
      });

      if (activeIndexes.length) engine.activeLabel = activeIndexes.map(i => `Kamera ${i + 1}`).join(' + ');
      else {
        let top = -1, topDb = -90;
        engine.channels.forEach((ch,i) => { if (ch.meterDb > topDb && !cfg.channels[i].muted) { topDb = ch.meterDb; top = i; } });
        engine.activeLabel = top >= 0 && topDb >= cfg.thresholdDb ? `Kamera ${top + 1}` : '—';
      }
      const rawMasterDb = meterRmsDb(masterAnalyser, masterData);
      engine.masterMeterDb = engine.masterMeterDb <= -85 ? rawMasterDb : engine.masterMeterDb * .7 + rawMasterDb * .3;
      updateAudioMixerUI();
    }
    engine.meterTimer = setInterval(processAudioMixer, 40);
    processAudioMixer();

    const canvas = document.createElement('canvas');
    canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    let running = true;
    let tickerX = canvas.width;
    let lastRenderTs = 0;
    let lastTickerTs = 0;

    const drawGuestVideo = (frameSrc, x, y, w, h, isDisconnected, isFrozen, isMuted) => {
      ctx.save();
      roundRect(ctx, x, y, w, h, 6);
      ctx.clip();
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(x, y, w, h);
      const srcW = frameSrc.videoWidth || frameSrc.width || 0;
      const srcH = frameSrc.videoHeight || frameSrc.height || 0;
      if (!isDisconnected && srcW) {
        const scale = Math.max(w / srcW, h / srcH);
        const dw = srcW * scale, dh = srcH * scale;
        ctx.drawImage(frameSrc, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      }
      if (isDisconnected) {
        ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ff7186'; ctx.textAlign = 'center'; ctx.font = '700 28px Inter, sans-serif';
        ctx.fillText('⚠ Bağlantı kesildi', x + w / 2, y + h / 2 - 10);
        ctx.fillStyle = '#c9c9c9'; ctx.font = '400 18px Inter, sans-serif';
        ctx.fillText('Yeniden bağlanmayı deniyor…', x + w / 2, y + h / 2 + 22); ctx.textAlign = 'left';
      }
      ctx.restore();
      ctx.strokeStyle = isDisconnected ? 'rgba(255,73,100,.8)' : 'rgba(255,255,255,.85)';
      ctx.lineWidth = 3; roundRect(ctx, x, y, w, h, 6); ctx.stroke();
      ctx.textAlign = 'right'; ctx.font = '24px sans-serif';
      let badgeX = x + w - 14;
      if (isFrozen) { ctx.fillStyle = '#63dcff'; ctx.fillText('🧊', badgeX, y + 34); badgeX -= 34; }
      if (isMuted) { ctx.fillStyle = '#ff7186'; ctx.fillText('🔇', badgeX, y + 34); }
      ctx.textAlign = 'left';
    };

    const drawLayerText = (rect, text, opts = {}) => {
      if (!rect || rect.visible === false || !text) return;
      const x = rect.x * canvas.width, y = rect.y * canvas.height, w = rect.w * canvas.width, h = rect.h * canvas.height;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      if (opts.background) { ctx.fillStyle = opts.background; ctx.fillRect(x, y, w, h); }
      if (opts.accent) { ctx.fillStyle = opts.accent; ctx.fillRect(x, y, Math.min(8, w * .04), h); }
      const fs = Math.max(8, Number(rect.fontSize || opts.fontSize || 24));
      ctx.fillStyle = opts.color || rect.color || '#fff';
      ctx.font = `${opts.weight || rect.weight || 700} ${fs}px Inter, sans-serif`;
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = 'middle';
      const pad = Math.min(26, Math.max(8, w * .025));
      const tx = ctx.textAlign === 'center' ? x + w / 2 : x + pad;
      ctx.fillText(String(text), tx, y + h / 2, Math.max(1, w - pad * 2));
      ctx.restore();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    };

    const draw = (ts = performance.now()) => {
      if (!running) return;
      requestAnimationFrame(draw);
      if (ts - lastRenderTs < 1000 / 30) return;
      const dt = lastTickerTs ? Math.min(.1, (ts - lastTickerTs) / 1000) : 1 / 30;
      lastTickerTs = ts;
      lastRenderTs = ts;
      ensureTemplateLayoutShape(n);
      hydrateTemplateCustomImages();
      const tpl = readTemplateData();
      const W = canvas.width, H = canvas.height;
      const bgImg = state.templateBgImg;
      ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
      if (bgImg && bgImg.complete && bgImg.naturalWidth) {
        const m = backgroundDrawMetrics(bgImg.naturalWidth, bgImg.naturalHeight, W, H, state.templateLayout.bg);
        ctx.save();
        ctx.globalAlpha = state.templateLayout.bg.opacity ?? 1;
        ctx.drawImage(bgImg, m.x, m.y, m.w, m.h);
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 0, W, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#1a0206'); grad.addColorStop(1, '#000');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      }

      const L = state.templateLayout.layers;
      drawLayerText(L.liveBadge, L.liveBadge.text, { background: '#df1735', weight: 800, color: '#fff' });
      drawLayerText(L.programName, L.programName.text, { weight: 800, color: '#df1735', align: 'center' });
      drawLayerText(L.programTagline, L.programTagline.text, { weight: 600, color: '#fff', align: 'center' });
      slots.forEach((slot, i) => {
        const rect = L.cams[i]; if (!rect || rect.visible === false) return;
        drawGuestVideo(slot.getFrame(), rect.x * W, rect.y * H, rect.w * W, rect.h * H, disconnected[i + 1], slot.isFrozen(), slot.isMuted());
      });

      L.guestNames.forEach((rect, i) => drawLayerText(rect, tpl[`guest${i + 1}Name`] || `Konuk ${i + 1}`, { background: 'rgba(10,10,10,.82)', accent: disconnected[i + 1] ? '#7a1a26' : '#df1735', weight: 700 }));
      L.guestTitles.forEach((rect, i) => drawLayerText(rect, tpl[`guest${i + 1}Title`] || 'Ünvan / Görev', { background: 'rgba(10,10,10,.78)', color: '#d2d2d2', weight: 400 }));

      const tR = L.ticker;
      if (tR.visible !== false) {
        const tx = tR.x * W, ty = tR.y * H, tw = tR.w * W, th = tR.h * H;
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(tx, ty, tw, th);
        const badgeW = Math.min(200, tw * .28);
        ctx.fillStyle = '#df1735'; ctx.fillRect(tx, ty, badgeW, th);
        ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(12, Math.min(22, tR.fontSize || 22))}px Inter, sans-serif`;
        ctx.textBaseline = 'middle'; ctx.fillText('SON DURUM', tx + 24, ty + th / 2);
        ctx.save(); ctx.beginPath(); ctx.rect(tx + badgeW + 10, ty, Math.max(0, tw - badgeW - 10), th); ctx.clip();
        ctx.fillStyle = '#111'; ctx.font = `700 ${tR.fontSize || 22}px Inter, sans-serif`;
        ctx.fillText(tpl.ticker, tickerX, ty + th / 2);
        const tickerWidth = ctx.measureText(tpl.ticker).width;
        ctx.restore();
        tickerX -= 132 * dt;
        if (tickerX < tx - tickerWidth) tickerX = tx + tw;
        ctx.textBaseline = 'alphabetic';
      }

      const visibleLower = [L.title, L.subtitle].filter(r => r && r.visible !== false);
      if (visibleLower.length) {
        const top = Math.max(0, Math.min(...visibleLower.map(r => r.y * H)) - 10);
        const bottom = Math.min(H, Math.max(...visibleLower.map(r => (r.y + r.h) * H)) + 4);
        ctx.fillStyle = 'rgba(0,0,0,.92)'; ctx.fillRect(0, top, W, bottom - top);
        ctx.fillStyle = '#df1735'; ctx.fillRect(0, top, W, 4);
      }
      drawLayerText(L.title, tpl.title, { weight: 800, color: '#fff' });
      drawLayerText(L.subtitle, tpl.subtitle, { weight: 400, color: '#d9d9d9' });

      const soR = L.socials;
      if (soR.visible !== false) {
        const sox = soR.x * W, soy = soR.y * H, sow = soR.w * W, soh = soR.h * H;
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(sox, soy, sow, soh);
        ctx.font = `600 ${soR.fontSize || 20}px Inter, sans-serif`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
        const socials = [`▶ ${tpl.youtube}`, `𝕏 ${tpl.twitter}`, `f ${tpl.facebook}`, `◎ ${tpl.instagram}`];
        const seg = sow / socials.length;
        socials.forEach((text, i) => ctx.fillText(text, sox + seg * i + 28, soy + soh / 2, Math.max(20, seg - 42)));
        ctx.textBaseline = 'alphabetic';
      }

      L.custom.forEach(rect => {
        if (rect.type === 'image') drawCustomTemplateLayer(ctx, rect, W, H);
        else drawLayerText(rect, rect.text || 'Metin', { background: 'rgba(0,0,0,.42)', weight: rect.weight || 700, color: rect.color || '#fff' });
      });
    };
    requestAnimationFrame(draw);
    state.compositorStop = () => {
      running = false;
      Object.values(retryTimers).forEach(t => t && clearInterval(t));
    };

    const out = canvas.captureStream(30);
    const outVTrack = out.getVideoTracks()[0];
    if (outVTrack) outVTrack.contentHint = 'motion';
    if (dest) dest.stream.getAudioTracks().forEach(t => out.addTrack(t));
    return out;
  }

  function renderLiveTemplateOverlay() {
    const overlay = $('#liveTplOverlay');
    if (!overlay || !state.templateLayout || !state.liveEditActive) return;
    ensureTemplateLayoutShape(camCount());
    overlay.innerHTML = '';

    const descriptors = layerDescriptors();
    descriptors.forEach((desc, index) => {
      if (desc.rect.visible === false) return;
      const el = document.createElement('div');
      el.dataset.layerId = desc.id;
      el.dataset.layerType = desc.type;
      el.dataset.defaultLayer = desc.isDefault ? '1' : '0';
      el.tabIndex = 0;
      el.className = 'tpl-el live-editable-layer' +
        (desc.type === 'camera' ? ' camera-el' : ' text-el') +
        (desc.type === 'custom' ? ' custom-text-el' : ' system-default-el') +
        (state.templateSelected === desc.id ? ' selected' : '') +
        (desc.rect.locked ? ' locked-layer' : '');
      el.dataset.baseZ = String(20 + index);
      el.style.zIndex = el.dataset.baseZ;
      el.title = desc.rect.locked
        ? `${desc.label} — KİLİTLİ`
        : `${desc.label} — sürükle, sağ alttan boyutlandır`;

      const label = document.createElement('span');
      label.className = 'tpl-live-label';
      label.textContent = layerPreviewLabel(desc);
      el.appendChild(label);

      const lockBtn = document.createElement('button');
      lockBtn.type = 'button';
      lockBtn.className = 'tpl-live-lock';
      lockBtn.title = desc.rect.locked ? `${desc.label} kilidini aç` : `${desc.label} konumunu kilitle`;
      lockBtn.setAttribute('aria-label', lockBtn.title);
      lockBtn.textContent = desc.rect.locked ? '🔒' : '🔓';
      lockBtn.addEventListener('pointerdown', e => { e.stopPropagation(); });
      lockBtn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        const liveRect = rectByLayerId(desc.id);
        if (!liveRect) return;
        liveRect.locked = !liveRect.locked;
        state.templateSelected = desc.id;
        renderTemplateEditor();
        showToast(liveRect.locked ? `${desc.label} kilitlendi.` : `${desc.label} kilidi açıldı.`);
      });
      el.appendChild(lockBtn);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tpl-live-remove';
      removeBtn.title = `${desc.label} kaldır`;
      removeBtn.setAttribute('aria-label', `${desc.label} kaldır`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('pointerdown', e => { e.stopPropagation(); });
      removeBtn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        removeTemplateDescriptor(desc.id);
      });
      el.appendChild(removeBtn);

      overlay.appendChild(el);
      makeDraggable(el, desc.id, overlay, () => {
        state.templateSelected = desc.id;
        renderLayerList();
        renderSelectedInspector();
        overlay.querySelectorAll('.tpl-el').forEach(node => {
          const selected = node.dataset.layerId === desc.id;
          node.classList.toggle('selected', selected);
          // Seçim yalnızca görsel vurgu yapar; z-index değiştirmez.
          // Böylece büyük kamera kutusu içindeki/altındaki metin katmanlarını engellemez.
          node.style.zIndex = node.dataset.baseZ || '20';
        });
      }, (liveRect) => {
        // Live sahne ile sol editör önizlemesini aynı koordinatta tut.
        const r = liveRect || rectByLayerId(desc.id);
        const previewNode = $('#tplPreview')?.querySelector(`[data-layer-id="${CSS.escape(desc.id)}"]`);
        if (previewNode && r) {
          previewNode.style.left = (r.x * 100) + '%';
          previewNode.style.top = (r.y * 100) + '%';
          previewNode.style.width = (r.w * 100) + '%';
          previewNode.style.height = (r.h * 100) + '%';
        }
      });
    });
    refreshStudioLockAllButton();
  }

  function toggleLiveEdit() {
    if (state.source !== 'dualcam') return;
    state.liveEditActive = !state.liveEditActive;
    const overlay = $('#liveTplOverlay');
    const btn = $('#liveEditBtn');
    overlay?.classList.toggle('hidden', !state.liveEditActive);
    btn?.classList.toggle('off', !state.liveEditActive);
    if (state.liveEditActive) {
      mountTemplateEditorInStudio(true);
      showStudioLiveTools();
      renderTemplateEditor();
      renderLiveTemplateOverlay();
      if (btn) btn.innerHTML = '✕<span>Editörü Kapat</span>';
      showToast('Canlı editör açık — araçlar sol tarafa sabitlendi.');
    } else {
      hideStudioTemplateEditor();
      if (btn) btn.innerHTML = '🎨<span>Canlı Editör</span>';
      showToast('Canlı editör kapatıldı.');
    }
  }
  $('#liveEditBtn')?.addEventListener('click', toggleLiveEdit);

  function allTemplateLayersLocked() {
    const visible = layerDescriptors().filter(d => d.rect.visible !== false);
    return visible.length > 0 && visible.every(d => !!d.rect.locked);
  }

  function refreshStudioLockAllButton() {
    const btn = $('#studioLiveLockAllBtn');
    if (!btn || !state.templateLayout) return;
    const locked = allTemplateLayersLocked();
    btn.classList.toggle('active', locked);
    btn.dataset.label = locked ? 'Tüm Kilitleri Aç' : 'Tümünü Kilitle';
    btn.setAttribute('aria-label', btn.dataset.label);
  }

  $('#studioLiveLockAllBtn')?.addEventListener('click', () => {
    if (!state.templateLayout) return;
    const shouldLock = !allTemplateLayersLocked();
    layerDescriptors().forEach(d => { if (d.rect.visible !== false) d.rect.locked = shouldLock; });
    renderTemplateEditor();
    refreshStudioLockAllButton();
    showToast(shouldLock ? 'Tüm görünür elementler kilitlendi.' : 'Tüm element kilitleri açıldı.');
  });

  $$('.studio-live-tool[data-live-tool]').forEach(btn => btn.addEventListener('click', () => {
    const tool = btn.dataset.liveTool;
    const sameOpen = studioLiveTools?.dataset.activeTool === tool && !studioLiveDrawer?.classList.contains('collapsed');
    if (sameOpen) collapseStudioLiveDrawer();
    else setStudioLiveTool(tool, true);
  }));
  $('#studioLiveDrawerClose')?.addEventListener('click', collapseStudioLiveDrawer);
  $('#studioLiveBackdrop')?.addEventListener('click', collapseStudioLiveDrawer);
  $('#studioLiveCloseBtn')?.addEventListener('click', () => { if (state.liveEditActive) toggleLiveEdit(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.liveEditActive && !studioLiveDrawer?.classList.contains('collapsed')) collapseStudioLiveDrawer();
  });

  function renderDualcamStudioControls() {
    const container = $('#dualcamStudioControls');
    if (!container || !state.dualcamSlots) return;
    container.innerHTML = '';
    container.classList.remove('hidden');
    state.dualcamSlots.forEach((slot, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'dualcam-slot-controls';

      const freezeBtn = document.createElement('button');
      freezeBtn.type = 'button';
      freezeBtn.className = 'round-control';
      freezeBtn.innerHTML = `🧊<span>Kamera ${i + 1} Dondur</span>`;
      freezeBtn.addEventListener('click', () => {
        const frozen = slot.toggleFreeze();
        freezeBtn.classList.toggle('off', frozen);
        freezeBtn.innerHTML = frozen ? `▶<span>Kamera ${i + 1} Devam</span>` : `🧊<span>Kamera ${i + 1} Dondur</span>`;
        showToast(frozen ? `Kamera ${i + 1} donduruldu` : `Kamera ${i + 1} devam ediyor`);
      });

      const muteBtn = document.createElement('button');
      muteBtn.type = 'button';
      muteBtn.className = 'round-control';
      const initialMuted = slot.isMuted();
      muteBtn.classList.toggle('off', initialMuted);
      muteBtn.innerHTML = initialMuted ? `🔇<span>Kamera ${i + 1} Sesi Aç</span>` : `🎙<span>Kamera ${i + 1} Sesi Kapat</span>`;
      muteBtn.addEventListener('click', () => {
        const muted = slot.toggleMute();
        muteBtn.classList.toggle('off', muted);
        muteBtn.innerHTML = muted ? `🔇<span>Kamera ${i + 1} Sesi Aç</span>` : `🎙<span>Kamera ${i + 1} Sesi Kapat</span>`;
        showToast(muted ? `Kamera ${i + 1} sesi kapatıldı` : `Kamera ${i + 1} sesi açıldı`);
      });

      wrap.appendChild(freezeBtn);
      wrap.appendChild(muteBtn);
      container.appendChild(wrap);
    });
  }

  // getUserMedia/getDisplayMedia hatalarını anlaşılır Türkçe mesajlara çevirir.
  function mapMediaError(err) {
    const name = err?.name || '';
    switch (name) {
      case 'NotAllowedError':
        return 'Kamera/mikrofon/ekran izni verilmedi ya da tarayıcı ayarlarından engellenmiş.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Kamera veya capture card başka bir uygulama tarafından kullanılıyor (OBS, Zoom, Teams, Kamera uygulaması, başka bir sekme vb.). Diğer uygulamayı kapatıp "↻ Cihazları Yenile" ile tekrar dene.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'Seçilen kamera/mikrofon artık bulunamıyor — kablosu çıkmış veya cihaz değişmiş olabilir. Cihazları yenileyip tekrar seç.';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return `Seçilen kamera istenen çözünürlüğü desteklemiyor (${err.constraint || ''}). Farklı bir kamera dene.`;
      case 'AbortError':
        return 'Kamera başlatma işlemi yarıda kesildi, tekrar dene.';
      case 'SecurityError':
        return 'Güvenlik kısıtlaması nedeniyle kameraya erişilemedi (https/localhost üzerinden çalıştığından emin ol).';
      default:
        return err?.message || name || 'Bilinmeyen hata';
    }
  }

  async function startBroadcast() {
    if (!navigator.mediaDevices || !window.Peer) {
      showToast('Tarayıcınız gerekli WebRTC özelliklerini desteklemiyor.');
      return;
    }
    const btn = $('#startBtn');
    btn.disabled = true;
    btn.querySelector('span:nth-of-type(2)').textContent = 'İzin bekleniyor…';

    try {
      if (state.source === 'dualcam') hydrateTemplateCustomImages();
      state.localStream = state.source === 'screen' ? await buildScreenStream()
        : state.source === 'dualcam' ? await buildDualCameraTemplateStream()
        : await buildCameraStream();
      const videoTrack = state.localStream.getVideoTracks()[0];
      if (videoTrack) videoTrack.addEventListener('ended', stopBroadcast);

      localVideo.srcObject = state.localStream;
      $('#stageEmpty').classList.add('hidden');
      $('#sourceBadge').textContent = state.source === 'screen' ? 'EKRAN' : state.source === 'dualcam' ? 'ŞABLON' : 'KAMERA';
      studioView.classList.toggle('dualcam-studio', state.source === 'dualcam');
      $('#switchScreenBtn').classList.toggle('hidden', state.source !== 'screen');
      $('#toggleMicBtn').classList.toggle('hidden', state.source === 'dualcam');
      if (state.source === 'dualcam') renderDualcamStudioControls();
      else { $('#dualcamStudioControls').innerHTML = ''; $('#dualcamStudioControls').classList.add('hidden'); }
      const isDualcamStudio = state.source === 'dualcam';
      $('#liveEditBtn').classList.toggle('hidden', !isDualcamStudio);

      homeView.classList.add('hidden');
      features.classList.add('hidden');
      studioView.classList.remove('hidden');

      // 2 Kamera + Şablon modunda canlı editör artık otomatik aktif başlar.
      // Sol ikon rayı doğrudan görünür; drawer başlangıçta kapalıdır.
      state.liveEditActive = isDualcamStudio;
      if (isDualcamStudio) {
        $('#liveTplOverlay')?.classList.remove('hidden');
        mountTemplateEditorInStudio(true);
        showStudioLiveTools(false);
        renderTemplateEditor();
        renderLiveTemplateOverlay();
        $('#liveEditBtn')?.classList.remove('off');
        if ($('#liveEditBtn')) $('#liveEditBtn').innerHTML = '✕<span>Editörü Kapat</span>';
      } else {
        hideStudioLiveTools();
        $('#liveTplOverlay')?.classList.add('hidden');
        hideStudioTemplateEditor();
        if ($('#liveEditBtn')) $('#liveEditBtn').innerHTML = '🎨<span>Canlı Editör</span>';
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
      startElapsed();
      initHostPeer();
    } catch (err) {
      console.error(err);
      showToast('Yayın başlatılamadı: ' + mapMediaError(err));
      btn.disabled = false;
      btn.querySelector('span:nth-of-type(2)').textContent = 'Yayını Başlat';
      cleanupMedia();
    }
  }

  // Yalnızca Google STUN kullanmak, kısıtlayıcı NAT'ların (kurumsal ağ, mobil veri,
  // bazı ISP'ler) arkasındaki cihazlarda doğrudan P2P bağlantı kurulamamasına ya da
  // kalitesiz bir yola düşülmesine sebep olur — "bazı ağlarda akıcı, bazılarında kasıyor"
  // belirtisinin klasik nedeni budur. TURN (röle) sunucusu eklemek bunu çözer.
  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ]
  };

  function initHostPeer() {
    setNetwork('Bağlantı kuruluyor');
    state.peer = new Peer(undefined, { debug: 1, config: ICE_CONFIG });
    state.peer.on('open', id => {
      shareLink.value = cleanViewerUrl(id);
      const obsInput = $('#obsLink');
      if (obsInput) obsInput.value = obsViewerUrl(id);
      setNetwork('Yayında');
      showToast('Yayın hazır — bağlantıyı paylaşabilirsin');
    });
    state.peer.on('call', call => {
      // Aynı izleyici reconnect olduğunda eski MediaConnection'ı kapat; sayaç yeni çağrıyı silmesin.
      for (const existing of state.calls.values()) {
        if (existing !== call && existing.peer === call.peer) {
          state.calls.delete(existing);
          try { existing.close(); } catch (_) {}
        }
      }
      call.answer(state.localStream);
      state.calls.set(call, call);
      updateViewerCount();
      const remove = () => { state.calls.delete(call); updateViewerCount(); };
      call.on('close', remove);
      call.on('error', remove);
    });
    state.peer.on('disconnected', () => {
      if (!state.localStream || state.peer?.destroyed) return;
      setNetwork('Yeniden bağlanıyor', false);
      clearTimeout(state.hostReconnectTimer);
      state.hostReconnectTimer = setTimeout(() => {
        try { state.peer?.reconnect?.(); } catch (_) {}
      }, 900);
    });
    state.peer.on('error', err => {
      console.error('PeerJS:', err);
      setNetwork('Bağlantı hatası', false);
      showToast('P2P bağlantı hatası: ' + (err.type || 'network'));
    });
  }

  function updateViewerCount() { $('#viewerCount').textContent = state.calls.size; }

  function startElapsed() {
    state.startedAt = Date.now();
    state.timer = setInterval(() => {
      const s = Math.floor((Date.now() - state.startedAt) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2,'0');
      const ss = String(s % 60).padStart(2,'0');
      $('#elapsed').textContent = `${mm}:${ss}`;
    }, 1000);
  }

  function cleanupMedia() {
    state.localStream?.getTracks().forEach(t => t.stop());
    state.rawStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
    state.rawStreams = [];
    state.compositorStop?.(); state.compositorStop = null;
    state.screenAudioEngine?.stop?.(); state.screenAudioEngine = null;
    state.audioMixerEngine?.stop?.(); state.audioMixerEngine = null;
    state.audioContext?.close?.().catch(() => {}); state.audioContext = null;
    state.localStream = null;
    state.screenStream = null;
    state.screenMicStream = null;
    state.screenVideoEl = null;
    state.templateVideos = null;
    state.dualcamRetryTimers = null;
    state.dualcamDisconnected = null;
    state.dualcamSlots = null;
    const dcc = $('#dualcamStudioControls');
    if (dcc) { dcc.innerHTML = ''; dcc.classList.add('hidden'); }
  }

  async function switchScreenSource() {
    if (state.source !== 'screen' || !state.localStream) {
      showToast('Ekran değiştirme yalnızca ekran paylaşımında kullanılabilir.');
      return;
    }
    const btn = $('#switchScreenBtn');
    btn.disabled = true;
    try {
      const newDisplay = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 60 } }, audio: true });
      const newVideoTrack = newDisplay.getVideoTracks()[0];
      if (!newVideoTrack) { newDisplay.getTracks().forEach(t => t.stop()); return; }
      newVideoTrack.addEventListener('ended', stopBroadcast);

      if (state.screenVideoEl) {
        // Kamera katmanlı (compose) mod: sadece besleme kaynağını değiştir, canvas otomatik günceller.
        const oldDisplay = state.screenStream;
        state.screenVideoEl.srcObject = newDisplay;
        await state.screenVideoEl.play().catch(() => {});
        state.screenAudioEngine?.replaceDisplayStream?.(newDisplay);
        state.screenStream = newDisplay;
        state.rawStreams.push(newDisplay);
        if (oldDisplay) {
          oldDisplay.getTracks().forEach(t => t.stop());
          state.rawStreams = state.rawStreams.filter(s => s !== oldDisplay);
        }
        newDisplay.getAudioTracks().forEach(t => t.enabled = true);
      } else {
        // Normal mod: video sender değişir; audio graph sabit kalır ve yeni ekran sesine bağlanır.
        state.screenAudioEngine?.replaceDisplayStream?.(newDisplay);
        const oldDisplay = state.screenStream;
        const oldVideoTrack = state.localStream.getVideoTracks()[0];
        state.localStream.removeTrack(oldVideoTrack);
        state.localStream.addTrack(newVideoTrack);
        localVideo.srcObject = state.localStream;

        state.calls.forEach(call => {
          const pc = call.peerConnection;
          const sender = pc?.getSenders().find(s => s.track && s.track.kind === 'video');
          sender?.replaceTrack(newVideoTrack);
        });

        state.screenStream = newDisplay;
        state.rawStreams.push(newDisplay);
        oldVideoTrack.stop();
        if (oldDisplay) {
          oldDisplay.getTracks().forEach(t => t.stop());
          state.rawStreams = state.rawStreams.filter(s => s !== oldDisplay);
        }
      }
      showToast('Ekran kaynağı değiştirildi');
    } catch (err) {
      if (err.name !== 'NotAllowedError') showToast('Ekran değiştirilemedi: ' + mapMediaError(err));
    } finally {
      btn.disabled = false;
    }
  }

  function stopBroadcast() {
    clearInterval(state.timer);
    clearTimeout(state.hostReconnectTimer); state.hostReconnectTimer = null;
    state.calls.forEach(c => c.close());
    state.calls.clear();
    if (state.peer && !state.peer.destroyed) state.peer.destroy();
    cleanupMedia();
    state.liveEditActive = false;
    $('#liveTplOverlay')?.classList.add('hidden');
    $('#liveTplOverlay') && ($('#liveTplOverlay').innerHTML = '');
    $('#liveEditBtn')?.classList.remove('off');
    $('#toggleMicBtn')?.classList.remove('hidden');
    if ($('#liveEditBtn')) $('#liveEditBtn').innerHTML = '🎨<span>Canlı Editör</span>';
    restoreTemplateEditorHome();
    shareLink.value = 'Bağlantı hazırlanıyor…';
    localVideo.srcObject = null;
    studioView.classList.add('hidden');
    studioView.classList.remove('dualcam-studio');
    homeView.classList.remove('hidden');
    features.classList.remove('hidden');
    setNetwork('Hazır');
    const btn = $('#startBtn');
    btn.disabled = false;
    btn.querySelector('span:nth-of-type(2)').textContent = 'Yayını Başlat';
    showToast('Yayın sonlandırıldı');
  }

  function toggleMic() {
    if (!state.localStream) return;
    if (state.source === 'dualcam') {
      showToast('Çoklu kamera seslerini Ses Mikseri veya kamera kanal düğmelerinden yönet.');
      return;
    }
    const tracks = state.source === 'screen'
      ? (state.screenMicStream?.getAudioTracks() || [])
      : state.localStream.getAudioTracks();
    if (!tracks.length) { showToast('Bu yayında ayrı bir mikrofon ses izi yok.'); return; }
    const enabled = !tracks[0].enabled;
    tracks.forEach(t => { t.enabled = enabled; });
    state.screenAudioEngine?.setMicEnabled?.(enabled);
    $('#toggleMicBtn').classList.toggle('off', !enabled);
    $('#toggleMicBtn').firstChild.nodeValue = enabled ? '🎙' : '🔇';
    showToast(enabled ? 'Mikrofon açıldı' : 'Mikrofon kapatıldı');
  }

function createViewerOfferStream() {
  /*
   * PeerJS media call sırasında tamamen boş MediaStream kullanılırsa
   * SDP içinde audio/video medya kanalları oluşmayabiliyor.
   *
   * Bu nedenle kamera/mikrofon izni istemeden:
   * - 2x2 piksel sahte video
   * - sessiz sahte audio
   * oluşturuyoruz.
   */

  const stream = new MediaStream();

  // Sahte video izi
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;

  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillRect(0, 0, 2, 2);
  }

  const canvasStream = canvas.captureStream(1);
  const videoTrack = canvasStream.getVideoTracks()[0];

  if (videoTrack) {
    videoTrack.enabled = false;
    stream.addTrack(videoTrack);
  }

  // Sessiz audio izi
  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  let audioCtx = null;
  let oscillator = null;

  if (AudioCtx) {
    try {
      audioCtx = new AudioCtx();

      const destination = audioCtx.createMediaStreamDestination();
      oscillator = audioCtx.createOscillator();

      const gain = audioCtx.createGain();
      gain.gain.value = 0;

      oscillator.connect(gain);
      gain.connect(destination);

      oscillator.start();

      const audioTrack = destination.stream.getAudioTracks()[0];

      if (audioTrack) {
        audioTrack.enabled = false;
        stream.addTrack(audioTrack);
      }

    } catch (err) {
      console.warn('Sessiz ses izi oluşturulamadı:', err);
    }
  }

  return {
    stream,

    cleanup() {
      stream.getTracks().forEach(track => {
        track.stop();
      });

      try {
        oscillator?.stop();
      } catch (e) {}

      audioCtx?.close?.().catch(() => {});
    }
  };
}


function initViewer(id) {
  document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex,nofollow');
  document.title = 'Özel Yayın — EBS Live';
  homeView.classList.add('hidden');
  features.classList.add('hidden');
  viewerView.classList.remove('hidden');
  $('.site-header')?.classList.add('hidden');
  if (obsMode) document.body.classList.add('obs-mode');

  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let destroyed = false;
  let peer = null;
  let activeCall = null;
  let activeOfferMedia = null;
  let callGeneration = 0;
  const status = $('#viewerStatus');

  const cleanupOffer = () => {
    activeOfferMedia?.cleanup?.();
    activeOfferMedia = null;
  };

  const closeActiveCall = () => {
    callGeneration++;
    const old = activeCall;
    activeCall = null;
    cleanupOffer();
    try { old?.close?.(); } catch (_) {}
  };

  const scheduleReconnect = () => {
    if (destroyed) return;
    clearTimeout(reconnectTimer);
    reconnectAttempt++;
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempt), 15000);
    reconnectTimer = setTimeout(() => {
      if (destroyed) return;
      console.log('Yeniden bağlanılıyor… deneme', reconnectAttempt);
      if (peer && !peer.destroyed && peer.open) {
        tryCall();
      } else if (peer && !peer.destroyed) {
        try { peer.reconnect(); } catch (_) { createPeerAndConnect(); }
      } else {
        createPeerAndConnect();
      }
    }, delay);
  };

  addEventListener('beforeunload', () => {
    destroyed = true;
    clearTimeout(reconnectTimer);
    closeActiveCall();
  });

  if (!window.Peer) {
    viewerError('Bağlantı bileşeni yüklenemedi.');
    return;
  }

  const createPeerAndConnect = () => {
    if (destroyed) return;
    try { if (peer && !peer.destroyed) peer.destroy(); } catch (_) {}
    peer = new Peer(undefined, { debug: 2, config: ICE_CONFIG });
    state.peer = peer;

    peer.on('open', viewerPeerId => {
      console.log('İzleyici PeerJS bağlantısı hazır:', viewerPeerId);
      reconnectAttempt = 0;
      tryCall();
    });

    peer.on('error', err => {
      console.error('PeerJS izleyici hatası:', err);
      viewerError(err.type === 'peer-unavailable'
        ? 'Yayıncı çevrimdışı veya yayın sona ermiş. Yeniden deneniyor…'
        : 'P2P bağlantısı kurulamadı. Yeniden deneniyor…');
      scheduleReconnect();
    });

    peer.on('disconnected', () => {
      if (destroyed) return;
      try { peer.reconnect(); } catch (_) { scheduleReconnect(); }
    });

    peer.on('close', () => {
      if (!destroyed) scheduleReconnect();
    });
  };

  const tryCall = () => {
    if (destroyed || !peer || peer.destroyed || !peer.open) {
      scheduleReconnect();
      return;
    }

    console.log('Yayıncıya bağlanılıyor:', id);
    closeActiveCall();
    const generation = callGeneration;
    const offerMedia = createViewerOfferStream();
    activeOfferMedia = offerMedia;
    const call = peer.call(id, offerMedia.stream);

    if (!call) {
      cleanupOffer();
      viewerError('Yayıncıya ulaşılamadı.');
      scheduleReconnect();
      return;
    }

    activeCall = call;
    let gotStream = false;
    let offerCleaned = false;
    const cleanThisOffer = () => {
      if (offerCleaned) return;
      offerCleaned = true;
      offerMedia.cleanup();
      if (activeOfferMedia === offerMedia) activeOfferMedia = null;
    };

    const timeout = setTimeout(() => {
      if (generation !== callGeneration || gotStream) return;
      cleanThisOffer();
      viewerError('Yayıncı çevrimdışı veya bağlantı kurulamadı. Yeniden deneniyor…');
      try { call.close(); } catch (_) {}
      if (activeCall === call) activeCall = null;
      scheduleReconnect();
    }, 15000);

    call.on('stream', stream => {
      if (generation !== callGeneration) return;
      console.log('Yayın akışı alındı:', stream);
      gotStream = true;
      reconnectAttempt = 0;
      clearTimeout(timeout);
      cleanThisOffer();
      remoteVideo.srcObject = stream;
      remotePlaceholder.classList.add('hidden');
      status.innerHTML = '<i></i> Canlı yayın';
      remoteVideo.play().catch(() => showToast('Videoyu başlatmak için ekrana dokunun.'));
    });

    const onConnectionEnded = (message, err = null) => {
      if (generation !== callGeneration) return;
      if (err) console.error('MediaConnection hatası:', err);
      clearTimeout(timeout);
      cleanThisOffer();
      if (activeCall === call) activeCall = null;
      viewerError(message);
      scheduleReconnect();
    };

    call.on('close', () => onConnectionEnded('Yayın sona erdi. Yeniden bağlanmayı deniyorum…'));
    call.on('error', err => onConnectionEnded('Yayın bağlantısı kesildi. Yeniden bağlanmayı deniyorum…', err));

    setTimeout(() => {
      if (generation !== callGeneration) return;
      const pc = call.peerConnection;
      if (!pc) return;
      pc.addEventListener('iceconnectionstatechange', () => {
        console.log('ICE durumu:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed' && generation === callGeneration) {
          viewerError('P2P bağlantısı kurulamadı. TURN sunucusu gerekli olabilir. Yeniden deneniyor…');
          try { call.close(); } catch (_) {}
          scheduleReconnect();
        }
      });
      pc.addEventListener('connectionstatechange', () => {
        console.log('WebRTC bağlantı durumu:', pc.connectionState);
      });
    }, 0);
  };

  createPeerAndConnect();
}

  function viewerError(message) {
    $('#viewerStatus').innerHTML = '<i style="background:#ff4964;box-shadow:0 0 14px #ff4964"></i> Bağlantı yok';
    remotePlaceholder.classList.remove('hidden');
    remotePlaceholder.querySelector('h1').textContent = message;
    remotePlaceholder.querySelector('p').textContent = 'Bağlantıyı kontrol edin veya yayıncıdan yeni bir davet bağlantısı isteyin.';
  }

  $('#startBtn').addEventListener('click', startBroadcast);
  $('#stopBtn').addEventListener('click', stopBroadcast);
  $('#toggleMicBtn').addEventListener('click', toggleMic);
  $('#switchScreenBtn').addEventListener('click', switchScreenSource);
  $('#copyBtn').addEventListener('click', copyLink);
  $('#copyBtn2').addEventListener('click', copyLink);
  $('#copyObsBtn')?.addEventListener('click', copyObsLink);
  $('#fullscreenBtn').addEventListener('click', () => {
    const target = $('.remote-stage');
    if (!document.fullscreenElement) target.requestFullscreen?.(); else document.exitFullscreen?.();
  });

  addEventListener('beforeunload', () => {
    state.peer?.destroy?.();
    cleanupMedia();
  });

  if (watchId && /^[A-Za-z0-9_-]{1,128}$/.test(watchId)) initViewer(watchId);
})();
