const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const recordedVideo = document.getElementById('recordedVideo');

let mediaRecorder;
let recordedChunks = [];

// 1080p veya daha yüksek çözünürlük için kayıt seçenekleri
const mediaConstraints = {
  video: {
    mediaSource: 'screen',
    width: 1920, // 1080p genişlik için ayarlayın
    height: 1080, // 1080p yükseklik için ayarlayın (tarayıcı desteğine göre ayarlayın)
    frameRate: 30, // Akıcı kare hızı için ayarlayın (performansa göre ayarlayın)
  },
  audio: {
    mandatory: true // Ses kaydını da etkinleştirin
  }
};

startBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints);

    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start();

    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    console.error('Ekran kaydı başlatılamadı:', error);
  }
});

stopBtn.addEventListener('click', () => {
  mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
});

function handleDataAvailable(event) {
  if (event.data.size > 0) {
    recordedChunks.push(event.data);
    download();
  }
}

function download() {
  const blob = new Blob(recordedChunks, {
    type: 'video/webm'
  });
  const url = URL.createObjectURL(blob);
  recordedVideo.src = url;

  // Kaydı otomatik olarak indirin (isteğe bağlı)
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.style = 'display: none';
  a.href = url;
  a.download = 'screen-recording.webm';
  a.click();
  window.URL.revokeObjectURL(url);
}
