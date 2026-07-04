const FORMATS = {
  post: { label: 'Instagram Gönderi', w: 1080, h: 1080, slug: 'instagram_gonderi' },
  story: { label: 'Instagram Story', w: 1080, h: 1920, slug: 'instagram_story' },
  shorts: { label: 'YouTube Shorts', w: 1080, h: 1920, slug: 'youtube_shorts' },
};

const CDN_CORE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';

const el = (id) => document.getElementById(id);
const state = {
  mainVideos: [],
  bgVideo: null,
  bannerImage: null,
  outroImage: null,
  audioFile: null,
  logoImage: null,
  urls: new Map(),
  ffmpeg: null,
  ffmpegLoaded: false,
  isExporting: false,
  bannerY: 82,
  logoX: 82,
  logoY: 4,
};

const inputs = {
  mainVideos: el('mainVideos'),
  bgVideo: el('bgVideo'),
  bannerImage: el('bannerImage'),
  outroImage: el('outroImage'),
  audioFile: el('audioFile'),
  logoImage: el('logoImage'),
};

function log(msg) {
  const box = el('logBox');
  box.textContent += msg + '\n';
  const lines = box.textContent.split('\n');
  if (lines.length > 120) box.textContent = lines.slice(-120).join('\n');
  box.scrollTop = box.scrollHeight;
}

function setStatus(text, ready = false) {
  el('ffmpegStatus').innerHTML = `<i class="fa-solid fa-circle-dot"></i> ${text}`;
  el('ffmpegStatus').style.background = ready ? '#e9f9ef' : '#eef4ff';
  el('ffmpegStatus').style.color = ready ? '#166534' : '#123b98';
}

function setProgress(percent, text = '') {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  el('exportProgress').style.width = p + '%';
  el('exportPercent').textContent = '%' + p;
  if (text) el('exportText').textContent = text;
}

function slugify(name) {
  return (name || 'video')
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'video';
}

function extOf(file, fallback) {
  const m = file?.name?.match(/\.[a-z0-9]+$/i);
  return m ? m[0].toLowerCase() : fallback;
}

function objectUrl(file) {
  if (!file) return '';
  if (!state.urls.has(file)) state.urls.set(file, URL.createObjectURL(file));
  return state.urls.get(file);
}

function fileLabel(file, empty = 'Seçilmedi') {
  if (!file) return empty;
  return file.name.length > 28 ? file.name.slice(0, 25) + '...' : file.name;
}

function assignFile(kind, fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  if (kind === 'mainVideos') {
    state.mainVideos = files.slice(0, 50);
  } else {
    state[kind] = files[0];
  }
  updateLabels();
  updatePreviewSources();
  updateVideoList();
}

function updateLabels() {
  el('mainVideoLabel').textContent = state.mainVideos.length ? `${state.mainVideos.length} video` : 'Seçilmedi';
  el('bgVideoLabel').textContent = fileLabel(state.bgVideo);
  el('bannerLabel').textContent = fileLabel(state.bannerImage);
  el('outroLabel').textContent = fileLabel(state.outroImage);
  el('audioLabel').textContent = fileLabel(state.audioFile, 'Opsiyonel');
  el('logoLabel').textContent = fileLabel(state.logoImage, 'Opsiyonel');
  el('emptyState').classList.toggle('hide', Boolean(state.mainVideos[0] || state.bgVideo || state.bannerImage || state.outroImage));
}

function updateVideoList() {
  const list = el('videoList');
  list.innerHTML = '';
  if (!state.mainVideos.length) {
    list.innerHTML = '<li class="text-muted">Henüz video eklenmedi.</li>';
    return;
  }
  state.mainVideos.forEach((file, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<span title="${file.name}">${index + 1}. ${file.name}</span><button type="button" title="Sil"><i class="fa-solid fa-xmark"></i></button>`;
    li.querySelector('button').addEventListener('click', () => {
      state.mainVideos.splice(index, 1);
      updateLabels(); updateVideoList(); updatePreviewSources();
    });
    list.appendChild(li);
  });
}

function updatePreviewSources() {
  const main = state.mainVideos[0];
  const bg = state.bgVideo;
  if (main) el('previewMain').src = objectUrl(main);
  if (bg) el('previewBg').src = objectUrl(bg);
  if (state.bannerImage) {
    el('previewBanner').src = objectUrl(state.bannerImage);
    el('previewBanner').style.display = 'block';
  } else el('previewBanner').style.display = 'none';
  if (state.logoImage) {
    el('previewLogo').src = objectUrl(state.logoImage);
    el('previewLogo').style.display = 'block';
  } else el('previewLogo').style.display = 'none';
  if (state.outroImage) el('previewOutro').src = objectUrl(state.outroImage);
  applyLayout();
}

function applyLayout() {
  const stage = el('previewStage');
  const fmt = el('previewFormat').value;
  stage.dataset.format = fmt;

  const main = el('previewMain');
  main.style.width = el('mainScale').value + '%';
  main.style.left = ((100 - Number(el('mainScale').value)) / 2) + '%';
  main.style.top = el('mainTop').value + '%';
  main.classList.toggle('soft-shadow', el('softShadow').checked);

  const banner = el('previewBanner');
  banner.style.width = el('bannerScale').value + '%';
  banner.style.left = ((100 - Number(el('bannerScale').value)) / 2) + '%';
  banner.style.top = state.bannerY + '%';

  const logo = el('previewLogo');
  logo.style.width = el('logoScale').value + '%';
  logo.style.left = state.logoX + '%';
  logo.style.top = state.logoY + '%';
}

function setupInputs() {
  Object.entries(inputs).forEach(([kind, input]) => {
    input.addEventListener('change', () => assignFile(kind, input.files));
  });
  ['mainScale','mainTop','bannerScale','logoScale','softShadow','previewFormat'].forEach(id => {
    el(id).addEventListener('input', applyLayout);
    el(id).addEventListener('change', applyLayout);
  });
  el('btnPreviewPlay').addEventListener('click', playPreview);
  el('btnExport').addEventListener('click', exportAll);
  el('btnSaveProject').addEventListener('click', saveProject);
  el('projectInput').addEventListener('change', openProject);
}

function setupDragDrop() {
  const drop = el('globalDrop');
  ['dragenter','dragover'].forEach(evt => drop.addEventListener(evt, (e) => {
    e.preventDefault(); drop.classList.add('dragover');
  }));
  ['dragleave','drop'].forEach(evt => drop.addEventListener(evt, (e) => {
    e.preventDefault(); drop.classList.remove('dragover');
  }));
  drop.addEventListener('drop', (e) => handleDroppedFiles(Array.from(e.dataTransfer.files || [])));
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    if (!drop.contains(e.target)) {
      e.preventDefault();
      handleDroppedFiles(Array.from(e.dataTransfer.files || []));
    }
  });
}

function handleDroppedFiles(files) {
  if (!files.length) return;
  const videos = files.filter(f => f.type.startsWith('video/'));
  const images = files.filter(f => f.type.startsWith('image/'));
  const audios = files.filter(f => f.type.startsWith('audio/'));

  videos.forEach(file => {
    if (!state.mainVideos.length) state.mainVideos.push(file);
    else if (!state.bgVideo) state.bgVideo = file;
    else if (state.mainVideos.length < 50) state.mainVideos.push(file);
  });
  images.forEach(file => {
    if (!state.bannerImage) state.bannerImage = file;
    else if (!state.outroImage) state.outroImage = file;
    else if (!state.logoImage) state.logoImage = file;
    else state.bannerImage = file;
  });
  audios.forEach(file => { if (!state.audioFile) state.audioFile = file; });

  updateLabels(); updatePreviewSources(); updateVideoList();
}

function setupLayerDragging() {
  let active = null;
  let offsetX = 0, offsetY = 0;
  const stage = el('previewStage');
  [el('previewBanner'), el('previewLogo')].forEach(layer => {
    layer.addEventListener('pointerdown', e => {
      active = layer.id;
      const r = layer.getBoundingClientRect();
      offsetX = e.clientX - r.left;
      offsetY = e.clientY - r.top;
      layer.setPointerCapture(e.pointerId);
    });
  });
  window.addEventListener('pointermove', e => {
    if (!active) return;
    const sr = stage.getBoundingClientRect();
    let x = ((e.clientX - sr.left - offsetX) / sr.width) * 100;
    let y = ((e.clientY - sr.top - offsetY) / sr.height) * 100;
    x = Math.max(0, Math.min(96, x));
    y = Math.max(0, Math.min(96, y));
    if (active === 'previewBanner') state.bannerY = y;
    if (active === 'previewLogo') { state.logoX = x; state.logoY = y; }
    applyLayout();
  });
  window.addEventListener('pointerup', () => { active = null; });
}

function playPreview() {
  const main = el('previewMain');
  const bg = el('previewBg');
  const outro = el('previewOutro');
  if (!main.src) return alert('Önce ana video seçin.');
  outro.classList.remove('show');
  main.currentTime = 0;
  if (bg.src) { bg.currentTime = 0; bg.play().catch(() => {}); }
  main.play().catch(err => alert('Önizleme başlatılamadı: ' + err.message));
}

function setupPreviewTimeline() {
  const main = el('previewMain');
  const seek = el('previewSeek');
  main.addEventListener('loadedmetadata', updateTimeText);
  main.addEventListener('timeupdate', () => {
    if (Number.isFinite(main.duration)) seek.value = (main.currentTime / main.duration) * 100;
    updateTimeText();
  });
  main.addEventListener('ended', () => {
    if (state.outroImage) el('previewOutro').classList.add('show');
  });
  seek.addEventListener('input', () => {
    if (!Number.isFinite(main.duration)) return;
    main.currentTime = (Number(seek.value) / 100) * main.duration;
    el('previewOutro').classList.remove('show');
  });
}

function formatTime(sec) {
  sec = Number.isFinite(sec) ? sec : 0;
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimeText() {
  const main = el('previewMain');
  el('timeText').textContent = `${formatTime(main.currentTime)} / ${formatTime(main.duration)}`;
}

function getSelectedFormats() {
  return Array.from(document.querySelectorAll('.output-format:checked')).map(i => i.value);
}

function getDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(file.name + ' süresi okunamadı.'));
    };
    video.src = url;
  });
}

async function ensureFFmpeg() {
  if (state.ffmpegLoaded) return state.ffmpeg;
  if (!window.FFmpegWASM || !window.FFmpegUtil) {
    throw new Error('Web FFmpeg CDN yüklenemedi. İnternet bağlantısını veya CDN erişimini kontrol edin.');
  }
  setStatus('Web FFmpeg yükleniyor...');
  const ffmpeg = new FFmpegWASM.FFmpeg();
  ffmpeg.on('log', ({ message }) => {
    if (/error|failed|time=|frame=/i.test(message)) log(message);
  });
  ffmpeg.on('progress', ({ progress }) => {
    if (Number.isFinite(progress)) setProgress(progress * 100, 'Render alınıyor');
  });
  const { toBlobURL } = FFmpegUtil;
  await ffmpeg.load({
    coreURL: await toBlobURL(`${CDN_CORE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CDN_CORE}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  state.ffmpeg = ffmpeg;
  state.ffmpegLoaded = true;
  setStatus('Web FFmpeg hazır', true);
  return ffmpeg;
}

function even(n) {
  n = Math.round(n);
  return n % 2 ? n + 1 : n;
}

function buildFilter(format, duration, opts) {
  const w = format.w, h = format.h;
  const transition = opts.transition;
  const outroSeconds = opts.outroSeconds;
  const total = duration + outroSeconds;
  const outDur = outroSeconds + transition;
  const mainW = even(w * (opts.mainScale / 100));
  const mainH = even(h * (format.slug === 'instagram_gonderi' ? 0.72 : 0.76));
  const mainY = even(h * (opts.mainTop / 100));
  const bannerW = even(w * (opts.bannerScale / 100));
  const bannerY = even(h * (state.bannerY / 100));
  const logoW = even(w * (opts.logoScale / 100));
  const logoX = even(w * (state.logoX / 100));
  const logoY = even(h * (state.logoY / 100));
  const fps = 30;
  const parts = [];

  parts.push(`[1:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${fps},trim=0:${duration.toFixed(3)},setpts=PTS-STARTPTS,boxblur=6:1,setsar=1[bg1]`);
  parts.push(`[0:v]scale=${mainW}:${mainH}:force_original_aspect_ratio=decrease,fps=${fps},trim=0:${duration.toFixed(3)},setpts=PTS-STARTPTS,setsar=1[main]`);
  parts.push(`[bg1][main]overlay=(W-w)/2:${mainY}:format=auto[m1]`);
  parts.push(`[2:v]scale=${bannerW}:-1,fps=${fps},trim=0:${duration.toFixed(3)},setpts=PTS-STARTPTS[ban]`);
  parts.push(`[m1][ban]overlay=(W-w)/2:${bannerY}:format=auto[m2]`);
  let last = 'm2';
  if (opts.hasLogo) {
    const logoIndex = opts.hasAudio ? 5 : 4;
    parts.push(`[${logoIndex}:v]scale=${logoW}:-1,fps=${fps},trim=0:${duration.toFixed(3)},setpts=PTS-STARTPTS[logo]`);
    parts.push(`[${last}][logo]overlay=${logoX}:${logoY}:format=auto[m3]`);
    last = 'm3';
  }
  parts.push(`[${last}]format=yuv420p[vmain]`);
  parts.push(`[1:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${fps},trim=0:${outDur.toFixed(3)},setpts=PTS-STARTPTS,boxblur=6:1,setsar=1[bg2]`);
  parts.push(`[3:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,fps=${fps},trim=0:${outDur.toFixed(3)},setpts=PTS-STARTPTS,setsar=1[outimg]`);
  parts.push(`[bg2][outimg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[vout]`);
  const offset = Math.max(0.1, duration - transition);
  parts.push(`[vmain][vout]xfade=transition=${opts.transitionType}:duration=${transition.toFixed(3)}:offset=${offset.toFixed(3)},format=yuv420p[v]`);

  if (opts.audioMode === 'silent') {
    return { filter: parts.join(';'), audioMap: ['-an'] };
  }

  const audioIndex = 4;
  const delay = Math.round(Math.max(0, duration - transition) * 1000);
  const vol = Number(opts.musicVolume).toFixed(2);

  if (opts.hasAudio && opts.audioMode === 'main+outro') {
    parts.push(`[0:a]atrim=0:${duration.toFixed(3)},asetpts=PTS-STARTPTS[maina]`);
    parts.push(`[${audioIndex}:a]volume=${vol},atrim=0:${outDur.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delay}:all=1,atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS[mus]`);
    parts.push(`[maina][mus]amix=inputs=2:duration=longest:dropout_transition=0[a]`);
    return { filter: parts.join(';'), audioMap: ['-map', '[a]', '-c:a', 'aac', '-b:a', '160k'] };
  }

  if (opts.hasAudio && opts.audioMode === 'outro') {
    parts.push(`[${audioIndex}:a]volume=${vol},atrim=0:${outDur.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delay}:all=1,atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS[a]`);
    return { filter: parts.join(';'), audioMap: ['-map', '[a]', '-c:a', 'aac', '-b:a', '160k'] };
  }

  if (opts.hasAudio && opts.audioMode === 'music_all') {
    parts.push(`[${audioIndex}:a]volume=${vol},atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS[a]`);
    return { filter: parts.join(';'), audioMap: ['-map', '[a]', '-c:a', 'aac', '-b:a', '160k'] };
  }

  return { filter: parts.join(';'), audioMap: ['-map', '0:a?', '-c:a', 'aac', '-b:a', '160k'] };
}

function buildCommand(names, format, duration, outName) {
  const transition = Math.max(0.2, Number(el('transitionSeconds').value || 0.7));
  const outroSeconds = Math.max(1, Number(el('outroSeconds').value || 5));
  const opts = {
    transition,
    outroSeconds,
    transitionType: el('transitionType').value,
    audioMode: el('audioMode').value,
    musicVolume: el('musicVolume').value,
    hasAudio: Boolean(names.audio),
    hasLogo: Boolean(names.logo),
    mainScale: Number(el('mainScale').value),
    mainTop: Number(el('mainTop').value),
    bannerScale: Number(el('bannerScale').value),
    logoScale: Number(el('logoScale').value),
  };

  const input = [
    '-i', names.main,
    '-stream_loop', '-1', '-i', names.bg,
    '-loop', '1', '-i', names.banner,
    '-loop', '1', '-t', String(outroSeconds + transition), '-i', names.outro,
  ];
  if (names.audio) input.push('-stream_loop', '-1', '-i', names.audio);
  if (names.logo) input.push('-loop', '1', '-i', names.logo);

  const { filter, audioMap } = buildFilter(format, duration, opts);
  const crf = String(Number(el('crfValue').value || 23));
  return [
    ...input,
    '-filter_complex', filter,
    '-map', '[v]',
    ...audioMap,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', crf,
    '-r', '30',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-shortest',
    outName,
  ];
}

async function writeSharedFiles(ffmpeg) {
  const { fetchFile } = FFmpegUtil;
  const names = {
    bg: 'bg' + extOf(state.bgVideo, '.mp4'),
    banner: 'banner' + extOf(state.bannerImage, '.png'),
    outro: 'outro' + extOf(state.outroImage, '.jpg'),
    audio: state.audioFile ? 'audio' + extOf(state.audioFile, '.mp3') : '',
    logo: state.logoImage ? 'logo' + extOf(state.logoImage, '.png') : '',
  };
  await ffmpeg.writeFile(names.bg, await fetchFile(state.bgVideo));
  await ffmpeg.writeFile(names.banner, await fetchFile(state.bannerImage));
  await ffmpeg.writeFile(names.outro, await fetchFile(state.outroImage));
  if (state.audioFile) await ffmpeg.writeFile(names.audio, await fetchFile(state.audioFile));
  if (state.logoImage) await ffmpeg.writeFile(names.logo, await fetchFile(state.logoImage));
  return names;
}

function validateExport() {
  if (!state.mainVideos.length) throw new Error('En az bir ana video seçin.');
  if (!state.bgVideo) throw new Error('Arka plan videosu seçin.');
  if (!state.bannerImage) throw new Error('Alt şerit PNG/JPG seçin.');
  if (!state.outroImage) throw new Error('Final görseli seçin.');
  const formats = getSelectedFormats();
  if (!formats.length) throw new Error('En az bir çıktı formatı seçin.');
  const audioMode = el('audioMode').value;
  if (['main+outro', 'outro', 'music_all'].includes(audioMode) && !state.audioFile && audioMode !== 'main') {
    log('Uyarı: Ses modu müzik istiyor ama ses dosyası yok; ana video sesi kullanılacak veya sessiz kalabilir.');
  }
  return formats;
}

async function exportAll() {
  if (state.isExporting) return;
  try {
    state.isExporting = true;
    el('btnExport').disabled = true;
    el('logBox').textContent = '';
    setProgress(0, 'Hazırlanıyor');

    const formats = validateExport();
    const ffmpeg = await ensureFFmpeg();
    const shared = await writeSharedFiles(ffmpeg);
    const results = [];
    const totalJobs = state.mainVideos.length * formats.length;
    let job = 0;

    for (const videoFile of state.mainVideos) {
      const { fetchFile } = FFmpegUtil;
      const mainName = 'main' + extOf(videoFile, '.mp4');
      await ffmpeg.writeFile(mainName, await fetchFile(videoFile));
      const duration = await getDuration(videoFile);
      if (!duration) throw new Error(videoFile.name + ' video süresi okunamadı.');

      for (const key of formats) {
        job++;
        const format = FORMATS[key];
        const outName = `${slugify(videoFile.name)}_${format.slug}.mp4`;
        setProgress(0, `${job}/${totalJobs} ${format.label} hazırlanıyor`);
        log(`\n=== ${job}/${totalJobs} | ${videoFile.name} | ${format.label} ===`);
        const cmd = buildCommand({ main: mainName, ...shared }, format, duration, outName);
        log('ffmpeg ' + cmd.join(' '));
        await ffmpeg.exec(cmd);
        const data = await ffmpeg.readFile(outName);
        results.push({ name: outName, blob: new Blob([data], { type: 'video/mp4' }) });
        try { await ffmpeg.deleteFile(outName); } catch (_) {}
      }
      try { await ffmpeg.deleteFile(mainName); } catch (_) {}
    }

    await downloadResults(results);
    setProgress(100, 'Tamamlandı');
    log('\nBitti. Çıktılar indirildi.');
  } catch (err) {
    console.error(err);
    log('\nHATA: ' + err.message);
    alert('Hata: ' + err.message);
    setProgress(0, 'Hata oluştu');
  } finally {
    state.isExporting = false;
    el('btnExport').disabled = false;
  }
}

async function downloadResults(results) {
  if (!results.length) return;
  if (results.length === 1 || !window.JSZip) {
    downloadBlob(results[0].blob, results[0].name);
    return;
  }
  setProgress(98, 'ZIP hazırlanıyor');
  const zip = new JSZip();
  for (const r of results) zip.file(r.name, r.blob);
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'sosyal_video_ciktilar.zip');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function saveProject() {
  const data = {
    version: 'static-1.0',
    layout: {
      mainScale: el('mainScale').value,
      mainTop: el('mainTop').value,
      bannerScale: el('bannerScale').value,
      bannerY: state.bannerY,
      logoScale: el('logoScale').value,
      logoX: state.logoX,
      logoY: state.logoY,
      softShadow: el('softShadow').checked,
    },
    settings: {
      transitionType: el('transitionType').value,
      transitionSeconds: el('transitionSeconds').value,
      outroSeconds: el('outroSeconds').value,
      audioMode: el('audioMode').value,
      musicVolume: el('musicVolume').value,
      crfValue: el('crfValue').value,
      previewFormat: el('previewFormat').value,
      formats: getSelectedFormats(),
    },
    note: 'Dosyalar güvenlik nedeniyle JSON içine kaydedilmez. Projeyi açınca medya dosyalarını tekrar seçmelisin.',
  };
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'sosyal_video_proje.json');
}

async function openProject(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const layout = data.layout || {};
    const settings = data.settings || {};
    if (layout.mainScale) el('mainScale').value = layout.mainScale;
    if (layout.mainTop) el('mainTop').value = layout.mainTop;
    if (layout.bannerScale) el('bannerScale').value = layout.bannerScale;
    if (layout.logoScale) el('logoScale').value = layout.logoScale;
    if (typeof layout.bannerY === 'number') state.bannerY = layout.bannerY;
    if (typeof layout.logoX === 'number') state.logoX = layout.logoX;
    if (typeof layout.logoY === 'number') state.logoY = layout.logoY;
    if (typeof layout.softShadow === 'boolean') el('softShadow').checked = layout.softShadow;
    ['transitionType','transitionSeconds','outroSeconds','audioMode','musicVolume','crfValue','previewFormat'].forEach(id => {
      if (settings[id] !== undefined) el(id).value = settings[id];
    });
    document.querySelectorAll('.output-format').forEach(cb => { cb.checked = (settings.formats || []).includes(cb.value); });
    applyLayout();
    log('Proje ayarları açıldı. Medya dosyalarını tekrar seçmelisin.');
  } catch (err) {
    alert('Proje açılamadı: ' + err.message);
  }
}

function init() {
  setupInputs();
  setupDragDrop();
  setupLayerDragging();
  setupPreviewTimeline();
  updateLabels(); updateVideoList(); applyLayout();
  setStatus('Web FFmpeg export için yüklenecek');
}

document.addEventListener('DOMContentLoaded', init);
