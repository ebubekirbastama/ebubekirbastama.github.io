// npm/build gerekmez: FFmpeg UMD CDN dosyalarından, Demucs ise isteğe bağlı ESM CDN'den yüklenir.
const ffmpegLib = () => window.FFmpegWASM;
// EBS local helpers: avoid @ffmpeg/util UMD 0.12.2, whose browser build references `exports`.
// Both helpers work in plain HTML/JS on a static host (no npm/build needed).
const fetchFile = async (source) => {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (source instanceof Blob) return new Uint8Array(await source.arrayBuffer());
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Dosya yüklenemedi (HTTP ${response.status}): ${source}`);
  return new Uint8Array(await response.arrayBuffer());
};
let demucsLibraryPromise;
async function getDemucsLibrary() {
  if (!demucsLibraryPromise) demucsLibraryPromise = import('https://esm.sh/demucs-wasm@0.1.5?bundle');
  return demucsLibraryPromise;
}

const $ = (id) => document.getElementById(id);
const formats = new Set(['mp4','mov','mkv','avi','m4v','webm','mts','m2ts']);
const state = { jobs: [], running: false, cancelled: false, loaded: false, ffmpeg: null, current: -1, claimed: new Set(), demucs: null, demucsReady: null, demucsDone: null };
const defaults = {mode:'Sadece vokal',resolution:'Orijinal (görüntüye dokunma)',compress:false,codec:'H.264 / AVC (uyumlu)',compressQuality:'Yüksek kalite (önerilen)',quality:'Yüksek (CRF 19)',preset:'medium',gain:'0',mix:'65',bitrate:'256k',vocalWav:false,backgroundWav:false,modelUrl:'https://raw.githubusercontent.com/bengfarrell/demucs-wasm/main/models/'};
let settings = {...defaults};
try { const stored = JSON.parse(localStorage.getItem('ebs_settings') || '{}'); settings = {...settings, ...stored}; } catch {}
const ids = Object.keys(defaults);
const pretty = (n) => { if(!Number.isFinite(n)) return '—'; const units=['B','KB','MB','GB','TB']; let i=0; while(n>=1024 && i<units.length-1){n/=1024;i++}return `${i===0?Math.round(n):n.toFixed(1)} ${units[i]}`; };
const escapeHTML = (text) => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){ const el=$('toast');el.textContent=message;el.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',6500); }
const setStatus=(v)=>$('status').textContent=v;
function summary(){
 const data=[['Ses modu',settings.mode],['Çözünürlük',settings.resolution],['Ses seviyesi',`${Number(settings.gain)>=0?'+':''}${settings.gain} dB`],['Kalite',settings.compress?settings.compressQuality:settings.quality],['Çıktı','Tarayıcı indirmeleri']];
 $('summary').innerHTML=data.map(([label,val])=>`<div class="summary-line"><span>${escapeHTML(label)}</span><strong>${escapeHTML(val)}</strong></div>`).join('');
}
function refreshMetrics(){
 const count=state.jobs.length;const size=state.jobs.reduce((sum,j)=>sum+j.file.size,0);
 $('queueCount').textContent=count;
 $('statFiles').textContent=String(count).padStart(2,'0');
 $('statSize').textContent=pretty(size);
}
function syncDialog(){ ids.forEach(id=>{const el=$(id); if(!el)return; if(el.type==='checkbox')el.checked=Boolean(settings[id]); else el.value=settings[id];});$('gainValue').textContent=`${Number($('gain').value)>=0?'+':''}${$('gain').value} dB`;$('mixValue').textContent=`%${$('mix').value}`;}
function updateButtons(){ $('pick').disabled=state.running;$('folder').disabled=state.running;$('clear').disabled=state.running;$('settingsBtn').disabled=state.running;$('start').disabled=state.running || !state.jobs.length;$('stop').disabled=!state.running;document.querySelectorAll('.remove').forEach(b=>b.disabled=state.running); }
function progress(job,pct,status){job.pct=Math.max(0,Math.min(1,pct));job.status=status; const card=$(job.id);if(!card)return;card.querySelector('.percent').textContent=`${Math.round(job.pct*100)}%`;card.querySelector('.jobStatus').textContent=job.status;card.querySelector('.bar>div').style.width=`${job.pct*100}%`;const overall=(state.jobs.findIndex(j=>j.id===job.id)+job.pct)/state.jobs.length;$('totalBar').style.width=`${overall*100}%`;}
function render(){ $('empty').hidden=state.jobs.length>0;$('list').innerHTML=state.jobs.map(j=>`<article class="job" id="${j.id}"><div class="jobHeader"><span class="jobName">${escapeHTML(j.file.name)}</span><button class="remove" data-id="${j.id}" ${state.running?'disabled':''}>Kaldır</button></div><div class="jobState"><span class="jobStatus">${escapeHTML(j.status)}</span><span class="percent">${Math.round(j.pct*100)}%</span></div><div class="bar"><div style="width:${j.pct*100}%"></div></div><div class="sizes">Eski: ${pretty(j.file.size)}　|　Yeni: ${j.result?pretty(j.result.size):'—'}${j.result?`　|　${Math.round((1-j.result.size/j.file.size)*100)}% ${j.result.size<=j.file.size?'tasarruf':'büyüdü'}`:''}</div>${(j.extras||[]).map(e=>`<a class="download" href="${e.url}" download="${escapeHTML(e.name)}">⬇ ${escapeHTML(e.name)} indir</a>`).join('')}${j.result?`<a class="download" href="${j.result.url}" download="${escapeHTML(j.result.name)}">⬇ ${escapeHTML(j.result.name)} indir</a>`:''}</article>`).join('');
 document.querySelectorAll('.remove').forEach(btn=>btn.addEventListener('click',()=>remove(btn.dataset.id)));refreshMetrics();updateButtons(); }
function addFiles(files){if(state.running)return;let added=0; for(const f of Array.from(files)){const ext=f.name.split('.').pop().toLowerCase();if(!formats.has(ext))continue;const key=`${f.name}|${f.size}|${f.lastModified}`;if(state.jobs.some(j=>j.key===key))continue;const id=`job${Date.now()}_${Math.random().toString(36).slice(2)}`;state.jobs.push({id,key,file:f,pct:0,status:'Sırada bekliyor',result:null});added++;}render(); $('overall').textContent=`0 / ${state.jobs.length} video tamamlandı`; $('totalBar').style.width='0%';setStatus(`${added} yeni video eklendi. Toplam: ${state.jobs.length}`); }
function remove(id){if(state.running)return;const i=state.jobs.findIndex(j=>j.id===id);if(i<0)return;if(state.jobs[i].result)URL.revokeObjectURL(state.jobs[i].result.url);for(const ex of state.jobs[i].extras||[])URL.revokeObjectURL(ex.url);state.jobs.splice(i,1);render();$('overall').textContent=`0 / ${state.jobs.length} video tamamlandı`;}
function reset(){if(state.running)return;for(const job of state.jobs){if(job.result)URL.revokeObjectURL(job.result.url);for(const ex of job.extras||[])URL.revokeObjectURL(ex.url);}state.jobs=[];render();$('overall').textContent='0 / 0 video tamamlandı';$('totalBar').style.width='0%';setStatus('Liste temizlendi.');}
async function loadFFmpeg(){if(state.ffmpeg && state.loaded)return state.ffmpeg;setStatus('FFmpeg WebAssembly motoru indiriliyor (ilk açılışta yaklaşık 30 MB)…');if (!ffmpegLib()?.FFmpeg) throw Error('FFmpeg kitaplığı yüklenemedi. CDN erişimini kontrol edin.');const ffmpeg=new (ffmpegLib().FFmpeg)();state.ffmpeg=ffmpeg;ffmpeg.on('progress',({progress:pr})=>{const job=state.jobs[state.current];if(job && state.running){progress(job,.78+Math.min(1,Math.max(0,pr))*.20,'Video işleniyor');setStatus(`${state.current+1}/${state.jobs.length} · ${job.file.name} · Video işleniyor`);}});
 const coreBase='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
 // Module worker loads ESM ffmpeg-core (importScripts cannot run in module workers).
 // Worker entry point stays same-origin so GitHub Pages subpaths remain supported.
 const classWorkerURL=new URL('./ffmpeg-worker.js?v=20261107-3',document.baseURI).href;
 try {
  await ffmpeg.load({
   classWorkerURL,
   coreURL:`${coreBase}/ffmpeg-core.js`,
   wasmURL:`${coreBase}/ffmpeg-core.wasm`
  });
 } catch(error) {
  state.ffmpeg=null;
  state.loaded=false;
  try{ffmpeg.terminate();}catch{}
  throw new Error(`FFmpeg başlatılamadı: ${error?.message||error}. Worker: ${classWorkerURL}`);
 }
 state.loaded=true;return ffmpeg;}
function opts(){let size=null;const res=settings.resolution;if(res.startsWith('4K'))size=[3840,2160];else if(res==='1440p')size=[2560,1440];else if(res==='1080p')size=[1920,1080];else if(res==='720p')size=[1280,720];else if(res==='480p')size=[854,480];return size;}
function ffmpegArgs(inName,outName,voiceName=null,backgroundName=null){const s=settings;const args=['-hide_banner','-i',inName];
 let aIndex=1; if(voiceName)args.push('-i',voiceName);if(backgroundName)args.push('-i',backgroundName);
 if(s.mode==='Sadece vokal' && voiceName){args.push('-map','0:v:0','-map',`1:a:0`,'-af',`volume=${Number(s.gain)}dB,alimiter=limit=0.95`);}else if(s.mode==='Sadece arka plan' && backgroundName){args.push('-map','0:v:0','-map',`${aIndex+(voiceName?1:0)}:a:0`);}else if(s.mode==='Orijinal ses + vokal' && voiceName){args.push('-filter_complex',`[0:a:0]volume=${Number(s.mix)/100}[orig];[1:a:0]volume=${Number(s.gain)}dB[voc];[orig][voc]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[outa]`,'-map','0:v:0','-map','[outa]');}else{args.push('-map','0:v:0','-map','0:a:0?');}
 const dim=opts();if(dim)args.push('-vf',`scale=w='min(iw,${dim[0]})':h='min(ih,${dim[1]})':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,setsar=1`);
 if(s.compress){const codec=s.codec.startsWith('H.265')?'libx265':'libx264';const qIndex=['Çok yüksek kalite','Yüksek kalite (önerilen)','Dengeli','Daha küçük dosya'].indexOf(s.compressQuality);const crf=(codec==='libx265'?[19,22,25,28]:[17,19,22,25])[Math.max(0,qIndex)];args.push('-c:v',codec,'-preset',s.preset,'-crf',String(crf),'-pix_fmt','yuv420p');if(codec==='libx265')args.push('-tag:v','hvc1');}
 else if(dim){const crf=Number((s.quality.match(/CRF (\d+)/)||[])[1]||19);args.push('-c:v','libx264','-preset',s.preset,'-crf',String(crf),'-pix_fmt','yuv420p');}else{args.push('-c:v','copy');}
 args.push('-c:a',(voiceName||backgroundName)?'aac':'copy',...(voiceName?['-b:a',s.bitrate]:[]),'-movflags','+faststart',outName);return args;}
function uniqueName(file){const stem=file.name.replace(/\.[^.]+$/,'');let name=`${stem}_EBS_AI.mp4`;let count=2;while(state.claimed.has(name.toLowerCase()))name=`${stem}_EBS_AI_${count++}.mp4`;state.claimed.add(name.toLowerCase());return name;}
// 44.1 kHz stereo PCM output from Demucs. Each result has independent channels.
function encodeWav(left,right,sampleRate=44100){
 const len=Math.min(left.length,right.length);const data=new ArrayBuffer(44+len*4);const v=new DataView(data);
 const word=(at,text)=>{for(let j=0;j<text.length;j++)v.setUint8(at+j,text.charCodeAt(j));};
 word(0,'RIFF');v.setUint32(4,data.byteLength-8,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,len*4,true);
 for(let i=0;i<len;i++)for(let ch=0;ch<2;ch++){const x=Math.max(-1,Math.min(1,ch===0?left[i]:right[i]));v.setInt16(44+i*4+ch*2,x<0?Math.round(x*32768):Math.round(x*32767),true);}
 return new Uint8Array(data);
}
async function loadDemucs(job){
 if(state.demucs && state.demucsReady)return state.demucsReady;
 const {Demucs, Models}=await getDemucsLibrary();
 // Demucs worker/model: CDN ve model dosyaları tarayıcıda erişilebilir olmalıdır.
 const workerUrl='./demucs-worker.js';
 const modelPath=new URL((settings.modelUrl||defaults.modelUrl).replace(/\/?$/,'/'),location.href).href;
 progress(job,.10,'AI model bağlantısı kontrol ediliyor');
 const modelFile = modelPath + 'htdemucs_ft_vocals.ort.gzipped';
 try {const probe=await fetch(modelFile,{method:'HEAD',cache:'no-store'});
   if(!probe.ok) throw new Error('HTTP '+probe.status);
 } catch(error) { throw new Error('Demucs model dosyasına ulaşılamıyor: '+modelFile+'. GitHub kaynak bağlantısını doğrulayın veya modeli ./models/ içine yükleyin. '+String(error.message||error)); }
 progress(job,.10,'AI modeli indiriliyor (ilk açılışta uzun sürebilir)');
 const instance=new Demucs(Models.Vocals,workerUrl,modelPath);
 state.demucs=instance;
 state.demucsReady=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Demucs modeli zaman aşımına uğradı. Model URL adresini kontrol edin.')),240000);
  instance.addEventListener('ready',()=>{clearTimeout(timer);resolve(instance);},{once:true});
  // Upstream package may not raise a proper error when fetching weights fails.
 });
 instance.addEventListener('progress',e=>{if(!state.running)return;const j=state.jobs[state.current];if(j){progress(j,.16+.50*Math.max(0,Math.min(1,e.progress)),'AI vokal ayrıştırıyor');setStatus(`${state.current+1}/${state.jobs.length} · ${j.file.name} · AI vokal ayrıştırıyor`);}});
 instance.addEventListener('complete',e=>{if(state.demucsDone){state.demucsDone.resolve(e.audio);state.demucsDone=null;}});
 return state.demucsReady;
}
async function runDemucs(audioFile,job){
 const model=await loadDemucs(job);
 if(state.cancelled)throw new Error('İşlem durduruldu');
 const done=new Promise((resolve,reject)=>{state.demucsDone={resolve,reject};});
 try{await model.process(audioFile);return await done;}finally{state.demucsDone=null;}
}
async function processJob(ffmpeg,job,i){
 state.current=i;const inputName=`input_${i}.${job.file.name.split('.').pop().toLowerCase()}`;
 const outName=`result_${i}.mp4`,rawName=`raw_${i}.wav`,voiceName=`voice_${i}.wav`,backgroundName=`bg_${i}.wav`;
 const toDelete=[inputName,outName,rawName,voiceName,backgroundName];let vocal=null,background=null;
 try{
  progress(job,.02,'Kaynak kontrol ediliyor');setStatus(`${i+1}/${state.jobs.length} · ${job.file.name}`);
  await ffmpeg.writeFile(inputName,await fetchFile(job.file));
  const needsAI=settings.mode!=='Orijinal sesi koru'||settings.vocalWav||settings.backgroundWav;
  if(needsAI){
   progress(job,.07,'Ses PCM WAV biçimine dönüştürülüyor');
   const result=await ffmpeg.exec(['-i',inputName,'-vn','-map','0:a:0','-ac','2','-ar','44100','-c:a','pcm_s16le',rawName]);
   if(result!==0)throw new Error('Video ses içermiyor veya ses akışı açılamadı.');
   const raw=await ffmpeg.readFile(rawName);
   const audio=new File([raw],`audio_${i}.wav`,{type:'audio/wav'});
   const stems=await runDemucs(audio,job);
   if(!Array.isArray(stems)||stems.length<2)throw new Error('Demucs vokal verisini döndürmedi.');
   // Upstream demo 'Vocals' seçeneği için audio[1] kullanıyor (gerçek sonuç doğrulanmalı).
   vocal=encodeWav(stems[1].left,stems[1].right);
   await ffmpeg.writeFile(voiceName,vocal);
   if(settings.mode==='Sadece arka plan'||settings.backgroundWav){
    progress(job,.68,'Arka plan sesi hesaplanıyor');
    const ctx=new AudioContext({sampleRate:44100});
    try{const decoded=await ctx.decodeAudioData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
     const left=decoded.getChannelData(0),right=decoded.numberOfChannels>1?decoded.getChannelData(1):left;
     const len=Math.min(left.length,stems[1].left.length,stems[1].right.length);const outL=new Float32Array(len),outR=new Float32Array(len);
     for(let k=0;k<len;k++){outL[k]=left[k]-stems[1].left[k];outR[k]=right[k]-stems[1].right[k];}
     background=encodeWav(outL,outR);await ffmpeg.writeFile(backgroundName,background);
    }finally{await ctx.close();}
   }
   if(settings.vocalWav)downloadExtra(job,`${job.file.name.replace(/\.[^.]+$/,'')}_VOKAL.wav`,vocal);
   if(settings.backgroundWav&&background)downloadExtra(job,`${job.file.name.replace(/\.[^.]+$/,'')}_ARKA_PLAN.wav`,background);
  }
  if(state.cancelled)throw new Error('İşlem durduruldu');
  progress(job,.78,'Yeni video oluşturuluyor');
  const code=await ffmpeg.exec(ffmpegArgs(inputName,outName,needsAI?voiceName:null,background?backgroundName:null));
  if(state.cancelled)throw new Error('İşlem durduruldu');
  if(code!==0)throw new Error('FFmpeg dönüştürmeyi tamamlayamadı. Seçilen video kodeği tarayıcıda desteklenmiyor olabilir.');
  const bytes=await ffmpeg.readFile(outName);const blob=new Blob([bytes],{type:'video/mp4'});const name=uniqueName(job.file);
  job.result={size:blob.size,name,url:URL.createObjectURL(blob)};progress(job,1,'Tamamlandı ✓');return true;
 }finally{if(state.ffmpeg===ffmpeg){for(const f of toDelete)try{await ffmpeg.deleteFile(f);}catch{}}}
}
function downloadExtra(job,name,bytes){
 const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
 job.extras??=[];job.extras.push({name,url});
}
async function start(){
 if(state.running||!state.jobs.length)return;
 state.running=true;state.cancelled=false;state.claimed.clear();
 state.jobs.forEach(j=>{if(j.result)URL.revokeObjectURL(j.result.url);for(const e of j.extras||[])URL.revokeObjectURL(e.url);j.extras=[];j.result=null;j.pct=0;j.status='Sırada bekliyor';});render();
 let success=0,fail=0;
 try{const ffmpeg=await loadFFmpeg();for(let i=0;i<state.jobs.length;i++){
  if(state.cancelled)break;const job=state.jobs[i];
  try{if(await processJob(ffmpeg,job,i))success++;}catch(e){if(state.cancelled)break;fail++;progress(job,1,`HATA: ${e.message||e}`);toast(`Video işlenemedi: ${e.message||e}`);}
  render();$('overall').textContent=`${i+1} / ${state.jobs.length} işlendi  •  ${success} başarılı  •  ${fail} hatalı`;
 }}catch(e){toast(`Motor yüklenemedi: ${e.message||e}. İnternet bağlantınızı ve tarayıcı güvenlik ayarlarınızı kontrol edin.`);}
 finally{state.running=false;state.current=-1;updateButtons();setStatus(state.cancelled?'İşlem kullanıcı tarafından durduruldu.':`Toplu işlem bitti: ${success} başarılı, ${fail} hatalı. Orijinal videolar değiştirilmedi.`);if(!state.cancelled)$('totalBar').style.width='100%';}
}
function stop(){if(!state.running)return;state.cancelled=true;setStatus('Durdurma isteği alındı. Aktif işlem sonlandırılıyor…');if(state.demucsDone){state.demucsDone.reject(new Error('İşlem durduruldu'));state.demucsDone=null;}if(state.ffmpeg){state.ffmpeg.terminate();state.ffmpeg=null;state.loaded=false;} // Demucs worker can only be terminated by upstream wrapper internals.
}
$('pick').addEventListener('click',()=>$('files').click());$('folder').addEventListener('click',()=>$('folderFiles').click());$('files').addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});$('folderFiles').addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});$('clear').addEventListener('click',reset);$('start').addEventListener('click',start);$('stop').addEventListener('click',stop);
$('settingsBtn').addEventListener('click',()=>{syncDialog();$('settingsDialog').showModal();});$('closeSettings').addEventListener('click',()=>$('settingsDialog').close());$('cancelSettings').addEventListener('click',()=>$('settingsDialog').close());$('saveSettings').addEventListener('click',()=>{ids.forEach(id=>{const el=$(id);settings[id]=el.type==='checkbox'?el.checked:el.value;});localStorage.setItem('ebs_settings',JSON.stringify(settings));summary();$('settingsDialog').close();setStatus('Ayarlar kaydedildi.');});$('gain').addEventListener('input',e=>$('gainValue').textContent=`${Number(e.target.value)>=0?'+':''}${e.target.value} dB`);$('mix').addEventListener('input',e=>$('mixValue').textContent=`%${e.target.value}`);
const drop=$('drop');['dragenter','dragover'].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('drag');}));['dragleave','drop'].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('drag');}));drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
summary();render();

// PWA: göreli yollar sayesinde GitHub Pages ve diğer alt klasörlerde çalışır.
let deferredInstallPrompt=null;
const installButton=document.getElementById('installApp');
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
function refreshInstallButton(){
 if(installButton)installButton.hidden=!deferredInstallPrompt || standalone();
}
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();deferredInstallPrompt=event;refreshInstallButton();
});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;refreshInstallButton();});
if(installButton) installButton.addEventListener('click',async()=>{
 if(!deferredInstallPrompt){setStatus('Chrome veya Edge menüsünden “Uygulamayı yükle” seçeneğini kullanabilirsiniz.');return;}
 const event=deferredInstallPrompt;deferredInstallPrompt=null;refreshInstallButton();
 try{await event.prompt();const choice=await event.userChoice;
   if(choice?.outcome==='accepted')setStatus('EBS AI Studio Windows uygulaması olarak yükleniyor.');
   else setStatus('Uygulama yükleme işlemi iptal edildi.');
 }catch(error){setStatus('Yükleme penceresi açılamadı. Chrome veya Edge menüsünden yüklemeyi deneyin.');}
});
if('serviceWorker' in navigator){
 window.addEventListener('load',()=>navigator.serviceWorker.register(new URL('./sw.js', location.href).href,{scope:new URL('./',location.href).pathname})
 .catch(error=>console.warn('PWA service worker kaydı başarısız:',error)));
}
refreshInstallButton();
