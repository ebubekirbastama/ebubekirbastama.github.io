
    'use strict';

    const $ = (id) => document.getElementById(id);

    const els = {
      imageInput: $('imageInput'),
      dropzone: $('dropzone'),
      previewCanvas: $('previewCanvas'),
      blurredCanvas: $('blurredCanvas'),
      clearImageCanvas: $('clearImageCanvas'),
      emptyState: $('emptyState'),
      saveBtn: $('saveBtn'),
      resetBtn: $('resetBtn'),
      statusText: $('statusText'),
      blurredWidthSlider: $('blurredWidthSlider'),
      blurredHeightSlider: $('blurredHeightSlider'),
      blurredWidthValue: $('blurredWidthValue'),
      blurredHeightValue: $('blurredHeightValue'),
      blurSlider: $('blurSlider'),
      blurValue: $('blurValue'),
      widthSlider: $('widthSlider'),
      heightSlider: $('heightSlider'),
      widthValue: $('widthValue'),
      heightValue: $('heightValue'),
      borderSlider: $('borderSlider'),
      borderValue: $('borderValue'),
      borderColorPicker: $('borderColorPicker'),
      borderColorValue: $('borderColorValue'),
      radiusSlider: $('radiusSlider'),
      radiusValue: $('radiusValue'),
      fitMode: $('fitMode'),
      formatSelect: $('formatSelect'),
      qualitySelect: $('qualitySelect'),
      watermarkToggle: $('watermarkToggle'),
      autoDownloadToggle: $('autoDownloadToggle'),
      toast: $('toast')
    };

    const defaults = {
      bgWidth: 1280,
      bgHeight: 720,
      blur: 25,
      fgWidth: 900,
      fgHeight: 600,
      border: 8,
      borderColor: '#ffffff',
      radius: 0,
      fitMode: 'contain',
      format: 'image/webp',
      quality: '0.9'
    };

    let uploadedImage = null;
    let sourceName = 'ebs-gorsel';
    let toastTimer = null;

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function showToast(message) {
      els.toast.textContent = message;
      els.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2400);
    }

    function setStatus(message) {
      els.statusText.textContent = message;
    }

    function syncLabels() {
      els.blurredWidthValue.textContent = `${els.blurredWidthSlider.value} px`;
      els.blurredHeightValue.textContent = `${els.blurredHeightSlider.value} px`;
      els.blurValue.textContent = `${els.blurSlider.value} px`;
      els.widthValue.textContent = `${els.widthSlider.value} px`;
      els.heightValue.textContent = `${els.heightSlider.value} px`;
      els.borderValue.textContent = `${els.borderSlider.value} px`;
      els.borderColorValue.textContent = els.borderColorPicker.value;
      els.radiusValue.textContent = `${els.radiusSlider.value} px`;
    }

    function roundedRectPath(ctx, x, y, w, h, radius) {
      const r = clamp(radius, 0, Math.min(w, h) / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawImageFit(ctx, img, x, y, boxW, boxH, mode) {
      if (mode === 'stretch') {
        ctx.drawImage(img, x, y, boxW, boxH);
        return;
      }

      const imgRatio = img.width / img.height;
      const boxRatio = boxW / boxH;
      let drawW, drawH, offsetX, offsetY;

      if ((mode === 'cover' && imgRatio > boxRatio) || (mode === 'contain' && imgRatio < boxRatio)) {
        drawH = boxH;
        drawW = drawH * imgRatio;
      } else {
        drawW = boxW;
        drawH = drawW / imgRatio;
      }

      offsetX = x + (boxW - drawW) / 2;
      offsetY = y + (boxH - drawH) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    }

    function coverDimensions(img, targetW, targetH) {
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      return { w, h, x: (targetW - w) / 2, y: (targetH - h) / 2 };
    }

    function renderPreview() {
      syncLabels();
      if (!uploadedImage) return;

      const bgWidth = Number(els.blurredWidthSlider.value);
      const bgHeight = Number(els.blurredHeightSlider.value);
      const blurPx = Number(els.blurSlider.value);
      const border = Number(els.borderSlider.value);
      const radius = Number(els.radiusSlider.value);
      const requestedFgW = Number(els.widthSlider.value);
      const requestedFgH = Number(els.heightSlider.value);
      const fgW = clamp(requestedFgW, 40, Math.max(40, bgWidth - border * 2));
      const fgH = clamp(requestedFgH, 40, Math.max(40, bgHeight - border * 2));
      const fitMode = els.fitMode.value;
      const borderColor = els.borderColorPicker.value;

      const preview = els.previewCanvas;
      const ctx = preview.getContext('2d', { alpha: false });
      preview.width = bgWidth;
      preview.height = bgHeight;

      // Keep original hidden canvases updated for backward compatibility.
      els.blurredCanvas.width = bgWidth;
      els.blurredCanvas.height = bgHeight;
      els.clearImageCanvas.width = fgW;
      els.clearImageCanvas.height = fgH;

      const blurredCtx = els.blurredCanvas.getContext('2d');
      blurredCtx.clearRect(0, 0, bgWidth, bgHeight);
      blurredCtx.save();
      blurredCtx.filter = `blur(${blurPx}px)`;
      const bleed = Math.max(blurPx * 2, 20);
      const cover = coverDimensions(uploadedImage, bgWidth + bleed * 2, bgHeight + bleed * 2);
      blurredCtx.drawImage(uploadedImage, cover.x - bleed, cover.y - bleed, cover.w, cover.h);
      blurredCtx.restore();

      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, bgWidth, bgHeight);
      ctx.drawImage(els.blurredCanvas, 0, 0);

      const x = (bgWidth - fgW) / 2;
      const y = (bgHeight - fgH) / 2;

      ctx.save();
      roundedRectPath(ctx, x, y, fgW, fgH, radius);
      ctx.clip();
      drawImageFit(ctx, uploadedImage, x, y, fgW, fgH, fitMode);
      ctx.restore();

      // Update clear image canvas as in the original implementation.
      const clearCtx = els.clearImageCanvas.getContext('2d');
      clearCtx.clearRect(0, 0, fgW, fgH);
      clearCtx.save();
      roundedRectPath(clearCtx, 0, 0, fgW, fgH, radius);
      clearCtx.clip();
      drawImageFit(clearCtx, uploadedImage, 0, 0, fgW, fgH, fitMode);
      clearCtx.restore();

      if (border > 0) {
        ctx.save();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = border;
        roundedRectPath(ctx, x + border / 2, y + border / 2, fgW - border, fgH - border, Math.max(0, radius - border / 2));
        ctx.stroke();
        ctx.restore();
      }

      els.emptyState.classList.add('hidden');
      preview.classList.remove('hidden');
      els.saveBtn.disabled = false;
      setStatus(`${bgWidth} × ${bgHeight} px`);
    }

    function addInvisibleWatermark(canvas, context) {
      if (!els.watermarkToggle.checked) return;
      const text = 'www.ebubekirbastama.com.tr';
      const fontSize = Math.max(14, Math.round(canvas.width / 64));
      const padding = Math.max(10, Math.round(canvas.width / 100));
      context.save();
      context.globalAlpha = 0.02;
      context.font = `${fontSize}px Arial, sans-serif`;
      context.fillStyle = '#000000';
      const textWidth = context.measureText(text).width;
      context.fillText(text, Math.max(padding, canvas.width - textWidth - padding), canvas.height - padding);
      context.restore();
    }

    function createFinalCanvas() {
      renderPreview();
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = els.previewCanvas.width;
      finalCanvas.height = els.previewCanvas.height;
      const finalCtx = finalCanvas.getContext('2d');
      finalCtx.drawImage(els.previewCanvas, 0, 0);
      addInvisibleWatermark(finalCanvas, finalCtx);
      return finalCanvas;
    }

    function saveImage({ silent = false } = {}) {
      if (!uploadedImage) {
        showToast('Önce bir görsel yükleyin.');
        return;
      }

      const finalCanvas = createFinalCanvas();
      const mime = els.formatSelect.value;
      const quality = Number(els.qualitySelect.value);
      const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp';
      const cleanName = (sourceName || 'ebs-gorsel')
        .replace(/\.[^.]+$/, '')
        .toLocaleLowerCase('tr-TR')
        .replace(/[^a-z0-9çğıöşü]+/gi, '-')
        .replace(/^-+|-+$/g, '') || 'ebs-gorsel';
      const fileName = `${cleanName}-${finalCanvas.width}x${finalCanvas.height}.${ext}`;

      const downloadBlob = (blob) => {
        if (!blob) {
          showToast('Bu çıktı formatı tarayıcınızda desteklenmiyor.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        if (!silent) showToast(`İndirildi: ${fileName}`);
      };

      if (finalCanvas.toBlob) {
        finalCanvas.toBlob(downloadBlob, mime, mime === 'image/png' ? undefined : quality);
      } else {
        const dataUrl = finalCanvas.toDataURL(mime, quality);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        if (!silent) showToast(`İndirildi: ${fileName}`);
      }
    }

    function handleFile(file) {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Lütfen geçerli bir görsel dosyası seçin.');
        return;
      }

      sourceName = file.name || 'ebs-gorsel';
      setStatus('Görsel yükleniyor…');

      const reader = new FileReader();
      reader.onerror = () => {
        setStatus('Yükleme başarısız');
        showToast('Dosya okunamadı.');
      };
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          uploadedImage = img;

          // Use image ratio to make the initial foreground fit naturally inside the default canvas.
          const bgW = Number(els.blurredWidthSlider.value);
          const bgH = Number(els.blurredHeightSlider.value);
          const scale = Math.min((bgW * .82) / img.width, (bgH * .82) / img.height);
          els.widthSlider.value = Math.round(clamp(img.width * scale, Number(els.widthSlider.min), Number(els.widthSlider.max)) / 10) * 10;
          els.heightSlider.value = Math.round(clamp(img.height * scale, Number(els.heightSlider.min), Number(els.heightSlider.max)) / 10) * 10;

          renderPreview();
          showToast('Görsel hazır. Ayarları değiştirebilirsiniz.');
          if (els.autoDownloadToggle.checked) {
            setTimeout(() => saveImage({ silent: true }), 180);
          }
        };
        img.onerror = () => {
          setStatus('Görsel açılamadı');
          showToast('Bu görsel tarayıcı tarafından açılamadı.');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }

    function resetEditor() {
      uploadedImage = null;
      sourceName = 'ebs-gorsel';
      els.imageInput.value = '';
      els.blurredWidthSlider.value = defaults.bgWidth;
      els.blurredHeightSlider.value = defaults.bgHeight;
      els.blurSlider.value = defaults.blur;
      els.widthSlider.value = defaults.fgWidth;
      els.heightSlider.value = defaults.fgHeight;
      els.borderSlider.value = defaults.border;
      els.borderColorPicker.value = defaults.borderColor;
      els.radiusSlider.value = defaults.radius;
      els.fitMode.value = defaults.fitMode;
      els.formatSelect.value = defaults.format;
      els.qualitySelect.value = defaults.quality;
      els.previewCanvas.classList.add('hidden');
      els.emptyState.classList.remove('hidden');
      els.saveBtn.disabled = true;
      setStatus('Görsel bekleniyor');
      syncLabels();
      showToast('Ayarlar sıfırlandı.');
    }

    // Original function names are kept for compatibility with the previous version.
    function handleImageUpload(event) { handleFile(event.target.files[0]); }
    function updateBlurredCanvasDimensions() { renderPreview(); }
    function updateBorderColor() { renderPreview(); }
    function updateBorder() { renderPreview(); }
    function updateDimensions() { renderPreview(); }

    els.imageInput.addEventListener('change', handleImageUpload);
    els.saveBtn.addEventListener('click', () => saveImage());
    els.resetBtn.addEventListener('click', resetEditor);

    [
      els.blurredWidthSlider,
      els.blurredHeightSlider,
      els.blurSlider,
      els.widthSlider,
      els.heightSlider,
      els.borderSlider,
      els.radiusSlider,
      els.borderColorPicker,
      els.fitMode
    ].forEach((el) => el.addEventListener('input', renderPreview));

    document.querySelectorAll('.preset').forEach((button) => {
      button.addEventListener('click', () => {
        const width = Number(button.dataset.width);
        const height = Number(button.dataset.height);
        els.blurredWidthSlider.value = clamp(width, Number(els.blurredWidthSlider.min), Number(els.blurredWidthSlider.max));
        els.blurredHeightSlider.value = clamp(height, Number(els.blurredHeightSlider.min), Number(els.blurredHeightSlider.max));
        renderPreview();
        showToast(`${width} × ${height} ölçüsü seçildi.`);
      });
    });

    ['dragenter', 'dragover'].forEach((name) => {
      els.dropzone.addEventListener(name, (event) => {
        event.preventDefault();
        els.dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach((name) => {
      els.dropzone.addEventListener(name, (event) => {
        event.preventDefault();
        els.dropzone.classList.remove('dragover');
      });
    });
    els.dropzone.addEventListener('drop', (event) => {
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      handleFile(file);
    });

    els.formatSelect.addEventListener('change', () => {
      const isPng = els.formatSelect.value === 'image/png';
      els.qualitySelect.disabled = isPng;
      if (isPng) showToast('PNG kayıpsızdır; kalite seçeneği uygulanmaz.');
    });

    $('year').textContent = new Date().getFullYear();
    syncLabels();
  