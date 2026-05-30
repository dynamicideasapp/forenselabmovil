// app/transcoder.js — detecta formatos no nativos del navegador y transcodifica con ffmpeg.wasm
(function () {
  // Extensiones que el navegador suele reproducir directamente (sin transcodificar)
  const NATIVE_EXTS = new Set(['mp4', 'm4v', 'webm', 'ogv', 'ogg', 'mov']);

  function needsTranscode(file) {
    // Primero confiar en canPlayType con el MIME type del archivo
    if (file.type) {
      const v = document.createElement('video');
      const r = v.canPlayType(file.type);
      if (r === 'probably' || r === 'maybe') return false;
    }
    // Fallback: si la extensión está en la lista nativa, intentar sin transcodificar
    const ext = file.name.split('.').pop().toLowerCase();
    if (NATIVE_EXTS.has(ext)) return false;
    // Cualquier otra extensión (avi, ts, mts, m2ts, wmv, flv, etc.) → transcodificar
    return true;
  }

  let ffInstance = null;
  let ffLoading = null;

  async function ensureFFmpeg() {
    if (ffInstance) return ffInstance;
    if (ffLoading) return ffLoading;

    // Esperar a que el script CDN de ffmpeg.wasm termine de cargarse (puede ir detrás del parse)
    if (!window.FFmpeg) {
      await new Promise((resolve, reject) => {
        const limit = setTimeout(() => reject(new Error('Tiempo de espera agotado cargando ffmpeg.wasm (¿sin conexión?)')), 30000);
        const poll = setInterval(() => {
          if (window.FFmpeg) { clearInterval(poll); clearTimeout(limit); resolve(); }
        }, 250);
      });
    }

    const { createFFmpeg } = window.FFmpeg;
    const inst = createFFmpeg({
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      log: false,
    });
    ffLoading = inst.load().then(() => {
      ffInstance = inst;
      ffLoading = null;
      return inst;
    });
    return ffLoading;
  }

  // onLoad  → se llama cuando ffmpeg ya está listo y arranca la conversión real
  // onProgress → ratio 0..1 durante la conversión
  async function transcode(file, { onLoad, onProgress } = {}) {
    const { fetchFile } = window.FFmpeg;
    const inst = await ensureFFmpeg();
    onLoad?.();

    inst.setProgress(({ ratio }) => {
      onProgress?.(Math.max(0, Math.min(1, ratio)));
    });

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const inputName = `input.${ext}`;
    const outputName = 'output.mp4';

    inst.FS('writeFile', inputName, await fetchFile(file));
    await inst.run(
      '-i', inputName,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', 'faststart',
      '-y', outputName
    );

    const data = inst.FS('readFile', outputName);
    try { inst.FS('unlink', inputName); } catch (_) {}
    try { inst.FS('unlink', outputName); } catch (_) {}

    return new Blob([data.buffer], { type: 'video/mp4' });
  }

  window.Transcoder = { needsTranscode, transcode };
})();
