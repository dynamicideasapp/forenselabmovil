// app/native-save.js — guarda blobs como archivos reales: Filesystem en Android (Capacitor)
// o descarga clásica en navegador. Plain JS: se carga antes que el JSX y exporta a window.
(function () {
  const Cap = window.Capacitor;
  const isNative = () => !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());

  // Blob → base64 (sin el prefijo data:...;base64,) que exige Filesystem.writeFile.
  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = () => rej(new Error('No se pudo leer el archivo en memoria'));
      r.onloadend = () => res(String(r.result).split(',')[1] || '');
      r.readAsDataURL(blob);
    });
  }

  // Etiqueta legible de la carpeta donde quedó el archivo.
  function dirLabel(directory) {
    if (directory === 'DOCUMENTS') return 'Documentos/ForenseLab';
    if (directory === 'EXTERNAL')  return 'Android/data · ForenseLab';
    return 'Almacenamiento de la app · ForenseLab';
  }

  // Guarda el blob.
  //  - Navegador: descarga clásica (devuelve { web:true }).
  //  - Android nativo: escribe en ForenseLab/<name>. Intenta Documentos (visible);
  //    si la versión de Android lo impide, cae a externo y luego a almacenamiento privado.
  //    Siempre devuelve { uri, directory, label } para poder compartir después.
  async function saveBlob(blob, name) {
    if (!isNative()) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      return { web: true, uri: null, label: name };
    }
    const Filesystem = Cap.Plugins && Cap.Plugins.Filesystem;
    if (!Filesystem) throw new Error('Plugin Filesystem no disponible (ejecuta cap sync)');
    const data = await blobToBase64(blob);
    const path = `ForenseLab/${name}`;
    let lastErr;
    for (const directory of ['DOCUMENTS', 'EXTERNAL', 'DATA']) {
      try {
        const r = await Filesystem.writeFile({ path, data, directory, recursive: true });
        return { uri: r && r.uri, directory, label: dirLabel(directory), web: false };
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('No se pudo escribir el archivo');
  }

  // Comparte un archivo ya guardado (en nativo via plugin Share; en web via navigator.share).
  async function shareFile(uri, title) {
    if (isNative()) {
      const Share = Cap.Plugins && Cap.Plugins.Share;
      if (Share && uri) { try { await Share.share({ title, url: uri }); } catch (_) {} return; }
    }
    if (navigator.share) { try { await navigator.share({ title }); } catch (_) {} }
  }

  window.NativeSave = { isNative, saveBlob, shareFile };
})();
