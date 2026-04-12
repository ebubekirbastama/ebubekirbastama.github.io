const imageUpload = document.getElementById('imageUpload');
const videoUpload = document.getElementById('videoUpload');
const videoPlayer = document.getElementById('videoPlayer');
const startBtn = document.getElementById('startBtn');
const progressBar = document.getElementById('progressBar');
const percentText = document.getElementById('percentText');
const nsaOverlay = document.getElementById('nsaOverlay');
const resultsLog = document.getElementById('resultsLog');
const modelStatus = document.getElementById('modelStatus');
const biometricBoxesContainer = document.getElementById('biometricBoxesContainer');

// Onay Paneli Elementleri
const customConfirm = document.getElementById('customConfirm');
const matchPreview = document.getElementById('matchPreview');
const confirmDetails = document.getElementById('confirmDetails');
const btnConfirmYes = document.getElementById('btnConfirmYes');
const btnConfirmNo = document.getElementById('btnConfirmNo');
const captureCanvas = document.getElementById('captureCanvas');
const statusText = document.getElementById('statusText');

let targetDescriptor = null;
let foundMatches = [];

// EBS FORENSIC - Modelleri Yükle
async function init() {
    const MODEL_URL = './models'; 
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        modelStatus.innerHTML = '<span class="text-success fw-bold"><i class="fas fa-terminal"></i> KERNEL V9.1 ACTIVE</span>';
        startBtn.disabled = false;
    } catch (e) {
        modelStatus.innerHTML = '<span class="text-danger"><i class="fas fa-skull"></i> MODEL YÜKLEME HATASI!</span>';
    }
}

// Resimden Biyometrik Veri Çıkar
imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('imgText').innerText = "İŞLENİYOR...";
    const image = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(image).withFaceLandmarks().withFaceDescriptor();
    if (detection) {
        targetDescriptor = detection.descriptor;
        document.getElementById('imgText').innerText = "HEDEF TANIMLANDI";
        document.getElementById('imgIcon').className = "fas fa-user-check fa-3x text-info";
    }
});

// Video Yükleme
videoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        videoPlayer.src = URL.createObjectURL(file);
        document.getElementById('vidText').innerText = "KANIT YÜKLENDİ";
        document.getElementById('vidIcon').className = "fas fa-shield-virus fa-3x text-info";
    }
});

// ANA ANALİZ DÖNGÜSÜ
startBtn.addEventListener('click', async () => {
    if (!targetDescriptor || !videoPlayer.src) return alert("HATA: Veri eksik!");

    foundMatches = [];
    resultsLog.innerHTML = "";
    startBtn.disabled = true;
    biometricBoxesContainer.innerHTML = "";
    nsaOverlay.style.display = "flex";
    statusText.style.display = "block";
    customConfirm.style.display = "none";
    videoPlayer.controls = false;
    
    const duration = videoPlayer.duration;
    const faceMatcher = new faceapi.FaceMatcher(targetDescriptor, 0.55);

    for (let t = 0; t < duration; t += 0.5) {
        videoPlayer.currentTime = t;
        await new Promise(res => {
            const seeked = () => { videoPlayer.removeEventListener('seeked', seeked); res(); };
            videoPlayer.addEventListener('seeked', seeked);
        });

        addRandomCodeStream();
        const detections = await faceapi.detectAllFaces(videoPlayer).withFaceLandmarks().withFaceDescriptors();
        drawBiometricBoxes(detections);

        const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor));
        
        const progress = (t / duration) * 100;
        progressBar.style.width = progress + "%";
        percentText.innerText = `%${Math.floor(progress)}`;

        let match = results.find(res => res.label !== 'unknown');
        
        if (match) {
            // Log Kaydı
            addResultToLog(t, match.distance);
            
            // --- ONAY VE RESİM YAKALAMA SÜRECİ ---
            // 1. Kareyi Canvas'a Çiz
            const ctx = captureCanvas.getContext('2d');
            captureCanvas.width = videoPlayer.videoWidth;
            captureCanvas.height = videoPlayer.videoHeight;
            ctx.drawImage(videoPlayer, 0, 0, captureCanvas.width, captureCanvas.height);
            
            // 2. Resmi Onay Paneline Bas
            matchPreview.src = captureCanvas.toDataURL('image/png');
            
            // 3. Paneli Göster, Analiz Yazısını Gizle
            statusText.style.display = "none";
            confirmDetails.innerHTML = `ZAMAN: ${formatTime(t)}<br>GÜVEN SKORU: %${((1 - match.distance) * 100).toFixed(2)}`;
            customConfirm.style.display = "flex";
            videoPlayer.controls = true;

            // 4. Kullanıcı Kararını Bekle (Promise Mekanizması)
            const userChoice = await new Promise((resolve) => {
                btnConfirmYes.onclick = () => resolve(true);
                btnConfirmNo.onclick = () => resolve(false);
            });

            if (userChoice) {
                break; // Analiz Kullanıcı Onayıyla Bitti
            } else {
                // Reddedildi: Devam et
                customConfirm.style.display = "none";
                statusText.style.display = "block";
                videoPlayer.controls = false;
                biometricBoxesContainer.innerHTML = "";
            }
        }
    }
    finishAnalysis();
});

function finishAnalysis() {
    progressBar.style.width = "100%";
    percentText.innerText = "TARAMA BİTTİ";
    nsaOverlay.style.display = "none";
    biometricBoxesContainer.innerHTML = "";
    videoPlayer.controls = true;
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-redo"></i> YENİ TARA';
    if (foundMatches.length === 0) {
        resultsLog.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">EŞLEŞME YOK.</td></tr>';
    }
}

function drawBiometricBoxes(detections) {
    biometricBoxesContainer.innerHTML = "";
    const displaySize = { width: videoPlayer.offsetWidth, height: videoPlayer.offsetHeight };
    faceapi.matchDimensions(biometricBoxesContainer, displaySize);
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    resizedDetections.forEach(detection => {
        const box = detection.detection.box;
        const boxDiv = document.createElement('div');
        boxDiv.className = "biometric-box";
        boxDiv.style.width = box.width + "px";
        boxDiv.style.height = box.height + "px";
        boxDiv.style.left = box.x + "px";
        boxDiv.style.top = box.y + "px";
        boxDiv.innerHTML = `<span style="position:absolute; top:-18px; left:0; color:#ff003c; font-size:9px; font-weight:bold; background:#000; padding:2px;">SCAN_${Math.floor(Math.random()*999)}</span>`;
        biometricBoxesContainer.appendChild(boxDiv);
    });
}

function addRandomCodeStream() {
    const codes = ["ANALYZING_VECTORS", "QUERY_DB_OSINT", "COMPARING_POINTS", "PIXEL_SURVEY_ACTIVE"];
    const codeSpan = document.createElement('div');
    codeSpan.className = "code-stream";
    codeSpan.innerText = codes[Math.floor(Math.random() * codes.length)];
    codeSpan.style.top = Math.random() * 90 + "%";
    codeSpan.style.left = Math.random() * 80 + "%";
    nsaOverlay.appendChild(codeSpan);
    setTimeout(() => codeSpan.remove(), 1000);
}

function addResultToLog(time, distance) {
    const confidence = ((1 - distance) * 100).toFixed(2);
    const uid = "EBS-" + Math.floor(Math.random() * 89999 + 10000);
    foundMatches.push({ uid, time, confidence });

    const row = document.createElement('tr');
    row.innerHTML = `
        <td><span class="text-white">${uid}</span></td>
        <td><i class="far fa-clock me-2 text-info"></i>${formatTime(time)}</td>
        <td><span class="text-info">%${confidence}</span></td>
        <td><span class="text-danger small fw-bold">TESPİT</span></td>
        <td><button class="btn btn-sm btn-outline-info" onclick="jumpTo(${time})">İZLE</button></td>
    `;
    resultsLog.prepend(row);
}

function jumpTo(time) {
    videoPlayer.currentTime = time;
    videoPlayer.play();
    videoPlayer.scrollIntoView({ behavior: 'smooth' });
}

function formatTime(seconds) {
    return new Date(seconds * 1000).toISOString().substr(14, 5);
}

window.onload = init;