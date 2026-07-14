/*
 * Local class worker for @ffmpeg/ffmpeg 0.12.x.
 * This is the message/FS worker used by the FFmpeg JavaScript class.
 * It is NOT ffmpeg-core.worker.js (the pthread worker of @ffmpeg/core-mt).
 */

const CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js';

const FFMessageType = Object.freeze({
  LOAD: 'LOAD',
  EXEC: 'EXEC',
  FFPROBE: 'FFPROBE',
  WRITE_FILE: 'WRITE_FILE',
  READ_FILE: 'READ_FILE',
  DELETE_FILE: 'DELETE_FILE',
  RENAME: 'RENAME',
  CREATE_DIR: 'CREATE_DIR',
  LIST_DIR: 'LIST_DIR',
  DELETE_DIR: 'DELETE_DIR',
  ERROR: 'ERROR',
  DOWNLOAD: 'DOWNLOAD',
  PROGRESS: 'PROGRESS',
  LOG: 'LOG',
  MOUNT: 'MOUNT',
  UNMOUNT: 'UNMOUNT'
});

const ERROR_UNKNOWN_MESSAGE_TYPE = new Error('unknown message type');
const ERROR_NOT_LOADED = new Error('ffmpeg is not loaded, call `await ffmpeg.load()` first');
const ERROR_IMPORT_FAILURE = new Error('failed to import ffmpeg-core.js');

let ffmpeg;

const load = async ({
  coreURL: requestedCoreURL = CORE_URL,
  wasmURL: requestedWasmURL,
  workerURL: requestedWorkerURL
}) => {
  const first = !ffmpeg;
  const coreURL = requestedCoreURL;
  const wasmURL = requestedWasmURL || coreURL.replace(/\.js$/g, '.wasm');
  const workerURL = requestedWorkerURL || coreURL.replace(/\.js$/g, '.worker.js');

  try {
    // Classic worker yolu.
    importScripts(coreURL);
  } catch (_) {
    // @ffmpeg/ffmpeg class worker modül olarak oluşturulduğunda bu yol kullanılır.
    self.createFFmpegCore = (await import(coreURL)).default;
    if (!self.createFFmpegCore) throw ERROR_IMPORT_FAILURE;
  }

  ffmpeg = await self.createFFmpegCore({
    mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL, workerURL }))}`
  });

  ffmpeg.setLogger((data) => self.postMessage({ type: FFMessageType.LOG, data }));
  ffmpeg.setProgress((data) => self.postMessage({ type: FFMessageType.PROGRESS, data }));
  return first;
};

const exec = ({ args, timeout = -1 }) => {
  ffmpeg.setTimeout(timeout);
  ffmpeg.exec(...args);
  const ret = ffmpeg.ret;
  ffmpeg.reset();
  return ret;
};

const ffprobe = ({ args, timeout = -1 }) => {
  ffmpeg.setTimeout(timeout);
  ffmpeg.ffprobe(...args);
  const ret = ffmpeg.ret;
  ffmpeg.reset();
  return ret;
};

const writeFile = ({ path, data }) => {
  ffmpeg.FS.writeFile(path, data);
  return true;
};

const readFile = ({ path, encoding }) => ffmpeg.FS.readFile(path, { encoding });
const deleteFile = ({ path }) => { ffmpeg.FS.unlink(path); return true; };
const rename = ({ oldPath, newPath }) => { ffmpeg.FS.rename(oldPath, newPath); return true; };
const createDir = ({ path }) => { ffmpeg.FS.mkdir(path); return true; };

const listDir = ({ path }) => {
  const names = ffmpeg.FS.readdir(path);
  const nodes = [];
  for (const name of names) {
    const stat = ffmpeg.FS.stat(`${path}/${name}`);
    nodes.push({ name, isDir: ffmpeg.FS.isDir(stat.mode) });
  }
  return nodes;
};

const deleteDir = ({ path }) => { ffmpeg.FS.rmdir(path); return true; };

const mount = ({ fsType, options, mountPoint }) => {
  const fs = ffmpeg.FS.filesystems[String(fsType)];
  if (!fs) return false;
  ffmpeg.FS.mount(fs, options, mountPoint);
  return true;
};

const unmount = ({ mountPoint }) => {
  ffmpeg.FS.unmount(mountPoint);
  return true;
};

self.onmessage = async ({ data: { id, type, data: inputData } }) => {
  const transfer = [];
  let data;

  try {
    if (type !== FFMessageType.LOAD && !ffmpeg) throw ERROR_NOT_LOADED;

    switch (type) {
      case FFMessageType.LOAD: data = await load(inputData); break;
      case FFMessageType.EXEC: data = exec(inputData); break;
      case FFMessageType.FFPROBE: data = ffprobe(inputData); break;
      case FFMessageType.WRITE_FILE: data = writeFile(inputData); break;
      case FFMessageType.READ_FILE: data = readFile(inputData); break;
      case FFMessageType.DELETE_FILE: data = deleteFile(inputData); break;
      case FFMessageType.RENAME: data = rename(inputData); break;
      case FFMessageType.CREATE_DIR: data = createDir(inputData); break;
      case FFMessageType.LIST_DIR: data = listDir(inputData); break;
      case FFMessageType.DELETE_DIR: data = deleteDir(inputData); break;
      case FFMessageType.MOUNT: data = mount(inputData); break;
      case FFMessageType.UNMOUNT: data = unmount(inputData); break;
      default: throw ERROR_UNKNOWN_MESSAGE_TYPE;
    }
  } catch (error) {
    self.postMessage({
      id,
      type: FFMessageType.ERROR,
      data: error instanceof Error ? error.toString() : String(error)
    });
    return;
  }

  if (data instanceof Uint8Array) transfer.push(data.buffer);
  self.postMessage({ id, type, data }, transfer);
};
