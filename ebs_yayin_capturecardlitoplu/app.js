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
    templateVideos: null
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
  let dualcamDevicesLoaded = false;

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

  async function populateDualCamDevices(force) {
    if (dualcamDevicesLoaded && !force) return;
    const refreshBtn = $('#dualcamRefreshBtn');
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '↻ Taranıyor…'; }
    await unlockDeviceLabelsOnce();
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      const mics = devices.filter(d => d.kind === 'audioinput');
      const prevV1 = $('#dualCam1').value, prevV2 = $('#dualCam2').value;
      const vSel1 = $('#dualCam1'), vSel2 = $('#dualCam2');
      const aSel1 = $('#dualCam1Audio'), aSel2 = $('#dualCam2Audio');
      vSel1.innerHTML = ''; vSel2.innerHTML = '';
      aSel1.innerHTML = ''; aSel2.innerHTML = '';

      if (!cams.length) {
        vSel1.innerHTML = vSel2.innerHTML = '<option value="">Kamera bulunamadı</option>';
        showToast('Hiç kamera/capture card algılanamadı.');
      } else {
        cams.forEach((d, i) => {
          const label = d.label || `Kamera ${i + 1} (isim izin sonrası görünür)`;
          vSel1.appendChild(new Option(label, d.deviceId));
          vSel2.appendChild(new Option(label, d.deviceId));
        });
        // Önceki seçim hâlâ listede varsa koru; değilse iki FARKLI cihazı varsayılan yap.
        vSel1.value = cams.some(c => c.deviceId === prevV1) ? prevV1 : cams[0].deviceId;
        vSel2.value = cams.some(c => c.deviceId === prevV2 && prevV2 !== vSel1.value) ? prevV2 : (cams[1] ? cams[1].deviceId : cams[0].deviceId);
        if (cams.length < 2) {
          showToast('Yalnızca 1 kamera algılandı — 2. capture card takılı mı kontrol et.');
        }
      }

      const noneOpt = () => new Option('Ses yok', '');
      if (!mics.length) {
        aSel1.appendChild(noneOpt()); aSel2.appendChild(noneOpt());
      } else {
        [aSel1, aSel2].forEach(sel => {
          sel.appendChild(noneOpt());
          mics.forEach((d, i) => sel.appendChild(new Option(d.label || `Mikrofon ${i + 1} (isim izin sonrası görünür)`, d.deviceId)));
        });
        const matchAudioFor = (videoDeviceId) => {
          const cam = cams.find(c => c.deviceId === videoDeviceId);
          if (!cam) return '';
          const paired = mics.find(m => m.groupId === cam.groupId);
          return paired ? paired.deviceId : '';
        };
        if (cams[0]) aSel1.value = matchAudioFor(vSel1.value) || mics[0].deviceId;
        if (cams[1] || cams[0]) aSel2.value = matchAudioFor(vSel2.value) || (mics[1] ? mics[1].deviceId : mics[0].deviceId);
      }

      vSel1.onchange = () => {
        const m = mics.find(x => x.groupId === cams.find(c => c.deviceId === vSel1.value)?.groupId);
        if (m) aSel1.value = m.deviceId;
        if (vSel1.value === vSel2.value) showToast('Uyarı: İki kamera alanı da aynı cihazı gösteriyor, farklı seçmelisin.');
      };
      vSel2.onchange = () => {
        const m = mics.find(x => x.groupId === cams.find(c => c.deviceId === vSel2.value)?.groupId);
        if (m) aSel2.value = m.deviceId;
        if (vSel1.value === vSel2.value) showToast('Uyarı: İki kamera alanı da aynı cihazı gösteriyor, farklı seçmelisin.');
      };

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

  $$('.share-option').forEach(btn => btn.addEventListener('click', () => {
    $$('.share-option').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.source = btn.dataset.source;
    $('#cameraOverlayRow').classList.toggle('hidden', state.source !== 'screen');
    $('#cameraOverlayToggle').disabled = state.source !== 'screen';
    $('#micToggle').closest('.switch-row').classList.toggle('hidden', state.source === 'dualcam');
    dualcamPanel.classList.toggle('hidden', state.source !== 'dualcam');
    if (state.source === 'dualcam') populateDualCamDevices();
  }));

  async function getMicrophoneStream() {
    if (!$('#micToggle').checked) return null;
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  }

  async function buildScreenStream() {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 60 } }, audio: true });
    state.rawStreams.push(display);
    state.screenStream = display;
    const mic = await getMicrophoneStream();
    if (mic) state.rawStreams.push(mic);

    if ($('#cameraOverlayToggle').checked) {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      state.rawStreams.push(cam);
      return composeScreenAndCamera(display, cam, mic);
    }

    const out = new MediaStream();
    display.getVideoTracks().forEach(t => out.addTrack(t));
    const audioTracks = [...display.getAudioTracks(), ...(mic ? mic.getAudioTracks() : [])];
    const mixed = await mixAudio(audioTracks);
    if (mixed) out.addTrack(mixed);
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

  async function mixAudio(tracks) {
    if (!tracks.length) return null;
    if (tracks.length === 1) return tracks[0];
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return tracks[0];
    const ctx = new AudioCtx();
    state.audioContext = ctx;
    const dest = ctx.createMediaStreamDestination();
    tracks.forEach(track => {
      const source = ctx.createMediaStreamSource(new MediaStream([track]));
      source.connect(dest);
    });
    return dest.stream.getAudioTracks()[0] || tracks[0];
  }

  async function composeScreenAndCamera(screen, camera, mic) {
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

    const draw = () => {
      if (!running) return;
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
      requestAnimationFrame(draw);
    };
    draw();
    state.compositorStop = () => { running = false; };

    const out = canvas.captureStream(30);
    const audioTracks = [...screen.getAudioTracks(), ...(mic ? mic.getAudioTracks() : [])];
    const mixed = await mixAudio(audioTracks);
    if (mixed) out.addTrack(mixed);
    return out;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x,y,w,h,r) : (ctx.rect(x,y,w,h));
  }

  function readTemplateData() {
    const val = (id) => ($(id)?.value || '').trim();
    return {
      guest1Name: val('#tplGuest1Name') || 'Konuk 1',
      guest1Title: val('#tplGuest1Title') || 'Ünvan / Görev',
      guest2Name: val('#tplGuest2Name') || 'Konuk 2',
      guest2Title: val('#tplGuest2Title') || 'Ünvan / Görev',
      title: (val('#tplTitle') || 'YAYIN BAŞLIĞI BURAYA GELECEK').toUpperCase(),
      subtitle: val('#tplSubtitle') || 'Alt başlık / açıklama metni buraya gelecek',
      ticker: val('#tplTicker') || 'son durum • son durum • son durum • son durum',
      youtube: val('#tplYoutube') || '/kanaladiniz',
      twitter: val('#tplTwitter') || '/kanaladiniz',
      facebook: val('#tplFacebook') || '/kanaladiniz',
      instagram: val('#tplInstagram') || '/kanaladiniz'
    };
  }

  async function buildDualCameraTemplateStream() {
    const id1 = $('#dualCam1').value;
    const id2 = $('#dualCam2').value;
    const audioId1 = $('#dualCam1Audio').value;
    const audioId2 = $('#dualCam2Audio').value;
    if (!id1 || !id2) throw new Error('İki kamera seçmelisin.');
    if (id1 === id2) throw new Error('Kamera 1 ve Kamera 2 aynı cihaz olamaz, farklı bir kamera seç.');
    const constraintsFor = (deviceId, audioDeviceId) => ({
      video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: audioDeviceId ? { deviceId: { exact: audioDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false
    });
    const cam1 = await navigator.mediaDevices.getUserMedia(constraintsFor(id1, audioId1));
    state.rawStreams.push(cam1);
    const cam2 = await navigator.mediaDevices.getUserMedia(constraintsFor(id2, audioId2));
    state.rawStreams.push(cam2);

    const tpl = readTemplateData();
    const v1 = document.createElement('video');
    const v2 = document.createElement('video');
    v1.srcObject = cam1; v2.srcObject = cam2;
    v1.muted = v2.muted = true;
    await Promise.all([v1.play(), v2.play()]);
    state.templateVideos = [v1, v2];

    const canvas = document.createElement('canvas');
    canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    let running = true;
    let tickerX = canvas.width;

    const drawGuestBox = (video, x, y, w, h, name, title) => {
      ctx.save();
      roundRect(ctx, x, y, w, h, 6);
      ctx.clip();
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(x, y, w, h);
      const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
      const scale = Math.max(w / vw, h / vh);
      const dw = vw * scale, dh = vh * scale;
      ctx.drawImage(video, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 3;
      roundRect(ctx, x, y, w, h, 6); ctx.stroke();

      const barY = y + h + 4, barH = 62;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(x, barY, w, barH);
      ctx.fillStyle = '#df1735';
      ctx.fillRect(x, barY, 8, barH);
      ctx.fillStyle = '#fff';
      ctx.font = '700 24px Inter, sans-serif';
      ctx.fillText(name, x + 26, barY + 26);
      ctx.fillStyle = '#c9c9c9';
      ctx.font = '400 16px Inter, sans-serif';
      ctx.fillText(title, x + 26, barY + 48);
    };

    const draw = () => {
      if (!running) return;
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = '#0a0507';
      ctx.fillRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#1a0206'); grad.addColorStop(1, '#000');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 150);

      ctx.fillStyle = '#df1735';
      ctx.fillRect(20, 30, 300, 60);
      ctx.fillStyle = '#fff';
      ctx.font = '800 30px Inter, sans-serif';
      ctx.fillText('● CANLI YAYIN', 45, 70);

      ctx.fillStyle = '#df1735';
      ctx.textAlign = 'center';
      ctx.font = '800 44px Inter, sans-serif';
      ctx.fillText('ÖZEL YAYIN', W / 2, 62);
      ctx.fillStyle = '#fff';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText('GÜNDEM • RÖPORTAJ • ANALİZ', W / 2, 96);
      ctx.textAlign = 'left';

      const boxW = 890, boxH = 460, gap = 40, top = 190;
      const x1 = (W - boxW * 2 - gap) / 2, x2 = x1 + boxW + gap;
      drawGuestBox(v1, x1, top, boxW, boxH, tpl.guest1Name, tpl.guest1Title);
      drawGuestBox(v2, x2, top, boxW, boxH, tpl.guest2Name, tpl.guest2Title);

      const tickerY = 730, tickerH = 56;
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(0, tickerY, W, tickerH);
      ctx.fillStyle = '#df1735';
      ctx.fillRect(0, tickerY, 200, tickerH);
      ctx.fillStyle = '#fff';
      ctx.font = '800 22px Inter, sans-serif';
      ctx.fillText('SON DURUM', 30, tickerY + 36);
      ctx.save();
      ctx.beginPath(); ctx.rect(210, tickerY, W - 210, tickerH); ctx.clip();
      ctx.fillStyle = '#111';
      ctx.font = '700 22px Inter, sans-serif';
      ctx.fillText(tpl.ticker, tickerX, tickerY + 36);
      ctx.restore();
      tickerX -= 2.2;
      const tickerWidth = ctx.measureText(tpl.ticker).width;
      if (tickerX < -tickerWidth) tickerX = W;

      const hlY = tickerY + tickerH, hlH = 160;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, hlY, W, hlH);
      ctx.fillStyle = '#df1735';
      ctx.fillRect(0, hlY, W, 4);
      ctx.fillStyle = '#fff';
      ctx.font = '800 54px Inter, sans-serif';
      ctx.fillText(tpl.title, 40, hlY + 78, W - 80);
      ctx.fillStyle = '#d9d9d9';
      ctx.font = '400 24px Inter, sans-serif';
      ctx.fillText(tpl.subtitle, 40, hlY + 118, W - 80);

      const socY = hlY + hlH, socH = 60;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, socY, W, socH);
      ctx.font = '600 20px Inter, sans-serif';
      ctx.fillStyle = '#fff';
      const socials = [`▶ ${tpl.youtube}`, `𝕏 ${tpl.twitter}`, `f ${tpl.facebook}`, `◎ ${tpl.instagram}`];
      const seg = W / socials.length;
      socials.forEach((s, i) => ctx.fillText(s, seg * i + 40, socY + 38));

      requestAnimationFrame(draw);
    };
    draw();
    state.compositorStop = () => { running = false; };

    const out = canvas.captureStream(30);
    const audioTracks = [...cam1.getAudioTracks(), ...cam2.getAudioTracks()];
    const mixed = await mixAudio(audioTracks);
    if (mixed) out.addTrack(mixed);
    return out;
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
      state.localStream = state.source === 'screen' ? await buildScreenStream()
        : state.source === 'dualcam' ? await buildDualCameraTemplateStream()
        : await buildCameraStream();
      const videoTrack = state.localStream.getVideoTracks()[0];
      if (videoTrack) videoTrack.addEventListener('ended', stopBroadcast);

      localVideo.srcObject = state.localStream;
      $('#stageEmpty').classList.add('hidden');
      $('#sourceBadge').textContent = state.source === 'screen' ? 'EKRAN' : state.source === 'dualcam' ? 'ŞABLON' : 'KAMERA';
      $('#switchScreenBtn').classList.toggle('hidden', state.source !== 'screen');
      homeView.classList.add('hidden');
      features.classList.add('hidden');
      studioView.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      startElapsed();
      initHostPeer();
    } catch (err) {
      console.error(err);
      showToast(err.name === 'NotAllowedError' ? 'Ekran/kamera izni verilmedi.' : 'Yayın başlatılamadı: ' + (err.message || err.name));
      btn.disabled = false;
      btn.querySelector('span:nth-of-type(2)').textContent = 'Yayını Başlat';
      cleanupMedia();
    }
  }

  function initHostPeer() {
    setNetwork('Bağlantı kuruluyor');
    state.peer = new Peer(undefined, { debug: 1 });
    state.peer.on('open', id => {
      shareLink.value = cleanViewerUrl(id);
      const obsInput = $('#obsLink');
      if (obsInput) obsInput.value = obsViewerUrl(id);
      setNetwork('Yayında');
      showToast('Yayın hazır — bağlantıyı paylaşabilirsin');
    });
    state.peer.on('call', call => {
      call.answer(state.localStream);
      state.calls.set(call.peer, call);
      updateViewerCount();
      call.on('close', () => { state.calls.delete(call.peer); updateViewerCount(); });
      call.on('error', () => { state.calls.delete(call.peer); updateViewerCount(); });
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
    state.audioContext?.close?.().catch(() => {}); state.audioContext = null;
    state.localStream = null;
    state.screenStream = null;
    state.screenVideoEl = null;
    state.templateVideos = null;
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
        state.screenStream = newDisplay;
        state.rawStreams.push(newDisplay);
        if (oldDisplay) {
          oldDisplay.getTracks().forEach(t => t.stop());
          state.rawStreams = state.rawStreams.filter(s => s !== oldDisplay);
        }
        newDisplay.getAudioTracks().forEach(t => t.enabled = true);
      } else {
        // Normal mod: track'i doğrudan değiştir.
        const oldVideoTrack = state.localStream.getVideoTracks()[0];
        state.localStream.removeTrack(oldVideoTrack);
        state.localStream.addTrack(newVideoTrack);
        localVideo.srcObject = state.localStream;

        state.calls.forEach(call => {
          const pc = call.peerConnection;
          const sender = pc?.getSenders().find(s => s.track && s.track.kind === 'video');
          sender?.replaceTrack(newVideoTrack);
        });

        oldVideoTrack.stop();
        newDisplay.getAudioTracks().forEach(t => t.stop());
      }
      showToast('Ekran kaynağı değiştirildi');
    } catch (err) {
      if (err.name !== 'NotAllowedError') showToast('Ekran değiştirilemedi: ' + (err.message || err.name));
    } finally {
      btn.disabled = false;
    }
  }

  function stopBroadcast() {
    clearInterval(state.timer);
    state.calls.forEach(c => c.close());
    state.calls.clear();
    if (state.peer && !state.peer.destroyed) state.peer.destroy();
    cleanupMedia();
    shareLink.value = 'Bağlantı hazırlanıyor…';
    localVideo.srcObject = null;
    studioView.classList.add('hidden');
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
    const tracks = state.localStream.getAudioTracks();
    if (!tracks.length) { showToast('Bu yayında mikrofon ses izi yok.'); return; }
    const enabled = !tracks[0].enabled;
    tracks.forEach(t => t.enabled = enabled);
    $('#toggleMicBtn').classList.toggle('off', !enabled);
    $('#toggleMicBtn').firstChild.nodeValue = enabled ? '🎙' : '🔇';
    showToast(enabled ? 'Ses açıldı' : 'Ses kapatıldı');
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

  document
    .querySelector('meta[name="robots"]')
    .setAttribute('content', 'noindex,nofollow');

  document.title = 'Özel Yayın — EBS Live';

  homeView.classList.add('hidden');
  features.classList.add('hidden');
  viewerView.classList.remove('hidden');

  $('.site-header').classList.add('hidden');

  if (obsMode) document.body.classList.add('obs-mode');

  // Otomatik yeniden bağlanma (OBS Tarayıcı Kaynağı gibi elle müdahale edilemeyen
  // ortamlarda yayın koparsa/yayıncı yeniden başlatırsa sayfa kendini toparlar).
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let destroyed = false;

  const scheduleReconnect = () => {
    if (destroyed) return;
    clearTimeout(reconnectTimer);
    reconnectAttempt++;
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempt), 15000);
    reconnectTimer = setTimeout(() => {
      if (destroyed) return;
      console.log('Yeniden bağlanılıyor… deneme', reconnectAttempt);
      if (state.peer && !state.peer.destroyed) {
        tryCall();
      } else {
        createPeerAndConnect();
      }
    }, delay);
  };

  addEventListener('beforeunload', () => { destroyed = true; clearTimeout(reconnectTimer); });

  if (!window.Peer) {
    viewerError('Bağlantı bileşeni yüklenemedi.');
    return;
  }

  let peer;
  let status;

  const createPeerAndConnect = () => {
    if (destroyed) return;
    peer = new Peer(undefined, { debug: 2 });
    state.peer = peer;

    peer.on('open', viewerPeerId => {
      console.log('İzleyici PeerJS bağlantısı hazır:', viewerPeerId);
      reconnectAttempt = 0;
      tryCall();
    });

    peer.on('error', err => {
      console.error('PeerJS izleyici hatası:', err);
      if (err.type === 'peer-unavailable') {
        viewerError('Yayıncı çevrimdışı veya yayın sona ermiş. Yeniden deneniyor…');
      } else {
        viewerError('P2P bağlantısı kurulamadı. Yeniden deneniyor…');
      }
      scheduleReconnect();
    });

    peer.on('disconnected', () => {
      if (destroyed) return;
      // Sinyal sunucusuyla bağlantı koptu; önce aynı peer'i canlandırmayı dene.
      try { peer.reconnect(); } catch (e) { scheduleReconnect(); }
    });

    peer.on('close', () => {
      if (destroyed) return;
      scheduleReconnect();
    });
  };

  status = $('#viewerStatus');


  const tryCall = () => {

    console.log('Yayıncıya bağlanılıyor:', id);

    const offerMedia = createViewerOfferStream();

    const call = peer.call(
      id,
      offerMedia.stream
    );


    if (!call) {

      offerMedia.cleanup();

      viewerError(
        'Yayıncıya ulaşılamadı.'
      );

      return;
    }


    let gotStream = false;


    const timeout = setTimeout(() => {

      if (!gotStream) {

        offerMedia.cleanup();

        viewerError(
          'Yayıncı çevrimdışı veya bağlantı kurulamadı. Yeniden deneniyor…'
        );

        scheduleReconnect();
      }

    }, 15000);



    call.on('stream', stream => {

      console.log(
        'Yayın akışı alındı:',
        stream
      );

      gotStream = true;

      clearTimeout(timeout);


      /*
       * Artık gerçek yayın geldi.
       * Sahte medya izlerine ihtiyacımız yok.
       */
      offerMedia.cleanup();


      remoteVideo.srcObject = stream;

      remotePlaceholder.classList.add(
        'hidden'
      );


      status.innerHTML =
        '<i></i> Canlı yayın';


      remoteVideo.play().catch(() => {

        showToast(
          'Videoyu başlatmak için ekrana dokunun.'
        );

      });

    });



    call.on('close', () => {

      console.log(
        'Yayın bağlantısı kapandı.'
      );

      clearTimeout(timeout);

      offerMedia.cleanup();

      viewerError(
        'Yayın sona erdi. Yeniden bağlanmayı deniyorum…'
      );

      scheduleReconnect();

    });



    call.on('error', err => {

      console.error(
        'MediaConnection hatası:',
        err
      );

      clearTimeout(timeout);

      offerMedia.cleanup();

      viewerError(
        'Yayın bağlantısı kesildi. Yeniden bağlanmayı deniyorum…'
      );

      scheduleReconnect();

    });



    /*
     * ICE / NAT kontrolü
     */

    setTimeout(() => {

      const pc = call.peerConnection;

      if (!pc) {
        return;
      }


      console.log(
        'PeerConnection bulundu.'
      );


      pc.addEventListener(
        'iceconnectionstatechange',
        () => {

          console.log(
            'ICE durumu:',
            pc.iceConnectionState
          );


          if (
            pc.iceConnectionState === 'failed'
          ) {

            viewerError(
              'P2P bağlantısı kurulamadı. TURN sunucusu gerekli olabilir. Yeniden deneniyor…'
            );

            scheduleReconnect();

          }

        }
      );


      pc.addEventListener(
        'connectionstatechange',
        () => {

          console.log(
            'WebRTC bağlantı durumu:',
            pc.connectionState
          );

        }
      );

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
