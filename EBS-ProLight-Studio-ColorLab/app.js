(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const on = (element, eventName, handler, options) => {
    if (element) element.addEventListener(eventName, handler, options);
  };

  const els = {
    fileInput: $("#fileInput"),
    openBtn: $("#openBtn"),
    emptyOpenBtn: $("#emptyOpenBtn"),
    emptyState: $("#emptyState"),
    canvasStage: $("#canvasStage"),
    canvasScroller: $("#canvasScroller"),
    displayCanvas: $("#displayCanvas"),
    compareLine: $("#compareLine"),
    brushCursor: $("#brushCursor"),
    statusPill: $("#statusPill"),
    statusText: $("#statusText"),
    imageInfo: $("#imageInfo"),
    compareRange: $("#compareRange"),
    zoomRange: $("#zoomRange"),
    zoomValue: $("#zoomValue"),
    beforeHoldBtn: $("#beforeHoldBtn"),
    fitBtn: $("#fitBtn"),
    histogramCanvas: $("#histogramCanvas"),
    toneCurveCanvas: $("#toneCurveCanvas"),
    undoBtn: $("#undoBtn"),
    redoBtn: $("#redoBtn"),
    resetAllBtn: $("#resetAllBtn"),
    autoToneBtn: $("#autoToneBtn"),
    bwModeBtn: $("#bwModeBtn"),
    hdrModeBtn: $("#hdrModeBtn"),
    profileSelect: $("#profileSelect"),
    removeCA: $("#removeCA"),
    enableLensCorrections: $("#enableLensCorrections"),
    clearMaskBtn: $("#clearMaskBtn"),
    brushSizeRange: $("#brushSizeRange"),
    brushSizeOutput: $("#brushSizeOutput"),
    brushOpacityRange: $("#brushOpacityRange"),
    brushOpacityOutput: $("#brushOpacityOutput"),
    brushFeatherRange: $("#brushFeatherRange"),
    brushFeatherOutput: $("#brushFeatherOutput"),
    rotateLeftBtn: $("#rotateLeftBtn"),
    rotateRightBtn: $("#rotateRightBtn"),
    flipHBtn: $("#flipHBtn"),
    flipVBtn: $("#flipVBtn"),
    exportName: $("#exportName"),
    exportFormat: $("#exportFormat"),
    exportBtn: $("#exportBtn"),
    toast: $("#appToast"),
    toastText: $("#toastText"),
    metaIso: $("#metaIso"),
    metaFocal: $("#metaFocal"),
    metaAperture: $("#metaAperture"),
    metaShutter: $("#metaShutter"),
    colorLabContent: $("#colorLabContent"),
    resetColorLabBtn: $("#resetColorLabBtn"),
  };

  if (!els.displayCanvas) {
    console.error("ProLight Studio: #displayCanvas bulunamadı.");
    return;
  }

  const displayCtx = els.displayCanvas.getContext("2d", { willReadFrequently: true });
  const sourceCanvas = document.createElement("canvas");
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const processedCanvas = document.createElement("canvas");
  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  const overlayCanvas = document.createElement("canvas");
  const overlayCtx = overlayCanvas.getContext("2d");
  const gamutCanvas = document.createElement("canvas");
  const gamutCtx = gamutCanvas.getContext("2d", { willReadFrequently: true });
  const previewFxCanvas = document.createElement("canvas");
  const previewFxCtx = previewFxCanvas.getContext("2d", { willReadFrequently: true });

  const DEFAULTS = Object.freeze({
    exposure: 0,
    brightness: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    temperature: 0,
    tint: 0,
    vibrance: 0,
    saturation: 0,
    texture: 0,
    clarity: 0,
    dehaze: 0,
    vignette: 0,
    grain: 0,
    redMix: 0,
    greenMix: 0,
    blueMix: 0,
    shadowsHue: 0,
    midtonesHue: 0,
    highlightsHue: 0,
    sharpness: 0,
    noiseReduction: 0,
    colorNoiseReduction: 0,
    lensBlurAmount: 0,
    lensBlurBokeh: 0,
    redPrimaryHue: 0,
    greenPrimaryHue: 0,
    bluePrimaryHue: 0,
  });

  const DEFAULT_CURVE = Object.freeze([0, 0.25, 0.5, 0.75, 1]);
  const HSL_COLORS = Object.freeze({
    red: { label: "Kırmızı", hue: 0 },
    orange: { label: "Turuncu", hue: 30 },
    yellow: { label: "Sarı", hue: 60 },
    green: { label: "Yeşil", hue: 120 },
    aqua: { label: "Aqua", hue: 180 },
    blue: { label: "Mavi", hue: 240 },
    purple: { label: "Mor", hue: 280 },
    magenta: { label: "Magenta", hue: 320 },
  });
  const SELECTIVE_GROUPS = Object.freeze({
    reds: "Reds", yellows: "Yellows", greens: "Greens", cyans: "Cyans",
    blues: "Blues", magentas: "Magentas", whites: "Whites", neutrals: "Neutrals", blacks: "Blacks",
  });

  function createDefaultColorLab() {
    const hsl = {};
    Object.keys(HSL_COLORS).forEach(key => { hsl[key] = { hue: 0, saturation: 0, luminance: 0 }; });
    const selective = {};
    Object.keys(SELECTIVE_GROUPS).forEach(key => { selective[key] = { cyan: 0, magenta: 0, yellow: 0, black: 0 }; });
    return {
      hsl,
      replacement: {
        enabled: false,
        source: [255, 80, 80],
        target: "#35a7ff",
        tolerance: 24,
        softness: 35,
        amount: 100,
        preserveLightness: true,
      },
      curves: {
        red: [...DEFAULT_CURVE],
        green: [...DEFAULT_CURVE],
        blue: [...DEFAULT_CURVE],
      },
      balance: {
        shadows: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
        midtones: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
        highlights: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
      },
      grading: {
        shadows: { hue: 220, saturation: 0, luminance: 0 },
        midtones: { hue: 35, saturation: 0, luminance: 0 },
        highlights: { hue: 48, saturation: 0, luminance: 0 },
        blending: 50,
        balance: 0,
      },
      selective,
      mixer: {
        red: { red: 100, green: 0, blue: 0, constant: 0 },
        green: { red: 0, green: 100, blue: 0, constant: 0 },
        blue: { red: 0, green: 0, blue: 100, constant: 0 },
      },
      lut: { enabled: false, name: "", intensity: 100, size: 0, data: null },
      filmLook: "none",
      skinProtect: { enabled: false, amount: 65 },
      colorMask: { enabled: false, source: [255, 80, 80], tolerance: 25, softness: 35 },
      rangeMask: { enabled: false, hueMin: 0, hueMax: 360, satMin: 0, satMax: 100, lumMin: 0, lumMax: 100 },
      gamutWarning: false,
      softProof: "none",
      outputSpace: "srgb",
      colorBlind: "none",
      harmony: "complementary",
    };
  }

  function cloneColorLab(source = state?.colorLab) {
    const base = createDefaultColorLab();
    if (!source) return base;
    const clone = JSON.parse(JSON.stringify(source, (key, value) => key === "data" ? null : value));
    const merged = {
      ...base,
      ...clone,
      hsl: { ...base.hsl, ...(clone.hsl || {}) },
      curves: { ...base.curves, ...(clone.curves || {}) },
      balance: { ...base.balance, ...(clone.balance || {}) },
      grading: { ...base.grading, ...(clone.grading || {}) },
      selective: { ...base.selective, ...(clone.selective || {}) },
      mixer: { ...base.mixer, ...(clone.mixer || {}) },
      replacement: { ...base.replacement, ...(clone.replacement || {}) },
      skinProtect: { ...base.skinProtect, ...(clone.skinProtect || {}) },
      colorMask: { ...base.colorMask, ...(clone.colorMask || {}) },
      rangeMask: { ...base.rangeMask, ...(clone.rangeMask || {}) },
      lut: { ...base.lut, ...(clone.lut || {}), data: source.lut?.data || null },
    };
    return merged;
  }

  const state = {
    image: null,
    objectUrl: null,
    fileName: "fotograf",
    fileType: "image/jpeg",
    fullWidth: 0,
    fullHeight: 0,
    settings: { ...DEFAULTS },
    transform: { rotation: 0, flipX: false, flipY: false },
    profile: "adobe-color",
    bw: false,
    hdr: false,
    options: {
      removeCA: false,
      lensCorrections: false,
    },
    curve: [...DEFAULT_CURVE],
    colorLab: createDefaultColorLab(),
    colorUi: {
      hslColor: "red",
      curveChannel: "master",
      balanceZone: "shadows",
      selectiveGroup: "reds",
      mixerOutput: "red",
      pickMode: null,
      curvePoint: null,
      palette: [],
      paletteBase: null,
    },
    tool: "adjust",
    compare: 0,
    showOriginal: false,
    zoom: 100,
    brushMode: "paint",
    brushSize: 120,
    brushOpacity: 45,
    brushFeather: 70,
    isPainting: false,
    lastPoint: null,
    curvePoint: null,
    renderTimer: null,
    renderVersion: 0,
    history: [],
    historyIndex: -1,
    maxHistory: 20,
  };

  const toast = window.bootstrap && els.toast
    ? new window.bootstrap.Toast(els.toast, { delay: 2400 })
    : null;

  function notify(message) {
    if (els.toastText) els.toastText.textContent = message;
    if (toast) toast.show();
    else console.info(message);
  }

  function setStatus(text, mode = "") {
    if (els.statusText) els.statusText.textContent = text;
    if (!els.statusPill) return;
    els.statusPill.classList.remove("ready", "working");
    if (mode) els.statusPill.classList.add(mode);
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  function mix(a, b, amount) {
    return a + (b - a) * amount;
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / Math.max(1e-6, edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function luminance(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function hslHueToRgb(hue) {
    const h = (((hue % 360) + 360) % 360) / 360;
    const channel = n => {
      const k = (n + h * 12) % 12;
      return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [channel(0), channel(8), channel(4)];
  }

  function formatValue(key, value) {
    const number = Number(value);
    if (key === "exposure") return number.toFixed(2);
    if (["shadowsHue", "midtonesHue", "highlightsHue"].includes(key)) {
      return `${Math.round(number)}°`;
    }
    return `${Math.round(number)}`;
  }

  function currentRenderConfig() {
    return {
      profile: state.profile,
      bw: state.bw,
      hdr: state.hdr,
      options: { ...state.options },
      curve: [...state.curve],
      colorLab: cloneColorLab(state.colorLab),
    };
  }

  function snapshotColorLab() {
    const snapshot = cloneColorLab(state.colorLab);
    snapshot.lut.data = null;
    return snapshot;
  }

  function buildSnapshot() {
    return {
      settings: { ...state.settings },
      transform: { ...state.transform },
      profile: state.profile,
      bw: state.bw,
      hdr: state.hdr,
      options: { ...state.options },
      curve: [...state.curve],
      colorLab: snapshotColorLab(),
      mask: maskCanvas.width > 0 ? maskCanvas.toDataURL("image/png") : null,
    };
  }

  function snapshotsEqual(a, b) {
    if (!a || !b) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function pushHistory() {
    if (!state.image) return;
    const snapshot = buildSnapshot();
    const current = state.history[state.historyIndex];
    if (snapshotsEqual(current, snapshot)) return;

    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot);
    if (state.history.length > state.maxHistory) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    if (els.undoBtn) els.undoBtn.disabled = state.historyIndex <= 0;
    if (els.redoBtn) els.redoBtn.disabled = state.historyIndex < 0 || state.historyIndex >= state.history.length - 1;
  }

  async function imageFromDataUrl(dataUrl) {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = dataUrl;
    });
    return image;
  }

  async function restoreSnapshot(snapshot) {
    if (!snapshot || !state.image) return;

    state.settings = { ...DEFAULTS, ...snapshot.settings };
    state.transform = { rotation: 0, flipX: false, flipY: false, ...snapshot.transform };
    state.profile = snapshot.profile || "adobe-color";
    state.bw = Boolean(snapshot.bw);
    state.hdr = Boolean(snapshot.hdr);
    state.options = {
      removeCA: Boolean(snapshot.options?.removeCA),
      lensCorrections: Boolean(snapshot.options?.lensCorrections),
    };
    state.curve = Array.isArray(snapshot.curve) && snapshot.curve.length === 5
      ? snapshot.curve.map(value => clamp(Number(value)))
      : [...DEFAULT_CURVE];
    const currentLut = state.colorLab?.lut || null;
    state.colorLab = cloneColorLab(snapshot.colorLab || createDefaultColorLab());
    if (!state.colorLab.lut.data && currentLut?.data && state.colorLab.lut.name === currentLut.name) {
      state.colorLab.lut.data = currentLut.data;
      state.colorLab.lut.size = currentLut.size;
    }

    await rebuildPreview(true, false);

    if (snapshot.mask) {
      try {
        const maskImage = await imageFromDataUrl(snapshot.mask);
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
      } catch (error) {
        console.warn("Maske geri yüklenemedi:", error);
      }
    }

    syncControlsFromState();
    await renderNow();
  }

  async function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    updateHistoryButtons();
    await restoreSnapshot(state.history[state.historyIndex]);
  }

  async function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    updateHistoryButtons();
    await restoreSnapshot(state.history[state.historyIndex]);
  }

  function syncControlsFromState() {
    $$(".range-control[data-key]").forEach(group => {
      const key = group.dataset.key;
      const input = $("input[type='range']", group);
      const output = $("output", group);
      if (!input || !(key in state.settings)) return;
      input.value = String(state.settings[key]);
      if (output) output.textContent = formatValue(key, state.settings[key]);
    });

    if (els.profileSelect) els.profileSelect.value = state.profile;
    if (els.bwModeBtn) els.bwModeBtn.classList.toggle("active", state.bw);
    if (els.hdrModeBtn) els.hdrModeBtn.classList.toggle("active", state.hdr);
    if (els.removeCA) els.removeCA.checked = state.options.removeCA;
    if (els.enableLensCorrections) els.enableLensCorrections.checked = state.options.lensCorrections;
    if (els.compareRange) els.compareRange.value = String(state.compare);

    drawToneCurve();
    syncColorLabControls();
    updateCompareLine();
  }

  function getTransformedDimensions(width, height, rotation = state.transform.rotation) {
    const normalized = ((rotation % 360) + 360) % 360;
    return normalized === 90 || normalized === 270
      ? { width: height, height: width }
      : { width, height };
  }

  function drawTransformedImage(targetCtx, targetCanvas, image, previewMax = null) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const rotated = getTransformedDimensions(sourceWidth, sourceHeight);

    let outputWidth = rotated.width;
    let outputHeight = rotated.height;

    if (previewMax) {
      const scale = Math.min(1, previewMax / Math.max(outputWidth, outputHeight));
      outputWidth = Math.max(1, Math.round(outputWidth * scale));
      outputHeight = Math.max(1, Math.round(outputHeight * scale));
    } else {
      outputWidth = Math.max(1, Math.round(outputWidth));
      outputHeight = Math.max(1, Math.round(outputHeight));
    }

    targetCanvas.width = outputWidth;
    targetCanvas.height = outputHeight;
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.clearRect(0, 0, outputWidth, outputHeight);
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.imageSmoothingQuality = "high";

    targetCtx.save();
    targetCtx.translate(outputWidth / 2, outputHeight / 2);
    targetCtx.rotate(state.transform.rotation * Math.PI / 180);
    targetCtx.scale(state.transform.flipX ? -1 : 1, state.transform.flipY ? -1 : 1);

    const quarterTurn = Math.abs(state.transform.rotation % 180) === 90;
    const drawWidth = quarterTurn ? outputHeight : outputWidth;
    const drawHeight = quarterTurn ? outputWidth : outputHeight;
    targetCtx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    targetCtx.restore();
  }

  function updateMetadata() {
    if (!state.image) return;
    const megapixels = (state.fullWidth * state.fullHeight / 1_000_000).toFixed(1);
    const typeLabel = state.fileType.split("/")[1]?.toUpperCase() || "GÖRSEL";
    if (els.metaIso) els.metaIso.textContent = "ISO —";
    if (els.metaFocal) els.metaFocal.textContent = `${state.fullWidth}×${state.fullHeight}px`;
    if (els.metaAperture) els.metaAperture.textContent = typeLabel;
    if (els.metaShutter) els.metaShutter.textContent = `${megapixels} MP`;
  }

  async function loadImageFromBlob(blob, name = "fotograf") {
    if (!blob || !blob.type.startsWith("image/")) {
      notify("Lütfen JPEG, PNG veya WEBP biçiminde bir görsel seçin.");
      return;
    }

    setStatus("Görsel açılıyor…", "working");

    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Görsel okunamadı."));
        image.src = objectUrl;
      });

      state.objectUrl = objectUrl;
      state.image = image;
      state.fileName = name.replace(/\.[^.]+$/, "") || "fotograf";
      state.fileType = blob.type || "image/jpeg";
      state.fullWidth = image.naturalWidth;
      state.fullHeight = image.naturalHeight;
      state.settings = { ...DEFAULTS };
      state.transform = { rotation: 0, flipX: false, flipY: false };
      state.profile = "adobe-color";
      state.bw = false;
      state.hdr = false;
      state.options = { removeCA: false, lensCorrections: false };
      state.curve = [...DEFAULT_CURVE];
      state.colorLab = createDefaultColorLab();
      state.colorUi.palette = [];
      state.colorUi.paletteBase = null;
      state.compare = 0;
      state.history = [];
      state.historyIndex = -1;

      if (els.exportName) els.exportName.value = `${state.fileName}-duzenlenmis`;

      await rebuildPreview(true, false);
      syncControlsFromState();
      updateMetadata();
      pushHistory();
      fitToWorkspace();
      setStatus("Hazır", "ready");
      notify("Görsel başarıyla açıldı.");
    } catch (error) {
      console.error(error);
      URL.revokeObjectURL(objectUrl);
      setStatus("Açma hatası");
      notify("Görsel açılamadı. Dosyanın bozuk olmadığını kontrol edin.");
    }
  }

  async function rebuildPreview(clearMask = true, render = true) {
    if (!state.image) return;
    setStatus("Önizleme hazırlanıyor…", "working");

    const oldMask = !clearMask && maskCanvas.width
      ? document.createElement("canvas")
      : null;

    if (oldMask) {
      oldMask.width = maskCanvas.width;
      oldMask.height = maskCanvas.height;
      oldMask.getContext("2d").drawImage(maskCanvas, 0, 0);
    }

    drawTransformedImage(sourceCtx, sourceCanvas, state.image, 1100);

    processedCanvas.width = sourceCanvas.width;
    processedCanvas.height = sourceCanvas.height;
    els.displayCanvas.width = sourceCanvas.width;
    els.displayCanvas.height = sourceCanvas.height;
    maskCanvas.width = sourceCanvas.width;
    maskCanvas.height = sourceCanvas.height;
    overlayCanvas.width = sourceCanvas.width;
    overlayCanvas.height = sourceCanvas.height;
    gamutCanvas.width = sourceCanvas.width;
    gamutCanvas.height = sourceCanvas.height;
    previewFxCanvas.width = sourceCanvas.width;
    previewFxCanvas.height = sourceCanvas.height;

    if (oldMask) {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      maskCtx.drawImage(oldMask, 0, 0, maskCanvas.width, maskCanvas.height);
    } else {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }

    els.emptyState?.classList.add("d-none");
    els.canvasStage?.classList.remove("d-none");
    updateImageInfo();
    applyZoom();

    if (render) await renderNow();
  }

  function updateImageInfo() {
    if (!els.imageInfo) return;
    if (!state.image) {
      els.imageInfo.textContent = "—";
      return;
    }
    els.imageInfo.textContent = `${state.fileName} • ${state.fullWidth}×${state.fullHeight}px • Önizleme ${sourceCanvas.width}×${sourceCanvas.height}px`;
  }

  function toneCurveValue(value, curve) {
    const x = clamp(value);
    const position = x * 4;
    const index = Math.min(3, Math.floor(position));
    const amount = position - index;
    return mix(curve[index], curve[index + 1], amount);
  }

  function getProfileAdjustments(profile) {
    const profiles = {
      "adobe-color": { contrast: 0, saturation: 0, vibrance: 0, warmth: 0 },
      "adobe-landscape": { contrast: 0.08, saturation: 0.04, vibrance: 0.16, warmth: -0.01 },
      "adobe-portrait": { contrast: -0.05, saturation: -0.03, vibrance: 0.07, warmth: 0.025 },
      "adobe-vivid": { contrast: 0.12, saturation: 0.14, vibrance: 0.18, warmth: 0.01 },
      mono: { contrast: 0.08, saturation: -1, vibrance: 0, warmth: 0 },
    };
    return profiles[profile] || profiles["adobe-color"];
  }

  function scheduleRender(delay = 55) {
    if (!state.image) return;
    clearTimeout(state.renderTimer);
    state.renderTimer = setTimeout(() => {
      renderNow().catch(error => {
        console.error(error);
        setStatus("İşleme hatası");
      });
    }, delay);
  }

  async function renderNow() {
    if (!state.image) return;
    const version = ++state.renderVersion;
    setStatus("İşleniyor…", "working");

    await new Promise(resolve => requestAnimationFrame(resolve));
    if (version !== state.renderVersion) return;

    processImage(sourceCanvas, processedCanvas, maskCanvas, state.settings, currentRenderConfig());
    if (version !== state.renderVersion) return;

    drawDisplay();
    drawHistogram(processedCanvas);
    setStatus("Hazır", "ready");
  }

  function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const delta = max - min;
    if (delta < 1e-7) return [0, 0, lightness];
    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    let hue;
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
    return [((hue % 360) + 360) % 360, clamp(saturation), clamp(lightness)];
  }

  function hslToRgb(hue, saturation, lightness) {
    const h = ((hue % 360) + 360) % 360;
    const s = clamp(saturation);
    const l = clamp(lightness);
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [r + m, g + m, b + m];
  }

  function hexToRgb(hex) {
    const clean = String(hex || "#000000").replace("#", "").trim();
    const normalized = clean.length === 3 ? clean.split("").map(ch => ch + ch).join("") : clean.padEnd(6, "0").slice(0, 6);
    return [parseInt(normalized.slice(0, 2), 16), parseInt(normalized.slice(2, 4), 16), parseInt(normalized.slice(4, 6), 16)];
  }

  function rgbToHex(rgb) {
    return `#${rgb.map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`;
  }

  function hueDistance(a, b) {
    const distance = Math.abs(a - b) % 360;
    return Math.min(distance, 360 - distance);
  }

  function softRangeWeight(value, min, max, softness = 0.08) {
    const lo = min - softness;
    const hi = max + softness;
    if (value < lo || value > hi) return 0;
    if (value >= min && value <= max) return 1;
    if (value < min) return smoothstep(lo, min, value);
    return 1 - smoothstep(max, hi, value);
  }

  function hueRangeWeight(hue, min, max) {
    if (min <= 0 && max >= 360) return 1;
    const h = ((hue % 360) + 360) % 360;
    const lo = ((min % 360) + 360) % 360;
    const hi = max >= 360 ? 360 : ((max % 360) + 360) % 360;
    const softness = 12;
    if (lo <= hi) {
      if (h >= lo && h <= hi) return 1;
      const dl = hueDistance(h, lo);
      const dh = hueDistance(h, hi);
      return 1 - smoothstep(0, softness, Math.min(dl, dh));
    }
    if (h >= lo || h <= hi) return 1;
    return 1 - smoothstep(0, softness, Math.min(hueDistance(h, lo), hueDistance(h, hi)));
  }

  function colorSimilarityWeight(h, s, l, sourceRgb, tolerance, softness) {
    const [sh, ss, sl] = rgbToHsl(sourceRgb[0] / 255, sourceRgb[1] / 255, sourceRgb[2] / 255);
    const huePart = hueDistance(h, sh) / 180;
    const satPart = Math.abs(s - ss);
    const lumPart = Math.abs(l - sl);
    const distance = Math.sqrt(huePart * huePart * 0.62 + satPart * satPart * 0.23 + lumPart * lumPart * 0.15) * 100;
    const edge0 = Math.max(0, tolerance);
    const edge1 = edge0 + Math.max(1, softness);
    return 1 - smoothstep(edge0, edge1, distance);
  }

  function getSelectionWeight(h, s, l, lab) {
    let weight = 1;
    if (lab.colorMask.enabled) {
      weight *= colorSimilarityWeight(h, s, l, lab.colorMask.source, lab.colorMask.tolerance, lab.colorMask.softness);
    }
    if (lab.rangeMask.enabled) {
      weight *= hueRangeWeight(h, lab.rangeMask.hueMin, lab.rangeMask.hueMax);
      weight *= softRangeWeight(s, lab.rangeMask.satMin / 100, lab.rangeMask.satMax / 100, 0.06);
      weight *= softRangeWeight(l, lab.rangeMask.lumMin / 100, lab.rangeMask.lumMax / 100, 0.06);
    }
    return clamp(weight);
  }

  function getSkinWeight(h, s, l) {
    const hueWeight = 1 - smoothstep(18, 55, hueDistance(h, 28));
    const satWeight = softRangeWeight(s, 0.12, 0.78, 0.12);
    const lumWeight = softRangeWeight(l, 0.12, 0.92, 0.12);
    return clamp(hueWeight * satWeight * lumWeight);
  }

  function applyHslMixer(r, g, b, lab, scope, skinProtection) {
    let [h, s, l] = rgbToHsl(r, g, b);
    let hueShift = 0;
    let satShift = 0;
    let lumShift = 0;
    let weightTotal = 0;

    for (const [key, meta] of Object.entries(HSL_COLORS)) {
      const distance = hueDistance(h, meta.hue);
      const width = key === "orange" || key === "magenta" ? 42 : 48;
      const weight = 1 - smoothstep(width * 0.35, width, distance);
      if (weight <= 0) continue;
      const adjustment = lab.hsl[key];
      hueShift += adjustment.hue * 0.62 * weight;
      satShift += adjustment.saturation * weight;
      lumShift += adjustment.luminance * weight;
      weightTotal += weight;
    }

    if (weightTotal > 0) {
      hueShift /= Math.max(1, weightTotal);
      satShift /= Math.max(1, weightTotal);
      lumShift /= Math.max(1, weightTotal);
    }

    const amount = scope * skinProtection;
    h += hueShift * amount;
    s = clamp(s * (1 + satShift / 100 * amount));
    l = clamp(l + lumShift / 100 * 0.36 * amount);
    return hslToRgb(h, s, l);
  }

  function applyColorReplacement(r, g, b, lab, scope, skinProtection) {
    if (!lab.replacement.enabled) return [r, g, b];
    const [h, s, l] = rgbToHsl(r, g, b);
    const similarity = colorSimilarityWeight(h, s, l, lab.replacement.source, lab.replacement.tolerance, lab.replacement.softness);
    if (similarity <= 0) return [r, g, b];
    const targetRgb = hexToRgb(lab.replacement.target);
    const [targetHue, targetSat, targetLight] = rgbToHsl(targetRgb[0] / 255, targetRgb[1] / 255, targetRgb[2] / 255);
    const outLight = lab.replacement.preserveLightness ? l : mix(l, targetLight, 0.65);
    const [tr, tg, tb] = hslToRgb(targetHue, mix(s, targetSat, 0.86), outLight);
    const amount = similarity * scope * skinProtection * lab.replacement.amount / 100;
    return [mix(r, tr, amount), mix(g, tg, amount), mix(b, tb, amount)];
  }

  function tonalZoneWeights(lum, balance = 0) {
    const shifted = clamp(lum + balance / 100 * 0.22);
    const shadows = 1 - smoothstep(0.12, 0.5, shifted);
    const highlights = smoothstep(0.5, 0.9, shifted);
    const midtones = clamp(1 - Math.abs(shifted - 0.5) / 0.42);
    return [shadows, midtones, highlights];
  }

  function applyColorBalance(r, g, b, lum, lab, scope) {
    const [sw, mw, hw] = tonalZoneWeights(lum, lab.grading.balance);
    const zones = [
      [lab.balance.shadows, sw],
      [lab.balance.midtones, mw],
      [lab.balance.highlights, hw],
    ];
    let rr = r, gg = g, bb = b;
    for (const [zone, weight] of zones) {
      const amount = weight * scope * 0.0025;
      rr += zone.cyanRed * amount;
      gg += zone.magentaGreen * amount;
      bb -= zone.yellowBlue * amount;
      // Preserve average luminance while shifting chroma.
      const before = luminance(r, g, b);
      const after = luminance(rr, gg, bb);
      const correction = before - after;
      rr += correction; gg += correction; bb += correction;
    }
    return [rr, gg, bb];
  }

  function getSelectiveWeights(h, s, l) {
    const weights = {
      reds: 1 - smoothstep(18, 58, hueDistance(h, 0)),
      yellows: 1 - smoothstep(20, 55, hueDistance(h, 58)),
      greens: 1 - smoothstep(25, 65, hueDistance(h, 120)),
      cyans: 1 - smoothstep(22, 58, hueDistance(h, 180)),
      blues: 1 - smoothstep(24, 64, hueDistance(h, 235)),
      magentas: 1 - smoothstep(22, 58, hueDistance(h, 310)),
      whites: smoothstep(0.70, 0.96, l) * (1 - s * 0.55),
      blacks: (1 - smoothstep(0.04, 0.32, l)) * (1 - s * 0.25),
      neutrals: (1 - Math.abs(l - 0.5) * 1.8) * (1 - s * 0.72),
    };
    const chromaGate = smoothstep(0.04, 0.25, s);
    ["reds", "yellows", "greens", "cyans", "blues", "magentas"].forEach(key => { weights[key] *= chromaGate; });
    return weights;
  }

  function applySelectiveColor(r, g, b, lab, scope) {
    const [h, s, l] = rgbToHsl(r, g, b);
    const weights = getSelectiveWeights(h, s, l);
    let rr = r, gg = g, bb = b;
    for (const key of Object.keys(SELECTIVE_GROUPS)) {
      const weight = weights[key] * scope;
      if (weight <= 0.0001) continue;
      const adjustment = lab.selective[key];
      rr -= adjustment.cyan / 100 * weight * 0.42;
      gg -= adjustment.magenta / 100 * weight * 0.42;
      bb -= adjustment.yellow / 100 * weight * 0.42;
      const blackFactor = 1 - adjustment.black / 100 * weight * 0.48;
      rr *= blackFactor; gg *= blackFactor; bb *= blackFactor;
    }
    return [rr, gg, bb];
  }

  function applyAdvancedChannelMixer(r, g, b, lab, scope) {
    const rows = lab.mixer;
    const nr = r * rows.red.red / 100 + g * rows.red.green / 100 + b * rows.red.blue / 100 + rows.red.constant / 100;
    const ng = r * rows.green.red / 100 + g * rows.green.green / 100 + b * rows.green.blue / 100 + rows.green.constant / 100;
    const nb = r * rows.blue.red / 100 + g * rows.blue.green / 100 + b * rows.blue.blue / 100 + rows.blue.constant / 100;
    return [mix(r, nr, scope), mix(g, ng, scope), mix(b, nb, scope)];
  }

  function applyAdvancedGrading(r, g, b, lum, lab, scope) {
    const [sw, mw, hw] = tonalZoneWeights(lum, lab.grading.balance);
    const zones = [
      [lab.grading.shadows, sw],
      [lab.grading.midtones, mw],
      [lab.grading.highlights, hw],
    ];
    let rr = r, gg = g, bb = b;
    const blending = 0.45 + lab.grading.blending / 100 * 0.75;
    for (const [zone, weight] of zones) {
      if (zone.saturation <= 0 && Math.abs(zone.luminance) < 0.1) continue;
      const [cr, cg, cb] = hslToRgb(zone.hue, zone.saturation / 100, clamp(lum + zone.luminance / 100 * 0.28));
      const amount = weight * scope * zone.saturation / 100 * 0.34 * blending;
      rr = mix(rr, cr, amount);
      gg = mix(gg, cg, amount);
      bb = mix(bb, cb, amount);
      const lift = zone.luminance / 100 * weight * scope * 0.16;
      rr += lift; gg += lift; bb += lift;
    }
    return [rr, gg, bb];
  }

  function applyFilmLook(r, g, b, look, scope) {
    if (!look || look === "none") return [r, g, b];
    const lum = luminance(r, g, b);
    let nr = r, ng = g, nb = b;
    switch (look) {
      case "teal-orange":
        nr += smoothstep(0.48, 1, lum) * 0.08;
        ng += smoothstep(0.48, 1, lum) * 0.025;
        nb += (1 - smoothstep(0.22, 0.62, lum)) * 0.09;
        ng += (1 - smoothstep(0.22, 0.62, lum)) * 0.055;
        break;
      case "cinematic-blue":
        nb += 0.075; ng += 0.025; nr -= 0.035; nr = (nr - 0.5) * 1.06 + 0.5;
        break;
      case "vintage":
        nr += 0.07; ng += 0.035; nb -= 0.035; nr = mix(nr, lum, 0.08); ng = mix(ng, lum, 0.1); nb = mix(nb, lum, 0.14);
        break;
      case "matte":
        nr = nr * 0.86 + 0.075; ng = ng * 0.86 + 0.075; nb = nb * 0.86 + 0.075;
        break;
      case "warm-portrait":
        nr += 0.065; ng += 0.018; nb -= 0.04;
        break;
      case "cold-news":
        nr -= 0.035; ng += 0.012; nb += 0.06; nr = (nr - 0.5) * 1.08 + 0.5; ng = (ng - 0.5) * 1.08 + 0.5; nb = (nb - 0.5) * 1.08 + 0.5;
        break;
      case "fuji":
        nr += 0.025; ng += 0.035; nb += 0.012; ng = mix(ng, lum, 0.04); nr = (nr - 0.5) * 0.96 + 0.5;
        break;
      case "kodak":
        nr += 0.055; ng += 0.018; nb -= 0.018; nr = (nr - 0.5) * 1.04 + 0.5;
        break;
      default: break;
    }
    return [mix(r, nr, scope), mix(g, ng, scope), mix(b, nb, scope)];
  }

  function sampleLutNearest(r, g, b, lut) {
    if (!lut?.enabled || !lut.data || !lut.size) return [r, g, b];
    const size = lut.size;
    const ri = Math.round(clamp(r) * (size - 1));
    const gi = Math.round(clamp(g) * (size - 1));
    const bi = Math.round(clamp(b) * (size - 1));
    // .cube files list red fastest, then green, then blue.
    const index = ((bi * size + gi) * size + ri) * 3;
    const amount = lut.intensity / 100;
    return [
      mix(r, lut.data[index] ?? r, amount),
      mix(g, lut.data[index + 1] ?? g, amount),
      mix(b, lut.data[index + 2] ?? b, amount),
    ];
  }

  function applyOutputSimulation(r, g, b, outputSpace, softProof) {
    let rr = r, gg = g, bb = b;
    if (outputSpace === "display-p3") {
      const lum = luminance(rr, gg, bb);
      rr = lum + (rr - lum) * 1.035;
      gg = lum + (gg - lum) * 1.025;
      bb = lum + (bb - lum) * 1.04;
    } else if (outputSpace === "adobe-rgb") {
      const nr = rr * 1.035 - gg * 0.018 - bb * 0.004;
      const ng = gg * 1.025 - rr * 0.008;
      const nb = bb * 1.018 - rr * 0.006;
      rr = nr; gg = ng; bb = nb;
    } else if (outputSpace === "cmyk") {
      const k = 1 - Math.max(clamp(rr), clamp(gg), clamp(bb));
      const denom = Math.max(1e-6, 1 - k);
      const c = (1 - clamp(rr) - k) / denom;
      const m = (1 - clamp(gg) - k) / denom;
      const y = (1 - clamp(bb) - k) / denom;
      const ink = Math.min(2.8, c + m + y + k);
      const compression = ink > 2.35 ? 2.35 / ink : 1;
      rr = 1 - Math.min(1, c * compression + k);
      gg = 1 - Math.min(1, m * compression + k);
      bb = 1 - Math.min(1, y * compression + k);
    }

    if (softProof === "cmyk") {
      const lum = luminance(rr, gg, bb);
      rr = lum + (rr - lum) * 0.86;
      gg = lum + (gg - lum) * 0.86;
      bb = lum + (bb - lum) * 0.84;
      rr *= 0.97; gg *= 0.97; bb *= 0.95;
    } else if (softProof === "srgb") {
      rr = clamp(rr); gg = clamp(gg); bb = clamp(bb);
    } else if (softProof === "display-p3") {
      const lum = luminance(rr, gg, bb);
      rr = lum + (rr - lum) * 1.02;
      gg = lum + (gg - lum) * 1.02;
      bb = lum + (bb - lum) * 1.025;
    } else if (softProof === "adobe-rgb") {
      gg += (gg - luminance(rr, gg, bb)) * 0.02;
    }
    return [rr, gg, bb];
  }

  function applyChannelMix(r, g, b, settings) {
    const redDominance = clamp(r - Math.max(g, b), 0, 1);
    const greenDominance = clamp(g - Math.max(r, b), 0, 1);
    const blueDominance = clamp(b - Math.max(r, g), 0, 1);
    const redShift = settings.redMix / 100 * redDominance * 0.28;
    const greenShift = settings.greenMix / 100 * greenDominance * 0.28;
    const blueShift = settings.blueMix / 100 * blueDominance * 0.28;
    g += redShift; b -= redShift; r -= greenShift; b += greenShift; r += blueShift; g -= blueShift;
    const redPrimary = settings.redPrimaryHue / 100 * 0.07;
    const greenPrimary = settings.greenPrimaryHue / 100 * 0.07;
    const bluePrimary = settings.bluePrimaryHue / 100 * 0.07;
    return [
      r + b * redPrimary - g * redPrimary * 0.5,
      g + r * greenPrimary - b * greenPrimary * 0.5,
      b + g * bluePrimary - r * bluePrimary * 0.5,
    ];
  }

  function applyColorGrading(r, g, b, lum, settings) {
    const zones = [
      { hue: settings.shadowsHue, weight: 1 - smoothstep(0.12, 0.48, lum) },
      { hue: settings.midtonesHue, weight: 1 - Math.min(1, Math.abs(lum - 0.5) / 0.32) },
      { hue: settings.highlightsHue, weight: smoothstep(0.52, 0.9, lum) },
    ];
    for (const zone of zones) {
      if (!zone.hue || zone.weight <= 0) continue;
      const [tr, tg, tb] = hslHueToRgb(zone.hue);
      const amount = clamp(zone.weight) * 0.09;
      r = mix(r, tr * Math.max(0.15, lum), amount);
      g = mix(g, tg * Math.max(0.15, lum), amount);
      b = mix(b, tb * Math.max(0.15, lum), amount);
    }
    return [r, g, b];
  }

  function processImage(inputCanvas, outputCanvas, localMaskCanvas, settings, config) {
    const width = inputCanvas.width;
    const height = inputCanvas.height;
    outputCanvas.width = width;
    outputCanvas.height = height;

    const inputCtx = inputCanvas.getContext("2d", { willReadFrequently: true });
    const outputCtx = outputCanvas.getContext("2d", { willReadFrequently: true });
    const imageData = inputCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const maskData = localMaskCanvas && localMaskCanvas.width === width && localMaskCanvas.height === height
      ? localMaskCanvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height).data
      : null;
    const lab = config.colorLab || createDefaultColorLab();
    const previewGamut = outputCanvas === processedCanvas;
    let gamutImage = null;
    if (previewGamut) {
      gamutCanvas.width = width;
      gamutCanvas.height = height;
      gamutImage = gamutCtx.createImageData(width, height);
    }

    const profile = getProfileAdjustments(config.profile);
    const exposureFactor = Math.pow(2, settings.exposure);
    const brightness = settings.brightness / 100 * 0.24;
    const contrast = settings.contrast / 100 + profile.contrast;
    const shadows = settings.shadows / 100;
    const highlights = settings.highlights / 100;
    const whites = settings.whites / 100;
    const blacks = settings.blacks / 100;
    const temperature = settings.temperature / 100 + profile.warmth;
    const tint = settings.tint / 100;
    const saturation = settings.saturation / 100 + profile.saturation;
    const vibrance = settings.vibrance / 100 + profile.vibrance;
    const dehaze = settings.dehaze / 100;
    const vignette = settings.vignette / 100;
    const bw = config.bw || config.profile === "mono";
    const curve = config.curve || DEFAULT_CURVE;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);

    for (let y = 0, p = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1, p += 4) {
        let r = data[p] / 255;
        let g = data[p + 1] / 255;
        let b = data[p + 2] / 255;
        const [sourceHue, sourceSat, sourceLight] = rgbToHsl(r, g, b);
        const scope = getSelectionWeight(sourceHue, sourceSat, sourceLight, lab);
        const skin = getSkinWeight(sourceHue, sourceSat, sourceLight);
        const skinProtection = lab.skinProtect.enabled ? 1 - skin * lab.skinProtect.amount / 100 : 1;

        r += temperature * 0.105 + tint * 0.025;
        g -= tint * 0.055;
        b -= temperature * 0.105 + tint * 0.02;
        r *= exposureFactor; g *= exposureFactor; b *= exposureFactor;

        let lum = luminance(r, g, b);
        let targetLum = lum + brightness;
        targetLum += shadows * 0.43 * Math.pow(1 - clamp(lum), 2);
        targetLum += highlights * 0.43 * Math.pow(clamp(lum), 2);
        targetLum += whites * 0.24 * smoothstep(0.58, 1, lum);
        targetLum += blacks * 0.22 * (1 - smoothstep(0, 0.42, lum));
        if (config.hdr) {
          targetLum += 0.13 * Math.pow(1 - clamp(lum), 2);
          targetLum -= 0.11 * Math.pow(clamp(lum), 2);
        }
        targetLum = (targetLum - 0.5) * (1 + dehaze * 0.72) + 0.5 - dehaze * 0.035;
        const luminanceScale = lum > 0.0001 ? targetLum / lum : 1;
        r *= luminanceScale; g *= luminanceScale; b *= luminanceScale;

        const contrastFactor = 1 + contrast * 1.5;
        r = (r - 0.5) * contrastFactor + 0.5;
        g = (g - 0.5) * contrastFactor + 0.5;
        b = (b - 0.5) * contrastFactor + 0.5;

        lum = luminance(r, g, b);
        const curvedLum = toneCurveValue(lum, curve);
        const curveScale = Math.abs(lum) > 0.0001 ? curvedLum / lum : 1;
        r *= curveScale; g *= curveScale; b *= curveScale;

        if (maskData) {
          const mask = maskData[p + 3] / 255;
          if (mask > 0.001) {
            lum = luminance(r, g, b);
            const highlightGate = smoothstep(0.52, 1, lum);
            const compression = mask * highlightGate * 0.78;
            const compressedLum = lum - compression * (0.12 + Math.max(0, lum - 0.52) * 0.56);
            const maskScale = lum > 0.0001 ? Math.max(0, compressedLum) / lum : 1;
            r *= maskScale; g *= maskScale; b *= maskScale;
          }
        }

        [r, g, b] = applyChannelMix(r, g, b, settings);
        lum = luminance(r, g, b);
        const maximum = Math.max(r, g, b);
        const minimum = Math.min(r, g, b);
        const chroma = maximum - minimum;
        const vibranceFactor = 1 + vibrance * (1 - clamp(chroma * 1.8));
        const saturationFactor = Math.max(0, 1 + saturation) * Math.max(0, vibranceFactor) * (1 + dehaze * 0.14);
        r = lum + (r - lum) * saturationFactor;
        g = lum + (g - lum) * saturationFactor;
        b = lum + (b - lum) * saturationFactor;
        [r, g, b] = applyColorGrading(r, g, b, clamp(lum), settings);

        [r, g, b] = applyHslMixer(r, g, b, lab, scope, skinProtection);
        [r, g, b] = applyColorReplacement(r, g, b, lab, scope, skinProtection);
        lum = luminance(r, g, b);
        [r, g, b] = applyColorBalance(r, g, b, lum, lab, scope * skinProtection);
        [r, g, b] = applySelectiveColor(r, g, b, lab, scope * skinProtection);
        [r, g, b] = applyAdvancedChannelMixer(r, g, b, lab, scope * skinProtection);
        lum = luminance(r, g, b);
        [r, g, b] = applyAdvancedGrading(r, g, b, lum, lab, scope * skinProtection);
        [r, g, b] = applyFilmLook(r, g, b, lab.filmLook, scope * skinProtection);
        const lutBase = [r, g, b];
        const lutResult = sampleLutNearest(r, g, b, lab.lut);
        const lutScope = scope * skinProtection;
        r = mix(lutBase[0], lutResult[0], lutScope);
        g = mix(lutBase[1], lutResult[1], lutScope);
        b = mix(lutBase[2], lutResult[2], lutScope);

        // Per-channel RGB curves. The master curve is the existing tone curve above.
        r = toneCurveValue(clamp(r), lab.curves.red);
        g = toneCurveValue(clamp(g), lab.curves.green);
        b = toneCurveValue(clamp(b), lab.curves.blue);
        [r, g, b] = applyOutputSimulation(r, g, b, lab.outputSpace, lab.softProof);

        if (bw) {
          const gray = luminance(r, g, b);
          r = gray; g = gray; b = gray;
        }

        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) / maxDistance;
        const edge = smoothstep(0.38, 1, distance);
        if (Math.abs(vignette) > 0.001) {
          const factor = 1 - vignette * edge * 0.72;
          r *= factor; g *= factor; b *= factor;
        }
        if (config.options.lensCorrections) {
          const correction = 1 + edge * 0.11;
          r *= correction; g *= correction; b *= correction;
        }

        if (gamutImage) {
          const [gh, gs, gl] = rgbToHsl(clamp(r), clamp(g), clamp(b));
          const proofThreshold = lab.softProof === "cmyk" || lab.outputSpace === "cmyk" ? 0.72 : 0.92;
          const clipped = r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1;
          const saturated = gs > proofThreshold && (gl < 0.92 && gl > 0.06);
          const warning = clipped || saturated;
          gamutImage.data[p] = 255;
          gamutImage.data[p + 1] = 25;
          gamutImage.data[p + 2] = 82;
          gamutImage.data[p + 3] = warning ? 185 : 0;
        }

        data[p] = Math.round(clamp(r) * 255);
        data[p + 1] = Math.round(clamp(g) * 255);
        data[p + 2] = Math.round(clamp(b) * 255);
      }
    }

    outputCtx.putImageData(imageData, 0, 0);
    if (gamutImage) gamutCtx.putImageData(gamutImage, 0, 0);
    if (config.options.removeCA) applyChromaticAberrationCorrection(outputCanvas);
    applyNoiseReduction(outputCanvas, settings.noiseReduction, settings.colorNoiseReduction);
    applyDetail(outputCanvas, settings.texture, settings.clarity, settings.sharpness);
    applyLensBlur(outputCanvas, settings.lensBlurAmount, settings.lensBlurBokeh);
    applyGrain(outputCanvas, settings.grain);
  }


  function makeBlurredCanvas(source, radius) {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.filter = `blur(${Math.max(0, radius)}px)`;
    context.drawImage(source, 0, 0);
    context.filter = "none";
    return canvas;
  }

  function applyChromaticAberrationCorrection(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const source = new Uint8ClampedArray(image.data);
    const width = canvas.width;
    const height = canvas.height;

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const p = (y * width + x) * 4;
        image.data[p] = Math.round((source[p - 4] + source[p] * 2 + source[p + 4]) / 4);
        image.data[p + 2] = Math.round((source[p + 2 - width * 4] + source[p + 2] * 2 + source[p + 2 + width * 4]) / 4);
      }
    }
    context.putImageData(image, 0, 0);
  }

  function applyNoiseReduction(canvas, luminanceAmount, colorAmount) {
    if (luminanceAmount <= 0 && colorAmount <= 0) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    const blurRadius = 1 + Math.max(luminanceAmount, colorAmount) / 100 * 2.2;
    const blurred = makeBlurredCanvas(canvas, blurRadius);
    const original = context.getImageData(0, 0, canvas.width, canvas.height);
    const blurData = blurred.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
    const lumaMix = luminanceAmount / 100 * 0.58;
    const chromaMix = colorAmount / 100 * 0.72;

    for (let p = 0; p < original.data.length; p += 4) {
      const originalLum = luminance(original.data[p], original.data[p + 1], original.data[p + 2]);
      const blurLum = luminance(blurData[p], blurData[p + 1], blurData[p + 2]);

      for (let channel = 0; channel < 3; channel += 1) {
        let value = mix(original.data[p + channel], blurData[p + channel], lumaMix);
        const smoothedChroma = originalLum + (blurData[p + channel] - blurLum);
        value = mix(value, smoothedChroma, chromaMix);
        original.data[p + channel] = clamp(Math.round(value), 0, 255);
      }
    }
    context.putImageData(original, 0, 0);
  }

  function applyDetail(canvas, texture, clarity, sharpness) {
    if (Math.abs(texture) < 0.5 && Math.abs(clarity) < 0.5 && sharpness < 0.5) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    const base = context.getImageData(0, 0, canvas.width, canvas.height);
    const original = new Uint8ClampedArray(base.data);

    const textureBlur = Math.abs(texture) >= 0.5 ? makeBlurredCanvas(canvas, 2) : null;
    const clarityBlur = Math.abs(clarity) >= 0.5
      ? makeBlurredCanvas(canvas, Math.max(3, Math.min(9, Math.round(Math.max(canvas.width, canvas.height) / 420))))
      : null;
    const sharpBlur = sharpness >= 0.5 ? makeBlurredCanvas(canvas, 1) : null;

    const textureData = textureBlur?.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
    const clarityData = clarityBlur?.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
    const sharpData = sharpBlur?.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;

    const textureAmount = texture / 100 * 0.52;
    const clarityAmount = clarity / 100 * 0.62;
    const sharpAmount = sharpness / 100 * 0.82;

    for (let p = 0; p < base.data.length; p += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        let value = original[p + channel];
        if (textureData) value += (original[p + channel] - textureData[p + channel]) * textureAmount;
        if (clarityData) value += (original[p + channel] - clarityData[p + channel]) * clarityAmount;
        if (sharpData) value += (original[p + channel] - sharpData[p + channel]) * sharpAmount;
        base.data[p + channel] = clamp(Math.round(value), 0, 255);
      }
    }
    context.putImageData(base, 0, 0);
  }

  function applyLensBlur(canvas, amount, bokehBoost) {
    if (amount <= 0) return;

    const width = canvas.width;
    const height = canvas.height;
    const original = document.createElement("canvas");
    original.width = width;
    original.height = height;
    original.getContext("2d").drawImage(canvas, 0, 0);

    const blurRadius = 1 + amount / 100 * 13;
    const blurred = makeBlurredCanvas(original, blurRadius);
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, width, height);
    context.drawImage(blurred, 0, 0);

    if (bokehBoost > 0) {
      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = bokehBoost / 100 * 0.14;
      context.filter = `brightness(${1 + bokehBoost / 100 * 0.8}) contrast(${1 + bokehBoost / 100 * 0.3})`;
      context.drawImage(blurred, 0, 0);
      context.filter = "none";
      context.restore();
    }

    const sharpLayer = document.createElement("canvas");
    sharpLayer.width = width;
    sharpLayer.height = height;
    const sharpCtx = sharpLayer.getContext("2d");
    sharpCtx.drawImage(original, 0, 0);
    sharpCtx.globalCompositeOperation = "destination-in";

    const radius = Math.min(width, height) * (0.46 - amount / 100 * 0.15);
    const gradient = sharpCtx.createRadialGradient(
      width * 0.5,
      height * 0.44,
      radius * 0.45,
      width * 0.5,
      height * 0.44,
      radius
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.62, "rgba(255,255,255,.96)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    sharpCtx.fillStyle = gradient;
    sharpCtx.fillRect(0, 0, width, height);
    sharpCtx.globalCompositeOperation = "source-over";
    context.drawImage(sharpLayer, 0, 0);
  }

  function applyGrain(canvas, amount) {
    if (amount <= 0) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const strength = amount / 100 * 24;

    for (let y = 0, p = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1, p += 4) {
        const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const noise = (seed - Math.floor(seed) - 0.5) * strength;
        image.data[p] = clamp(Math.round(image.data[p] + noise), 0, 255);
        image.data[p + 1] = clamp(Math.round(image.data[p + 1] + noise), 0, 255);
        image.data[p + 2] = clamp(Math.round(image.data[p + 2] + noise), 0, 255);
      }
    }
    context.putImageData(image, 0, 0);
  }

  function applyColorBlindPreview(canvas, mode) {
    if (!mode || mode === "none") return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const matrices = {
      protanopia: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
      deuteranopia: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
      tritanopia: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
      achromatopsia: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
    };
    const matrix = matrices[mode];
    if (!matrix) return;
    for (let p = 0; p < image.data.length; p += 4) {
      const r = image.data[p];
      const g = image.data[p + 1];
      const b = image.data[p + 2];
      image.data[p] = clamp(Math.round(r * matrix[0] + g * matrix[1] + b * matrix[2]), 0, 255);
      image.data[p + 1] = clamp(Math.round(r * matrix[3] + g * matrix[4] + b * matrix[5]), 0, 255);
      image.data[p + 2] = clamp(Math.round(r * matrix[6] + g * matrix[7] + b * matrix[8]), 0, 255);
    }
    context.putImageData(image, 0, 0);
  }

  function drawDisplay() {
    if (!state.image) return;
    const width = els.displayCanvas.width;
    const height = els.displayCanvas.height;
    displayCtx.clearRect(0, 0, width, height);

    if (state.showOriginal) {
      displayCtx.drawImage(sourceCanvas, 0, 0);
    } else if (state.compare > 0 && state.compare < 100) {
      const splitX = Math.round(width * state.compare / 100);
      displayCtx.drawImage(sourceCanvas, 0, 0);
      displayCtx.save();
      displayCtx.beginPath();
      displayCtx.rect(splitX, 0, width - splitX, height);
      displayCtx.clip();
      displayCtx.drawImage(processedCanvas, 0, 0);
      displayCtx.restore();
    } else if (state.compare >= 100) {
      displayCtx.drawImage(sourceCanvas, 0, 0);
    } else {
      displayCtx.drawImage(processedCanvas, 0, 0);
    }

    if (!state.showOriginal && state.colorLab.colorBlind !== "none") {
      previewFxCanvas.width = width;
      previewFxCanvas.height = height;
      previewFxCtx.clearRect(0, 0, width, height);
      previewFxCtx.drawImage(els.displayCanvas, 0, 0);
      applyColorBlindPreview(previewFxCanvas, state.colorLab.colorBlind);
      displayCtx.clearRect(0, 0, width, height);
      displayCtx.drawImage(previewFxCanvas, 0, 0);
    }

    if (!state.showOriginal && state.colorLab.gamutWarning && gamutCanvas.width === width) {
      displayCtx.save();
      displayCtx.globalCompositeOperation = "source-over";
      displayCtx.drawImage(gamutCanvas, 0, 0);
      displayCtx.restore();
    }

    if (state.tool === "brush" && !state.showOriginal) {
      overlayCtx.clearRect(0, 0, width, height);
      overlayCtx.drawImage(maskCanvas, 0, 0);
      overlayCtx.globalCompositeOperation = "source-in";
      overlayCtx.fillStyle = "rgba(255, 62, 62, .64)";
      overlayCtx.fillRect(0, 0, width, height);
      overlayCtx.globalCompositeOperation = "source-over";
      displayCtx.drawImage(overlayCanvas, 0, 0);
    }
  }

  function drawHistogram(canvas) {
    if (!els.histogramCanvas || !canvas.width || !canvas.height) return;
    const histogramCtx = els.histogramCanvas.getContext("2d");
    const width = els.histogramCanvas.width;
    const height = els.histogramCanvas.height;
    histogramCtx.clearRect(0, 0, width, height);

    const source = canvas.getContext("2d", { willReadFrequently: true });
    const pixels = source.getImageData(0, 0, canvas.width, canvas.height).data;
    const step = Math.max(1, Math.floor(Math.sqrt((canvas.width * canvas.height) / 100000)));
    const red = new Uint32Array(256);
    const green = new Uint32Array(256);
    const blue = new Uint32Array(256);
    const luma = new Uint32Array(256);

    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const p = (y * canvas.width + x) * 4;
        red[pixels[p]] += 1;
        green[pixels[p + 1]] += 1;
        blue[pixels[p + 2]] += 1;
        luma[Math.round(luminance(pixels[p], pixels[p + 1], pixels[p + 2]))] += 1;
      }
    }

    let maximum = 1;
    for (let i = 0; i < 256; i += 1) {
      maximum = Math.max(maximum, red[i], green[i], blue[i], luma[i]);
    }

    const drawChannel = (bins, strokeStyle, alpha, lineWidth = 1) => {
      histogramCtx.save();
      histogramCtx.strokeStyle = strokeStyle;
      histogramCtx.globalAlpha = alpha;
      histogramCtx.lineWidth = lineWidth;
      histogramCtx.beginPath();
      for (let i = 0; i < 256; i += 1) {
        const x = i / 255 * width;
        const y = height - bins[i] / maximum * (height - 4);
        if (i === 0) histogramCtx.moveTo(x, y);
        else histogramCtx.lineTo(x, y);
      }
      histogramCtx.stroke();
      histogramCtx.restore();
    };

    drawChannel(luma, "#e9eef8", 0.72, 1.4);
    drawChannel(red, "#ff6b6b", 0.55);
    drawChannel(green, "#4fd18b", 0.55);
    drawChannel(blue, "#6ca8ff", 0.55);
  }

  function drawToneCurve() {
    if (!els.toneCurveCanvas) return;
    const canvas = els.toneCurveCanvas;
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#10141c";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(255,255,255,.10)";
    context.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      const x = i / 4 * width;
      const y = i / 4 * height;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    context.strokeStyle = "rgba(255,255,255,.22)";
    context.beginPath();
    context.moveTo(0, height);
    context.lineTo(width, 0);
    context.stroke();

    context.strokeStyle = "#8eabff";
    context.lineWidth = 2;
    context.beginPath();
    state.curve.forEach((value, index) => {
      const x = index / 4 * width;
      const y = height - value * height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();

    state.curve.forEach((value, index) => {
      const x = index / 4 * width;
      const y = height - value * height;
      context.beginPath();
      context.arc(x, y, index === state.curvePoint ? 5 : 4, 0, Math.PI * 2);
      context.fillStyle = index === state.curvePoint ? "#ffffff" : "#8eabff";
      context.fill();
      context.strokeStyle = "#10141c";
      context.stroke();
    });
  }

  function curvePointFromEvent(event) {
    const rect = els.toneCurveCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (els.toneCurveCanvas.width / rect.width);
    const y = (event.clientY - rect.top) * (els.toneCurveCanvas.height / rect.height);
    const index = clamp(Math.round(x / els.toneCurveCanvas.width * 4), 1, 3);
    const value = clamp(1 - y / els.toneCurveCanvas.height);
    return { index, value };
  }

  function updateCompareLine() {
    if (!els.compareLine) return;
    if (!state.image || state.showOriginal || state.compare <= 0 || state.compare >= 100) {
      els.compareLine.classList.add("hidden");
      return;
    }
    els.compareLine.classList.remove("hidden");
    els.compareLine.style.left = `${state.compare}%`;
  }

  function fitToWorkspace() {
    if (!state.image || !els.canvasScroller) return;
    const availableWidth = Math.max(100, els.canvasScroller.clientWidth - 70);
    const availableHeight = Math.max(100, els.canvasScroller.clientHeight - 70);
    const scale = Math.min(1, availableWidth / sourceCanvas.width, availableHeight / sourceCanvas.height);
    state.zoom = clamp(Math.round(scale * 100 / 5) * 5, 25, 100);
    if (els.zoomRange) els.zoomRange.value = String(state.zoom);
    applyZoom();
  }

  function applyZoom() {
    if (!state.image || !els.canvasStage) return;
    if (els.zoomValue) els.zoomValue.textContent = `${state.zoom}%`;
    const scale = state.zoom / 100;
    const displayWidth = sourceCanvas.width * scale;
    const displayHeight = sourceCanvas.height * scale;
    els.canvasStage.style.width = `${displayWidth}px`;
    els.canvasStage.style.height = `${displayHeight}px`;
    els.displayCanvas.style.width = `${displayWidth}px`;
    els.displayCanvas.style.height = `${displayHeight}px`;
    if (els.compareLine) els.compareLine.style.height = `${displayHeight}px`;
    updateBrushCursorSize();
  }

  function updateBrushCursorSize() {
    if (!els.brushCursor || !sourceCanvas.width) return;
    const size = state.brushSize * state.zoom / 100;
    els.brushCursor.style.width = `${size}px`;
    els.brushCursor.style.height = `${size}px`;
  }

  function canvasPointFromEvent(event) {
    const rect = els.displayCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (els.displayCanvas.width / rect.width),
      y: (event.clientY - rect.top) * (els.displayCanvas.height / rect.height),
    };
  }

  function drawMaskPoint(x, y) {
    const radius = state.brushSize / 2;
    const feather = state.brushFeather / 100;
    const innerRadius = radius * (1 - feather);
    const opacity = state.brushOpacity / 100;

    maskCtx.save();
    maskCtx.globalCompositeOperation = state.brushMode === "erase" ? "destination-out" : "source-over";
    const gradient = maskCtx.createRadialGradient(x, y, Math.max(0, innerRadius), x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${opacity})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    maskCtx.fillStyle = gradient;
    maskCtx.beginPath();
    maskCtx.arc(x, y, radius, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();
  }

  function paintLine(from, to) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const spacing = Math.max(2, state.brushSize * 0.12);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let i = 0; i <= steps; i += 1) {
      const amount = i / steps;
      drawMaskPoint(
        mix(from.x, to.x, amount),
        mix(from.y, to.y, amount)
      );
    }
  }

  function clearMask(addHistory = true) {
    if (!state.image) return;
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    scheduleRender(0);
    if (addHistory) pushHistory();
  }

  function setShowOriginal(value) {
    if (!state.image) return;
    state.showOriginal = Boolean(value);
    els.beforeHoldBtn?.classList.toggle("active", state.showOriginal);
    updateCompareLine();
    drawDisplay();
  }

  function switchTool(tool) {
    state.tool = tool;
    $$(".tool-btn").forEach(button => {
      button.classList.toggle("active", button.dataset.tool === tool);
    });
    $$(".tool-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === `panel-${tool}`);
    });
    els.canvasStage?.classList.toggle("brush-mode", tool === "brush");
    els.brushCursor?.classList.add("d-none");
    drawDisplay();
  }

  function autoTone(commit = true) {
    if (!state.image) {
      notify("Önce bir görsel açın.");
      return;
    }

    const pixels = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
    const sampleStep = Math.max(1, Math.floor(pixels.length / (4 * 60000)));
    const values = [];

    for (let p = 0; p < pixels.length; p += 4 * sampleStep) {
      values.push(luminance(pixels[p], pixels[p + 1], pixels[p + 2]) / 255);
    }
    values.sort((a, b) => a - b);

    const percentile = value => values[Math.min(values.length - 1, Math.floor(values.length * value))] ?? value;
    const p10 = percentile(0.10);
    const p50 = percentile(0.50);
    const p90 = percentile(0.90);

    state.settings.exposure = clamp(Math.log2(0.48 / Math.max(0.08, p50)), -1.2, 1.2);
    state.settings.contrast = clamp((0.72 - (p90 - p10)) * 90, -25, 30);
    state.settings.highlights = p90 > 0.90 ? -35 : -12;
    state.settings.shadows = p10 < 0.08 ? 28 : 12;
    state.settings.whites = p90 > 0.96 ? -18 : 2;
    state.settings.blacks = p10 > 0.10 ? -8 : 4;
    state.settings.vibrance = 10;
    state.settings.sharpness = 10;

    syncControlsFromState();
    scheduleRender(0);
    if (commit) pushHistory();
    if (commit) notify("Otomatik ton dengesi uygulandı.");
  }

  async function applyTransformChange() {
    if (!state.image) {
      notify("Önce bir görsel açın.");
      return;
    }
    clearMask(false);
    await rebuildPreview(true, true);
    fitToWorkspace();
    pushHistory();
    notify("Dönüşüm uygulandı; fırça maskesi temizlendi.");
  }

  async function exportImage() {
    if (!state.image) {
      notify("Önce bir görsel açın.");
      return;
    }

    const originalButtonHtml = els.exportBtn?.innerHTML || "Fotoğrafı Kaydet";
    if (els.exportBtn) {
      els.exportBtn.disabled = true;
      els.exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Hazırlanıyor…';
    }
    setStatus("Tam çözünürlük işleniyor…", "working");

    try {
      await new Promise(resolve => setTimeout(resolve, 25));

      const fullSource = document.createElement("canvas");
      const fullSourceCtx = fullSource.getContext("2d", { willReadFrequently: true });
      drawTransformedImage(fullSourceCtx, fullSource, state.image, null);

      const fullMask = document.createElement("canvas");
      fullMask.width = fullSource.width;
      fullMask.height = fullSource.height;
      const fullMaskCtx = fullMask.getContext("2d", { willReadFrequently: true });
      fullMaskCtx.imageSmoothingEnabled = true;
      fullMaskCtx.imageSmoothingQuality = "high";
      fullMaskCtx.drawImage(maskCanvas, 0, 0, fullMask.width, fullMask.height);

      const resultCanvas = document.createElement("canvas");
      processImage(fullSource, resultCanvas, fullMask, state.settings, currentRenderConfig());

      const mime = els.exportFormat?.value || "image/jpeg";
      const quality = mime === "image/png" ? undefined : 0.92;
      const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const safeName = (els.exportName?.value.trim() || "duzenlenmis-fotograf")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      const blob = await new Promise(resolve => resultCanvas.toBlob(resolve, mime, quality));
      if (!blob) throw new Error("Dosya üretilemedi.");

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${safeName}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);

      notify(`Fotoğraf ${extension.toUpperCase()} olarak kaydedildi.`);
    } catch (error) {
      console.error(error);
      notify("Dışa aktarma sırasında hata oluştu. Daha küçük bir görsel deneyin.");
    } finally {
      if (els.exportBtn) {
        els.exportBtn.disabled = false;
        els.exportBtn.innerHTML = originalButtonHtml;
      }
      setStatus("Hazır", "ready");
    }
  }

  function labRange(id, label, min, max, value, step = 1, suffix = "") {
    return `<div class="range-control standalone">
      <div class="range-label"><span>${label}</span><output id="${id}Output">${value}${suffix}</output></div>
      <input id="${id}" type="range" min="${min}" max="${max}" value="${value}" step="${step}">
    </div>`;
  }

  function buildColorLabPanel() {
    if (!els.colorLabContent) return;
    const hslChips = Object.entries(HSL_COLORS)
      .map(([key, meta]) => `<button class="color-chip${key === "red" ? " active" : ""}" data-hsl-color="${key}">${meta.label}</button>`)
      .join("");
    const selectiveOptions = Object.entries(SELECTIVE_GROUPS)
      .map(([key, label]) => `<option value="${key}">${label}</option>`).join("");

    els.colorLabContent.innerHTML = `
      <details class="colorlab-section" open>
        <summary>Akıllı Renk Düzeltme</summary>
        <div class="colorlab-body">
          <div class="colorlab-actions">
            <button class="btn btn-sm btn-primary" id="autoColorLabBtn"><i class="bi bi-magic me-1"></i>Tümünü Otomatik</button>
            <button class="btn btn-sm btn-outline-secondary" id="autoWhiteBalanceBtn">Auto WB</button>
            <button class="btn btn-sm btn-outline-secondary" id="autoSkinBtn">Ten Rengi</button>
            <button class="btn btn-sm btn-outline-secondary" id="autoSaturationBtn">Doygunluk</button>
            <button class="btn btn-sm btn-outline-info" id="whiteBalancePickerBtn"><i class="bi bi-eyedropper me-1"></i>WB Damlalık</button>
          </div>
          <div class="colorlab-help">Damlalık etkinleştirildikten sonra fotoğraftaki beyaz veya nötr gri bir noktaya tıklayın.</div>
        </div>
      </details>

      <details class="colorlab-section" open>
        <summary>Gelişmiş HSL / Color Mixer</summary>
        <div class="colorlab-body">
          <div class="color-chip-row">${hslChips}</div>
          ${labRange("hslHue", "Hue", -100, 100, 0)}
          ${labRange("hslSaturation", "Saturation", -100, 100, 0)}
          ${labRange("hslLuminance", "Luminance", -100, 100, 0)}
        </div>
      </details>

      <details class="colorlab-section">
        <summary>Renk Seç ve Değiştir</summary>
        <div class="colorlab-body">
          <div class="form-check form-switch mb-2">
            <input class="form-check-input" type="checkbox" id="replaceEnabled">
            <label class="form-check-label" for="replaceEnabled">Renk değiştirmeyi etkinleştir</label>
          </div>
          <div class="color-pick-line">
            <button class="color-swatch-button" id="replaceSourceSwatch" title="Kaynak renk"></button>
            <button class="btn btn-sm btn-outline-info" id="replacePickBtn"><i class="bi bi-eyedropper me-1"></i>Fotoğraftan Seç</button>
            <input class="form-control form-control-color" type="color" id="replaceTarget" value="#35a7ff" title="Hedef renk">
            <span class="small text-secondary">Hedef</span>
          </div>
          ${labRange("replaceTolerance", "Tolerans", 1, 70, 24)}
          ${labRange("replaceSoftness", "Yumuşaklık", 1, 70, 35)}
          ${labRange("replaceAmount", "Etki", 0, 100, 100, 1, "%")}
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="replacePreserveLightness" checked>
            <label class="form-check-label" for="replacePreserveLightness">Orijinal parlaklığı koru</label>
          </div>
        </div>
      </details>

      <details class="colorlab-section">
        <summary>RGB Ton Eğrileri</summary>
        <div class="colorlab-body">
          <div class="curve-channel-tabs">
            <button class="btn btn-sm btn-outline-light active" data-curve-channel="master">RGB</button>
            <button class="btn btn-sm btn-outline-danger" data-curve-channel="red">Red</button>
            <button class="btn btn-sm btn-outline-success" data-curve-channel="green">Green</button>
            <button class="btn btn-sm btn-outline-primary" data-curve-channel="blue">Blue</button>
          </div>
          <canvas id="rgbCurveCanvas" width="320" height="160"></canvas>
          <div class="colorlab-help">Üç orta noktayı sürükleyin. Seçili kanalı sıfırlamak için eğriye çift tıklayın.</div>
        </div>
      </details>

      <details class="colorlab-section">
        <summary>Color Balance</summary>
        <div class="colorlab-body">
          <div class="balance-zone-tabs">
            <button class="btn btn-sm btn-outline-light active" data-balance-zone="shadows">Gölgeler</button>
            <button class="btn btn-sm btn-outline-light" data-balance-zone="midtones">Orta Ton</button>
            <button class="btn btn-sm btn-outline-light" data-balance-zone="highlights">Parlak</button>
          </div>
          ${labRange("balanceCyanRed", "Cyan ↔ Red", -100, 100, 0)}
          ${labRange("balanceMagentaGreen", "Magenta ↔ Green", -100, 100, 0)}
          ${labRange("balanceYellowBlue", "Yellow ↔ Blue", -100, 100, 0)}
        </div>
      </details>

      <details class="colorlab-section">
        <summary>Color Grading Tekerlekleri</summary>
        <div class="colorlab-body">
          <div class="grading-wheels">
            ${["shadows", "midtones", "highlights"].map((zone, index) => `
              <div class="grading-wheel-card">
                <strong>${["Gölgeler", "Orta Ton", "Parlaklar"][index]}</strong>
                <div class="color-wheel" data-grade-zone="${zone}"></div>
                ${labRange(`grade-${zone}-sat`, "Sat", 0, 100, 0, 1, "%")}
                ${labRange(`grade-${zone}-lum`, "Lum", -100, 100, 0)}
              </div>`).join("")}
          </div>
          ${labRange("gradeBlending", "Blending", 0, 100, 50, 1, "%")}
          ${labRange("gradeBalance", "Balance", -100, 100, 0)}
        </div>
      </details>

      <details class="colorlab-section">
        <summary>Selective Color</summary>
        <div class="colorlab-body">
          <label class="form-label" for="selectiveGroup">Renk grubu</label>
          <select class="form-select form-select-sm mb-3" id="selectiveGroup">${selectiveOptions}</select>
          ${labRange("selectiveCyan", "Cyan", -100, 100, 0)}
          ${labRange("selectiveMagenta", "Magenta", -100, 100, 0)}
          ${labRange("selectiveYellow", "Yellow", -100, 100, 0)}
          ${labRange("selectiveBlack", "Black", -100, 100, 0)}
        </div>
      </details>

      <details class="colorlab-section">
        <summary>Channel Mixer</summary>
        <div class="colorlab-body">
          <label class="form-label" for="mixerOutput">Çıkış kanalı</label>
          <select class="form-select form-select-sm mb-3" id="mixerOutput">
            <option value="red">Red Output</option><option value="green">Green Output</option><option value="blue">Blue Output</option>
          </select>
          ${labRange("mixerRed", "Red", -200, 200, 100)}
          ${labRange("mixerGreen", "Green", -200, 200, 0)}
          ${labRange("mixerBlue", "Blue", -200, 200, 0)}
          ${labRange("mixerConstant", "Constant", -100, 100, 0)}
        </div>
      </details>

      <details class="colorlab-section">
        <summary>LUT ve Film Görünümleri</summary>
        <div class="colorlab-body">
          <input type="file" id="lutFileInput" accept=".cube,text/plain" hidden>
          <div class="colorlab-actions mb-2">
            <button class="btn btn-sm btn-outline-info" id="loadLutBtn"><i class="bi bi-file-earmark-arrow-up me-1"></i>.cube LUT Yükle</button>
            <button class="btn btn-sm btn-outline-danger" id="removeLutBtn">LUT Kaldır</button>
          </div>
          <div class="lut-name mb-2" id="lutName">LUT yüklenmedi</div>
          <div class="form-check form-switch mb-2">
            <input class="form-check-input" type="checkbox" id="lutEnabled">
            <label class="form-check-label" for="lutEnabled">LUT etkin</label>
          </div>
          ${labRange("lutIntensity", "LUT yoğunluğu", 0, 100, 100, 1, "%")}
          <label class="form-label" for="filmLook">Hazır film görünümü</label>
          <select class="form-select form-select-sm mb-3" id="filmLook">
            <option value="none">Yok</option>
            <option value="teal-orange">Teal &amp; Orange</option>
            <option value="cinematic-blue">Cinematic Blue</option>
            <option value="vintage">Vintage Film</option>
            <option value="matte">Matte</option>
            <option value="warm-portrait">Warm Portrait</option>
            <option value="cold-news">Cold News</option>
            <option value="fuji">Fuji Benzeri</option>
            <option value="kodak">Kodak Benzeri</option>
          </select>
          <div class="form-check form-switch mb-2">
            <input class="form-check-input" type="checkbox" id="skinProtectEnabled">
            <label class="form-check-label" for="skinProtectEnabled">Ten rengini koru</label>
          </div>
          ${labRange("skinProtectAmount", "Koruma gücü", 0, 100, 65, 1, "%")}
        </div>
      </details>

      <details class="colorlab-section">
        <summary>Akıllı Renk ve Aralık Maskesi</summary>
        <div class="colorlab-body">
          <div class="form-check form-switch mb-2">
            <input class="form-check-input" type="checkbox" id="colorMaskEnabled">
            <label class="form-check-label" for="colorMaskEnabled">Seçilen renge sınırla</label>
          </div>
          <div class="color-pick-line">
            <button class="color-swatch-button" id="colorMaskSwatch"></button>
            <button class="btn btn-sm btn-outline-info" id="colorMaskPickBtn"><i class="bi bi-eyedropper me-1"></i>Maske Rengi Seç</button>
          </div>
          ${labRange("colorMaskTolerance", "Renk toleransı", 1, 70, 25)}
          ${labRange("colorMaskSoftness", "Maske yumuşaklığı", 1, 70, 35)}
          <hr class="border-secondary opacity-25">
          <div class="form-check form-switch mb-2">
            <input class="form-check-input" type="checkbox" id="rangeMaskEnabled">
            <label class="form-check-label" for="rangeMaskEnabled">HSL aralığına sınırla</label>
          </div>
          ${labRange("rangeHueMin", "Hue başlangıç", 0, 360, 0, 1, "°")}
          ${labRange("rangeHueMax", "Hue bitiş", 0, 360, 360, 1, "°")}
          ${labRange("rangeSatMin", "Minimum saturation", 0, 100, 0, 1, "%")}
          ${labRange("rangeSatMax", "Maximum saturation", 0, 100, 100, 1, "%")}
          ${labRange("rangeLumMin", "Minimum luminance", 0, 100, 0, 1, "%")}
          ${labRange("rangeLumMax", "Maximum luminance", 0, 100, 100, 1, "%")}
          <div class="colorlab-help">Bu maskeler HSL, grading, selective color, kanal mikseri ve film görünümünün uygulanacağı alanı sınırlar.</div>
        </div>
      </details>

      <details class="colorlab-section">
        <summary>Dominant Palet ve Renk Uyumu</summary>
        <div class="colorlab-body">
          <div class="colorlab-actions">
            <button class="btn btn-sm btn-outline-primary" id="extractPaletteBtn">Paleti Çıkar</button>
            <button class="btn btn-sm btn-outline-secondary" id="exportPalettePngBtn">PNG</button>
            <button class="btn btn-sm btn-outline-secondary" id="exportPaletteJsonBtn">JSON</button>
          </div>
          <div class="palette-grid" id="paletteGrid"></div>
          <label class="form-label" for="harmonySelect">Renk uyumu</label>
          <select class="form-select form-select-sm" id="harmonySelect">
            <option value="complementary">Complementary</option>
            <option value="analogous">Analogous</option>
            <option value="triadic">Triadic</option>
            <option value="split">Split Complementary</option>
          </select>
          <div class="harmony-row" id="harmonyRow"></div>
        </div>
      </details>

      <details class="colorlab-section">
        <summary>Gamut, Soft Proof ve Erişilebilirlik</summary>
        <div class="colorlab-body">
          <div class="form-check form-switch mb-2">
            <input class="form-check-input" type="checkbox" id="gamutWarning">
            <label class="form-check-label" for="gamutWarning">Gamut dışı alanları göster</label>
          </div>
          <label class="form-label" for="softProof">Soft proof</label>
          <select class="form-select form-select-sm mb-3" id="softProof">
            <option value="none">Kapalı</option><option value="srgb">sRGB</option><option value="display-p3">Display P3</option><option value="adobe-rgb">Adobe RGB</option><option value="cmyk">CMYK Baskı</option>
          </select>
          <label class="form-label" for="outputSpace">Çıkış renk uzayı simülasyonu</label>
          <select class="form-select form-select-sm mb-3" id="outputSpace">
            <option value="srgb">sRGB</option><option value="display-p3">Display P3</option><option value="adobe-rgb">Adobe RGB</option><option value="cmyk">CMYK</option>
          </select>
          <label class="form-label" for="colorBlind">Renk körlüğü önizlemesi</label>
          <select class="form-select form-select-sm" id="colorBlind">
            <option value="none">Kapalı</option><option value="protanopia">Protanopia</option><option value="deuteranopia">Deuteranopia</option><option value="tritanopia">Tritanopia</option><option value="achromatopsia">Tam renk görmeme</option>
          </select>
          <div class="proof-warning mt-3">Tarayıcı Canvas gerçek ICC profili gömmez. Bu bölüm renk uzaylarını ve baskı davranışını görsel olarak simüle eder.</div>
        </div>
      </details>`;

    bindColorLabControls();
    syncColorLabControls();
  }

  function setRangeUi(id, value, suffix = "") {
    const input = document.getElementById(id);
    const output = document.getElementById(`${id}Output`);
    if (input) input.value = String(value);
    if (output) output.textContent = `${Math.round(Number(value) * 100) / 100}${suffix}`;
  }

  function selectedCurve() {
    return state.colorUi.curveChannel === "master"
      ? state.curve
      : state.colorLab.curves[state.colorUi.curveChannel];
  }

  function drawRgbCurveEditor() {
    const canvas = document.getElementById("rgbCurveCanvas");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const curve = selectedCurve();
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#0d1118";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(255,255,255,.09)";
    context.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      context.beginPath(); context.moveTo(i * width / 4, 0); context.lineTo(i * width / 4, height); context.stroke();
      context.beginPath(); context.moveTo(0, i * height / 4); context.lineTo(width, i * height / 4); context.stroke();
    }
    context.strokeStyle = "rgba(255,255,255,.18)";
    context.beginPath(); context.moveTo(0, height); context.lineTo(width, 0); context.stroke();
    const colors = { master: "#f3f6fb", red: "#ff6b6b", green: "#48d597", blue: "#5b8cff" };
    context.strokeStyle = colors[state.colorUi.curveChannel];
    context.lineWidth = 2;
    context.beginPath();
    curve.forEach((value, index) => {
      const x = index / 4 * width;
      const y = height - value * height;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
    context.fillStyle = colors[state.colorUi.curveChannel];
    curve.forEach((value, index) => {
      const x = index / 4 * width;
      const y = height - value * height;
      context.beginPath(); context.arc(x, y, index === 0 || index === 4 ? 3 : 5, 0, Math.PI * 2); context.fill();
    });
  }

  function rgbCurvePoint(event) {
    const canvas = document.getElementById("rgbCurveCanvas");
    const rect = canvas.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width);
    const y = clamp(1 - (event.clientY - rect.top) / rect.height);
    return { index: clamp(Math.round(x * 4), 1, 3), value: y };
  }

  function updateGradeWheel(zone) {
    const wheel = document.querySelector(`[data-grade-zone="${zone}"]`);
    if (!wheel) return;
    const grade = state.colorLab.grading[zone];
    const angle = (grade.hue - 90) * Math.PI / 180;
    const radius = grade.saturation / 100 * 43;
    wheel.style.setProperty("--dot-x", `${50 + Math.cos(angle) * radius}%`);
    wheel.style.setProperty("--dot-y", `${50 + Math.sin(angle) * radius}%`);
  }

  function syncColorLabControls() {
    if (!els.colorLabContent || !document.getElementById("hslHue")) return;
    document.querySelectorAll("[data-hsl-color]").forEach(button => button.classList.toggle("active", button.dataset.hslColor === state.colorUi.hslColor));
    const hsl = state.colorLab.hsl[state.colorUi.hslColor];
    setRangeUi("hslHue", hsl.hue);
    setRangeUi("hslSaturation", hsl.saturation);
    setRangeUi("hslLuminance", hsl.luminance);

    const setChecked = (id, value) => { const el = document.getElementById(id); if (el) el.checked = Boolean(value); };
    const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = String(value); };
    setChecked("replaceEnabled", state.colorLab.replacement.enabled);
    setValue("replaceTarget", state.colorLab.replacement.target);
    setChecked("replacePreserveLightness", state.colorLab.replacement.preserveLightness);
    setRangeUi("replaceTolerance", state.colorLab.replacement.tolerance);
    setRangeUi("replaceSoftness", state.colorLab.replacement.softness);
    setRangeUi("replaceAmount", state.colorLab.replacement.amount, "%");
    const replaceSwatch = document.getElementById("replaceSourceSwatch");
    if (replaceSwatch) replaceSwatch.style.background = rgbToHex(state.colorLab.replacement.source);

    document.querySelectorAll("[data-curve-channel]").forEach(button => button.classList.toggle("active", button.dataset.curveChannel === state.colorUi.curveChannel));
    drawRgbCurveEditor();

    document.querySelectorAll("[data-balance-zone]").forEach(button => button.classList.toggle("active", button.dataset.balanceZone === state.colorUi.balanceZone));
    const balance = state.colorLab.balance[state.colorUi.balanceZone];
    setRangeUi("balanceCyanRed", balance.cyanRed);
    setRangeUi("balanceMagentaGreen", balance.magentaGreen);
    setRangeUi("balanceYellowBlue", balance.yellowBlue);

    ["shadows", "midtones", "highlights"].forEach(zone => {
      const grade = state.colorLab.grading[zone];
      setRangeUi(`grade-${zone}-sat`, grade.saturation, "%");
      setRangeUi(`grade-${zone}-lum`, grade.luminance);
      updateGradeWheel(zone);
    });
    setRangeUi("gradeBlending", state.colorLab.grading.blending, "%");
    setRangeUi("gradeBalance", state.colorLab.grading.balance);

    setValue("selectiveGroup", state.colorUi.selectiveGroup);
    const selective = state.colorLab.selective[state.colorUi.selectiveGroup];
    setRangeUi("selectiveCyan", selective.cyan);
    setRangeUi("selectiveMagenta", selective.magenta);
    setRangeUi("selectiveYellow", selective.yellow);
    setRangeUi("selectiveBlack", selective.black);

    setValue("mixerOutput", state.colorUi.mixerOutput);
    const mixer = state.colorLab.mixer[state.colorUi.mixerOutput];
    setRangeUi("mixerRed", mixer.red);
    setRangeUi("mixerGreen", mixer.green);
    setRangeUi("mixerBlue", mixer.blue);
    setRangeUi("mixerConstant", mixer.constant);

    setChecked("lutEnabled", state.colorLab.lut.enabled);
    setRangeUi("lutIntensity", state.colorLab.lut.intensity, "%");
    const lutName = document.getElementById("lutName");
    if (lutName) lutName.textContent = state.colorLab.lut.name || "LUT yüklenmedi";
    setValue("filmLook", state.colorLab.filmLook);
    setChecked("skinProtectEnabled", state.colorLab.skinProtect.enabled);
    setRangeUi("skinProtectAmount", state.colorLab.skinProtect.amount, "%");

    setChecked("colorMaskEnabled", state.colorLab.colorMask.enabled);
    setRangeUi("colorMaskTolerance", state.colorLab.colorMask.tolerance);
    setRangeUi("colorMaskSoftness", state.colorLab.colorMask.softness);
    const maskSwatch = document.getElementById("colorMaskSwatch");
    if (maskSwatch) maskSwatch.style.background = rgbToHex(state.colorLab.colorMask.source);
    setChecked("rangeMaskEnabled", state.colorLab.rangeMask.enabled);
    setRangeUi("rangeHueMin", state.colorLab.rangeMask.hueMin, "°");
    setRangeUi("rangeHueMax", state.colorLab.rangeMask.hueMax, "°");
    setRangeUi("rangeSatMin", state.colorLab.rangeMask.satMin, "%");
    setRangeUi("rangeSatMax", state.colorLab.rangeMask.satMax, "%");
    setRangeUi("rangeLumMin", state.colorLab.rangeMask.lumMin, "%");
    setRangeUi("rangeLumMax", state.colorLab.rangeMask.lumMax, "%");

    setValue("harmonySelect", state.colorLab.harmony);
    setChecked("gamutWarning", state.colorLab.gamutWarning);
    setValue("softProof", state.colorLab.softProof);
    setValue("outputSpace", state.colorLab.outputSpace);
    setValue("colorBlind", state.colorLab.colorBlind);
    renderPalette();
    renderHarmony();
  }

  function bindRange(id, onInput, suffix = "") {
    const input = document.getElementById(id);
    if (!input) return;
    on(input, "input", () => {
      const value = Number(input.value);
      const output = document.getElementById(`${id}Output`);
      if (output) output.textContent = `${Math.round(value * 100) / 100}${suffix}`;
      onInput(value);
      scheduleRender();
    });
    on(input, "change", pushHistory);
  }

  function setPickMode(mode) {
    if (!state.image) return notify("Önce bir görsel açın.");
    state.colorUi.pickMode = mode;
    els.canvasStage?.classList.add("pick-mode");
    const labels = { whiteBalance: "Beyaz/gri bir noktaya tıklayın.", replacement: "Değiştirilecek renge tıklayın.", colorMask: "Maskelenecek renge tıklayın." };
    notify(labels[mode] || "Fotoğraf üzerinde bir renk seçin.");
  }

  function applyWhiteBalanceFromRgb(rgb) {
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    state.settings.temperature = clamp((b - r) * 185, -100, 100);
    state.settings.tint = clamp((g - (r + b) / 2) * 205, -100, 100);
  }

  function analyzeSourceSamples() {
    if (!state.image) return [];
    const image = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
    const step = Math.max(1, Math.floor(Math.sqrt((sourceCanvas.width * sourceCanvas.height) / 70000)));
    const samples = [];
    for (let y = 0; y < sourceCanvas.height; y += step) {
      for (let x = 0; x < sourceCanvas.width; x += step) {
        const p = (y * sourceCanvas.width + x) * 4;
        samples.push([image[p], image[p + 1], image[p + 2]]);
      }
    }
    return samples;
  }

  function autoWhiteBalance(commit = true) {
    if (!state.image) return notify("Önce bir görsel açın.");
    const samples = analyzeSourceSamples();
    let r = 0, g = 0, b = 0, count = 0;
    for (const rgb of samples) {
      const [h, s, l] = rgbToHsl(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
      if (l < 0.12 || l > 0.94 || s > 0.48) continue;
      r += rgb[0]; g += rgb[1]; b += rgb[2]; count += 1;
    }
    if (!count) {
      for (const rgb of samples) { r += rgb[0]; g += rgb[1]; b += rgb[2]; }
      count = Math.max(1, samples.length);
    }
    applyWhiteBalanceFromRgb([r / count, g / count, b / count]);
    syncControlsFromState();
    scheduleRender(0);
    if (commit) pushHistory();
    if (commit) notify("Otomatik beyaz dengesi uygulandı.");
  }

  function autoSkinCorrection(commit = true) {
    if (!state.image) return notify("Önce bir görsel açın.");
    const samples = analyzeSourceSamples();
    let hueX = 0, hueY = 0, sat = 0, count = 0;
    for (const rgb of samples) {
      const [h, s, l] = rgbToHsl(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
      const weight = getSkinWeight(h, s, l);
      if (weight < 0.45) continue;
      hueX += Math.cos(h * Math.PI / 180) * weight;
      hueY += Math.sin(h * Math.PI / 180) * weight;
      sat += s * weight;
      count += weight;
    }
    if (count > 8) {
      const avgHue = ((Math.atan2(hueY, hueX) * 180 / Math.PI) + 360) % 360;
      const avgSat = sat / count;
      state.colorLab.hsl.orange.hue = clamp((28 - avgHue) * 1.6, -35, 35);
      state.colorLab.hsl.orange.saturation = clamp((0.42 - avgSat) * 110, -25, 25);
      state.colorLab.skinProtect.enabled = true;
    }
    syncColorLabControls();
    scheduleRender(0);
    if (commit) pushHistory();
    if (commit) notify(count > 8 ? "Ten rengi dengelendi ve koruma açıldı." : "Belirgin ten rengi alanı bulunamadı.");
  }

  function autoSaturationCorrection(commit = true) {
    if (!state.image) return notify("Önce bir görsel açın.");
    const samples = analyzeSourceSamples();
    let total = 0;
    for (const rgb of samples) total += rgbToHsl(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)[1];
    const average = total / Math.max(1, samples.length);
    state.settings.vibrance = clamp((0.34 - average) * 115, -28, 34);
    state.settings.saturation = clamp((0.30 - average) * 45, -12, 12);
    syncControlsFromState();
    scheduleRender(0);
    if (commit) pushHistory();
    if (commit) notify("Doygunluk dengesi uygulandı.");
  }

  function autoColorCorrection() {
    if (!state.image) return notify("Önce bir görsel açın.");
    autoTone(false);
    autoWhiteBalance(false);
    autoSkinCorrection(false);
    autoSaturationCorrection(false);
    syncControlsFromState();
    scheduleRender(0);
    pushHistory();
    notify("Akıllı ton, beyaz dengesi, ten rengi ve doygunluk düzeltildi.");
  }

  function parseCubeLut(text, name) {
    let size = 0;
    const values = [];
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const parts = line.split(/\s+/);
      if (parts[0].toUpperCase() === "LUT_3D_SIZE") {
        size = Number(parts[1]);
        continue;
      }
      if (/^(TITLE|DOMAIN_MIN|DOMAIN_MAX|LUT_1D_SIZE)/i.test(parts[0])) continue;
      if (parts.length >= 3 && parts.slice(0, 3).every(value => Number.isFinite(Number(value)))) {
        values.push(Number(parts[0]), Number(parts[1]), Number(parts[2]));
      }
    }
    if (!Number.isInteger(size) || size < 2 || values.length < size ** 3 * 3) {
      throw new Error("Geçerli bir 3D .cube LUT bulunamadı.");
    }
    state.colorLab.lut = {
      enabled: true,
      name,
      intensity: state.colorLab.lut.intensity || 100,
      size,
      data: new Float32Array(values.slice(0, size ** 3 * 3)),
    };
  }

  function extractDominantPalette() {
    if (!state.image) return notify("Önce bir görsel açın.");
    const context = processedCanvas.getContext("2d", { willReadFrequently: true });
    const pixels = context.getImageData(0, 0, processedCanvas.width, processedCanvas.height).data;
    const step = Math.max(1, Math.floor(Math.sqrt((processedCanvas.width * processedCanvas.height) / 65000)));
    const bins = new Map();
    for (let y = 0; y < processedCanvas.height; y += step) {
      for (let x = 0; x < processedCanvas.width; x += step) {
        const p = (y * processedCanvas.width + x) * 4;
        const r = pixels[p], g = pixels[p + 1], b = pixels[p + 2];
        const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
        const bin = bins.get(key) || { r: 0, g: 0, b: 0, count: 0 };
        bin.r += r; bin.g += g; bin.b += b; bin.count += 1;
        bins.set(key, bin);
      }
    }
    const candidates = [...bins.values()].sort((a, b) => b.count - a.count);
    const palette = [];
    for (const item of candidates) {
      const rgb = [item.r / item.count, item.g / item.count, item.b / item.count].map(Math.round);
      const distinct = palette.every(entry => Math.hypot(rgb[0] - entry.rgb[0], rgb[1] - entry.rgb[1], rgb[2] - entry.rgb[2]) > 52);
      if (!distinct) continue;
      const hsl = rgbToHsl(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
      palette.push({ rgb, hex: rgbToHex(rgb), hsl, count: item.count });
      if (palette.length >= 6) break;
    }
    state.colorUi.palette = palette;
    state.colorUi.paletteBase = palette[0] || null;
    renderPalette();
    renderHarmony();
    notify("Fotoğrafın baskın renk paleti çıkarıldı.");
  }

  function renderPalette() {
    const grid = document.getElementById("paletteGrid");
    if (!grid) return;
    if (!state.colorUi.palette.length) {
      grid.innerHTML = '<div class="colorlab-help" style="grid-column:1/-1">Henüz palet çıkarılmadı.</div>';
      return;
    }
    grid.innerHTML = state.colorUi.palette.map((entry, index) => `
      <button class="palette-swatch" data-palette-index="${index}" title="Bu rengi kaynak renk olarak kullan">
        <div class="palette-swatch-color" style="background:${entry.hex}"></div>
        <div class="palette-swatch-label">${entry.hex.toUpperCase()}<br>H ${Math.round(entry.hsl[0])}°</div>
      </button>`).join("");
    grid.querySelectorAll("[data-palette-index]").forEach(button => {
      on(button, "click", () => {
        const entry = state.colorUi.palette[Number(button.dataset.paletteIndex)];
        state.colorUi.paletteBase = entry;
        state.colorLab.replacement.source = [...entry.rgb];
        state.colorLab.colorMask.source = [...entry.rgb];
        syncColorLabControls();
        renderHarmony();
      });
    });
  }

  function harmonyHues(baseHue, scheme) {
    const offsets = {
      complementary: [0, 180],
      analogous: [-40, -20, 0, 20, 40],
      triadic: [0, 120, 240],
      split: [0, 150, 210],
    }[scheme] || [0, 180];
    return offsets.map(offset => (baseHue + offset + 360) % 360);
  }

  function renderHarmony() {
    const row = document.getElementById("harmonyRow");
    if (!row) return;
    const base = state.colorUi.paletteBase || state.colorUi.palette[0];
    const baseHue = base ? base.hsl[0] : rgbToHsl(...state.colorLab.replacement.source.map(value => value / 255))[0];
    row.innerHTML = harmonyHues(baseHue, state.colorLab.harmony)
      .map(hue => `<span title="H ${Math.round(hue)}°" style="background:hsl(${hue} 66% 52%)"></span>`).join("");
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportPaletteJson() {
    if (!state.colorUi.palette.length) return notify("Önce paleti çıkarın.");
    const payload = state.colorUi.palette.map(entry => ({
      hex: entry.hex.toUpperCase(), rgb: entry.rgb, hsl: [Math.round(entry.hsl[0]), Math.round(entry.hsl[1] * 100), Math.round(entry.hsl[2] * 100)],
    }));
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${state.fileName}-renk-paleti.json`);
  }

  function exportPalettePng() {
    if (!state.colorUi.palette.length) return notify("Önce paleti çıkarın.");
    const canvas = document.createElement("canvas");
    canvas.width = 960; canvas.height = 260;
    const context = canvas.getContext("2d");
    context.fillStyle = "#10131a"; context.fillRect(0, 0, canvas.width, canvas.height);
    const width = canvas.width / state.colorUi.palette.length;
    state.colorUi.palette.forEach((entry, index) => {
      context.fillStyle = entry.hex; context.fillRect(index * width, 0, width, 190);
      context.fillStyle = "#f4f6fa"; context.font = "bold 20px sans-serif"; context.textAlign = "center";
      context.fillText(entry.hex.toUpperCase(), index * width + width / 2, 225);
    });
    canvas.toBlob(blob => blob && downloadBlob(blob, `${state.fileName}-renk-paleti.png`), "image/png");
  }

  function bindColorLabControls() {
    on(document.getElementById("autoColorLabBtn"), "click", autoColorCorrection);
    on(document.getElementById("autoWhiteBalanceBtn"), "click", () => autoWhiteBalance(true));
    on(document.getElementById("autoSkinBtn"), "click", () => autoSkinCorrection(true));
    on(document.getElementById("autoSaturationBtn"), "click", () => autoSaturationCorrection(true));
    on(document.getElementById("whiteBalancePickerBtn"), "click", () => setPickMode("whiteBalance"));

    document.querySelectorAll("[data-hsl-color]").forEach(button => on(button, "click", () => {
      state.colorUi.hslColor = button.dataset.hslColor;
      syncColorLabControls();
    }));
    bindRange("hslHue", value => { state.colorLab.hsl[state.colorUi.hslColor].hue = value; });
    bindRange("hslSaturation", value => { state.colorLab.hsl[state.colorUi.hslColor].saturation = value; });
    bindRange("hslLuminance", value => { state.colorLab.hsl[state.colorUi.hslColor].luminance = value; });

    const bindCheck = (id, setter, render = true) => on(document.getElementById(id), "change", event => {
      setter(event.target.checked); if (render) scheduleRender(0); pushHistory();
    });
    const bindSelect = (id, setter, render = true) => on(document.getElementById(id), "change", event => {
      setter(event.target.value); if (render) scheduleRender(0); pushHistory();
    });

    bindCheck("replaceEnabled", value => { state.colorLab.replacement.enabled = value; });
    bindCheck("replacePreserveLightness", value => { state.colorLab.replacement.preserveLightness = value; });
    on(document.getElementById("replaceTarget"), "input", event => { state.colorLab.replacement.target = event.target.value; scheduleRender(); });
    on(document.getElementById("replaceTarget"), "change", pushHistory);
    on(document.getElementById("replacePickBtn"), "click", () => setPickMode("replacement"));
    bindRange("replaceTolerance", value => { state.colorLab.replacement.tolerance = value; });
    bindRange("replaceSoftness", value => { state.colorLab.replacement.softness = value; });
    bindRange("replaceAmount", value => { state.colorLab.replacement.amount = value; }, "%");

    document.querySelectorAll("[data-curve-channel]").forEach(button => on(button, "click", () => {
      state.colorUi.curveChannel = button.dataset.curveChannel;
      syncColorLabControls();
    }));
    const curveCanvas = document.getElementById("rgbCurveCanvas");
    on(curveCanvas, "pointerdown", event => {
      if (!state.image) return;
      event.preventDefault();
      const point = rgbCurvePoint(event);
      state.colorUi.curvePoint = point.index;
      selectedCurve()[point.index] = point.value;
      curveCanvas.setPointerCapture(event.pointerId);
      drawRgbCurveEditor(); scheduleRender();
    });
    on(curveCanvas, "pointermove", event => {
      if (state.colorUi.curvePoint === null) return;
      const point = rgbCurvePoint(event);
      selectedCurve()[state.colorUi.curvePoint] = point.value;
      drawRgbCurveEditor(); scheduleRender();
    });
    on(curveCanvas, "pointerup", event => {
      if (state.colorUi.curvePoint === null) return;
      try { curveCanvas.releasePointerCapture(event.pointerId); } catch (_) {}
      state.colorUi.curvePoint = null; scheduleRender(0); pushHistory();
    });
    on(curveCanvas, "dblclick", () => {
      if (state.colorUi.curveChannel === "master") state.curve = [...DEFAULT_CURVE];
      else state.colorLab.curves[state.colorUi.curveChannel] = [...DEFAULT_CURVE];
      drawRgbCurveEditor(); scheduleRender(0); pushHistory();
    });

    document.querySelectorAll("[data-balance-zone]").forEach(button => on(button, "click", () => {
      state.colorUi.balanceZone = button.dataset.balanceZone; syncColorLabControls();
    }));
    bindRange("balanceCyanRed", value => { state.colorLab.balance[state.colorUi.balanceZone].cyanRed = value; });
    bindRange("balanceMagentaGreen", value => { state.colorLab.balance[state.colorUi.balanceZone].magentaGreen = value; });
    bindRange("balanceYellowBlue", value => { state.colorLab.balance[state.colorUi.balanceZone].yellowBlue = value; });

    document.querySelectorAll("[data-grade-zone]").forEach(wheel => {
      const update = event => {
        const rect = wheel.getBoundingClientRect();
        const dx = event.clientX - rect.left - rect.width / 2;
        const dy = event.clientY - rect.top - rect.height / 2;
        const radius = Math.min(1, Math.hypot(dx, dy) / (rect.width * 0.46));
        const hue = ((Math.atan2(dy, dx) * 180 / Math.PI + 90) + 360) % 360;
        const zone = wheel.dataset.gradeZone;
        state.colorLab.grading[zone].hue = hue;
        state.colorLab.grading[zone].saturation = Math.round(radius * 100);
        setRangeUi(`grade-${zone}-sat`, state.colorLab.grading[zone].saturation, "%");
        updateGradeWheel(zone); scheduleRender();
      };
      on(wheel, "pointerdown", event => { event.preventDefault(); wheel.setPointerCapture(event.pointerId); update(event); });
      on(wheel, "pointermove", event => { if (wheel.hasPointerCapture(event.pointerId)) update(event); });
      on(wheel, "pointerup", event => { try { wheel.releasePointerCapture(event.pointerId); } catch (_) {} pushHistory(); });
    });
    ["shadows", "midtones", "highlights"].forEach(zone => {
      bindRange(`grade-${zone}-sat`, value => { state.colorLab.grading[zone].saturation = value; updateGradeWheel(zone); }, "%");
      bindRange(`grade-${zone}-lum`, value => { state.colorLab.grading[zone].luminance = value; });
    });
    bindRange("gradeBlending", value => { state.colorLab.grading.blending = value; }, "%");
    bindRange("gradeBalance", value => { state.colorLab.grading.balance = value; });

    on(document.getElementById("selectiveGroup"), "change", event => { state.colorUi.selectiveGroup = event.target.value; syncColorLabControls(); });
    bindRange("selectiveCyan", value => { state.colorLab.selective[state.colorUi.selectiveGroup].cyan = value; });
    bindRange("selectiveMagenta", value => { state.colorLab.selective[state.colorUi.selectiveGroup].magenta = value; });
    bindRange("selectiveYellow", value => { state.colorLab.selective[state.colorUi.selectiveGroup].yellow = value; });
    bindRange("selectiveBlack", value => { state.colorLab.selective[state.colorUi.selectiveGroup].black = value; });

    on(document.getElementById("mixerOutput"), "change", event => { state.colorUi.mixerOutput = event.target.value; syncColorLabControls(); });
    bindRange("mixerRed", value => { state.colorLab.mixer[state.colorUi.mixerOutput].red = value; });
    bindRange("mixerGreen", value => { state.colorLab.mixer[state.colorUi.mixerOutput].green = value; });
    bindRange("mixerBlue", value => { state.colorLab.mixer[state.colorUi.mixerOutput].blue = value; });
    bindRange("mixerConstant", value => { state.colorLab.mixer[state.colorUi.mixerOutput].constant = value; });

    on(document.getElementById("loadLutBtn"), "click", () => document.getElementById("lutFileInput")?.click());
    on(document.getElementById("lutFileInput"), "change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        parseCubeLut(await file.text(), file.name);
        syncColorLabControls(); scheduleRender(0); pushHistory(); notify(`${file.name} LUT yüklendi.`);
      } catch (error) { console.error(error); notify(error.message || "LUT okunamadı."); }
      event.target.value = "";
    });
    on(document.getElementById("removeLutBtn"), "click", () => {
      state.colorLab.lut = { enabled: false, name: "", intensity: 100, size: 0, data: null };
      syncColorLabControls(); scheduleRender(0); pushHistory();
    });
    bindCheck("lutEnabled", value => { state.colorLab.lut.enabled = value; });
    bindRange("lutIntensity", value => { state.colorLab.lut.intensity = value; }, "%");
    bindSelect("filmLook", value => { state.colorLab.filmLook = value; });
    bindCheck("skinProtectEnabled", value => { state.colorLab.skinProtect.enabled = value; });
    bindRange("skinProtectAmount", value => { state.colorLab.skinProtect.amount = value; }, "%");

    bindCheck("colorMaskEnabled", value => { state.colorLab.colorMask.enabled = value; });
    on(document.getElementById("colorMaskPickBtn"), "click", () => setPickMode("colorMask"));
    bindRange("colorMaskTolerance", value => { state.colorLab.colorMask.tolerance = value; });
    bindRange("colorMaskSoftness", value => { state.colorLab.colorMask.softness = value; });
    bindCheck("rangeMaskEnabled", value => { state.colorLab.rangeMask.enabled = value; });
    bindRange("rangeHueMin", value => { state.colorLab.rangeMask.hueMin = value; }, "°");
    bindRange("rangeHueMax", value => { state.colorLab.rangeMask.hueMax = value; }, "°");
    bindRange("rangeSatMin", value => { state.colorLab.rangeMask.satMin = value; }, "%");
    bindRange("rangeSatMax", value => { state.colorLab.rangeMask.satMax = value; }, "%");
    bindRange("rangeLumMin", value => { state.colorLab.rangeMask.lumMin = value; }, "%");
    bindRange("rangeLumMax", value => { state.colorLab.rangeMask.lumMax = value; }, "%");

    on(document.getElementById("extractPaletteBtn"), "click", extractDominantPalette);
    on(document.getElementById("exportPalettePngBtn"), "click", exportPalettePng);
    on(document.getElementById("exportPaletteJsonBtn"), "click", exportPaletteJson);
    on(document.getElementById("harmonySelect"), "change", event => { state.colorLab.harmony = event.target.value; renderHarmony(); pushHistory(); });

    bindCheck("gamutWarning", value => { state.colorLab.gamutWarning = value; }, false);
    on(document.getElementById("gamutWarning"), "change", drawDisplay);
    bindSelect("softProof", value => { state.colorLab.softProof = value; });
    bindSelect("outputSpace", value => { state.colorLab.outputSpace = value; });
    bindSelect("colorBlind", value => { state.colorLab.colorBlind = value; }, false);
    on(document.getElementById("colorBlind"), "change", drawDisplay);
  }

  function handleColorPick(event) {
    const mode = state.colorUi.pickMode;
    if (!mode || !state.image) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = canvasPointFromEvent(event);
    const x = clamp(Math.round(point.x), 0, sourceCanvas.width - 1);
    const y = clamp(Math.round(point.y), 0, sourceCanvas.height - 1);
    const pixel = sourceCtx.getImageData(x, y, 1, 1).data;
    const rgb = [pixel[0], pixel[1], pixel[2]];
    if (mode === "whiteBalance") applyWhiteBalanceFromRgb(rgb);
    else if (mode === "replacement") {
      state.colorLab.replacement.source = rgb;
      state.colorLab.replacement.enabled = true;
    } else if (mode === "colorMask") {
      state.colorLab.colorMask.source = rgb;
      state.colorLab.colorMask.enabled = true;
    }
    state.colorUi.pickMode = null;
    els.canvasStage?.classList.remove("pick-mode");
    syncControlsFromState(); scheduleRender(0); pushHistory();
    notify("Renk fotoğraftan seçildi.");
  }

  function resetColorLab() {
    if (!state.image) return;
    const existingLut = state.colorLab.lut;
    state.colorLab = createDefaultColorLab();
    if (existingLut?.data) state.colorLab.lut = { ...existingLut, enabled: false };
    state.curve = [...DEFAULT_CURVE];
    syncColorLabControls(); drawToneCurve(); scheduleRender(0); pushHistory();
    notify("Gelişmiş renk ayarları sıfırlandı.");
  }


  function resetAll() {
    if (!state.image) return;
    state.settings = { ...DEFAULTS };
    state.profile = "adobe-color";
    state.bw = false;
    state.hdr = false;
    state.options = { removeCA: false, lensCorrections: false };
    state.curve = [...DEFAULT_CURVE];
    state.colorLab = createDefaultColorLab();
    state.colorUi.palette = [];
    state.colorUi.paletteBase = null;
    clearMask(false);
    syncControlsFromState();
    scheduleRender(0);
    pushHistory();
    notify("Tüm düzenleme ayarları sıfırlandı.");
  }

  buildColorLabPanel();
  on(els.resetColorLabBtn, "click", resetColorLab);
  on(els.displayCanvas, "pointerdown", handleColorPick, true);

  // Görsel açma, sürükle-bırak ve panodan yapıştırma.
  on(els.openBtn, "click", () => els.fileInput?.click());
  on(els.emptyOpenBtn, "click", () => els.fileInput?.click());
  on(els.fileInput, "change", () => {
    const file = els.fileInput.files?.[0];
    if (file) loadImageFromBlob(file, file.name);
    els.fileInput.value = "";
  });

  on(window, "dragover", event => event.preventDefault());
  on(window, "drop", event => {
    event.preventDefault();
    const file = [...(event.dataTransfer?.files || [])].find(item => item.type.startsWith("image/"));
    if (file) loadImageFromBlob(file, file.name);
  });

  on(window, "paste", event => {
    const item = [...(event.clipboardData?.items || [])].find(entry => entry.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) loadImageFromBlob(file, "yapistirilan-gorsel.png");
  });

  // Araç panelleri.
  $$(".tool-btn").forEach(button => {
    on(button, "click", () => switchTool(button.dataset.tool));
  });

  // Lightroom benzeri kaydırıcılar.
  $$(".range-control[data-key]").forEach(group => {
    const key = group.dataset.key;
    const input = $("input[type='range']", group);
    const output = $("output", group);
    if (!input || !(key in DEFAULTS)) return;

    on(input, "input", () => {
      state.settings[key] = Number(input.value);
      if (output) output.textContent = formatValue(key, input.value);
      scheduleRender();
    });

    on(input, "change", pushHistory);

    on(input, "dblclick", () => {
      state.settings[key] = DEFAULTS[key];
      input.value = String(DEFAULTS[key]);
      if (output) output.textContent = formatValue(key, DEFAULTS[key]);
      scheduleRender(0);
      pushHistory();
    });
  });

  on(els.resetAllBtn, "click", resetAll);
  on(els.autoToneBtn, "click", autoTone);

  on(els.bwModeBtn, "click", () => {
    if (!state.image) return notify("Önce bir görsel açın.");
    state.bw = !state.bw;
    els.bwModeBtn.classList.toggle("active", state.bw);
    scheduleRender(0);
    pushHistory();
  });

  on(els.hdrModeBtn, "click", () => {
    if (!state.image) return notify("Önce bir görsel açın.");
    state.hdr = !state.hdr;
    els.hdrModeBtn.classList.toggle("active", state.hdr);
    scheduleRender(0);
    pushHistory();
  });

  on(els.profileSelect, "change", () => {
    state.profile = els.profileSelect.value;
    scheduleRender(0);
    pushHistory();
  });

  on(els.removeCA, "change", () => {
    state.options.removeCA = els.removeCA.checked;
    scheduleRender(0);
    pushHistory();
  });

  on(els.enableLensCorrections, "change", () => {
    state.options.lensCorrections = els.enableLensCorrections.checked;
    scheduleRender(0);
    pushHistory();
  });

  // Karşılaştırma ve yakınlaştırma.
  on(els.compareRange, "input", () => {
    state.compare = Number(els.compareRange.value);
    updateCompareLine();
    drawDisplay();
  });

  on(els.zoomRange, "input", () => {
    state.zoom = Number(els.zoomRange.value);
    applyZoom();
  });
  on(els.fitBtn, "click", fitToWorkspace);

  on(els.beforeHoldBtn, "pointerdown", event => {
    event.preventDefault();
    setShowOriginal(true);
  });
  on(window, "pointerup", () => setShowOriginal(false));
  on(window, "pointercancel", () => setShowOriginal(false));

  // Ton eğrisi: üç orta nokta sürüklenebilir, çift tıklama sıfırlar.
  on(els.toneCurveCanvas, "pointerdown", event => {
    if (!state.image) return;
    event.preventDefault();
    const point = curvePointFromEvent(event);
    state.curvePoint = point.index;
    state.curve[point.index] = point.value;
    els.toneCurveCanvas.setPointerCapture(event.pointerId);
    drawToneCurve();
    scheduleRender();
  });

  on(els.toneCurveCanvas, "pointermove", event => {
    if (state.curvePoint === null) return;
    const point = curvePointFromEvent(event);
    state.curve[state.curvePoint] = point.value;
    drawToneCurve();
    scheduleRender();
  });

  on(els.toneCurveCanvas, "pointerup", event => {
    if (state.curvePoint === null) return;
    try { els.toneCurveCanvas.releasePointerCapture(event.pointerId); } catch (_) {}
    state.curvePoint = null;
    drawToneCurve();
    scheduleRender(0);
    pushHistory();
  });

  on(els.toneCurveCanvas, "dblclick", () => {
    state.curve = [...DEFAULT_CURVE];
    drawToneCurve();
    scheduleRender(0);
    pushHistory();
  });

  // Fırça.
  if (els.displayCanvas) els.displayCanvas.style.touchAction = "none";

  on(els.brushSizeRange, "input", () => {
    state.brushSize = Number(els.brushSizeRange.value);
    if (els.brushSizeOutput) els.brushSizeOutput.textContent = `${state.brushSize} px`;
    updateBrushCursorSize();
  });

  on(els.brushOpacityRange, "input", () => {
    state.brushOpacity = Number(els.brushOpacityRange.value);
    if (els.brushOpacityOutput) els.brushOpacityOutput.textContent = `${state.brushOpacity}%`;
  });

  on(els.brushFeatherRange, "input", () => {
    state.brushFeather = Number(els.brushFeatherRange.value);
    if (els.brushFeatherOutput) els.brushFeatherOutput.textContent = `${state.brushFeather}%`;
  });

  $$('[data-brush-mode]').forEach(button => {
    on(button, "click", () => {
      state.brushMode = button.dataset.brushMode;
      $$('[data-brush-mode]').forEach(item => item.classList.toggle("active", item === button));
    });
  });

  on(els.displayCanvas, "pointerenter", () => {
    if (state.tool === "brush" && state.image) els.brushCursor?.classList.remove("d-none");
  });

  on(els.displayCanvas, "pointerleave", () => {
    els.brushCursor?.classList.add("d-none");
  });

  on(els.displayCanvas, "pointermove", event => {
    if (state.tool !== "brush" || !state.image) return;
    const stageRect = els.canvasStage.getBoundingClientRect();
    if (els.brushCursor) {
      els.brushCursor.style.left = `${event.clientX - stageRect.left}px`;
      els.brushCursor.style.top = `${event.clientY - stageRect.top}px`;
    }

    if (!state.isPainting) return;
    const point = canvasPointFromEvent(event);
    paintLine(state.lastPoint || point, point);
    state.lastPoint = point;
    scheduleRender(18);
  });

  on(els.displayCanvas, "pointerdown", event => {
    if (state.tool !== "brush" || !state.image) return;
    event.preventDefault();
    els.displayCanvas.setPointerCapture(event.pointerId);
    state.isPainting = true;
    const point = canvasPointFromEvent(event);
    drawMaskPoint(point.x, point.y);
    state.lastPoint = point;
    scheduleRender(18);
  });

  const finishPainting = event => {
    if (!state.isPainting) return;
    state.isPainting = false;
    state.lastPoint = null;
    try { els.displayCanvas.releasePointerCapture(event.pointerId); } catch (_) {}
    scheduleRender(0);
    pushHistory();
  };
  on(els.displayCanvas, "pointerup", finishPainting);
  on(els.displayCanvas, "pointercancel", finishPainting);
  on(els.clearMaskBtn, "click", () => clearMask(true));

  // Dönüşüm.
  on(els.rotateLeftBtn, "click", async () => {
    state.transform.rotation = (state.transform.rotation - 90 + 360) % 360;
    await applyTransformChange();
  });
  on(els.rotateRightBtn, "click", async () => {
    state.transform.rotation = (state.transform.rotation + 90) % 360;
    await applyTransformChange();
  });
  on(els.flipHBtn, "click", async () => {
    state.transform.flipX = !state.transform.flipX;
    await applyTransformChange();
  });
  on(els.flipVBtn, "click", async () => {
    state.transform.flipY = !state.transform.flipY;
    await applyTransformChange();
  });

  // Geçmiş ve dışa aktarma.
  on(els.undoBtn, "click", undo);
  on(els.redoBtn, "click", redo);
  on(els.exportBtn, "click", exportImage);

  // Klavye kısayolları.
  on(window, "keydown", event => {
    const activeTag = document.activeElement?.tagName;
    const typing = activeTag === "INPUT" || activeTag === "SELECT" || activeTag === "TEXTAREA";

    if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
      return;
    }

    if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }

    if (!typing && event.code === "Space" && !event.repeat) {
      event.preventDefault();
      setShowOriginal(true);
    }
  });

  on(window, "keyup", event => {
    if (event.code === "Space") setShowOriginal(false);
  });

  on(window, "resize", () => {
    if (state.image && state.zoom <= 100) fitToWorkspace();
  });

  on(window, "beforeunload", () => {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  });

  updateHistoryButtons();
  syncControlsFromState();
  switchTool("adjust");
})();
