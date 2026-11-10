'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const input = $('fileInput'), zone = $('dropzone'), list = $('fileList'), count = $('fileCount');
  const clear = $('clearBtn'), convert = $('convertBtn'), select = $('formatSelect');
  const range = $('qualityRange'), qualitySection = $('qualitySection'), qualityValue = $('qualityValue');
  const status = $('status'), progressWrap = $('progressWrap'), progressText = $('progressText');
  const progressPercent = $('progressPercent'), progressBar = $('progressBar'), progressFill = $('progressFill');
  const installBtn = $('installBtn');
  const installLabel = $('installLabel');
  let files = [], busy = false, installPrompt = null;
  const MAX_FILES = 100;
  const ext = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/avif':'avif', 'image/bmp':'bmp' };
  const extraExtensions=/\.(png|jpe?g|jfif|pjpeg|pjp|webp|gif|bmp|dib|avif|apng|svg|ico|cur|heic|heif|tif|tiff|qoi|tga|pbm|pgm|ppm|pnm|jxl|jp2|j2k|jpf|jpx)$/i;
  const fmt = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;
  function announce(message, isError=false) { status.textContent = message; status.classList.toggle('error',isError); }
  function showProgress(done,total,label) {
    const pct = total ? Math.round(done/total*100) : 0;
    progressWrap.hidden = false; progressText.textContent = label;
    progressPercent.textContent = `${pct}%`;progressFill.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow',String(pct));
  }
  function paint() {
    count.textContent = String(files.length);
    clear.disabled = busy || !files.length;
    convert.disabled = busy || !files.length;
    input.disabled = busy;
    select.disabled = busy;
    range.disabled = busy;
    zone.setAttribute('aria-disabled', String(busy));
    list.replaceChildren();
    if (!files.length) {const empty=document.createElement('div');empty.className='empty-state';empty.textContent='Henüz dosya seçilmedi. Görselleriniz burada listelenecek.';list.append(empty);return;}
    files.forEach((file,index)=>{
      const row=document.createElement('div');row.className='file-row';
      const icon=document.createElement('div');icon.className='file-thumb';icon.style.display='grid';icon.style.placeItems='center';icon.textContent='▧';icon.style.color='#7fd9dc';
      const meta=document.createElement('div');meta.className='file-meta';
      const name=document.createElement('strong');name.textContent=file.name;
      const desc=document.createElement('small');desc.textContent=fmt(file.size);
      meta.append(name,desc);
      const button=document.createElement('button');button.className='file-remove';button.type='button';button.title='Dosyayı kaldır';button.setAttribute('aria-label',`${file.name} dosyasını kaldır`);button.textContent='✕';button.disabled=busy;
      button.addEventListener('click',()=>{files.splice(index,1);paint();announce('');});
      row.append(icon,meta,button);list.append(row);
    });
  }
  function addFiles(items) {
    if(busy)return;
    const candidates=Array.from(items || []);
    let accepted=0, rejected=0, duplicates=0;
    for(const file of candidates){
      if(files.length>=MAX_FILES){rejected++;continue;}
      if(!file.type.startsWith('image/') && !extraExtensions.test(file.name)){rejected++;continue;}
      if(files.some(f=>f.name===file.name&&f.size===file.size&&f.lastModified===file.lastModified)){duplicates++;continue;}
      files.push(file);accepted++;
    }
    paint();
    if(rejected)announce(`${accepted} dosya eklendi. ${rejected} dosya desteklenmeyen tür veya ${MAX_FILES} dosyalık sınır nedeniyle alınmadı.`,true);
    else if(duplicates)announce(`${accepted} yeni dosya eklendi. ${duplicates} tekrar atlandı.`);
    else if(accepted)announce(`${accepted} dosya eklendi. Çıktı formatını seçip dönüştürebilirsiniz.`);
    input.value='';
  }
  zone.addEventListener('click',()=>{if(!busy)input.click();});
  zone.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!busy){e.preventDefault();input.click();}});
  input.addEventListener('change',()=>addFiles(input.files));
  ['dragenter','dragover'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();if(!busy)zone.classList.add('drag-over');}));
  ['dragleave','drop'].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.remove('drag-over');}));
  zone.addEventListener('drop',e=>addFiles(e.dataTransfer?.files));
  clear.addEventListener('click',()=>{if(busy)return;files=[];paint();progressWrap.hidden=true;announce('Liste temizlendi.');});
  select.addEventListener('change',()=>{qualitySection.hidden=['image/png','image/bmp'].includes(select.value);});
  range.addEventListener('input',()=>{qualityValue.textContent=`${range.value}%`;});
  $('year').textContent=String(new Date().getFullYear());

  function loadImage(file){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file); const img=new Image();
      const tidy=()=>URL.revokeObjectURL(url);
      img.onload=()=>{tidy();resolve(img);};
      img.onerror=()=>{tidy();reject(new Error('Tarayıcınız bu dosya biçimini açamıyor. HEIC/HEIF veya sıkıştırılmış TIFF için uyumlu tarayıcı ya da başka bir dönüştürücü gerekebilir.'));};
      img.src=url;
    });
  }
  function toBlob(canvas,type,quality){
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
      if(!blob || blob.type!==type){reject(new Error('Seçilen çıktı biçimi bu tarayıcıda desteklenmiyor.'));return;}
      resolve(blob);
    },type,quality));
  }
  function bmpBlob(canvas) {
    const w=canvas.width,h=canvas.height,pixels=canvas.getContext('2d').getImageData(0,0,w,h).data;
    const stride=w*4,header=14+40,bytes=header+stride*h;
    if(bytes>0xffffffff)throw Error('BMP dosyası 4 GB sınırını aşıyor.');
    const array=new Uint8Array(bytes),v=new DataView(array.buffer);
    array[0]=66;array[1]=77;v.setUint32(2,bytes,true);v.setUint32(10,header,true);
    v.setUint32(14,40,true);v.setInt32(18,w,true);v.setInt32(22,-h,true);
    v.setUint16(26,1,true);v.setUint16(28,32,true);v.setUint32(30,0,true);
    v.setUint32(34,stride*h,true);
    for(let i=0;i<w*h;i++){const a=i*4,b=header+i*4;array[b]=pixels[a+2];array[b+1]=pixels[a+1];array[b+2]=pixels[a];array[b+3]=pixels[a+3];}
    return new Blob([array],{type:'image/bmp'});
  }
  async function transform(file,type,quality){
    let decoded=null;
    if(window.EBExtraFormats)decoded=await window.EBExtraFormats.decode(file);
    const img=decoded||await loadImage(file);
    const width=decoded?decoded.width:img.naturalWidth,height=decoded?decoded.height:img.naturalHeight;
    if(!width||!height)throw Error('Görsel boyutları okunamadı.');
    if(width*height>32000000)throw Error('Görsel 32 megapiksel sınırını aşıyor; bellek güvenliği için işlenmedi.');
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    if(!canvas.width||!canvas.height||!canvas.getContext)throw Error('Geçersiz görsel boyutu.');
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Görsel işlemek için yeterli bellek yok.');
    if(type==='image/jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);}
    ctx.drawImage(img,0,0);const blob=type==='image/bmp'?bmpBlob(canvas):await toBlob(canvas,type,quality);
    canvas.width=0;canvas.height=0;
    return blob;
  }
  function uniqueNames(results){
    const used=new Set();
    return results.map(({file,blob})=>{
      const stem=(file.name.replace(/\.[^.]+$/,'')||'gorsel').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,150);
      const suffix=ext[select.value];let name=`${stem}.${suffix}`,n=2;
      while(used.has(name.toLowerCase()))name=`${stem}-${n++}.${suffix}`;
      used.add(name.toLowerCase());return {name,blob};
    });
  }
  // Standalone ZIP (store method): PNG/JPG/WebP files already compress well, so no CDN dependency is required.
  const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  function crc32(buf){let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  function w16(view,pos,val){view.setUint16(pos,val,true);}function w32(view,pos,val){view.setUint32(pos,val,true);}
  function dosDate(d){return ((Math.max(1980,d.getFullYear())-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();}
  function dosTime(d){return (d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2);}
  async function makeZip(items){
    const encoder=new TextEncoder(),local=[],central=[];let offset=0;const now=new Date();
    for(const item of items){
      const name=encoder.encode(item.name),data=new Uint8Array(await item.blob.arrayBuffer()),crc=crc32(data);
      if(data.length>0xffffffff||offset>0xffffffff)throw Error('ZIP arşivi 4 GB sınırını aşıyor.');
      const lh=new Uint8Array(30+name.length),lv=new DataView(lh.buffer);
      w32(lv,0,0x04034b50);w16(lv,4,20);w16(lv,6,0x0800);w16(lv,8,0);w16(lv,10,dosTime(now));w16(lv,12,dosDate(now));w32(lv,14,crc);w32(lv,18,data.length);w32(lv,22,data.length);w16(lv,26,name.length);lh.set(name,30);
      const ch=new Uint8Array(46+name.length),cv=new DataView(ch.buffer);
      w32(cv,0,0x02014b50);w16(cv,4,20);w16(cv,6,20);w16(cv,8,0x0800);w16(cv,10,0);w16(cv,12,dosTime(now));w16(cv,14,dosDate(now));w32(cv,16,crc);w32(cv,20,data.length);w32(cv,24,data.length);w16(cv,28,name.length);w32(cv,42,offset);ch.set(name,46);
      local.push(lh,data);central.push(ch);offset+=lh.length+data.length;
    }
    if(items.length>65535)throw Error('Çok fazla dosya var.');
    const centralSize=central.reduce((sum,p)=>sum+p.length,0);
    if(offset+centralSize>0xffffffff)throw Error('ZIP arşivi 4 GB sınırını aşıyor.');
    const end=new Uint8Array(22),ev=new DataView(end.buffer);w32(ev,0,0x06054b50);w16(ev,8,items.length);w16(ev,10,items.length);w32(ev,12,centralSize);w32(ev,16,offset);
    return new Blob([...local,...central,end],{type:'application/zip'});
  }
  function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  convert.addEventListener('click',async()=>{
    if(busy||!files.length)return;
    busy=true;paint();announce('');const chosen=[...files],results=[],errors=[];
    const type=select.value,quality=Number(range.value)/100;
    try{
      for(let i=0;i<chosen.length;i++){
        const file=chosen[i];showProgress(i,chosen.length,`${i+1}/${chosen.length} • ${file.name} işleniyor`);
        try{results.push({file,blob:await transform(file,type,quality)});}catch(e){errors.push(`${file.name}: ${e.message||'Bilinmeyen hata'}`);}
        showProgress(i+1,chosen.length,`${i+1}/${chosen.length} dosya işlendi`);
        await new Promise(r=>setTimeout(r,0));
      }
      if(!results.length){announce(`Hiçbir görsel dönüştürülemedi. ${errors.slice(0,2).join(' | ')}`,true);return;}
      const named=uniqueNames(results);
      if(named.length===1){download(named[0].blob,named[0].name);}else{progressText.textContent='ZIP arşivi hazırlanıyor';download(await makeZip(named),'eb-tools-donusturulen-gorseller.zip');}
      announce(`${named.length} dosya başarıyla dönüştürüldü ve indirme başlatıldı.${errors.length?` ${errors.length} dosya atlandı: ${errors.slice(0,2).join(' | ')}`:''}`,errors.length>0);
    }catch(e){announce(`İndirme tamamlanamadı: ${e.message||'Bilinmeyen hata'}`,true);}
    finally{busy=false;paint();}
  });

  // Relative service-worker scope supports hosting at the domain root or in a subfolder.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', {scope:'./'}).catch(error => {
      console.warn('PWA servis çalışanı kaydedilemedi:', error);
    }));
  }
  function installed() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function updateInstallLabel() {
    if(installed()) { installBtn.hidden=true; return; }
    installBtn.hidden=false;
    installLabel.textContent = installPrompt ? 'Uygulamayı yükle' : 'Yükleme seçenekleri';
  }
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); installPrompt=e; updateInstallLabel();
  });
  installBtn.addEventListener('click',async()=>{
    if(installed())return;
    if(installPrompt){
      const p=installPrompt; installPrompt=null;
      try{await p.prompt();await p.userChoice;}catch(error){console.warn('Kurulum penceresi açılamadı:',error);}
      updateInstallLabel();return;
    }
    // Some browsers do not expose beforeinstallprompt; still offer actionable steps.
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSecure=location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1';
    const instructions=!isSecure
      ? 'Uygulama yükleme için siteyi HTTPS üzerinden veya localhost adresinde açın. Dosyayı doğrudan file:// olarak açarsanız PWA yükleme çalışmaz.'
      : ios
        ? 'Safari\'de Paylaş düğmesine dokunun, ardından Ana Ekrana Ekle seçeneğini kullanın.'
        : 'Tarayıcı menüsündeki Uygulamayı yükle / Sayfayı uygulama olarak yükle seçeneğini deneyin. Chrome ve Edge\'de adres çubuğundaki yükleme simgesi de kullanılabilir. Seçenek yoksa tarayıcı siteyi henüz kurulabilir olarak değerlendirmemiş olabilir.';
    announce(instructions, !isSecure);
    $('donusturucu').scrollIntoView({behavior:'smooth',block:'start'});
  });
  window.addEventListener('appinstalled',()=>{installPrompt=null;updateInstallLabel();announce('Uygulama yüklendi.');});
  updateInstallLabel();
  paint();
})();
