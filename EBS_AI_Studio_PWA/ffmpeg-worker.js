/* EBS AI Studio Pro — same-origin worker entry point for @ffmpeg/ffmpeg UMD 0.12.15.
 * FFmpeg's UMD webpack worker bundle is loaded in this classic worker.
 * Do not replace this with a blob: classWorkerURL.
 */
try {
  importScripts('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/umd/814.ffmpeg.js');
} catch (error) {
  console.error('EBS FFmpeg worker yüklenemedi:', error);
  throw error;
}
