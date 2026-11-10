/* EB Tools — local-only decoders for QOI, TGA, Netpbm (P1-P6) and basic uncompressed TIFF. */
'use strict';
window.EBExtraFormats = (() => {
  function fail(msg) { throw new Error(msg); }
  function image(w,h,pixels) {
    if (!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||w*h>32000000) fail('Boyut geçersiz veya 32 MP sınırını aşıyor.');
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:false}); if(!ctx) fail('Görsel işlemek için bellek yetersiz.');
    ctx.putImageData(new ImageData(pixels,w,h),0,0);return canvas;
  }
  function qoi(buf) {
    const d=new Uint8Array(buf),v=new DataView(buf);if(d.length<22||String.fromCharCode(...d.slice(0,4))!=='qoif')fail('QOI dosyası geçersiz.');
    const w=v.getUint32(4),h=v.getUint32(8);if(w*h>32000000||w<1||h<1)fail('QOI görseli çok büyük.');
    const out=new Uint8ClampedArray(w*h*4),index=new Uint8Array(64*4);let r=0,g=0,b=0,a=255,p=14,run=0;
    for(let i=0;i<w*h;i++){
      if(run>0)run--;
      else {if(p>=d.length-8)fail('QOI verisi eksik.');const op=d[p++];
        if(op===254){if(p+3>d.length)fail('QOI verisi eksik.');r=d[p++];g=d[p++];b=d[p++];}
        else if(op===255){if(p+4>d.length)fail('QOI verisi eksik.');r=d[p++];g=d[p++];b=d[p++];a=d[p++];}
        else if((op&192)===0){const x=(op&63)*4;r=index[x];g=index[x+1];b=index[x+2];a=index[x+3];}
        else if((op&192)===64){r=(r+((op>>4)&3)-2)&255;g=(g+((op>>2)&3)-2)&255;b=(b+(op&3)-2)&255;}
        else if((op&192)===128){if(p>=d.length)fail('QOI verisi eksik.');const b2=d[p++],dg=(op&63)-32;r=(r+dg+(b2>>4)-8)&255;g=(g+dg)&255;b=(b+dg+(b2&15)-8)&255;}
        else run=op&63;
      }
      const ix=((r*3+g*5+b*7+a*11)%64)*4;index[ix]=r;index[ix+1]=g;index[ix+2]=b;index[ix+3]=a;
      const o=i*4;out[o]=r;out[o+1]=g;out[o+2]=b;out[o+3]=a;
    }return image(w,h,out);
  }
  function tga(buf) {
    const d=new Uint8Array(buf),v=new DataView(buf);if(d.length<18)fail('TGA başlığı eksik.');
    const cmap=d[1],type=d[2],w=v.getUint16(12,true),h=v.getUint16(14,true),depth=d[16],desc=d[17];
    if(cmap!==0||![2,3,10,11].includes(type)||![8,24,32].includes(depth))fail('Bu TGA çeşidi desteklenmiyor (RGB, gri, RLE desteklenir).');
    if((type===3||type===11)!==(depth===8))fail('TGA piksel türü geçersiz.');
    if(w*h>32000000||w<1||h<1)fail('TGA görseli çok büyük.');
    let p=18+d[0],i=0;const output=new Uint8ClampedArray(w*h*4),rle=type===10||type===11;
    function pixel(){if(p+depth/8>d.length)fail('TGA verisi eksik.');if(depth===8){const x=d[p++];return[x,x,x,255];}const b=d[p++],g=d[p++],r=d[p++],a=depth===32?d[p++]:255;return[r,g,b,a];}
    while(i<w*h){let size=1,rep=false;if(rle){if(p>=d.length)fail('TGA verisi eksik.');const hdr=d[p++];size=(hdr&127)+1;rep=Boolean(hdr&128);}if(i+size>w*h)fail('TGA RLE verisi geçersiz.');const same=rep?pixel():null;
      for(let j=0;j<size;j++){const c=rep?same:pixel();const pos=i++;const x=pos%w,fy=Math.floor(pos/w),y=(desc&32)?fy:h-1-fy,ox=(desc&16)?w-1-x:x,off=(y*w+ox)*4;output.set(c,off);}}
    return image(w,h,output);
  }
  function netpbm(buf){
    const d=new Uint8Array(buf);let p=0;
    function token(){while(p<d.length){if(d[p]===35){while(p<d.length&&d[p]!==10)p++;}else if(d[p]<=32)p++;else break;}const s=p;while(p<d.length&&d[p]>32&&d[p]!==35)p++;if(s===p)fail('Netpbm verisi eksik.');return new TextDecoder('ascii').decode(d.slice(s,p));}
    const magic=token(),w=Number(token()),h=Number(token());if(!/^P[1-6]$/.test(magic)||w<1||h<1||w*h>32000000)fail('Netpbm görseli geçersiz veya çok büyük.');
    const ascii=['P1','P2','P3'].includes(magic),pbm=['P1','P4'].includes(magic),rgb=['P3','P6'].includes(magic);const max=pbm?1:Number(token());if(!Number.isInteger(max)||max<1||max>65535)fail('Netpbm renk derinliği desteklenmiyor.');
    const out=new Uint8ClampedArray(w*h*4);for(let i=3;i<out.length;i+=4)out[i]=255;
    if(ascii){for(let i=0;i<w*h;i++){const x=Number(token()),y=rgb?Number(token()):x,z=rgb?Number(token()):x;const k=i*4;out[k]=pbm?(x?0:255):x*255/max;out[k+1]=pbm?(x?0:255):y*255/max;out[k+2]=pbm?(x?0:255):z*255/max;}}
    else {if(p>=d.length||d[p]>32)fail('Netpbm veri ayracı eksik.'); // one required whitespace byte (CRLF accepted)
      if(d[p]===13&&d[p+1]===10)p+=2;else p++;
      if(pbm){const row=Math.ceil(w/8);if(p+row*h>d.length)fail('PBM verisi eksik.');for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=(d[p+y*row+(x>>3)]>>(7-(x&7)))&1,k=(y*w+x)*4;out[k]=out[k+1]=out[k+2]=v?0:255;}}
      else {const channels=rgb?3:1,bytes=max>255?2:1;if(p+w*h*channels*bytes>d.length)fail('Netpbm verisi eksik.');for(let i=0;i<w*h;i++){const vals=[];for(let c=0;c<channels;c++){const n=bytes===1?d[p++]:d[p++]*256+d[p++];vals.push(n*255/max);}const k=i*4;out[k]=vals[0];out[k+1]=rgb?vals[1]:vals[0];out[k+2]=rgb?vals[2]:vals[0];}}
    }return image(w,h,out);
  }
  function tiff(buf){
    const d=new DataView(buf);if(d.byteLength<8)fail('TIFF başlığı eksik.');const hdr=d.getUint16(0),le=hdr===0x4949;if(!le&&hdr!==0x4d4d)fail('TIFF başlığı geçersiz.');
    const u16=p=>{if(p<0||p+2>d.byteLength)fail('TIFF verisi eksik.');return d.getUint16(p,le);},u32=p=>{if(p<0||p+4>d.byteLength)fail('TIFF verisi eksik.');return d.getUint32(p,le);};if(u16(2)!==42)fail('BigTIFF veya desteklenmeyen TIFF türü.');
    const ifd=u32(4),n=u16(ifd),tags={};if(n>2048)fail('TIFF etiketleri geçersiz.');
    for(let i=0;i<n;i++){const pos=ifd+2+i*12,tag=u16(pos),type=u16(pos+2),count=u32(pos+4),size=type===3?2:type===4?4:type===1?1:0;if(!size||count>32000000||size*count>100000000)continue;const off=size*count<=4?pos+8:u32(pos+8),arr=[];for(let j=0;j<count;j++){const at=off+j*size;arr.push(type===3?u16(at):type===4?u32(at):d.getUint8(at));}tags[tag]=arr;}
    const get=(tag,def)=>tags[tag]?.[0]??def,w=get(256,0),h=get(257,0),comp=get(259,1),photo=get(262,2),samples=get(277,photo===2?3:1),bits=tags[258]||[8],planar=get(284,1),orientation=get(274,1);
    if(!w||!h||w*h>32000000)fail('TIFF boyutu geçersiz veya çok büyük.');
    if(comp!==1||!bits.every(x=>x===8)||planar!==1||![1,2,3,4].includes(samples)||![0,1,2].includes(photo)||orientation!==1)fail('Bu TIFF sıkıştırma, yön veya renk türü henüz desteklenmiyor.');
    const rows=get(278,h),offsets=tags[273]||[],counts=tags[279]||[];if(!offsets.length)fail('TIFF şeritleri bulunamadı.');
    const out=new Uint8ClampedArray(w*h*4);for(let strip=0;strip<offsets.length;strip++){const start=offsets[strip],y0=strip*rows,lines=Math.min(rows,h-y0),needed=lines*w*samples;if(needed<0||start+needed>d.byteLength||(counts[strip]!==undefined&&counts[strip]<needed))fail('TIFF piksel verisi eksik.');
      for(let k=0;k<lines*w;k++){const src=start+k*samples,dst=(y0*w+k)*4,v=d.getUint8(src);if(photo===2){out[dst]=v;out[dst+1]=d.getUint8(src+1);out[dst+2]=d.getUint8(src+2);out[dst+3]=samples===4?d.getUint8(src+3):255;}
        else{const grey=photo===0?255-v:v;out[dst]=out[dst+1]=out[dst+2]=grey;out[dst+3]=samples===2?d.getUint8(src+1):255;}}}
    return image(w,h,out);
  }
  async function decode(file){const name=file.name.toLowerCase(),buf=await file.arrayBuffer();if(/\.qoi$/.test(name))return qoi(buf);if(/\.tga$/.test(name))return tga(buf);if(/\.(pnm|pbm|pgm|ppm)$/.test(name))return netpbm(buf);if(/\.(tif|tiff)$/.test(name))return tiff(buf);return null;}
  return {decode};
})();
