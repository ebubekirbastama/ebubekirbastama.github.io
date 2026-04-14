const folderInput = document.getElementById('folderInput');
const targetInput = document.getElementById('targetInput');
const startBtn = document.getElementById('startBtn');
const logArea = document.getElementById('logArea');
const datasetGallery = document.getElementById('datasetGallery');
const targetPreview = document.getElementById('targetPreview');
const overlay = document.getElementById('overlay');
const scanner = document.getElementById('scanner');

let faceMatcher = null;

// SİSTEM BAŞLATMA VE MODELLERİ YEREL KLASÖRDEN YÜKLEME
async function init() {
    // İsteğin üzerine modeller yerel './models' klasöründen çekiliyor
    const MODEL_URL = './models'; 
    
    addLog("> SYSTEM: [LOADING_MODELS] Path: ./models");
    
    try {
        // Neon Mavi log
        addLog("> SYSTEM: [NETWORKS] SSD_Mobilenetv1, FaceLandmark68, FaceRecognition");
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        addLog("> SYSTEM: [STATUS: ONLINE] Biyometrik motor aktif.");
    } catch (err) {
        // Neon Kırmızı log (gerekirse CSS ile renklendirilebilir)
        addLog("> ERROR: [MODEL_LOAD_FAIL] Models klasörünü kontrol edin!");
        console.error(err);
    }
}

// VERİTABANI YÜKLEME (DATASET)
folderInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    datasetGallery.innerHTML = "";
    addLog(`> DB: [TARAMA_BAŞLADI] ${files.length} kayıt tespit edildi.`);

    const labeledDescriptors = await Promise.all(
        files.map(async (file) => {
            // Galeriye ekle
            const item = document.createElement('div');
            item.className = 'criminal-item';
            const imgUrl = URL.createObjectURL(file);
            item.innerHTML = `<img src="${imgUrl}"><br>${file.name.substring(0,10)}`;
            datasetGallery.appendChild(item);

            const img = await faceapi.bufferToImage(file);
            // Tek bir yüz tespiti (Sabıka kaydı resmi temiz olmalı)
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            
            if (detection) {
                // Dosya isminden suçlu adını oluştur (örn: mehmet_yilmaz.jpg -> MEHMET YILMAZ)
                const name = file.name.split('.')[0].replace(/_/g, " ").toUpperCase();
                return new faceapi.LabeledFaceDescriptors(name, [detection.descriptor]);
            }
            return null;
        })
    );

    const validData = labeledDescriptors.filter(d => d !== null);
    if (validData.length > 0) {
        // Eşleşme hassasiyeti (Threshold): 0.55. NSA standartları için uygun bir orta yol.
        faceMatcher = new faceapi.FaceMatcher(validData, 0.55); 
        addLog(`> DB: [STATUS: READY] ${validData.length} kayıt biyometrik veritabanına eklendi.`);
        checkReady();
    } else {
        addLog("> ERROR: [DB_YÜKLEME_BAŞARISIZ] Klasörde geçerli yüz verisi bulunamadı.");
    }
});

// HEDEF RESİM SEÇİMİ (ŞÜPHELİ)
targetInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const imgUrl = URL.createObjectURL(file);
    targetPreview.src = imgUrl;
    targetPreview.style.display = "block";
    document.getElementById('placeholder').style.display = "none";
    addLog(`> ANALİZ: [KANIT_DOSYASI] ${file.name} sisteme yüklendi.`);
    
    // Temizle
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    document.getElementById('matchStatus').innerText = "BEKLENİYOR";
    document.getElementById('matchDetails').innerHTML = "[KİMLİK]: ---<br>[GÜVEN_SKORU]: %0";
    
    checkReady();
});

function checkReady() {
    if (faceMatcher && targetPreview.src) {
        startBtn.disabled = false;
        addLog("> ANALİZ: [STATUS: HAZIR] Biyometrik karşılaştırma başlatılabilir.");
    }
}

// KARŞILAŞTIRMA İŞLEMİ
startBtn.addEventListener('click', async () => {
    addLog("> ANALİZ: [TARAMA_BAŞLADI] Lütfen bekleyin...");
    // Neon Kırmızı tarama çizgisini göster
    scanner.style.display = "block";
    startBtn.disabled = true;

    const displaySize = { width: targetPreview.width, height: targetPreview.height };
    faceapi.matchDimensions(overlay, displaySize);

    // Şüpheli resmindeki tüm yüzleri tespit et
    const detections = await faceapi.detectAllFaces(targetPreview).withFaceLandmarks().withFaceDescriptors();
    
    // Sonuçları resim boyutuna göre yeniden hesapla
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    // Veritabanı ile karşılaştır
    const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

    if (results.length === 0) {
        addLog("> ANALİZ: [HATA] Görselde yüz tespiti yapılamadı.");
        scanner.style.display = "none";
        startBtn.disabled = false;
        return;
    }

    results.forEach((result, i) => {
        if (result.label !== 'unknown') {
            // Eşleşme Bulundu (Neon Kırmızı Durum)
            addLog(`> !!! [TESPİT_EDİLDİ] !!! Kimlik: ${result.label}, Güven: %${((1 - result.distance) * 100).toFixed(1)}`);
            
            document.getElementById('matchStatus').innerText = "POZİTİF";
            document.getElementById('matchStatus').style.color = "#ff0000"; // Neon Kırmızı
            document.getElementById('matchDetails').innerHTML = `
                [KİMLİK]: ${result.label}<br>
                [GÜVEN_SKORU]: %${((1 - result.distance) * 100).toFixed(1)}
            `;
            
            // Eğer varsa, veritabanındaki resmi bulup önizlemeye ekleyelim
            const dbItems = Array.from(document.querySelectorAll('.criminal-item'));
            const matchedItem = dbItems.find(item => item.innerText.includes(result.label.substring(0,10)));
            if(matchedItem) {
                const thumb = document.getElementById('matchThumb');
                thumb.src = matchedItem.querySelector('img').src;
                thumb.style.display = "block";
                document.querySelector('.result-panel i').style.display = "none";
            }

        } else {
            // Kayıt Yok (Neon Mavi/Muted Durum)
            addLog("> ANALİZ: [NEGATİF] Veritabanında eşleşen kayıt bulunamadı.");
            document.getElementById('matchStatus').innerText = "KAYIT YOK";
            document.getElementById('matchStatus').style.color = "#888"; // Muted
            document.getElementById('matchThumb').style.display = "none";
            document.querySelector('.result-panel i').style.display = "block";
        }
    });

    // Analiz bitti, efektleri kapat
    scanner.style.display = "none";
    startBtn.disabled = false;
});

function addLog(msg) {
    const div = document.createElement('div');
    div.innerText = msg;
    logArea.appendChild(div);
    // Otomatik kaydır
    logArea.scrollTop = logArea.scrollHeight;
}

init();