/* EBS AI Studio Pro — Demucs classic-worker / WASM asset path fix.
   Upstream: https://github.com/bengfarrell/demucs-wasm (MIT).
   Emscripten libdemucs(moduleArg) requires locateFile passed as argument.
   Setting self.Module does NOT configure this factory. */
const DEMUCS_BASE = 'https://cdn.jsdelivr.net/gh/bengfarrell/demucs-wasm@main/';
const WASM_URL = DEMUCS_BASE + 'demucs_onnx_simd.wasm';
const originalImportScripts = self.importScripts.bind(self);
const resolveDemucsScript = path => path === 'demucs_onnx_simd.js'
  ? DEMUCS_BASE + path : path;
self.importScripts = (...paths) => {
  for (const path of paths) {
    originalImportScripts(resolveDemucsScript(path));
    if (path === 'demucs_onnx_simd.js') {
      // Upstream worker invokes libdemucs() with no options. Patch the
      // factory to provide an absolute .wasm URL each time it is loaded.
      const factory = self.libdemucs;
      if (typeof factory !== 'function') throw new Error('Demucs WASM factory yüklenmedi');
      self.libdemucs = (options = {}) => factory({
        ...options,
        locateFile: filename => filename.endsWith('.wasm') ? WASM_URL : DEMUCS_BASE + filename
      });
    }
  }
};
self.addEventListener('unhandledrejection', event => {
  const error = String(event.reason?.message || event.reason || 'Bilinmeyen WASM hatası');
  console.error('EBS Demucs WASM hatası:', error);
  self.postMessage({ msg: 'WASM_ERROR', error });
});
try {
  originalImportScripts(DEMUCS_BASE + 'worker.js');
} catch (error) {
  console.error('EBS Demucs worker yüklenemedi:', error);
  self.postMessage({msg:'WASM_ERROR', error:String(error)});
}
