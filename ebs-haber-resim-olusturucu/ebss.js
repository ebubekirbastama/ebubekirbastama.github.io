let selected = null;
let zCounter = 100;

function createBox(cls) {
    const el = document.createElement('div');
    el.className = 'box ' + cls;
    el.style.left = '100px';
    el.style.top = '100px';
    el.style.zIndex = zCounter++;
    el.setAttribute('data-skewx', '0');
    el.setAttribute('data-skewy', '0');
    document.getElementById('canvasWrap').appendChild(el);
    return el;
}

function changeBgColor(val) {
    const wrap = document.getElementById('canvasWrap');
    wrap.style.backgroundImage = 'none';
    wrap.style.backgroundColor = val;
}


function addShape() {
    const el = createBox('shape-box');
    el.style.width = '350px';
    el.style.height = '150px';
    el.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
    addEvents(el);
}

function addText(val, cls, size) {
    const el = createBox(cls);
    el.contentEditable = true;
    el.style.fontSize = size + 'px';
    el.innerHTML = val;
    addEvents(el);
}

function addParagraph(title, desc) {
    const el = createBox('paragraph-box');
    el.style.width = '350px';
    el.style.height = 'auto';
    el.innerHTML = `<div class="p-title" contenteditable="true">${title}</div><div class="p-desc" contenteditable="true">${desc}</div>`;
    addEvents(el);
}

function addSonDakika() {
    const el = createBox('son-dakika');
    el.innerHTML = '<span>SON</span><div style="font-size:20px; background:#fff; color:#ce0000; padding:0 10px; border-radius:5px">DAKİKA</div>';
    addEvents(el);
}

function addQuote(text, author) {
    const el = createBox('quote-box');
    el.style.width = '420px';
    el.style.height = 'auto';
    el.style.padding = '20px 20px 20px 35px'; // Tırnak işareti için sol padding artırıldı
    el.innerHTML = `<div class="q-text" contenteditable="true">${text}</div><div class="q-author" contenteditable="true">${author}</div>`;
    
    // Alt öğelere tıklandığında da kutunun seçilmesini garanti altına alıyoruz
    el.querySelectorAll('.q-text, .q-author').forEach(child => {
        child.addEventListener('focus', () => select(el));
    });

    addEvents(el);
}

function addBrush() {
    const el = createBox('brush-splatter');
    el.style.width = '400px';
    el.style.height = '150px';
    addEvents(el);
}

function addIcon(iconClass) {
    const el = createBox('video-icon');
    el.innerHTML = `<i class="fas ${iconClass}"></i>`;
    addEvents(el);
}

function addEvents(el) {
    el.addEventListener('mousedown', (e) => {
        // Eğer tıklanan yer yazılabilir (contenteditable) bir alan ise sürükleme ve çoklu seçimi engellememesi için duruma göre ayarlanır
        select(el, e);
    });
}

function select(el, event) {
    // Eğer Ctrl veya Meta (Cmd) tuşuna basılmıyorsa diğer tüm seçimleri kaldır
    if (!event || (!event.ctrlKey && !event.metaKey)) {
        document.querySelectorAll('.box').forEach(b => b.classList.remove('selected'));
    }

    // Tıklanan öğenin seçim durumunu tersine çevir (Açıksa kapat, kapalıysa aç)
    if (event && (event.ctrlKey || event.metaKey)) {
        el.classList.toggle('selected');
    } else {
        el.classList.add('selected');
    }

    // En son seçilen öğeyi ana "selected" öğesi yap (Slider ve renk kontrolleri için)
    selected = el.classList.contains('selected') ? el : null;

    if (selected) {
        // Değerleri sliderlara geri yükle
        document.getElementById('skewXSlider').value = selected.getAttribute('data-skewx') || 0;
        document.getElementById('skewYSlider').value = selected.getAttribute('data-skewy') || 0;

        const style = window.getComputedStyle(selected);
        document.getElementById('radiusTopSlider').value = parseInt(style.borderTopLeftRadius) || 0;
        document.getElementById('radiusBottomSlider').value = parseInt(style.borderBottomLeftRadius) || 0;

        // Renk kontrolü
        const rgbColor = style.color;
        if (rgbColor) {
            const hex = '#' + rgbColor.match(/\d+/g).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
            const picker = document.getElementById('elementColorPicker');
            if (picker) picker.value = hex;
        }

        // Font kontrolü
        if (style.fontFamily) {
            const cleanFont = style.fontFamily.replace(/["']/g, "");
            const selectEl = document.getElementById('fontFamilySelect');
            if (selectEl) {
                for (let i = 0; i < selectEl.options.length; i++) {
                    if (selectEl.options[i].value.includes(cleanFont)) {
                        selectEl.selectedIndex = i;
                        break;
                    }
                }
            }
        }

        const currentFontSize = parseInt(style.fontSize) || 16;
        const fontSlider = document.getElementById('fontSizeSlider');
        const fontNumber = document.getElementById('fontSizeNumber');

        if (fontSlider) fontSlider.value = currentFontSize;
        if (fontNumber) fontNumber.value = currentFontSize;
    }

    // Paragraf alt metin rengi kontrolü (Sadece tek bir öğe seçiliyse çalışır)
    const activeBoxes = document.querySelectorAll('.box.selected');
    const descColorLabel = document.getElementById('descColorLabel');
    const descColorPicker = document.getElementById('descColorPicker');

    if (activeBoxes.length === 1 && selected) {
        const desc = selected.querySelector('.p-desc');
        if (desc) {
            if (descColorLabel) descColorLabel.style.display = 'block';
            if (descColorPicker) {
                descColorPicker.style.display = 'block';
                const descStyle = window.getComputedStyle(desc);
                const descRgb = descStyle.color;
                if (descRgb) {
                    const descHex = '#' + descRgb.match(/\d+/g).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                    descColorPicker.value = descHex;
                }
            }
        } else {
            if (descColorLabel) descColorLabel.style.display = 'none';
            if (descColorPicker) descColorPicker.style.display = 'none';
        }
    } else {
        if (descColorLabel) descColorLabel.style.display = 'none';
        if (descColorPicker) descColorPicker.style.display = 'none';
    }
	

if (selected && selected.classList.contains('sketch-mode')) {
    document.getElementById('sketchSettings').style.display = 'block';
    
    // Eğer bu kutunun önceden kaydedilmiş ayarları varsa slider'ları güncelle
    const savedParams = selected.getAttribute('data-sketch-params');
    if (savedParams) {
        const p = JSON.parse(savedParams);
        ['pastel','poster','sat','bright','edge','thin','smooth','texture','grain'].forEach(k => {
            const input = document.getElementById('sk_' + k);
            if (input) {
                input.value = p[k];
                document.getElementById('sk_' + k + 'V').textContent = p[k];
            }
        });
    }
} else {
    document.getElementById('sketchSettings').style.display = 'none';
}
}

// Renk değişiminde yazar rengini de güncelleyen fonksiyon
function updateElementColor(val) {
    if (!selected) return;
    
    selected.style.color = val;

    if (selected.classList.contains('shape-box')) {
        selected.style.backgroundColor = val;
    }
    
    const title = selected.querySelector('.p-title');
    if (title) title.style.color = val;

    // Alıntı metni ve yazarı için renk güncellemeleri
    const qText = selected.querySelector('.q-text');
    if (qText) qText.style.color = val;

    const qAuthor = selected.querySelector('.q-author');
    if (qAuthor) qAuthor.style.color = val;
}

function updateDescColor(val) {
    if (!selected) return;
    
    const desc = selected.querySelector('.p-desc');
    if (desc) desc.style.color = val;

    const qAuthor = selected.querySelector('.q-author');
    if (qAuthor) qAuthor.style.color = val;
}

function updateFontFamily(val) {
    if (!selected) return;
    selected.style.fontFamily = val;

    const title = selected.querySelector('.p-title');
    const desc = selected.querySelector('.p-desc');
    const qText = selected.querySelector('.q-text');
    const qAuthor = selected.querySelector('.q-author');
    
    if (title) title.style.fontFamily = val;
    if (desc) desc.style.fontFamily = val;
    if (qText) qText.style.fontFamily = val;
    if (qAuthor) qAuthor.style.fontFamily = val;
}

function updateTransformation() {
    if (!selected) return;
    const sx = document.getElementById('skewXSlider').value;
    const sy = document.getElementById('skewYSlider').value;
    selected.style.transform = `skew(${sx}deg, ${sy}deg)`;
    selected.setAttribute('data-skewx', sx);
    selected.setAttribute('data-skewy', sy);
}

function updateRadius(val, pos) {
    if (!selected) return;
    if (pos === 'top') {
        selected.style.borderTopLeftRadius = val + 'px';
        selected.style.borderTopRightRadius = val + 'px';
    } else {
        selected.style.borderBottomLeftRadius = val + 'px';
        selected.style.borderBottomRightRadius = val + 'px';
    }
}

function setTextAlign(align) {
    if (!selected) return;
    selected.style.textAlign = align;
    const title = selected.querySelector('.p-title');
    const desc = selected.querySelector('.p-desc');
    if (title) title.style.textAlign = align;
    if (desc) desc.style.textAlign = align;
}

function setupDrop(el, img) {
    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const r = new FileReader();
            r.onload = (ev) => {
                img.src = ev.target.result;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.style.objectPosition = 'center';
            };
            r.readAsDataURL(file);
        }
    });
}

interact('.box').draggable({
    listeners: {
        move(e) {
            const t = e.target;
            t.style.left = (parseFloat(t.style.left) + e.dx) + 'px';
            t.style.top = (parseFloat(t.style.top) + e.dy) + 'px';
        }
    }
}).resizable({
    edges: {
        left: true,
        right: true,
        bottom: true,
        top: true
    },
    listeners: {
        move(e) {
            Object.assign(e.target.style, {
                width: `${e.rect.width}px`,
                height: `${e.rect.height}px`
            });
        }
    }
});

function setBG(e) {
    const r = new FileReader();
    r.onload = (ev) => {
        const wrap = document.getElementById('canvasWrap');
        wrap.style.backgroundImage = `url(${ev.target.result})`;
        wrap.style.backgroundSize = '100% 100%';
        wrap.style.backgroundPosition = 'center center';
        wrap.style.backgroundRepeat = 'no-repeat';
    };
    r.readAsDataURL(e.target.files[0]);
}

function changeZ(v) {
    if (selected) {
        const currentZ = parseInt(window.getComputedStyle(selected).zIndex) || 100;
        selected.style.zIndex = currentZ + v;
    }
}

function deleteSelected() {
    const selectedBoxes = document.querySelectorAll('.box.selected');
    if (selectedBoxes.length > 0) {
        selectedBoxes.forEach(box => box.remove());
        selected = null;
    }
}
  function save() {
    html2canvas(document.getElementById('canvasWrap'), { scale: 1 }).then(canvas => {
    document.querySelectorAll('.box').forEach(b => b.classList.remove('selected'));
      const link = document.createElement('a'); 
      link.download = 'beykoz-haber.png'; link.href = canvas.toDataURL(); link.click();
    });
  }

// Klavyeden silme işlemlerini yakalar
document.addEventListener('keydown', function(e) {
    // Eğer kullanıcı bir metin kutusunun (contenteditable) içine odaklanmışsa silme işlemini engelle
    if (document.activeElement && (document.activeElement.contentEditable === "true" || document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT")) {
        return; 
    }

    // Delete (Sil) tuşu veya Backspace (Geri silme) tuşuna basıldığında
    if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
    }
});

// Hazır boyut şablonunu tuvale uygular
function applyPresetSize(value) {
    const customInputs = document.getElementById('customSizeInputs');
    
    if (value === 'custom') {
        customInputs.classList.remove('d-none');
        return;
    } else {
        customInputs.classList.add('d-none');
    }

    const [width, height] = value.split('x').map(Number);
    resizeCanvas(width, height);
}

// Özel olarak elle girilen boyutları tuvale uygular
function applyCustomSize() {
    const width = parseInt(document.getElementById('customWidthInput').value) || 1080;
    const height = parseInt(document.getElementById('customHeightInput').value) || 1080;
    resizeCanvas(width, height);
}

// Ana Boyutlandırma ve Akıllı Ölçeklendirme Fonksiyonu
function resizeCanvas(newWidth, newHeight) {
    const wrap = document.getElementById('canvasWrap');
    if (!wrap) return;

    // Mevcut boyutları piksel cinsinden alalım
    const oldWidth = wrap.offsetWidth || 1080;
    const oldHeight = wrap.offsetHeight || 1080;

    // Ölçekleme oranlarını hesaplayalım
    const scaleX = newWidth / oldWidth;
    const scaleY = newHeight / oldHeight;

    // Kullanıcı öğelerin de otomatik boyutlandırılmasını istiyor mu?
    const scaleElements = document.getElementById('scaleElementsCheck').checked;

    // 1. Adım: Tuval boyutunu güncelle
    wrap.style.width = newWidth + 'px';
    wrap.style.height = newHeight + 'px';

    // 2. Adım: Eğer işaretliyse, içindeki tüm öğeleri orantıla
    if (scaleElements) {
        document.querySelectorAll('#canvasWrap .box').forEach(box => {
            // Mevcut pozisyon ve boyutlar
            const currentLeft = parseFloat(box.style.left) || 0;
            const currentTop = parseFloat(box.style.top) || 0;
            const currentWidth = parseFloat(box.style.width) || box.offsetWidth;
            const currentHeight = parseFloat(box.style.height) || box.offsetHeight;

            // Yeni pozisyon ve boyutları ata
            box.style.left = (currentLeft * scaleX) + 'px';
            box.style.top = (currentTop * scaleY) + 'px';
            box.style.width = (currentWidth * scaleX) + 'px';
            box.style.height = (currentHeight * scaleY) + 'px';

            // Yazı boyutlarını da orantılı olarak büyüt/küçült
            if (box.style.fontSize) {
                const currentFontSize = parseFloat(box.style.fontSize) || 16;
                // Yazı boyutunda X/Y ortalaması bir ölçekleme kullanmak en dengeli sonucu verir
                const fontScale = (scaleX + scaleY) / 2;
                box.style.fontSize = (currentFontSize * fontScale) + 'px';
            }

            // Alt öğelerdeki yazı boyutlarını da orantıla (Paragraf, alıntı vb.)
            box.querySelectorAll('.p-title, .p-desc, .q-text, .q-author').forEach(child => {
                const childStyle = window.getComputedStyle(child);
                const currentChildSize = parseFloat(childStyle.fontSize) || 16;
                const fontScale = (scaleX + scaleY) / 2;
                child.style.fontSize = (currentChildSize * fontScale) + 'px';
            });
        });
    }

    // Özel boyut giriş kutularını mevcut boyutla güncelle
    document.getElementById('customWidthInput').value = newWidth;
    document.getElementById('customHeightInput').value = newHeight;
}

function updateSelectedFontSize(val, source) {
    if (!selected) return;
    
    // Değeri tam sayıya çevir
    const fontSize = parseInt(val) || 16;

    // Kaynak kontrolü yaparak slider ve number input'u birbirine senkronize et
    const fontSlider = document.getElementById('fontSizeSlider');
    const fontNumber = document.getElementById('fontSizeNumber');

    if (source === 'slider' && fontNumber) {
        fontNumber.value = fontSize;
    } else if (source === 'number' && fontSlider) {
        fontSlider.value = fontSize;
    }

    // Ana kutunun font boyutunu güncelle
    selected.style.fontSize = fontSize + 'px';

    // Alt öğelerdeki yazı boyutlarını da orantılı veya direkt güncelle
    const isParagraph = selected.classList.contains('paragraph-box');
    const isQuote = selected.classList.contains('quote-box');

    if (isParagraph) {
        const title = selected.querySelector('.p-title');
        const desc = selected.querySelector('.p-desc');
        if (title) title.style.fontSize = (fontSize * 1.3) + 'px';
        if (desc) desc.style.fontSize = fontSize + 'px';
    } else if (isQuote) {
        const qText = selected.querySelector('.q-text');
        const qAuthor = selected.querySelector('.q-author');
        if (qText) qText.style.fontSize = fontSize + 'px';
        if (qAuthor) qAuthor.style.fontSize = (fontSize * 0.8) + 'px';
    } else {
        selected.querySelectorAll('.p-title, .p-desc, .q-text, .q-author, span, div').forEach(child => {
            child.style.fontSize = fontSize + 'px';
        });
    }
}

function addPhoto(type) {
    const el = createBox('photo-box');
    el.style.width = '400px';
    el.style.height = '300px';
    if (type === 'oval') el.style.borderRadius = '150px 150px 0 0';
    const img = document.createElement('img');
    
    // YENİ LİNK: placehold.co kullanıyoruz
    img.src = 'https://placehold.co/600x400?text=Resmi+Buraya+Surukle';
    
    el.appendChild(img);
    setupDrop(el, img);
    addEvents(el);
}

// ebss.js - Yeni Kuru Boya Resim Kutusu ve Algoritma Entegrasyonu

function addSketchPhoto() {
    const el = createBox('photo-box sketch-mode');
    el.style.width = '400px';
    el.style.height = '450px';
    const img = document.createElement('img');
    
    // Başlangıçta kullanıcıya rehberlik eden boş görsel
    img.src = 'https://placehold.co/400x450/f4ede1/7d6a57?text=Kuru+Boya+Icin+Resim';
    
    el.appendChild(img);
    setupSketchDrop(el, img); // Özel efektli sürükle bırak fonksiyonu
    addEvents(el);
	
}

// Hazır ayar preset değerleri
const sketchPresets = {
    soft: {pastel:58, poster:30, sat:105, bright:113, edge:46, thin:150, smooth:2, texture:16, grain:8},
    reference: {pastel:42, poster:22, sat:120, bright:108, edge:74, thin:118, smooth:1, texture:20, grain:12},
    strong: {pastel:34, poster:18, sat:132, bright:103, edge:92, thin:95, smooth:0, texture:28, grain:16},
    watercolor: {pastel:70, poster:36, sat:112, bright:118, edge:38, thin:165, smooth:3, texture:34, grain:6},
    premium: {pastel:50, poster:26, sat:116, bright:110, edge:62, thin:132, smooth:2, texture:22, grain:9}
};

// Preset seçildiğinde çalışacak fonksiyon
function applySketchPreset(presetKey) {
    if (!selected || !selected.classList.contains('sketch-mode')) return;
    const p = sketchPresets[presetKey];
    if (!p) return;

    Object.keys(p).forEach(k => {
        const input = document.getElementById('sk_' + k);
        if (input) {
            input.value = p[k];
            document.getElementById('sk_' + k + 'V').textContent = p[k];
        }
    });

    updateSketchParam();
}

// Slider'lar hareket ettirildiğinde çalışacak fonksiyon
function updateSketchParam() {
    if (!selected || !selected.classList.contains('sketch-mode')) return;

    const img = selected.querySelector('img');
    const originalSrc = selected.getAttribute('data-original-src');
    if (!img || !originalSrc) return;

    // Tüm slider değerlerini oku
    const params = {
        pastel: parseInt(document.getElementById('sk_pastel').value),
        poster: parseInt(document.getElementById('sk_poster').value),
        sat: parseInt(document.getElementById('sk_sat').value),
        bright: parseInt(document.getElementById('sk_bright').value),
        edge: parseInt(document.getElementById('sk_edge').value),
        thin: parseInt(document.getElementById('sk_thin').value),
        smooth: parseInt(document.getElementById('sk_smooth').value),
        texture: parseInt(document.getElementById('sk_texture').value),
        grain: parseInt(document.getElementById('sk_grain').value)
    };

    // Değerleri HTML etiketlerinde güncelle
    Object.keys(params).forEach(k => {
        document.getElementById('sk_' + k + 'V').textContent = params[k];
    });

    // Seçili kutuya mevcut ayarları kaydet
    selected.setAttribute('data-sketch-params', JSON.stringify(params));

    // Canlı olarak pikselleri tekrar işle
    processSketchEffect(img, originalSrc, params);
}

// Kuru boya efektini piksel seviyesinde uygulayan yardımcı fonksiyonlar
function clamp(v) { return Math.max(0, Math.min(255, v)); }
function nse(x, y) { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); }
function saturate(r, g, b, s) { const l = .299 * r + .587 * g + .114 * b; return [l + (r - l) * s, l + (g - l) * s, l + (b - l) * s]; }

function boxBlur(src, dst, w, h, r) {
    if (r <= 0) { dst.set(src); return; }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0, c = 0;
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const xx = Math.min(w - 1, Math.max(0, x + dx)),
                          yy = Math.min(h - 1, Math.max(0, y + dy));
                    sum += src[yy * w + xx];
                    c++;
                }
            }
            dst[y * w + x] = sum / c;
        }
    }
}

function sobel(src, dst, w, h) {
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const p = y * w + x;
            const gx = -src[p - w - 1] - 2 * src[p - 1] - src[p + w - 1] + src[p - w + 1] + 2 * src[p + 1] + src[p + w + 1];
            const gy = -src[p - w - 1] - 2 * src[p - w] - src[p - w + 1] + src[p + w - 1] + 2 * src[p + w] + src[p + w + 1];
            dst[p] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
        }
    }
}

function processSketchEffect(imgElement, originalSrc, customParams = null) {
    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous";
    tempImg.onload = function () {
        const tempCanvas = document.createElement('canvas');
        const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        
        const max = 1200, sc = Math.min(max / tempImg.width, max / tempImg.height, 1);
        const w = Math.round(tempImg.width * sc);
        const h = Math.round(tempImg.height * sc);
        
        tempCanvas.width = w;
        tempCanvas.height = h;
        tCtx.drawImage(tempImg, 0, 0, w, h);
        
        const originalData = tCtx.getImageData(0, 0, w, h);
        const src = new Uint8ClampedArray(originalData.data);
        const gray = new Float32Array(w * h), blur = new Float32Array(w * h), edges = new Float32Array(w * h);
        const out = new Uint8ClampedArray(src.length);
        
        for (let i = 0, p = 0; i < src.length; i += 4, p++) {
            gray[p] = .299 * src[i] + .587 * src[i + 1] + .114 * src[i + 2];
        }

        // Eğer parametre verilmemişse varsayılan 'reference' değerlerini kullan
        const p = customParams || {pastel:42, poster:22, sat:120, bright:108, edge:74, thin:118, smooth:1, texture:20, grain:12};
        
        const valPastel = p.pastel / 100, valPoster = p.poster, valSat = p.sat / 100, valBright = p.bright / 100;
        const valEdge = p.edge / 100, valThin = p.thin, valSmooth = p.smooth, valTex = p.texture / 100, valGrain = p.grain;

        boxBlur(gray, blur, w, h, valSmooth);
        sobel(blur, edges, w, h);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const p = y * w + x, i = p * 4;
                let r = src[i], g = src[i + 1], b = src[i + 2];

                [r, g, b] = saturate(r, g, b, valSat);
                r *= valBright; g *= valBright; b *= valBright;

                r = Math.round(r / valPoster) * valPoster;
                g = Math.round(g / valPoster) * valPoster;
                b = Math.round(b / valPoster) * valPoster;

                r = r * (1 - valPastel) + (251) * valPastel;
                g = g * (1 - valPastel) + (243) * valPastel;
                b = b * (1 - valPastel) + (231) * valPastel;

                let e = Math.max(0, (edges[p] - valThin) / (255 - valThin));
                e = Math.min(1, e * valEdge * 1.85);
                r *= 1 - e * .82; g *= 1 - e * .78; b *= 1 - e * .70;

                const paper = (nse(x * .075, y * .075) - .5) * 34 * valTex + (Math.sin((x + y) * .045)) * 10 * valTex;
                const gr = (nse(x * 1.7, y * 1.7) - .5) * valGrain;

                out[i] = clamp(r + paper + gr);
                out[i + 1] = clamp(g + paper + gr);
                out[i + 2] = clamp(b + paper + gr);
                out[i + 3] = 255;
            }
        }

        const effectedImageData = new ImageData(out, w, h);
        tCtx.putImageData(effectedImageData, 0, 0);
        
        imgElement.src = tempCanvas.toDataURL('image/png');
    };
    tempImg.src = originalSrc;
}

function setupSketchDrop(el, img) {
    ['dragenter', 'dragover'].forEach(name => {
        el.addEventListener(name, (e) => { e.preventDefault(); el.classList.add('drag-over'); }, false);
    });
    ['dragleave', 'drop'].forEach(name => {
        el.addEventListener(name, (e) => { e.preventDefault(); el.classList.remove('drag-over'); }, false);
    });
    el.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                // Orijinal görseli kutuya kaydet
                el.setAttribute('data-original-src', evt.target.result);
                
                // İlk efekti uygula
                processSketchEffect(img, evt.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
}