// DOM elementlerini seçiyoruz
const imageInput = document.getElementById('imageInput');
const previewContainer = document.getElementById('previewContainer');
const histories = new WeakMap();  // Her canvas için işlem geçmişi saklamak için WeakMap kullanıyoruz

// Kullanıcı resim seçtiğinde tetiklenen olay
imageInput.addEventListener('change', function () {
    // Önce önizleme alanını temizle
    previewContainer.innerHTML = '';

    // Seçilen tüm dosyaları döngüye al
    Array.from(this.files).forEach((file, index) => {
        const reader = new FileReader();

        // Dosya okuma tamamlandığında çalışacak fonksiyon
        reader.onload = function (e) {
            // Yeni bir bölüm oluşturuyoruz: her resim için ayrı section
            const section = document.createElement('section');
            section.className = 'mb-4';

            // Resim başlığı
            const title = document.createElement('h5');
            title.textContent = `Resim ${index + 1}`;
            title.style.textAlign = 'center';
            title.style.userSelect = 'none';

            // Resim boyut bilgisini gösterecek paragraf
            const sizeInfo = document.createElement('p');
            sizeInfo.className = 'size-info';
            sizeInfo.textContent = 'Yükleniyor...';

            // Canvas ve kontrol paneli için wrapper div
            const wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';

            // Canvas oluştur
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Kontrol paneli div'i oluştur (butonlar burada olacak)
            const controlPanel = document.createElement('div');
            controlPanel.className = 'control-panel';
            controlPanel.style.left = '10px';
            controlPanel.style.top = '10px';

            const counters = {};  // Her efekt için kaç kez uygulandığını tutar (isteğe bağlı)

            // Genel efekt butonu ekleme fonksiyonu
            function addEffectButton(effectName, displayName) {
                counters[effectName] = 0;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-light';
                btn.textContent = displayName;

                btn.addEventListener('click', () => {
                    counters[effectName]++;
                    applyEffect(effectName, 1);
                });

                controlPanel.appendChild(btn);
            }

            // Efekt uygulama fonksiyonu (pixel manipülasyonu)
            function applyEffect(type, times) {
                const ctx = canvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                for (let t = 0; t < times; t++) {
                    for (let i = 0; i < data.length; i += 4) {
                        if (type === 'sharpen') {
                            data[i] = Math.min(255, data[i] * 1.05);
                            data[i + 1] = Math.min(255, data[i + 1] * 1.05);
                            data[i + 2] = Math.min(255, data[i + 2] * 1.05);
                        } else if (type === 'orange') {
                            data[i] = Math.min(255, data[i] + 10);
                            data[i + 1] = Math.min(255, data[i + 1] + 5);
                        } else if (type === 'red') {
                            data[i] = Math.min(255, data[i] + 10);
                        } else if (type === 'blue') {
                            data[i + 2] = Math.min(255, data[i + 2] + 10);
                        } else if (type === 'brighten') {
                            data[i] = Math.min(255, data[i] + 15);
                            data[i + 1] = Math.min(255, data[i + 1] + 15);
                            data[i + 2] = Math.min(255, data[i + 2] + 15);
                        } else if (type === 'clarity') {
                            data[i] = Math.min(255, data[i] * 1.1);
                            data[i + 1] = Math.min(255, data[i + 1] * 1.1);
                            data[i + 2] = Math.min(255, data[i + 2] * 1.1);
                        } else if (type === 'vignette') {
                            const x = (i / 4) % canvas.width;
                            const y = Math.floor(i / 4 / canvas.width);
                            const dx = x - canvas.width / 2;
                            const dy = y - canvas.height / 2;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const maxDist = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height) / 2;
                            const darken = 0.5 * (dist / maxDist);
                            data[i] *= 1 - darken;
                            data[i + 1] *= 1 - darken;
                            data[i + 2] *= 1 - darken;
                        } else if (type === 'noise') {
                            if (i + 4 < data.length) {
                                data[i] = (data[i] + data[i + 4]) / 2;
                                data[i + 1] = (data[i + 1] + data[i + 5]) / 2;
                                data[i + 2] = (data[i + 2] + data[i + 6]) / 2;
                            }
                        }
                    }
                }

                ctx.putImageData(imageData, 0, 0);
                histories.get(canvas).push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            }

            // Geri alma fonksiyonu (undo)
            function undoEffect() {
                const stack = histories.get(canvas);
                if (stack.length > 1) {
                    stack.pop();
                    ctx.putImageData(stack[stack.length - 1], 0, 0);
                } else {
                    alert('Geri alınacak işlem yok.');
                }
            }

            // -------------------------
            // Yeni eklenen özellikler:
            // -------------------------

            // 1) Röportaj/Portre Modu: Otomatik cilt düzeltme ve arka plan bulanıklaştırma
            function portraitMode(canvas) {
                const ctx = canvas.getContext('2d');
                const width = canvas.width;
                const height = canvas.height;
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;

                // Basit cilt tonu ayarı: kırmızıyı biraz azalt, yeşil ve maviyi artır
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = data[i] * 0.9; // kırmızı azalt
                    data[i + 1] = Math.min(255, data[i + 1] * 1.05);
                    data[i + 2] = Math.min(255, data[i + 2] * 1.05);
                }

                // Basit blur efekti gibi (arka plan bulanıklaştırmaya çok temel yaklaşım)
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = width;
                tempCanvas.height = height;
                tempCtx.putImageData(imageData, 0, 0);
                tempCtx.globalAlpha = 0.4;
                for (let y = -1; y <= 1; y++) {
                    for (let x = -1; x <= 1; x++) {
                        if (x !== 0 || y !== 0) {
                            tempCtx.drawImage(tempCanvas, x, y);
                        }
                    }
                }
                const blurred = tempCtx.getImageData(0, 0, width, height);
                ctx.putImageData(blurred, 0, 0);
                histories.get(canvas).push(ctx.getImageData(0, 0, width, height));
            }

            // 2) Otomatik İyileştirme: ışık, kontrast, renk optimizasyonu
            function autoEnhance(canvas) {
                const ctx = canvas.getContext('2d');
                const width = canvas.width;
                const height = canvas.height;
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;

                const contrast = 1.1;
                const brightness = 10;

                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, Math.max(0, ((data[i] - 128) * contrast) + 128 + brightness));
                    data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - 128) * contrast) + 128 + brightness));
                    data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - 128) * contrast) + 128 + brightness));
                }

                ctx.putImageData(imageData, 0, 0);
                histories.get(canvas).push(ctx.getImageData(0, 0, width, height));
            }

            // Toplu dışa aktarma fonksiyonu (global scope)
            function bulkDownloadAll() {
                const canvases = previewContainer.querySelectorAll('canvas');
                canvases.forEach((canvas, i) => {
                    const link = document.createElement('a');
                    link.download = `islenmis_resim_toplu_${i + 1}.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                });
            }

// Sayfa yüklendiğinde toplu dışa aktarma butonu oluştur
            let bulkDownloadBtn = document.getElementById('bulkDownloadBtn');
            if (!bulkDownloadBtn) {
                bulkDownloadBtn = document.createElement('button');
                bulkDownloadBtn.type = 'button';
                bulkDownloadBtn.className = 'btn btn-success mt-3';
                bulkDownloadBtn.textContent = 'Toplu Dışa Aktar';
                bulkDownloadBtn.title = 'Tüm görselleri tek seferde indir';
                bulkDownloadBtn.id = 'bulkDownloadBtn';
                bulkDownloadBtn.addEventListener('click', bulkDownloadAll);
                document.querySelector('.container').appendChild(bulkDownloadBtn);
            }

// Kırmızı göz düzeltme fonksiyonu (oval seçime göre)
            function removeRedEyeAuto(canvas, selection) {
                const ctx = canvas.getContext('2d');
                const {x, y, width, height} = selection;
                if (width <= 0 || height <= 0)
                    return; // Boş seçim engelleme
                const imageData = ctx.getImageData(x, y, width, height);
                const data = imageData.data;

                // Oval içinde olup olmadığını kontrol eden fonksiyon
                function isInsideOval(px, py, ox, oy, w, h) {
                    const dx = px - (ox + w / 2);
                    const dy = py - (oy + h / 2);
                    return (dx * dx) / ((w / 2) * (w / 2)) + (dy * dy) / ((h / 2) * (h / 2)) <= 1;
                }

                for (let i = 0; i < data.length; i += 4) {
                    const pixelIndex = i / 4;
                    const px = pixelIndex % width;
                    const py = Math.floor(pixelIndex / width);

                    if (isInsideOval(px, py, 0, 0, width, height)) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];

                        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

                        if (r > 150 && g < 100 && b < 100 && luminance > 100) {
                            data[i] = r * 0.6;
                            data[i + 1] = Math.min(255, g + 50);
                            data[i + 2] = Math.min(255, b + 50);
                        }
                    }
                }

                ctx.putImageData(imageData, x, y);
                histories.get(canvas).push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            }

            // 4) Toplu dışa aktarma fonksiyonu (tüm canvasları indirir)
            function bulkDownloadAll() {
                const canvases = previewContainer.querySelectorAll('canvas');
                canvases.forEach((canvas, i) => {
                    const link = document.createElement('a');
                    link.download = `islenmis_resim_toplu_${i + 1}.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                });
            }

            // -------------------------
            // Kontrol paneli butonları
            // -------------------------

            // 90 derece döndürme butonu
            const rotateBtn = document.createElement('button');
            rotateBtn.type = 'button';
            rotateBtn.className = 'btn btn-light';
            rotateBtn.textContent = '90° Döndür';
            rotateBtn.title = "90 derece döndür";
            rotateBtn.addEventListener('click', () => {
                const temp = document.createElement('canvas');
                const tempCtx = temp.getContext('2d');
                temp.width = canvas.height;
                temp.height = canvas.width;
                tempCtx.translate(temp.width / 2, temp.height / 2);
                tempCtx.rotate(Math.PI / 2);
                tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

                canvas.width = temp.width;
                canvas.height = temp.height;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(temp, 0, 0);

                sizeInfo.textContent = `Boyut: ${canvas.width} x ${canvas.height}`;
                histories.set(canvas, [ctx.getImageData(0, 0, canvas.width, canvas.height)]);
            });

            // Yatay çevir butonu
            const flipBtn = document.createElement('button');
            flipBtn.type = 'button';
            flipBtn.className = 'btn btn-light';
            flipBtn.textContent = 'Yatay Çevir';
            flipBtn.title = "Yatay çevir";
            flipBtn.addEventListener('click', () => {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(canvas, 0, 0);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                histories.set(canvas, [ctx.getImageData(0, 0, canvas.width, canvas.height)]);
            });

            // Geri al butonu
            const undoBtn = document.createElement('button');
            undoBtn.type = 'button';
            undoBtn.className = 'btn btn-warning';
            undoBtn.textContent = 'Geri Al';
            undoBtn.title = "Son işlemi geri al";
            undoBtn.addEventListener('click', undoEffect);

            // İndir butonu
            const downloadBtn = document.createElement('button');
            downloadBtn.type = 'button';
            downloadBtn.className = 'btn btn-success';
            downloadBtn.textContent = 'İndir';
            downloadBtn.title = "İşlenen resmi indir";
            downloadBtn.addEventListener('click', () => {
                const link = document.createElement('a');
                link.download = `islenmis_resim_${index + 1}.png`;
                link.href = canvas.toDataURL();
                link.click();
            });

            // Röportaj/Portre modu butonu
            const portraitBtn = document.createElement('button');
            portraitBtn.type = 'button';
            portraitBtn.className = 'btn btn-primary';
            portraitBtn.textContent = 'Röportaj/Portre Modu';
            portraitBtn.title = "Otomatik cilt düzeltme, arka plan bulanıklaştırma";
            portraitBtn.addEventListener('click', () => {
                portraitMode(canvas);
            });

            // Otomatik iyileştirme butonu
            const autoEnhanceBtn = document.createElement('button');
            autoEnhanceBtn.type = 'button';
            autoEnhanceBtn.className = 'btn btn-primary';
            autoEnhanceBtn.textContent = 'Otomatik İyileştirme';
            autoEnhanceBtn.title = "Işık, kontrast, renk optimizasyonu";
            autoEnhanceBtn.addEventListener('click', () => {
                autoEnhance(canvas);
            });



            // Standart efekt butonları
            addEffectButton('sharpen', 'Keskinleştir');
            addEffectButton('orange', 'Turunculaştır');
            addEffectButton('red', 'Kırmızılık');
            addEffectButton('blue', 'Mavi Ton');
            addEffectButton('brighten', 'Beyazlat');
            addEffectButton('clarity', 'Clarity / Dehaze');
            addEffectButton('vignette', 'Vignette');
            addEffectButton('noise', 'Noise Reduction');

            // Butonları kontrol paneline ekle (sırasıyla)
            controlPanel.appendChild(rotateBtn);
            controlPanel.appendChild(flipBtn);
            controlPanel.appendChild(portraitBtn);
            controlPanel.appendChild(autoEnhanceBtn);
            controlPanel.appendChild(undoBtn);
            controlPanel.appendChild(downloadBtn);

            // -------------------------
            // Kontrol paneli sürükle bırak işlemi
            // -------------------------
            let isDragging = false;
            let dragStartX, dragStartY;
            let panelStartLeft, panelStartTop;



            controlPanel.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;

                panelStartLeft = parseInt(controlPanel.style.left) || controlPanel.offsetLeft;
                panelStartTop = parseInt(controlPanel.style.top) || controlPanel.offsetTop;

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            function onMouseMove(e) {
                if (!isDragging)
                    return;

                const dx = e.clientX - dragStartX;
                const dy = e.clientY - dragStartY;

                controlPanel.style.left = (panelStartLeft + dx) + 'px';
                controlPanel.style.top = (panelStartTop + dy) + 'px';

                controlPanel.style.opacity = '1';
                controlPanel.style.pointerEvents = 'auto';
            }

            function onMouseUp(e) {
                isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            // -------------------------
            // Resim yüklenince canvas'a çiz ve başlangıç tarihi belirle
            // -------------------------
            const img = new Image();
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.style.width = img.width + 'px';
                canvas.style.height = img.height + 'px';

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                histories.set(canvas, [ctx.getImageData(0, 0, canvas.width, canvas.height)]);
                sizeInfo.textContent = `Boyut: ${img.width} x ${img.height}`;
                let isDrawing = false;
                let startX, startY, currentX, currentY;

                canvas.addEventListener('mousedown', (e) => {
                    isDrawing = true;
                    const rect = canvas.getBoundingClientRect();
                    startX = e.clientX - rect.left;
                    startY = e.clientY - rect.top;
                });

                canvas.addEventListener('mousemove', (e) => {
                    if (!isDrawing)
                        return;
                    const rect = canvas.getBoundingClientRect();
                    currentX = e.clientX - rect.left;
                    currentY = e.clientY - rect.top;
                    // Yeniden çiz (orijinal resim)
                    ctx.putImageData(histories.get(canvas)[histories.get(canvas).length - 1], 0, 0);
                    // Oval seçim çiz
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6]);
                    ctx.beginPath();
                    const x = Math.min(startX, currentX);
                    const y = Math.min(startY, currentY);
                    const w = Math.abs(currentX - startX);
                    const h = Math.abs(currentY - startY);
                    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
                    ctx.stroke();
                    ctx.setLineDash([]);
                });

                canvas.addEventListener('mouseup', () => {
                    if (!isDrawing)
                        return;
                    isDrawing = false;

                    const x = Math.min(startX, currentX);
                    const y = Math.min(startY, currentY);
                    const width = Math.abs(currentX - startX);
                    const height = Math.abs(currentY - startY);

                    removeRedEyeAuto(canvas, {x, y, width, height});

                    ctx.putImageData(histories.get(canvas)[histories.get(canvas).length - 1], 0, 0);
                });


            };
            img.src = e.target.result;

            // DOM'a ekle
            wrapper.appendChild(canvas);
            wrapper.appendChild(controlPanel);

            section.appendChild(title);
            section.appendChild(sizeInfo);
            section.appendChild(wrapper);
            previewContainer.appendChild(section);
        };

        // Dosyayı oku
        reader.readAsDataURL(file);
    });


});
