/* EBS AI Studio — upstream Demucs WASM worker bridge (deneysel).
 * Kaynak: https://github.com/bengfarrell/demucs-wasm
 * Çalışması CDN, WASM ve model erişimine bağlıdır.
 */
const EBS_DEMUCS_CDN = 'https://cdn.jsdelivr.net/gh/bengfarrell/demucs-wasm@main/';
const nativeImportScripts = self.importScripts.bind(self);
self.importScripts = (...paths) => nativeImportScripts(...paths.map(path =>
  path === 'demucs_onnx_simd.js' ? EBS_DEMUCS_CDN + path : path
));
// Emscripten WASM dosyasının doğru bulunabilmesi için uzak URL'yi iletmeyi dene.
self.Module = { locateFile: (filename) => EBS_DEMUCS_CDN + filename };
try {
  nativeImportScripts(EBS_DEMUCS_CDN + 'worker.js');
} catch (err) {
  self.postMessage({msg:'WASM_ERROR', error:String(err)});
  console.error('Demucs Worker başlatılamadı', err);
}
