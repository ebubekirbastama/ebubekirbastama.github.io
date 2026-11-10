'use strict';
const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput'), dropZone = $('dropZone'), original = $('originalPreview'), result = $('resultPreview');
const btn = $('convertBtn'), status = $('statusText'), downloadLink = $('downloadLink');
let sourceFile = null, imageBitmap = null, sourceURL = null, outputURL = null, deferredInstall = null, busy = false;
const MAX_BYTES = 20 * 1024 * 1024;
$('year').textContent = new Date().getFullYear();
function setStatus(message, error = false) { status.textContent = message; status.classList.toggle('error', error); }
function readableSize(bytes) { return (bytes < 1024 * 1024 ? (bytes / 1024).toFixed(0) + ' KB' : (bytes / (1024 * 1024)).toFixed(2) + ' MB'); }
function releaseOutput() { if (outputURL) URL.revokeObjectURL(outputURL); outputURL = null; result.replaceChildren(); $('downloadArea').hidden = true; $('resultTab').disabled = true; showTab('original'); }
function clearImage() { releaseOutput(); if (sourceURL) URL.revokeObjectURL(sourceURL); sourceURL = null; sourceFile = null; imageBitmap?.close?.(); imageBitmap = null; fileInput.value = ''; original.hidden = true; original.removeAttribute('src'); $('fileInfo').hidden = true; $('emptyPreview').hidden = false; btn.disabled = true; $('previewDetails').textContent = 'Henüz bir görsel seçilmedi'; setStatus('Başlamak için bir görsel yükleyin.'); }
$('clearBtn').addEventListener('click', clearImage);
function showTab(which) { const isResult = which === 'result' && !$('resultTab').disabled; original.hidden = isResult || !sourceFile; result.hidden = !isResult; $('emptyPreview').hidden = Boolean(sourceFile); $('originalTab').setAttribute('aria-selected', String(!isResult)); $('resultTab').setAttribute('aria-selected', String(isResult)); $('previewType').textContent = isResult ? 'SVG · ÖNİZLEME' : 'ORİJİNAL · ÖNİZLEME'; }
$('originalTab').addEventListener('click', () => showTab('original'));
$('resultTab').addEventListener('click', () => showTab('result'));
function setMode() { $('vectorOptions').hidden = document.querySelector('input[name="mode"]:checked').value !== 'vector'; releaseOutput(); if (sourceFile) setStatus('Ayarlar hazır. Dönüştürme işlemini başlatabilirsiniz.'); }
document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', setMode));
$('colorRange').addEventListener('input', () => { $('colorVal').textContent = $('colorRange').value; });
$('detailRange').addEventListener('input', () => { $('detailVal').textContent = ['','Düşük','Orta','Yüksek'][+$('detailRange').value]; });
async function loadFile(file) {
  if (!file) return;
  if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)) { setStatus('PNG, JPG, WebP veya GIF seçin.', true); return; }
  if (file.size > MAX_BYTES) { setStatus('Dosya boyutu 20 MB sınırını aşıyor.', true); return; }
  clearImage();
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 30_000_000) { bitmap.close(); throw new Error('Görsel çok büyük (en fazla 30 megapiksel).'); }
    imageBitmap = bitmap; sourceFile = file; sourceURL = URL.createObjectURL(file);
    original.src = sourceURL; original.hidden = false; $('emptyPreview').hidden = true;
    $('fileName').textContent = file.name; $('fileDetails').textContent = `${bitmap.width} × ${bitmap.height} px · ${readableSize(file.size)}`;
    $('fileInfo').hidden = false; btn.disabled = false; $('previewDetails').textContent = `${bitmap.width} × ${bitmap.height} px`;
    setStatus('Görsel hazır. SVG oluşturmak için dönüştürün.'); showTab('original');
  } catch (err) { clearImage(); setStatus('Görsel açılamadı: ' + err.message, true); }
}
fileInput.addEventListener('change', (e) => loadFile(e.target.files?.[0]));
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
for (const evt of ['dragenter','dragover']) dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('dragging'); });
for (const evt of ['dragleave','drop']) dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', e => loadFile(e.dataTransfer?.files?.[0]));
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function hex(rgb) { return '#' + rgb.map(v => Math.min(255,Math.max(0,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
// Lightweight RGB k-means with deterministic initial samples; all computation stays local.
function quantize(data, width, height, colors, preserveAlpha) {
  const n = width * height, palette = [], samples = [], stride = Math.max(1, Math.floor(n / 11000));
  for (let i=0;i<n;i+=stride) { const p=i*4; if (preserveAlpha && data[p+3]<128) continue; samples.push([data[p],data[p+1],data[p+2]]); }
  if (!samples.length) return { palette:[], labels:new Int16Array(n).fill(-1) };
  palette.push(samples[0].slice());
  while (palette.length < colors) {
    let best = samples[0], max = -1;
    // maximin sampling makes seed colors responsive to distinct visible regions
    for (let s=0;s<samples.length;s+=Math.max(1,Math.floor(samples.length/1500))) {
      const color = samples[s]; let mind = Infinity;
      for (const c of palette) { const d=(c[0]-color[0])**2+(c[1]-color[1])**2+(c[2]-color[2])**2; if(d<mind)mind=d; }
      if(mind>max){max=mind;best=color;}
    }
    if(max<1)break;
    palette.push(best.slice());
  }
  const labels = new Int16Array(n).fill(-1);
  for(let iter=0;iter<7;iter++) {
    const sums=palette.map(()=>[0,0,0,0]);
    for(let i=0;i<n;i++) {
      const k=i*4; if(preserveAlpha && data[k+3]<128) continue;
      let best=0,min=Infinity;
      for(let c=0;c<palette.length;c++){const p=palette[c];const dist=(data[k]-p[0])**2+(data[k+1]-p[1])**2+(data[k+2]-p[2])**2;if(dist<min){min=dist;best=c;}}
      labels[i]=best; const s=sums[best]; s[0]+=data[k];s[1]+=data[k+1];s[2]+=data[k+2];s[3]++;
    }
    for(let c=0;c<palette.length;c++)if(sums[c][3])palette[c]=sums[c].slice(0,3).map(v=>v/sums[c][3]);
  }
  // Majority smoothing reduces isolated noise before edge tracing.
  for(let pass=0;pass<2;pass++) {
    const copy=labels.slice();
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++) {
      const i=y*width+x, v=copy[i];if(v<0)continue;
      const near=[copy[i-1],copy[i+1],copy[i-width],copy[i+width],copy[i-width-1],copy[i-width+1],copy[i+width-1],copy[i+width+1]];
      const counts=new Map();for(const c of near)if(c>=0)counts.set(c,(counts.get(c)||0)+1);
      let winner=v,top=0;for(const [c,total] of counts)if(total>top){top=total;winner=c;}
      if(top>=6)labels[i]=winner;
    }
  }
  return {palette,labels};
}
// Extract boundaries of same-colored pixels into closed SVG paths.
function traceContours(labels,w,h,numColors) {
  const paths=[];
  for(let color=0;color<numColors;color++){
    const edges=new Map();let count=0;
    const put=(ax,ay,bx,by)=>{const a=ay*(w+1)+ax,b=by*(w+1)+bx;let bucket=edges.get(a);if(!bucket){bucket=[];edges.set(a,bucket);}bucket.push(b);count++;};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x;if(labels[i]!==color)continue;
      if(y===0||labels[i-w]!==color)put(x,y,x+1,y);
      if(x===w-1||labels[i+1]!==color)put(x+1,y,x+1,y+1);
      if(y===h-1||labels[i+w]!==color)put(x+1,y+1,x,y+1);
      if(x===0||labels[i-1]!==color)put(x,y+1,x,y);
    }
    if(!count){paths.push('');continue;}
    const chunks=[];let steps=0;
    while(edges.size && steps<count+3){
      let start=edges.keys().next().value,cur=start,prev=-1;const points=[];
      do{
        const x=cur%(w+1),y=Math.floor(cur/(w+1));points.push([x,y]);
        const bucket=edges.get(cur);if(!bucket||!bucket.length)break;
        let choose=bucket.length-1;
        if(bucket.length>1&&prev>=0){ // prefer clockwise edge at diagonal junction
          const pd=(cur%(w+1)-prev%(w+1))+2*(Math.floor(cur/(w+1))-Math.floor(prev/(w+1)));
          let score=-Infinity;
          for(let j=0;j<bucket.length;j++){
            const b=bucket[j];const dx=b%(w+1)-x,dy=Math.floor(b/(w+1))-y;
            const turn=pd===1?dy:pd===-1?-dy:pd===2?-dx:dx;
            if(turn>score){score=turn;choose=j;}
          }
        }
        const next=bucket.splice(choose,1)[0];if(!bucket.length)edges.delete(cur);prev=cur;cur=next;steps++;
      }while(cur!==start&&steps<count+3);
      if(cur!==start||points.length<4)continue;
      // Remove collinear points. Straight-line simplification preserves geometry exactly.
      const reduced=[];for(let j=0;j<points.length;j++){
        const a=points[(j+points.length-1)%points.length],b=points[j],c=points[(j+1)%points.length];
        if((b[0]-a[0])*(c[1]-b[1])!==(b[1]-a[1])*(c[0]-b[0]))reduced.push(b);
      }
      if(reduced.length>=3){chunks.push('M'+reduced.map(p=>p.join(' ')).join('L')+'Z');}
    }
    paths.push(chunks.join(''));
  }
  return paths;
}
async function makeVector(bitmap) {
  const detail=+$('detailRange').value, longest=[0,160,240,360][detail];
  const scale=Math.min(1,longest/Math.max(bitmap.width,bitmap.height));
  const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h).data;
  setStatus('Renk katmanları analiz ediliyor…');await tick();
  const {palette,labels}=quantize(pixels,w,h,+$('colorRange').value,$('alphaToggle').checked);
  setStatus('Vektör yolları oluşturuluyor…');await tick();
  const paths=traceContours(labels,w,h,palette.length);
  const layers=paths.map((path,i)=>path?`<path fill="${hex(palette[i])}" fill-rule="evenodd" d="${path}"/>`:'').join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bitmap.width}" height="${bitmap.height}" viewBox="0 0 ${w} ${h}" role="img" aria-label="GoldenTrace vektör çizim">${layers}</svg>`;
}
async function makeEmbedded(file,bitmap){
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Dosya okunamadı'));reader.readAsDataURL(file);});
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bitmap.width}" height="${bitmap.height}" viewBox="0 0 ${bitmap.width} ${bitmap.height}"><image width="100%" height="100%" href="${base64}"/></svg>`;
}
btn.addEventListener('click',async()=>{
  if(!sourceFile||!imageBitmap||busy)return;busy=true;btn.disabled=true;$('convertText').textContent='Dönüştürülüyor…';releaseOutput();
  const file=sourceFile, bitmap=imageBitmap, mode=document.querySelector('input[name="mode"]:checked').value;
  try{
    setStatus('Görsel işleniyor…');await tick();
    const svg=mode==='vector'?await makeVector(bitmap):await makeEmbedded(file,bitmap);
    const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
    outputURL=URL.createObjectURL(blob);downloadLink.href=outputURL;
    const base=file.name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ_-]/g,'-').slice(0,60)||'gorsel';
    downloadLink.download=`${base}-${mode==='vector'?'vektor':'orijinal'}.svg`;
    // Use image element for safe, isolated SVG rendering; never inject untrusted SVG as HTML.
    const preview=document.createElement('img');preview.src=outputURL;preview.alt='Oluşturulan SVG';result.replaceChildren(preview);
    $('outputInfo').textContent=`${readableSize(blob.size)} · ${mode==='vector'?'Gerçek vektör yolları':'Raster gömülü SVG'}`;
    $('downloadArea').hidden=false;$('resultTab').disabled=false;showTab('result');setStatus('SVG oluşturuldu. Dosyanız indirilmeye hazır.');
  }catch(error){console.error(error);setStatus('Dönüştürme başarısız: '+(error.message||'Bilinmeyen hata'),true);}
  finally{busy=false;btn.disabled=!sourceFile;$('convertText').textContent="SVG'ye dönüştür";}
});
window.addEventListener('beforeinstallprompt', e=>{e.preventDefault();deferredInstall=e;$('installBtn').hidden=false;});
$('installBtn').addEventListener('click',async()=>{if(!deferredInstall)return;const prompt=deferredInstall;deferredInstall=null;$('installBtn').hidden=true;await prompt.prompt();});
window.addEventListener('appinstalled',()=>{$('installBtn').hidden=true;deferredInstall=null;});
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
