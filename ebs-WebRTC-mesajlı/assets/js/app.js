(() => {
  'use strict';

  const $ = (q) => document.querySelector(q);
  const $$ = (q) => [...document.querySelectorAll(q)];

  // Sadece IP keşfi (NAT aşımı) için genel/ücretsiz STUN sunucuları.
  // Signaling (offer/answer) bunlardan GEÇMEZ — o tamamen elden (manuel) yapılır.
  const ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ];

  const state = {
    localStream: null,
    rawStreams: [],
    source: 'screen',
    startedAt: null,
    timer: null,
    compositorStop: null,
    audioContext: null,
    viewerCount: 0,
    hostConns: [],   // yayıncı taraf: her izleyici için ayrı RTCPeerConnection
    viewerConn: null, // izleyici taraf: tek bağlantı
    username: (localStorage.getItem('ebslive_username') || '').slice(0, 24),
    chatOpen: false,
    unread: 0,
    incomingFiles: new Map() // fileId -> {meta, chunks:[], received}
  };

  const homeView = $('#homeView');
  const studioView = $('#studioView');
  const viewerView = $('#viewerView');
  const features = $('#features');
  const localVideo = $('#localVideo');
  const remoteVideo = $('#remoteVideo');
  const remotePlaceholder = $('#remotePlaceholder');
  const toast = $('#toast');

  $('#year').textContent = new Date().getFullYear();

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function setNetwork(text, ok = true) {
    $('#networkText').textContent = text;
    const dot = $('.status-pill i');
    if (dot) dot.style.background = ok ? '#20d98d' : '#ff4964';
  }

  // ---- Kod kodlama/çözme: SDP nesnesini kısa, güvenli bir metne çevirir ----
  function encodeCode(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }
  function decodeCode(text) {
    const clean = (text || '').trim().replace(/\s+/g, '');
    const json = decodeURIComponent(escape(atob(clean)));
    return JSON.parse(json);
  }

  async function copyTextValue(value, label) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast(label + ' kopyalandı');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast(label + ' kopyalandı');
    }
  }

  // ICE toplama tamamlanana kadar bekler (tam SDP'yi tek seferde kopyalayabilmek için).
  // Bazı ağlarda toplama hiç "complete" olmayabilir; bu yüzden bir zaman aşımı var.
  function waitIceGatheringComplete(pc, timeoutMs = 6000) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(resolve => {
      let done = false;
      const finish = () => { if (done) return; done = true; pc.removeEventListener('icegatheringstatechange', check); resolve(); };
      const check = () => { if (pc.iceGatheringState === 'complete') finish(); };
      pc.addEventListener('icegatheringstatechange', check);
      setTimeout(finish, timeoutMs);
    });
  }

  $$('.share-option').forEach(btn => btn.addEventListener('click', () => {
    $$('.share-option').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.source = btn.dataset.source;
    $('#cameraOverlayRow').style.opacity = state.source === 'screen' ? '1' : '.35';
    $('#cameraOverlayToggle').disabled = state.source !== 'screen';
  }));

  async function getMicrophoneStream() {
    if (!$('#micToggle').checked) return null;
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  }

  async function buildScreenStream() {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 60 } }, audio: true });
    state.rawStreams.push(display);
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

  // ================= YAYINCI TARAFI =================

  async function startBroadcast() {
    if (!navigator.mediaDevices || !window.RTCPeerConnection) {
      showToast('Tarayıcınız gerekli WebRTC özelliklerini desteklemiyor.');
      return;
    }
    const btn = $('#startBtn');
    btn.disabled = true;
    btn.querySelector('span:nth-of-type(2)').textContent = 'İzin bekleniyor…';

    try {
      state.localStream = state.source === 'screen' ? await buildScreenStream() : await buildCameraStream();
      const videoTrack = state.localStream.getVideoTracks()[0];
      if (videoTrack) videoTrack.addEventListener('ended', stopBroadcast);

      localVideo.srcObject = state.localStream;
      $('#stageEmpty').classList.add('hidden');
      $('#sourceBadge').textContent = state.source === 'screen' ? 'EKRAN' : 'KAMERA';
      homeView.classList.add('hidden');
      features.classList.add('hidden');
      studioView.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      startElapsed();
      setNetwork('Yayında');
      showToast('Yayın hazır — izleyici davet edebilirsin');
      $('#chatToggleBtn').classList.remove('hidden');
    } catch (err) {
      console.error(err);
      showToast(err.name === 'NotAllowedError' ? 'Ekran/kamera izni verilmedi.' : 'Yayın başlatılamadı: ' + (err.message || err.name));
      btn.disabled = false;
      btn.querySelector('span:nth-of-type(2)').textContent = 'Yayını Başlat';
      cleanupMedia();
    }
  }

  function updateViewerCount() {
    state.viewerCount = state.hostConns.filter(c => c.pc.connectionState === 'connected').length;
    $('#viewerCount').textContent = state.viewerCount;
  }

  let inviteSeq = 0;
  async function addViewerInvite() {
    if (!state.localStream) return;
    inviteSeq += 1;
    const n = inviteSeq;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    state.localStream.getTracks().forEach(t => pc.addTrack(t, state.localStream));
    const dc = pc.createDataChannel('chat', { ordered: true });
    wireChatChannel(dc, `İzleyici #${n}`);
    const entry = { id: n, pc, dc };
    state.hostConns.push(entry);

    const card = document.createElement('div');
    card.className = 'invite-card';
    card.innerHTML = `
      <div class="invite-card-head"><b>İzleyici #${n}</b><span class="invite-status">Kod oluşturuluyor…</span></div>
      <label>1. Bu kodu izleyiciye gönder</label>
      <textarea class="code-box offer-code" rows="3" readonly>Oluşturuluyor…</textarea>
      <label>2. İzleyicinin gönderdiği cevap kodunu buraya yapıştır</label>
      <textarea class="code-box answer-input" rows="3" placeholder="Cevap kodunu buraya yapıştır…"></textarea>
      <div class="invite-actions">
        <button type="button" class="secondary-btn copy-offer-btn">Kodu Kopyala</button>
        <button type="button" class="secondary-btn connect-btn">Bağlan</button>
      </div>`;
    $('#viewerInvites').appendChild(card);

    const statusEl = card.querySelector('.invite-status');
    const offerBox = card.querySelector('.offer-code');
    const answerBox = card.querySelector('.answer-input');

    pc.onconnectionstatechange = () => {
      updateViewerCount();
      if (pc.connectionState === 'connected') { statusEl.textContent = 'Bağlandı'; statusEl.classList.add('connected'); statusEl.classList.remove('failed'); }
      else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') { statusEl.textContent = 'Bağlantı koptu'; statusEl.classList.add('failed'); }
      else if (pc.connectionState === 'connecting') { statusEl.textContent = 'Bağlanıyor…'; }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitIceGatheringComplete(pc);
      const code = encodeCode({ sdp: pc.localDescription });
      offerBox.value = code;
      statusEl.textContent = 'Kod hazır — gönder';
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Hata';
      statusEl.classList.add('failed');
      offerBox.value = 'Kod oluşturulamadı: ' + (err.message || err.name);
    }

    card.querySelector('.copy-offer-btn').addEventListener('click', () => copyTextValue(offerBox.value, 'Davet kodu'));
    card.querySelector('.connect-btn').addEventListener('click', async () => {
      const raw = answerBox.value.trim();
      if (!raw) { showToast('Önce izleyicinin cevap kodunu yapıştır.'); return; }
      try {
        const { sdp } = decodeCode(raw);
        await pc.setRemoteDescription(sdp);
        statusEl.textContent = 'Bağlanıyor…';
        showToast('Cevap kodu işlendi, bağlantı kuruluyor…');
      } catch (err) {
        console.error(err);
        showToast('Cevap kodu okunamadı. Kodu tam ve eksiksiz yapıştırdığından emin ol.');
      }
    });
  }

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
  }

  function stopBroadcast() {
    clearInterval(state.timer);
    state.hostConns.forEach(c => c.pc.close());
    state.hostConns = [];
    $('#viewerInvites').innerHTML = '';
    updateViewerCount();
    cleanupMedia();
    localVideo.srcObject = null;
    studioView.classList.add('hidden');
    homeView.classList.remove('hidden');
    features.classList.remove('hidden');
    setNetwork('Hazır');
    closeChat();
    $('#chatToggleBtn').classList.add('hidden');
    $('#chatMessages').innerHTML = '';
    state.incomingFiles.clear();
    const btn = $('#startBtn');
    btn.disabled = false;
    btn.querySelector('span:nth-of-type(2)').textContent = 'Yayını Başlat';
    const micBtn = $('#toggleMicBtn');
    micBtn.classList.remove('off');
    micBtn.firstChild.nodeValue = '🎙';
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

  // ================= İZLEYİCİ TARAFI =================

  async function processHostOffer() {
    const raw = $('#offerInput').value.trim();
    if (!raw) { showToast('Önce yayıncının davet kodunu yapıştır.'); return; }
    if (!window.RTCPeerConnection) { showToast('Tarayıcınız gerekli WebRTC özelliklerini desteklemiyor.'); return; }

    let offerDesc;
    try {
      const { sdp } = decodeCode(raw);
      offerDesc = sdp;
    } catch (err) {
      showToast('Kod okunamadı. Kodun tamamını eksiksiz yapıştırdığından emin ol.');
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    state.viewerConn = pc;

    pc.ontrack = (e) => {
      remoteVideo.srcObject = e.streams[0];
      remotePlaceholder.classList.add('hidden');
      $('#viewerStatus').innerHTML = '<i></i> Canlı yayın';
      remoteVideo.play().catch(() => showToast('Videoyu başlatmak için ekrana dokunun.'));
    };
    pc.ondatachannel = (e) => {
      state.viewerConn.chatChannel = e.channel;
      wireChatChannel(e.channel, 'Yayıncı');
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        $('#viewerStatus').innerHTML = '<i></i> Bağlandı';
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        viewerError('Bağlantı koptu. Yayıncıdan yeni bir davet kodu iste.');
      }
    };

    try {
      await pc.setRemoteDescription(offerDesc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitIceGatheringComplete(pc);
      const code = encodeCode({ sdp: pc.localDescription });
      $('#answerOutput').value = code;
      $('#joinStep1').classList.add('hidden');
      $('#joinStep2').classList.remove('hidden');
      showToast('Cevap kodu hazır — yayıncıya gönder');
    } catch (err) {
      console.error(err);
      showToast('Bağlantı kurulamadı: ' + (err.message || err.name));
    }
  }

  function goToViewerView() {
    document.querySelector('meta[name="robots"]').setAttribute('content', 'noindex,nofollow');
    document.title = 'Özel Yayın — EBS Live';
    homeView.classList.add('hidden');
    features.classList.add('hidden');
    viewerView.classList.remove('hidden');
    $('.site-header').classList.add('hidden');
    $('#chatToggleBtn').classList.remove('hidden');
  }

  function viewerError(message) {
    $('#viewerStatus').innerHTML = '<i style="background:#ff4964;box-shadow:0 0 14px #ff4964"></i> Bağlantı yok';
    remotePlaceholder.classList.remove('hidden');
    remotePlaceholder.querySelector('h1').textContent = message;
    remotePlaceholder.querySelector('p').textContent = 'Yayıncıdan yeni bir davet kodu isteyip yeniden dene.';
  }

  // ================= SOHBET (DataChannel üzerinden) =================

  const CHUNK_SIZE = 8000; // ham bayt; base64 sonrası ~10.7KB, tüm tarayıcılarda güvenli
  const MAX_FILE_SIZE = 60 * 1024 * 1024; // 60MB pratik üst sınır (P2P, sunucu yok)
  const EMOJIS = ['😀','😂','😍','😎','🥳','😢','😡','👍','👎','🙏','🎉','🔥','❤️','💯','👏','🤔','😴','🤝','✅','❌','⚡','📎','🖥️','🎥'];

  function chatMessagesEl() { return $('#chatMessages'); }

  function ensureUsername() {
    if (state.username) return true;
    $('#chatUsernameRow').style.display = 'block';
    $('#chatUsernameInput').focus();
    return false;
  }

  function appendSystemMsg(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg system';
    el.textContent = text;
    chatMessagesEl().appendChild(el);
    chatMessagesEl().scrollTop = chatMessagesEl().scrollHeight;
  }

  function appendTextMsg({ from, text, mine }) {
    const el = document.createElement('div');
    el.className = 'chat-msg ' + (mine ? 'me' : 'them');
    const nameEl = document.createElement('span');
    nameEl.className = 'chat-msg-name';
    nameEl.textContent = mine ? 'Sen' : from;
    const textEl = document.createElement('div');
    textEl.textContent = text;
    el.appendChild(nameEl);
    el.appendChild(textEl);
    chatMessagesEl().appendChild(el);
    chatMessagesEl().scrollTop = chatMessagesEl().scrollHeight;
    if (!mine && !state.chatOpen) bumpUnread();
  }

  function appendFilePlaceholder({ id, from, name, size, mine }) {
    const el = document.createElement('div');
    el.className = 'chat-msg ' + (mine ? 'me' : 'them');
    el.dataset.fileId = id;
    const nameEl = document.createElement('span');
    nameEl.className = 'chat-msg-name';
    nameEl.textContent = mine ? 'Sen' : from;
    const textEl = document.createElement('div');
    textEl.textContent = `📎 ${name} (${formatBytes(size)})`;
    const prog = document.createElement('div');
    prog.className = 'chat-progress';
    prog.textContent = mine ? 'Gönderiliyor… 0%' : 'Alınıyor… 0%';
    el.appendChild(nameEl); el.appendChild(textEl); el.appendChild(prog);
    chatMessagesEl().appendChild(el);
    chatMessagesEl().scrollTop = chatMessagesEl().scrollHeight;
    if (!mine && !state.chatOpen) bumpUnread();
    return { el, prog };
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
    return (n/1024/1024).toFixed(1) + ' MB';
  }

  function bumpUnread() {
    state.unread += 1;
    const badge = $('#chatBadge');
    badge.textContent = state.unread;
    badge.classList.remove('hidden');
  }

  function clearUnread() {
    state.unread = 0;
    $('#chatBadge').classList.add('hidden');
  }

  function isHost() { return !studioView.classList.contains('hidden'); }

  function activeChannels() {
    if (isHost()) return state.hostConns.filter(c => c.dc && c.dc.readyState === 'open').map(c => c.dc);
    if (state.viewerConn && state.viewerConn.chatChannel && state.viewerConn.chatChannel.readyState === 'open') return [state.viewerConn.chatChannel];
    return [];
  }

  function wireChatChannel(dc, label) {
    dc.binaryType = 'arraybuffer';
    dc.onopen = () => appendSystemMsg(`${label} sohbete bağlandı.`);
    dc.onclose = () => appendSystemMsg(`${label} sohbetten ayrıldı.`);
    dc.onmessage = (e) => handleChatData(e.data, label);
  }

  function handleChatData(raw, label) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'text') {
      appendTextMsg({ from: msg.from || label, text: msg.text, mine: false });
    } else if (msg.type === 'file-meta') {
      state.incomingFiles.set(msg.id, { meta: msg, chunks: new Array(msg.total), received: 0 });
      const ref = appendFilePlaceholder({ id: msg.id, from: msg.from || label, name: msg.name, size: msg.size, mine: false });
      state.incomingFiles.get(msg.id).ref = ref;
    } else if (msg.type === 'file-chunk') {
      const entry = state.incomingFiles.get(msg.id);
      if (!entry) return;
      const bin = atob(msg.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      entry.chunks[msg.index] = bytes;
      entry.received += 1;
      const pct = Math.round((entry.received / entry.meta.total) * 100);
      if (entry.ref) entry.ref.prog.textContent = `Alınıyor… ${pct}%`;
      if (entry.received >= entry.meta.total) finalizeIncomingFile(msg.id);
    }
  }

  function finalizeIncomingFile(id) {
    const entry = state.incomingFiles.get(id);
    if (!entry) return;
    const blob = new Blob(entry.chunks, { type: entry.meta.mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const { el, prog } = entry.ref;
    prog.remove();
    if ((entry.meta.mime || '').startsWith('image/')) {
      const img = document.createElement('img');
      img.className = 'chat-file-preview';
      img.src = url;
      el.appendChild(img);
    }
    const a = document.createElement('a');
    a.className = 'chat-file-link';
    a.href = url;
    a.download = entry.meta.name;
    a.textContent = '⬇ İndir';
    el.appendChild(a);
    state.incomingFiles.delete(id);
  }

  async function waitBufferedLow(dc, max = 262144) {
    while (dc.bufferedAmount > max) await new Promise(r => setTimeout(r, 40));
  }

  function sendChatText() {
    if (!ensureUsername()) { showToast('Önce adını girip kaydet.'); return; }
    const input = $('#chatTextInput');
    const text = input.value.trim();
    if (!text) return;
    const channels = activeChannels();
    if (!channels.length) { showToast('Bağlı kimse yok, mesaj gönderilemedi.'); return; }
    const payload = JSON.stringify({ type: 'text', from: state.username, text });
    channels.forEach(dc => { try { dc.send(payload); } catch (e) { console.error(e); } });
    appendTextMsg({ from: state.username, text, mine: true });
    input.value = '';
  }

  async function sendChatFile(file) {
    if (!ensureUsername()) { showToast('Önce adını girip kaydet.'); return; }
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { showToast(`Dosya çok büyük (limit ${formatBytes(MAX_FILE_SIZE)}).`); return; }
    const channels = activeChannels();
    if (!channels.length) { showToast('Bağlı kimse yok, dosya gönderilemedi.'); return; }

    const id = 'f' + Date.now() + Math.random().toString(36).slice(2, 7);
    const buf = await file.arrayBuffer();
    const total = Math.ceil(buf.byteLength / CHUNK_SIZE) || 1;
    const meta = { type: 'file-meta', id, from: state.username, name: file.name, size: file.size, mime: file.type, total };
    const metaJson = JSON.stringify(meta);
    const { prog } = appendFilePlaceholder({ id, from: state.username, name: file.name, size: file.size, mine: true });

    channels.forEach(dc => { try { dc.send(metaJson); } catch (e) { console.error(e); } });

    for (let i = 0; i < total; i++) {
      const slice = buf.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      let binary = '';
      const bytes = new Uint8Array(slice);
      for (let b = 0; b < bytes.length; b++) binary += String.fromCharCode(bytes[b]);
      const chunkJson = JSON.stringify({ type: 'file-chunk', id, index: i, data: btoa(binary) });
      for (const dc of channels) {
        await waitBufferedLow(dc);
        try { dc.send(chunkJson); } catch (e) { console.error(e); }
      }
      prog.textContent = `Gönderiliyor… ${Math.round(((i + 1) / total) * 100)}%`;
    }
    prog.textContent = 'Gönderildi ✓';
    setTimeout(() => prog.remove(), 1500);
  }

  function toggleChat() {
    state.chatOpen = !state.chatOpen;
    $('#chatPanel').classList.toggle('hidden', !state.chatOpen);
    if (state.chatOpen) {
      clearUnread();
      if (state.username) { $('#chatUsernameRow').style.display = 'none'; $('#chatInputRow').classList.remove('hidden'); }
      $('#chatTextInput').focus();
    }
  }
  function closeChat() { state.chatOpen = false; $('#chatPanel').classList.add('hidden'); }

  function saveUsername() {
    const v = $('#chatUsernameInput').value.trim().slice(0, 24);
    if (!v) { showToast('Lütfen bir ad gir.'); return; }
    state.username = v;
    localStorage.setItem('ebslive_username', v);
    $('#chatUsernameRow').style.display = 'none';
    $('#chatInputRow').classList.remove('hidden');
    showToast('Ad kaydedildi: ' + v);
  }

  function buildEmojiPicker() {
    const wrap = $('#chatEmojiPicker');
    wrap.innerHTML = '';
    EMOJIS.forEach(em => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = em;
      b.addEventListener('click', () => { $('#chatTextInput').value += em; $('#chatTextInput').focus(); });
      wrap.appendChild(b);
    });
  }

  // ================= OLAY BAĞLAMA =================

  $('#startBtn').addEventListener('click', startBroadcast);
  $('#stopBtn').addEventListener('click', stopBroadcast);
  $('#toggleMicBtn').addEventListener('click', toggleMic);
  $('#addViewerBtn').addEventListener('click', addViewerInvite);
  $('#processOfferBtn').addEventListener('click', processHostOffer);
  $('#copyAnswerBtn').addEventListener('click', () => copyTextValue($('#answerOutput').value, 'Cevap kodu'));
  $('#goWatchBtn').addEventListener('click', goToViewerView);
  $('#fullscreenBtn').addEventListener('click', () => {
    const target = $('.remote-stage');
    if (!document.fullscreenElement) target.requestFullscreen?.(); else document.exitFullscreen?.();
  });

  buildEmojiPicker();
  if (state.username) { $('#chatUsernameInput').value = state.username; $('#chatUsernameRow').style.display = 'none'; $('#chatInputRow').classList.remove('hidden'); }
  $('#chatToggleBtn').addEventListener('click', toggleChat);
  $('#chatCloseBtn').addEventListener('click', closeChat);
  $('#chatUsernameSaveBtn').addEventListener('click', saveUsername);
  $('#chatUsernameInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveUsername(); });
  $('#chatSendBtn').addEventListener('click', sendChatText);
  $('#chatTextInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendChatText(); });
  $('#chatEmojiBtn').addEventListener('click', () => $('#chatEmojiPicker').classList.toggle('hidden'));
  $('#chatFileBtn').addEventListener('click', () => $('#chatFileInput').click());
  $('#chatFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) sendChatFile(file);
  });

  addEventListener('beforeunload', () => {
    state.hostConns.forEach(c => c.pc.close());
    state.viewerConn?.close?.();
    cleanupMedia();
  });
})();
