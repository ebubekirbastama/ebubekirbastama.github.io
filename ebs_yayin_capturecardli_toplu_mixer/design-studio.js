// EBS Live Şablon Stüdyosu V1.1 / V5.1 uyumlu
(() => {
  'use strict';
  const $ = (q) => document.querySelector(q);

  const toast = $('#toast');
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function setStatus(elId, msg, kind) {
    const el = $(elId);
    if (!el) return;
    el.textContent = msg;
    el.className = 'ds-status' + (kind ? ' ' + kind : '');
  }

  // ---------------------------------------------------------------
  // Varsayılan yerleşim yardımcıları (ana app.js ile aynı mantık,
  // bağımsız kopya — bu sayfa app.js'ten habersiz çalışır)
  // ---------------------------------------------------------------
  function layoutRow(n) {
    const margin = 30 / 1920, gap = 20 / 1920, top = 190 / 1080, boxH = 540 / 1080;
    const boxW = (1 - margin * 2 - (n - 1) * gap) / n;
    return Array.from({ length: n }, (_, i) => ({ x: margin + i * (boxW + gap), y: top, w: boxW, h: boxH }));
  }
  function layoutDual() {
    const boxW = 890 / 1920, boxH = 460 / 1080, gap = 40 / 1920, top = 190 / 1080;
    const x1 = (1 - boxW * 2 - gap) / 2, x2 = x1 + boxW + gap;
    return [{ x: x1, y: top, w: boxW, h: boxH }, { x: x2, y: top, w: boxW, h: boxH }];
  }
  function defaultCamRects(n) { return n === 2 ? layoutDual() : layoutRow(n); }
  function guestDefault(camRect, kind) {
    const inset = Math.min(0.012, camRect.w * 0.04);
    const nameH = Math.min(0.052, Math.max(0.032, camRect.h * 0.12));
    const titleH = Math.min(0.042, Math.max(0.026, camRect.h * 0.09));
    if (kind === 'name') return { x: camRect.x + inset, y: Math.max(camRect.y, camRect.y + camRect.h - nameH - titleH - 0.012), w: Math.max(0.08, camRect.w - inset * 2), h: nameH, visible: true, fontSize: 24 };
    return { x: camRect.x + inset, y: Math.max(camRect.y, camRect.y + camRect.h - titleH - 0.008), w: Math.max(0.08, camRect.w - inset * 2), h: titleH, visible: true, fontSize: 16 };
  }
  function fallbackLayout(n) {
    const cams = defaultCamRects(n).map(r => ({ ...r, visible: true }));
    return {
      bgImage: null,
      bg: { fit: 'cover', x: .5, y: .5, scale: 1, opacity: 1 },
      layers: {
        cams,
        liveBadge: { x: 20 / 1920, y: 30 / 1080, w: 300 / 1920, h: 60 / 1080, visible: true, fontSize: 30, text: '● CANLI YAYIN' },
        programName: { x: .35, y: 22 / 1080, w: .30, h: 56 / 1080, visible: true, fontSize: 44, text: 'ÖZEL YAYIN' },
        programTagline: { x: .33, y: 76 / 1080, w: .34, h: 38 / 1080, visible: true, fontSize: 18, text: 'GÜNDEM • RÖPORTAJ • ANALİZ' },
        title: { x: 40 / 1920, y: 786 / 1080, w: 1840 / 1920, h: 90 / 1080, visible: true, fontSize: 54 },
        subtitle: { x: 40 / 1920, y: 876 / 1080, w: 1840 / 1920, h: 70 / 1080, visible: true, fontSize: 24 },
        ticker: { x: 0, y: 730 / 1080, w: 1, h: 56 / 1080, visible: true, fontSize: 22 },
        socials: { x: 0, y: 946 / 1080, w: 1, h: 60 / 1080, visible: true, fontSize: 20 },
        guestNames: cams.map(c => guestDefault(c, 'name')),
        guestTitles: cams.map(c => guestDefault(c, 'title')),
        custom: []
      },
      fontSizes: { title: 54, subtitle: 24, ticker: 22, guest: 24, guestTitle: 16, socials: 20 }
    };
  }

  // ---------------------------------------------------------------
  // Canvas render motoru (kamera yerine gri "Kamera N" yer tutucusu)
  // ---------------------------------------------------------------
  const canvas = $('#dsCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  let tickerX = canvas.width;
  let rafId = null;
  let current = null; // { templateLayout, texts, camCount, bgImg }
  let lastDrawTs = 0;
  let lastTickerTs = 0;
  const customImageCache = new Map();

  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }

  function drawLayerText(rect, text, opts = {}) {
    if (!rect || rect.visible === false || !text) return;
    const W = canvas.width, H = canvas.height;
    const x = rect.x * W, y = rect.y * H, w = rect.w * W, h = rect.h * H;
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
  }

  function drawCamPlaceholder(rect, index) {
    if (!rect || rect.visible === false) return;
    const W = canvas.width, H = canvas.height;
    const x = rect.x * W, y = rect.y * H, w = rect.w * W, h = rect.h * H;
    ctx.save();
    roundRect(ctx, x, y, w, h, 6); ctx.clip();
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#182634'); grad.addColorStop(1, '#0a121b');
    ctx.fillStyle = grad; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(99,220,255,.5)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 26px Inter, sans-serif';
    ctx.fillText(`📷 Kamera ${index + 1}`, x + w / 2, y + h / 2);
    ctx.font = '400 13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(180,210,225,.5)';
    ctx.fillText('canlı görüntü buraya gelecek', x + w / 2, y + h / 2 + 30);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 6); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
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

  function draw(ts = performance.now()) {
    if (!current) return;
    rafId = requestAnimationFrame(draw);
    if (ts - lastDrawTs < 1000 / 30) return;
    const dt = lastTickerTs ? Math.min(.1, (ts - lastTickerTs) / 1000) : 1 / 30;
    lastTickerTs = ts;
    lastDrawTs = ts;
    const { templateLayout: T, texts, camCount } = current;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
    if (current.bgImg && current.bgImg.complete && current.bgImg.naturalWidth) {
      const m = backgroundDrawMetrics(current.bgImg.naturalWidth, current.bgImg.naturalHeight, W, H, T.bg || { fit: 'cover', x: .5, y: .5, scale: 1, opacity: 1 });
      ctx.save();
      ctx.globalAlpha = T.bg?.opacity ?? 1;
      ctx.drawImage(current.bgImg, m.x, m.y, m.w, m.h);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 0, W, H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#1a0206'); grad.addColorStop(1, '#000');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    }

    const L = T.layers;
    if (L.liveBadge) drawLayerText(L.liveBadge, L.liveBadge.text, { background: '#df1735', weight: 800, color: '#fff' });
    if (L.programName) drawLayerText(L.programName, L.programName.text, { weight: 800, color: '#df1735', align: 'center' });
    if (L.programTagline) drawLayerText(L.programTagline, L.programTagline.text, { weight: 600, color: '#fff', align: 'center' });

    (L.cams || []).slice(0, camCount).forEach((rect, i) => drawCamPlaceholder(rect, i));
    (L.guestNames || []).forEach((rect, i) => drawLayerText(rect, texts[`tplGuest${i + 1}Name`] || `Konuk ${i + 1}`, { background: 'rgba(10,10,10,.82)', accent: '#df1735', weight: 700 }));
    (L.guestTitles || []).forEach((rect, i) => drawLayerText(rect, texts[`tplGuest${i + 1}Title`] || 'Ünvan / Görev', { background: 'rgba(10,10,10,.78)', color: '#d2d2d2', weight: 400 }));

    const tR = L.ticker;
    if (tR && tR.visible !== false) {
      const tx = tR.x * W, ty = tR.y * H, tw = tR.w * W, th = tR.h * H;
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(tx, ty, tw, th);
      const badgeW = Math.min(200, tw * .28);
      ctx.fillStyle = '#df1735'; ctx.fillRect(tx, ty, badgeW, th);
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(12, Math.min(22, tR.fontSize || 22))}px Inter, sans-serif`;
      ctx.textBaseline = 'middle'; ctx.fillText('SON DURUM', tx + 24, ty + th / 2);
      const tickerText = texts.tplTicker || 'son durum • son durum • son durum';
      ctx.save(); ctx.beginPath(); ctx.rect(tx + badgeW + 10, ty, Math.max(0, tw - badgeW - 10), th); ctx.clip();
      ctx.fillStyle = '#111'; ctx.font = `700 ${tR.fontSize || 22}px Inter, sans-serif`;
      ctx.fillText(tickerText, tickerX, ty + th / 2);
      const tickerWidth = ctx.measureText(tickerText).width;
      ctx.restore();
      tickerX -= 96 * dt;
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
    if (L.title) drawLayerText(L.title, texts.tplTitle || 'YAYIN BAŞLIĞI BURAYA GELECEK', { weight: 800, color: '#fff' });
    if (L.subtitle) drawLayerText(L.subtitle, texts.tplSubtitle || 'Alt başlık / açıklama metni buraya gelecek', { weight: 400, color: '#d9d9d9' });

    const soR = L.socials;
    if (soR && soR.visible !== false) {
      const sox = soR.x * W, soy = soR.y * H, sow = soR.w * W, soh = soR.h * H;
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(sox, soy, sow, soh);
      ctx.font = `600 ${soR.fontSize || 20}px Inter, sans-serif`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
      const socials = [`▶ ${texts.tplYoutube || '/kanaladiniz'}`, `𝕏 ${texts.tplTwitter || '/kanaladiniz'}`, `f ${texts.tplFacebook || '/kanaladiniz'}`, `◎ ${texts.tplInstagram || '/kanaladiniz'}`];
      const seg = sow / socials.length;
      socials.forEach((t, i) => ctx.fillText(t, sox + seg * i + 28, soy + soh / 2, Math.max(20, seg - 42)));
      ctx.textBaseline = 'alphabetic';
    }

    (L.custom || []).forEach(rect => {
      if (rect.visible === false) return;
      if (rect.type === 'image') {
        const img = customImageCache.get(String(rect.id));
        if (!img?.complete || !img.naturalWidth) return;
        const W2 = canvas.width, H2 = canvas.height;
        const x = rect.x * W2, y = rect.y * H2, w = rect.w * W2, h = rect.h * H2;
        ctx.save();
        ctx.globalAlpha = rect.opacity ?? 1;
        try { ctx.drawImage(img, x, y, w, h); } catch (e) {}
        ctx.restore();
      } else if (rect.type !== 'image') {
        drawLayerText(rect, rect.text || 'Metin', { background: 'rgba(0,0,0,.42)', weight: rect.weight || 700, color: rect.color || '#fff' });
      }
    });

  }

  function isSafeImageSrc(src) {
    return typeof src === 'string' && (/^data:image\//i.test(src) || /^blob:/i.test(src));
  }

  function hydrateCustomImages(templateLayout) {
    const valid = new Set();
    (templateLayout?.layers?.custom || []).forEach(rect => {
      if (rect.type !== 'image' || !isSafeImageSrc(rect.src)) return;
      const id = String(rect.id);
      valid.add(id);
      const cached = customImageCache.get(id);
      if (cached?.__ebsSource === rect.src) return;
      const img = new Image();
      img.decoding = 'async';
      img.__ebsSource = rect.src;
      img.src = rect.src;
      customImageCache.set(id, img);
    });
    [...customImageCache.keys()].forEach(id => { if (!valid.has(id)) customImageCache.delete(id); });
  }

  function setPreview(templateLayout, texts, camCount) {
    cancelAnimationFrame(rafId);
    let bgImg = null;
    if (templateLayout.bgImage && isSafeImageSrc(templateLayout.bgImage)) {
      bgImg = new Image();
      bgImg.src = templateLayout.bgImage;
    } else if (templateLayout.bgImage) {
      templateLayout.bgImage = null;
    }
    hydrateCustomImages(templateLayout);
    current = { templateLayout, texts: texts || {}, camCount: camCount || (templateLayout.layers?.cams?.length) || 2, bgImg };
    $('#dsEmptyState')?.classList.add('hidden');
    $('#dsCamCountBadge').textContent = `${current.camCount} kamera`;
    tickerX = canvas.width;
    lastDrawTs = 0; lastTickerTs = 0;
    rafId = requestAnimationFrame(draw);
    updateJsonOutput();
  }

  function updateJsonOutput() {
    if (!current) return;
    const out = { version: 5, camCount: current.camCount, templateLayout: current.templateLayout, texts: current.texts };
    $('#dsJsonOutput').value = JSON.stringify(out, null, 2);
  }

  // ---------------------------------------------------------------
  // 1) JSON yükleme
  // ---------------------------------------------------------------
  $('#dsJsonInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const templateLayout = data.templateLayout || data;
        const texts = data.texts || {};
        const camCount = data.camCount || templateLayout.layers?.cams?.length || 2;
        if (!templateLayout.layers) throw new Error('Geçersiz şablon yapısı (layers eksik).');
        setPreview(templateLayout, texts, camCount);
        setStatus('#dsJsonStatus', `"${file.name}" yüklendi ve önizlendi.`, 'ok');
        showToast('JSON şablon yüklendi.');
      } catch (err) {
        setStatus('#dsJsonStatus', 'Dosya okunamadı: geçerli bir EBS Live şablon JSON\'u değil.', 'err');
        showToast('JSON okunamadı.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ---------------------------------------------------------------
  // 2) HTML -> JSON dönüştürücü
  // ---------------------------------------------------------------
  function rectOfEl(el, stageRect, W, H) {
    const r = el.getBoundingClientRect();
    return {
      x: (r.left - stageRect.left) / W,
      y: (r.top - stageRect.top) / H,
      w: Math.max(0.01, r.width / W),
      h: Math.max(0.01, r.height / H)
    };
  }

  async function toDataUrl(url, doc) {
    try {
      const res = await fetch(new URL(url, doc.baseURI));
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    } catch (e) { return null; }
  }

  async function convertHtmlToTemplate(htmlText) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-99999px;top:0;width:1920px;height:1080px;border:0;visibility:hidden;';
      // Yüklenen HTML yalnızca layout/CSS okumak için çalıştırılır; script ve aktif içerik çalışamaz.
      iframe.setAttribute('sandbox', 'allow-same-origin');
      iframe.referrerPolicy = 'no-referrer';
      document.body.appendChild(iframe);
      iframe.addEventListener('load', async () => {
        try {
          const doc = iframe.contentDocument;
          const win = iframe.contentWindow;
          const stage = doc.querySelector('[data-stage]') || doc.body;
          const stageRect = stage.getBoundingClientRect();
          const W = stageRect.width || 1920, H = stageRect.height || 1080;
          const nodes = [...stage.querySelectorAll('[data-layer-type]')];
          if (!nodes.length) throw new Error('Hiçbir [data-layer-type] elementi bulunamadı. Kural için sayfadaki açıklamaya bak.');

          const layout = fallbackLayout(2);
          layout.layers.title = null; layout.layers.subtitle = null; layout.layers.ticker = null; layout.layers.socials = null;
          layout.layers.guestNames = []; layout.layers.guestTitles = []; layout.layers.custom = [];
          const texts = {};
          const camEntries = [];

          for (let idx = 0; idx < nodes.length; idx++) {
            const el = nodes[idx];
            const type = el.dataset.layerType;
            const rect = rectOfEl(el, stageRect, W, H);
            const cs = win.getComputedStyle(el);
            const fontSize = parseFloat(cs.fontSize) || 24;
            const color = cs.color || '#ffffff';
            const weight = parseInt(cs.fontWeight, 10) || 400;
            const field = el.dataset.field || '';
            const text = (el.textContent || '').trim();

            if (type === 'camera') {
              const ci = el.dataset.camIndex != null ? parseInt(el.dataset.camIndex, 10) : camEntries.length;
              camEntries[ci] = { ...rect, visible: true, locked: false };
            } else if (type === 'ticker') {
              layout.layers.ticker = { ...rect, visible: true, fontSize };
              if (text) texts.tplTicker = text;
            } else if (type === 'image') {
              const img = el.querySelector('img');
              let src = img ? img.getAttribute('src') : el.dataset.src;
              if (src && !/^data:image\//i.test(src) && !/^blob:/i.test(src)) src = await toDataUrl(src, doc);
              if (src && (/^data:image\//i.test(src) || /^blob:/i.test(src))) {
                layout.layers.custom.push({ id: `img-${idx}`, type: 'image', src, x: rect.x, y: rect.y, w: rect.w, h: rect.h, visible: true });
              }
            } else if (type === 'text' || type === 'custom') {
              if (field === 'title') { layout.layers.title = { ...rect, visible: true, fontSize, color, weight }; if (text) texts.tplTitle = text; }
              else if (field === 'subtitle') { layout.layers.subtitle = { ...rect, visible: true, fontSize, color, weight }; if (text) texts.tplSubtitle = text; }
              else if (field === 'socials') { layout.layers.socials = { ...rect, visible: true, fontSize }; }
              else if (/^guest\d+Name$/.test(field)) {
                const gi = parseInt(field.match(/\d+/)[0], 10) - 1;
                layout.layers.guestNames[gi] = { ...rect, visible: true, fontSize };
                if (text) texts[`tplGuest${gi + 1}Name`] = text;
              } else if (/^guest\d+Title$/.test(field)) {
                const gi = parseInt(field.match(/\d+/)[0], 10) - 1;
                layout.layers.guestTitles[gi] = { ...rect, visible: true, fontSize };
                if (text) texts[`tplGuest${gi + 1}Title`] = text;
              } else if (field === 'youtube' || field === 'twitter' || field === 'facebook' || field === 'instagram') {
                texts[`tpl${field[0].toUpperCase()}${field.slice(1)}`] = text;
              } else {
                layout.layers.custom.push({ id: `custom-${idx}`, text: text || 'Metin', x: rect.x, y: rect.y, w: rect.w, h: rect.h, visible: true, fontSize, color, weight });
              }
            }
          }

          const highestCamIndex = camEntries.reduce((max, entry, i) => entry ? Math.max(max, i + 1) : max, 0);
          const camCount = Math.max(2, Math.min(5, highestCamIndex || 2));
          const defaults = defaultCamRects(camCount);
          layout.layers.cams = Array.from({ length: camCount }, (_, i) => camEntries[i] || { ...defaults[i], visible: true, locked: false });
          layout.layers.guestNames = Array.from({ length: camCount }, (_, i) => layout.layers.guestNames[i] || guestDefault(layout.layers.cams[i], 'name'));
          layout.layers.guestTitles = Array.from({ length: camCount }, (_, i) => layout.layers.guestTitles[i] || guestDefault(layout.layers.cams[i], 'title'));
          layout.layers.title ||= { x: 40 / 1920, y: 786 / 1080, w: 1840 / 1920, h: 90 / 1080, visible: true, fontSize: 54 };
          layout.layers.subtitle ||= { x: 40 / 1920, y: 876 / 1080, w: 1840 / 1920, h: 70 / 1080, visible: true, fontSize: 24 };
          layout.layers.ticker ||= { x: 0, y: 730 / 1080, w: 1, h: 56 / 1080, visible: true, fontSize: 22 };
          layout.layers.socials ||= { x: 0, y: 946 / 1080, w: 1, h: 60 / 1080, visible: true, fontSize: 20 };

          document.body.removeChild(iframe);
          resolve({ camCount, templateLayout: layout, texts, warnings: [] });
        } catch (err) {
          document.body.removeChild(iframe);
          reject(err);
        }
      });
      const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; object-src 'none'; frame-src 'none'; media-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
      iframe.srcdoc = /<head[\s>]/i.test(htmlText)
        ? htmlText.replace(/<head([^>]*)>/i, `<head$1>${csp}`)
        : csp + htmlText;
    });
  }

  $('#dsHtmlInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('#dsHtmlStatus', 'Dönüştürülüyor…', '');
    try {
      const text = await file.text();
      const { camCount, templateLayout, texts } = await convertHtmlToTemplate(text);
      setPreview(templateLayout, texts, camCount);
      setStatus('#dsHtmlStatus', `"${file.name}" başarıyla ${camCount} kameralı şablona çevrildi.`, 'ok');
      showToast('HTML tasarımı JSON şablona çevrildi.');
    } catch (err) {
      setStatus('#dsHtmlStatus', 'Dönüştürülemedi: ' + (err.message || err), 'err');
      showToast('HTML dönüştürme hatası.');
    }
    e.target.value = '';
  });

  // ---------------------------------------------------------------
  // JSON çıktısı: kopyala / indir
  // ---------------------------------------------------------------
  $('#dsCopyJsonBtn').addEventListener('click', async () => {
    const val = $('#dsJsonOutput').value;
    if (!val) { showToast('Önce bir şablon yükle.'); return; }
    try { await navigator.clipboard.writeText(val); showToast('JSON kopyalandı.'); }
    catch { $('#dsJsonOutput').select(); document.execCommand('copy'); showToast('JSON kopyalandı.'); }
  });

  $('#dsDownloadJsonBtn').addEventListener('click', () => {
    const val = $('#dsJsonOutput').value;
    if (!val) { showToast('Önce bir şablon yükle.'); return; }
    const blob = new Blob([val], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ebslive-sablon.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('JSON indirildi.');
  });

  // ---------------------------------------------------------------
  // Örnek HTML şablonu (indirilebilir başlangıç dosyası)
  // ---------------------------------------------------------------
  const SAMPLE_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<style>
  body{margin:0;background:#000}
  .stage{position:relative;width:1920px;height:1080px;background:#0a0507;font-family:Arial,sans-serif;overflow:hidden}
  .cam{position:absolute;background:#182634;border:3px solid #fff;border-radius:6px}
  .txt{position:absolute;color:#fff;display:flex;align-items:center}
  .title{font-size:54px;font-weight:800}
  .subtitle{font-size:24px;color:#d9d9d9}
  .ticker{font-size:22px;font-weight:700;color:#111;background:#e8e8e8}
  .guestname{font-size:24px;font-weight:700;background:rgba(10,10,10,.82);padding-left:20px}
  .guesttitle{font-size:16px;color:#d2d2d2;background:rgba(10,10,10,.78);padding-left:20px}
  .badge{font-size:30px;font-weight:800;color:#fff;background:#df1735;padding-left:20px}
</style>
</head>
<body>
  <div class="stage" data-stage>
    <div class="cam" data-layer-type="camera" data-cam-index="0" style="left:50px;top:190px;width:890px;height:460px;"></div>
    <div class="cam" data-layer-type="camera" data-cam-index="1" style="left:980px;top:190px;width:890px;height:460px;"></div>

    <div class="txt guestname" data-layer-type="text" data-field="guest1Name" style="left:50px;top:610px;width:890px;height:44px;">Konuk 1</div>
    <div class="txt guesttitle" data-layer-type="text" data-field="guest1Title" style="left:50px;top:652px;width:890px;height:36px;">Ünvan / Görev</div>
    <div class="txt guestname" data-layer-type="text" data-field="guest2Name" style="left:980px;top:610px;width:890px;height:44px;">Konuk 2</div>
    <div class="txt guesttitle" data-layer-type="text" data-field="guest2Title" style="left:980px;top:652px;width:890px;height:36px;">Ünvan / Görev</div>

    <div class="txt badge" data-layer-type="text" style="left:20px;top:30px;width:300px;height:60px;">● CANLI YAYIN</div>
    <div class="txt title" data-layer-type="text" data-field="title" style="left:40px;top:786px;width:1840px;height:90px;">YAYIN BAŞLIĞI BURAYA GELECEK</div>
    <div class="txt subtitle" data-layer-type="text" data-field="subtitle" style="left:40px;top:876px;width:1840px;height:70px;">Alt başlık / açıklama metni</div>
    <div class="txt ticker" data-layer-type="ticker" data-field="ticker" style="left:0;top:730px;width:1920px;height:56px;padding-left:210px;">son durum • son durum • son durum</div>
  </div>
</body>
</html>`;

  const sampleBlob = new Blob([SAMPLE_HTML], { type: 'text/html' });
  $('#dsSampleDownload').href = URL.createObjectURL(sampleBlob);

  // Başlangıçta boş durum mesajı gösterilir; kullanıcı bir dosya yükleyince önizleme başlar.
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
})();
