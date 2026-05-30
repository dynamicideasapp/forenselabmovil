// app/viewer-screen.jsx — compone el visor completo y gestiona todo el estado
const { useState: useVS, useEffect: useVE, useRef: useVR, useCallback: useVCb } = React;
const { Icon: IconV, Badge: BadgeV, Toast: ToastV, fmtTime: fmtV, stamp: stampV, TYPE_META: TM, AnnotationLayer: AnnLayer } = window;
const { Waveform, AnalysisGraph, PlaybackBar, FABRail, AnnotateToolbar, MetadataSheet, ShareSheet } = window.ViewerParts;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── Preferencias de anotación persistentes ──
// Recuerda la última herramienta, color y grosor usados. Persisten al abrir otro
// archivo y entre reinicios de la app (localStorage del WebView).
const ANNOT_KEY = 'forenselab.annot.v1';
function readAnnotPrefs() {
  const def = { tool: 'free', color: '#FF4D52', widthIdx: 1 };
  try {
    const raw = localStorage.getItem(ANNOT_KEY);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch (_) {}
  return def;
}
function writeAnnotPrefs(p) {
  try { localStorage.setItem(ANNOT_KEY, JSON.stringify(p)); } catch (_) {}
}

// ───────────────────────── Motor de análisis de actividad ─────────────────────────
// Normaliza un arreglo de valores al rango 0..1 según su máximo.
function normalizeValues(arr) {
  let max = 0;
  for (const v of arr) if (v > max) max = v;
  if (max <= 0) return arr.map(() => 0);
  return arr.map((v) => v / max);
}

// Análisis de MOVIMIENTO (RE): muestrea el vídeo SEGUNDO POR SEGUNDO y mide la diferencia
// media de píxeles entre muestras consecutivas. Picos = cambios bruscos en la escena.
// (antes iba cuadro a cuadro y resultaba muy lento). Usa fastSeek cuando está disponible.
async function analyzeMotion(videoEl, dur, samples, onProgress) {
  const cw = 80, ch = 45;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const values = new Array(samples).fill(0);
  let prev = null;
  const origTime = videoEl.currentTime;
  const seekTo = (time) => new Promise((res) => {
    let done = false;
    const finish = () => { if (done) return; done = true; videoEl.removeEventListener('seeked', onSeeked); res(); };
    const onSeeked = () => finish();
    videoEl.addEventListener('seeked', onSeeked);
    // fastSeek salta al keyframe más cercano (más rápido); la precisión exacta no es crítica aquí
    try { if (typeof videoEl.fastSeek === 'function') videoEl.fastSeek(time); else videoEl.currentTime = time; }
    catch (_) { try { videoEl.currentTime = time; } catch (__) {} }
    setTimeout(finish, 300); // salvaguarda si 'seeked' no dispara
  });
  for (let i = 0; i < samples; i++) {
    const time = Math.min(((i + 0.5) / samples) * dur, Math.max(0, dur - 0.05));
    await seekTo(time);
    try { ctx.drawImage(videoEl, 0, 0, cw, ch); } catch (_) {}
    const frame = ctx.getImageData(0, 0, cw, ch).data;
    if (prev) {
      let diff = 0;
      for (let p = 0; p < frame.length; p += 4) {
        diff += Math.abs(frame[p] - prev[p]) + Math.abs(frame[p+1] - prev[p+1]) + Math.abs(frame[p+2] - prev[p+2]);
      }
      values[i] = diff / ((frame.length / 4) * 3 * 255);
    }
    prev = frame.slice(0);
    onProgress && onProgress((i + 1) / samples);
  }
  try { videoEl.currentTime = origTime; } catch (_) {}
  return values;
}

// Análisis de AUDIO (RA): decodifica el audio y calcula la energía RMS por bloque.
// Picos = tramos sonoros (voces, golpes, ruido) frente a silencios.
async function analyzeAudio(url, samples, onProgress) {
  const resp = await fetch(url);
  const arrBuf = await resp.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const actx = new AC();
  const audioBuf = await actx.decodeAudioData(arrBuf);
  const ch = audioBuf.getChannelData(0);
  const len = ch.length;
  const block = Math.max(1, Math.floor(len / samples));
  const values = new Array(samples).fill(0);
  for (let i = 0; i < samples; i++) {
    const start = i * block, end = Math.min(len, start + block);
    let sum = 0;
    for (let j = start; j < end; j++) sum += ch[j] * ch[j];
    values[i] = Math.sqrt(sum / Math.max(1, end - start));
    onProgress && onProgress((i + 1) / samples);
  }
  try { actx.close(); } catch (_) {}
  return values;
}

// Perfil simulado (prototipo): cuando el archivo no tiene medio real cargado, genera
// una curva determinista con varios picos para demostrar la función.
function simulatedProfile(mode, n) {
  const peaks = mode === 'motion'
    ? [{ c:0.34, w:0.035, h:1 }, { c:0.58, w:0.025, h:0.65 }, { c:0.8, w:0.05, h:0.85 }]
    : [{ c:0.2, w:0.06, h:0.8 }, { c:0.45, w:0.02, h:1 }, { c:0.7, w:0.08, h:0.55 }, { c:0.9, w:0.03, h:0.9 }];
  const a = [];
  for (let i = 0; i < n; i++) {
    const x = i / n;
    let val = 0.04 + (((i * 2654435761) >>> 0) % 100) / 100 * 0.06; // ruido base
    for (const p of peaks) { const d = (x - p.c) / p.w; val += p.h * Math.exp(-d * d); }
    a.push(val);
  }
  return a;
}

// ───────────────────────── Overlay de transcodificación ─────────────────────────
function TranscodeOverlay({ phase, progress, fileName }) {
  const pct = Math.round(progress * 100);
  const isLoading = phase === 'loading';
  const ext = fileName.split('.').pop().toUpperCase();
  return (
    <div style={{
      position:'absolute', inset:0, zIndex:50,
      background:'rgba(6,8,10,.93)', backdropFilter:'blur(10px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:22,
      padding:'0 36px',
    }}>
      <div style={{ width:54, height:54, borderRadius:'50%', border:'3px solid var(--s3)', borderTopColor:'var(--accent)', animation:'spin 1s linear infinite', flexShrink:0 }} />
      <div style={{ textAlign:'center', width:'100%' }}>
        <div style={{ fontSize:15, fontWeight:600, color:'var(--hi)', marginBottom:6 }}>
          {isLoading ? 'Cargando motor de vídeo…' : `Transcodificando a H.264 · ${pct}%`}
        </div>
        <div style={{ fontFamily:'var(--mono)', fontSize:11.5, color:'var(--lo)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fileName}</div>
      </div>
      {!isLoading && (
        <div style={{ width:'100%', maxWidth:300 }}>
          <div style={{ height:4, borderRadius:3, background:'var(--s3)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent)', borderRadius:3, transition:'width .4s ease' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontFamily:'var(--mono)', fontSize:10.5, color:'var(--lo)' }}>
            <span>{ext} → MP4 H.264</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'var(--accent-glow)', borderRadius:11 }}>
        <IconV name="shield" size={16} color="var(--accent)" />
        <span style={{ fontSize:12, color:'var(--accent)' }}>El archivo original no se modifica</span>
      </div>
    </div>
  );
}

// ── Protector de pantalla durante el análisis (cubre el salto de frames del vídeo) ──
function AnalysisOverlay({ analyzing }) {
  const pct = Math.round((analyzing.progress || 0) * 100);
  const motion = analyzing.mode === 'motion';
  return (
    <div style={{
      position:'absolute', inset:0, zIndex:48,
      background:'rgba(6,8,10,.94)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, padding:'0 36px',
    }}>
      <div style={{ width:54, height:54, borderRadius:'50%', border:'3px solid var(--s3)', borderTopColor:'var(--accent)', animation:'spin 1s linear infinite', flexShrink:0 }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:15, fontWeight:600, color:'var(--hi)', marginBottom:6 }}>
          {motion ? 'Analizando movimiento…' : 'Analizando audio…'}
        </div>
        <div style={{ fontFamily:'var(--mono)', fontSize:11.5, color:'var(--lo)' }}>
          {motion ? 'Recorriendo el vídeo segundo por segundo' : 'Midiendo la energía del audio'}
        </div>
      </div>
      <div style={{ width:'100%', maxWidth:300 }}>
        <div style={{ height:5, borderRadius:3, background:'var(--s3)', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent)', borderRadius:3, transition:'width .2s ease' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontFamily:'var(--mono)', fontSize:10.5, color:'var(--lo)' }}>
          <span>{motion ? 'MOVIMIENTO (RE)' : 'AUDIO (RA)'}</span>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Barra superior ─────────────────────────
function TopBar({ file, compact, onBack, onInfo }) {
  const m = TM[file.type];
  const sz = compact ? 34 : 38;                 // compacto en horizontal
  const iconBtn = (onClick, children) => (
    <button onClick={onClick} style={{ width:sz, height:sz, borderRadius:10, background:'var(--s3)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--hi)', flexShrink:0 }}>
      {children}
    </button>
  );
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding: compact ? '5px 12px' : '10px 12px', background:'var(--s2)', borderBottom:'1px solid var(--line)', flexShrink:0 }}>
      {iconBtn(onBack, <IconV name="arrow-left" size={compact ? 18 : 20} />)}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <BadgeV color={m.color} bg="var(--s3)" style={{ flexShrink:0 }}><IconV name={m.icon} size={11} color={m.color} />{m.label}</BadgeV>
          <span style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--hi)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{file.name}</span>
        </div>
      </div>
      <button onClick={onInfo} style={{ display:'flex', alignItems:'center', gap:6, height:sz, padding:'0 12px', borderRadius:10, background:'var(--s3)', border:'1px solid var(--line)', cursor:'pointer', color:'var(--hi)', fontSize:13, fontWeight:600, flexShrink:0 }}>
        <IconV name="info" size={17} /> Info
      </button>
    </div>
  );
}

// ───────────────────────── Lienzo de medios ─────────────────────────
function MediaStage({ file, resolvedUrl, t, playing, zoom, setZoom, pan, setPan, annotating, showTimecode, showGrid, mediaRef, muted, onToggleMute, onImageLoad, annotationLayer, children }) {
  const stageRef = useVR(null);
  const dragRef = useVR(null);
  const pointersRef = useVR(new Map());   // pointerId → { x, y } (multitáctil)
  const pinchRef = useVR(null);

  // Limita el desplazamiento para que el contenido no se salga del encuadre.
  const clampPan = (p, z) => {
    const el = stageRef.current; if (!el) return p;
    const r = el.getBoundingClientRect();
    const mx = Math.max(0, (z - 1) * r.width / 2);
    const my = Math.max(0, (z - 1) * r.height / 2);
    return { x: clamp(p.x, -mx, mx), y: clamp(p.y, -my, my) };
  };

  const onDown = (e) => {
    if (annotating) return;                 // anotando: el lienzo gestiona el toque
    pointersRef.current.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (pointersRef.current.size === 2) {
      // pellizco (pinch): dos dedos
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const mid = { x:(pts[0].x + pts[1].x) / 2, y:(pts[0].y + pts[1].y) / 2 };
      const r = e.currentTarget.getBoundingClientRect();
      pinchRef.current = { startDist:dist, startZoom:zoom, startPan:{ ...pan },
        cx:r.left + r.width / 2, cy:r.top + r.height / 2, startMid:mid };
      dragRef.current = null;
    } else if (pointersRef.current.size === 1 && zoom > 1) {
      dragRef.current = { x:e.clientX, y:e.clientY, px:pan.x, py:pan.y };
    }
  };
  const onMove = (e) => {
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x:e.clientX, y:e.clientY });
    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const mid = { x:(pts[0].x + pts[1].x) / 2, y:(pts[0].y + pts[1].y) / 2 };
      const z = clamp(pinch.startZoom * (dist / pinch.startDist), 1, 5);
      // punto de contenido bajo el foco inicial (relativo al centro del encuadre)
      const ox = (pinch.startMid.x - pinch.cx - pinch.startPan.x) / pinch.startZoom;
      const oy = (pinch.startMid.y - pinch.cy - pinch.startPan.y) / pinch.startZoom;
      // mantenerlo bajo el foco actual: permite acercar y arrastrar a la vez
      const np = z <= 1 ? { x:0, y:0 } : { x:mid.x - pinch.cx - ox * z, y:mid.y - pinch.cy - oy * z };
      setZoom(z);
      setPan(clampPan(np, z));
      return;
    }
    if (dragRef.current) {
      setPan(clampPan({ x:dragRef.current.px + (e.clientX - dragRef.current.x), y:dragRef.current.py + (e.clientY - dragRef.current.y) }, zoom));
    }
  };
  const onUp = (e) => {
    if (e && e.pointerId != null) pointersRef.current.delete(e.pointerId);
    else pointersRef.current.clear();
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  const isAudio = file.type === 'audio';
  const transform = `translate(${pan.x}px,${pan.y}px) scale(${zoom})`;
  const interacting = !!(dragRef.current || pinchRef.current);

  return (
    <div ref={stageRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}
      onDoubleClick={() => { setZoom(1); setPan({ x:0, y:0 }); }}
      style={{ position:'absolute', inset:0, overflow:'hidden', background:'#06080a', display:'flex', alignItems:'center', justifyContent:'center',
        touchAction:'none',
        cursor: (!annotating && zoom > 1) ? 'grab' : 'default' }}>

      {isAudio ? (
        <div style={{ width:'100%', padding:'0 22px', display:'flex', flexDirection:'column', alignItems:'center', gap:22 }}>
          {resolvedUrl && <audio ref={mediaRef} src={resolvedUrl} preload="auto" style={{ display:'none' }} muted={muted} />}
          <div style={{ width:88, height:88, borderRadius:'50%', background:'var(--s2)', border:'1px solid var(--line2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--warn)', boxShadow: playing ? '0 0 0 8px rgba(245,181,60,.08)' : 'none' }}>
            <IconV name="music" size={36} />
          </div>
          <div style={{ height:96, width:'100%' }}><Waveform t={t} dur={file.dur} playing={playing} /></div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--hi)' }}>{file.name}</div>
            <div style={{ fontSize:11.5, color:'var(--lo)', marginTop:3 }}>{file.codec}</div>
          </div>
        </div>
      ) : (
        <React.Fragment>
          {/* marcador de fondo solo cuando no hay archivo real cargado */}
          {!resolvedUrl && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, color:'var(--lo)', pointerEvents:'none' }}>
              <IconV name={file.type === 'video' ? 'video' : 'image'} size={42} stroke={1.6} />
              <div style={{ fontFamily:'var(--mono)', fontSize:11.5, letterSpacing:.3 }}>
                {file.type === 'video' ? 'Suelta un frame del vídeo' : 'Suelta la imagen de evidencia'}
              </div>
            </div>
          )}
          <div style={{ position:'absolute', inset:0, transform, transformOrigin:'center', transition: interacting ? 'none' : 'transform .18s' }}>
            {resolvedUrl ? (
              file.type === 'video' ? (
                <video ref={mediaRef} src={resolvedUrl} preload="auto" playsInline muted={muted}
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain' }} />
              ) : (
                <img src={resolvedUrl} alt={file.name}
                  onLoad={(e) => onImageLoad?.(e.target.naturalWidth, e.target.naturalHeight)}
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain' }} />
              )
            ) : (
              <image-slot id={file.slot} fit="contain" shape="rect" placeholder=" "
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', color:'rgba(233,240,243,.45)' }}></image-slot>
            )}
            {/* la capa de anotación vive DENTRO del transform: sigue el zoom y el desplazamiento */}
            {annotationLayer}
          </div>
        </React.Fragment>
      )}

      {/* audio: la capa de anotación va a nivel de escena (el audio no tiene zoom) */}
      {isAudio && annotationLayer}

      {/* botón de silencio (vídeo y audio con archivo real) */}
      {resolvedUrl && file.type !== 'image' && (
        <button onClick={onToggleMute} style={{
          position:'absolute', bottom:14, right:14,
          width:40, height:40, borderRadius:10,
          background: muted ? 'rgba(255,77,82,.18)' : 'rgba(8,12,15,.55)',
          border: muted ? '1px solid rgba(255,77,82,.55)' : '1px solid rgba(255,255,255,.22)',
          backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center',
          color: muted ? 'var(--danger)' : '#fff', cursor:'pointer',
        }}>
          <IconV name={muted ? 'volume-x' : 'volume-2'} size={18} />
        </button>
      )}

      {/* superposición: rejilla forense */}
      {showGrid && !isAudio && (
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:.5 }}>
          <line x1="33.3%" y1="0" x2="33.3%" y2="100%" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
          <line x1="66.6%" y1="0" x2="66.6%" y2="100%" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
          <line x1="0" y1="33.3%" x2="100%" y2="33.3%" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
          <line x1="0" y1="66.6%" x2="100%" y2="66.6%" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
        </svg>
      )}

      {/* superposición: sello de tiempo (vídeo) */}
      {showTimecode && file.type === 'video' && (
        <div style={{ position:'absolute', top:12, left:12, fontFamily:'var(--mono)', fontSize:11, color:'#9efff0', background:'rgba(4,8,10,.62)', padding:'4px 8px', borderRadius:6, letterSpacing:.5, pointerEvents:'none', border:'1px solid rgba(32,211,194,.25)' }}>
          {fmtV(t)}<span style={{ color:'var(--lo)' }}> · F{Math.floor(t * (file.fps || 30))}</span>
        </div>
      )}

      {children}
    </div>
  );
}

// ───────────────────────── Pantalla del visor ─────────────────────────
function ViewerScreen({ file, onBack, tweaks }) {
  const isMedia = file.type !== 'image'; // tiene reproducción
  const [t, setT] = useVS(0);
  const [playing, setPlaying] = useVS(false);
  const [dur, setDur] = useVS(file.dur || 0);
  const mediaRef = useVR(null);
  const [zoom, setZoom] = useVS(1);
  const [pan, setPan] = useVS({ x:0, y:0 });
  // ── Orientación automática del dispositivo ──
  // Detecta la rotación real (ancho > alto) y redimensiona #scaler para llenar la
  // pantalla en horizontal (sin franjas negras). En vertical vuelve al ancho de teléfono.
  const [landscape, setLandscape] = useVS(() => window.innerWidth > window.innerHeight);
  useVE(() => {
    const scaler = document.getElementById('scaler');
    if (scaler) scaler.style.transition = 'width 0.3s ease, height 0.3s ease';
    const apply = () => {
      const land = window.innerWidth > window.innerHeight;
      setLandscape(land);
      if (!scaler) return;
      if (land) {
        // horizontal: usa toda la pantalla (con tope razonable para tablets/escritorio)
        scaler.style.width  = Math.min(window.innerWidth,  1000) + 'px';
        scaler.style.height = Math.min(window.innerHeight,  520) + 'px';
      } else {
        scaler.style.width  = '';
        scaler.style.height = '';
      }
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      if (scaler) { scaler.style.transition = ''; scaler.style.width = ''; scaler.style.height = ''; }
    };
  }, []);

  // URL resuelta: empieza con file.url (null si hay que transcodificar) y se reemplaza al terminar
  const [resolvedUrl, setResolvedUrl] = useVS(file.url);
  // 'idle' | 'loading' | 'running' | 'done' | 'error'
  const [xcodePhase, setXcodePhase] = useVS(file.needsTranscode ? 'loading' : 'idle');
  const [xcodeProgress, setXcodeProgress] = useVS(0);
  // Revocar blob URL al desmontar si fue creada por la transcodificación
  const xcodeBlobRef = useVR(null);

  // anotación
  const [annotating, setAnnotating] = useVS(false);
  const [tool, setTool] = useVS(() => readAnnotPrefs().tool);
  const [color, setColor] = useVS(() => readAnnotPrefs().color);
  const [widthIdx, setWidth] = useVS(() => readAnnotPrefs().widthIdx);
  // persiste la última selección de anotación (herramienta/color/grosor)
  useVE(() => { writeAnnotPrefs({ tool, color, widthIdx }); }, [tool, color, widthIdx]);
  const [shapes, setShapes] = useVS([]);
  // dimensiones naturales del contenido (vídeo: videoWidth/videoHeight; imagen: naturalWidth/naturalHeight)
  const [natW, setNatW] = useVS(0);
  const [natH, setNatH] = useVS(0);

  // silencio: activo por defecto hasta que el usuario lo habilite
  const [muted, setMuted] = useVS(true);

  // análisis de actividad (RE = movimiento / RA = audio). Solo uno visible a la vez.
  const [analysisMode, setAnalysisMode] = useVS(null);     // null | 'motion' | 'audio'
  const [analyses, setAnalyses] = useVS({ motion: null, audio: null }); // valores cacheados
  const [analyzing, setAnalyzing] = useVS(null);           // { mode, progress } | null
  // suprime la actualización de 't' mientras el análisis de movimiento mueve currentTime
  const suppressTimeRef = useVR(false);

  const mediaRecorderRef = useVR(null);
  const recChunksRef = useVR([]);
  const annCanvasRef = useVR(null);
  const recordRafRef = useVR(null);

  // grabación / captura / modales / toast
  const [recording, setRecording] = useVS(false);
  const [recT, setRecT] = useVS(0);
  const [flashId, setFlashId] = useVS(0);
  const [modal, setModal] = useVS(null);     // 'meta' | 'transform' | 'share'
  const [toast, setToast] = useVS(null);
  const [shareName, setShareName] = useVS('');
  const lastSavedRef = useVR(null);          // { uri, label, web } del último archivo guardado

  // Transcodificación automática para formatos no nativos del navegador
  useVE(() => {
    if (!file.needsTranscode || !file.rawFile) return;
    let cancelled = false;
    (async () => {
      try {
        const blob = await window.Transcoder.transcode(file.rawFile, {
          onLoad: () => { if (!cancelled) setXcodePhase('running'); },
          onProgress: (r) => { if (!cancelled) setXcodeProgress(r); },
        });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        xcodeBlobRef.current = url;
        setResolvedUrl(url);
        setXcodePhase('done');
      } catch (err) {
        if (!cancelled) {
          setXcodePhase('error');
          setToast({ icon:'x', title:'Error al transcodificar', sub: err.message || 'Error desconocido', id: Date.now(), duration: 7000 });
        }
      }
    })();
    return () => {
      cancelled = true;
      if (xcodeBlobRef.current) { URL.revokeObjectURL(xcodeBlobRef.current); xcodeBlobRef.current = null; }
    };
  }, []);

  // sincronizar play/pause con el elemento multimedia real
  useVE(() => {
    const el = mediaRef.current;
    if (!el || !resolvedUrl) return;
    if (playing) el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [playing, resolvedUrl]);

  // obtener duración y actualizar tiempo desde el elemento real
  useVE(() => {
    const el = mediaRef.current;
    if (!el || !resolvedUrl) return;
    const onMeta = () => {
      if (isFinite(el.duration)) setDur(el.duration);
      if (el.videoWidth > 0) { setNatW(el.videoWidth); setNatH(el.videoHeight); }
    };
    const onUpdate = () => { if (!suppressTimeRef.current) setT(el.currentTime); };
    const onEnd = () => setPlaying(false);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('timeupdate', onUpdate);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('timeupdate', onUpdate);
      el.removeEventListener('ended', onEnd);
    };
  }, [resolvedUrl]);

  // sincronizar muted directamente por DOM (React ignora el atributo muted en <video>)
  useVE(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = muted;
  }, [muted]);

  // teclas de volumen del dispositivo → alternan el silencio
  useVE(() => {
    if (!resolvedUrl || file.type === 'image') return;
    const onKey = (e) => {
      if (e.key === 'AudioVolumeUp' || e.key === 'AudioVolumeDown') {
        e.preventDefault();
        setMuted((m) => !m);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resolvedUrl, file.type]);

  // contador de grabación
  useVE(() => {
    if (!recording) return;
    setRecT(0);
    const iv = setInterval(() => setRecT((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [recording]);

  // detección de formato no reproducible por el navegador
  useVE(() => {
    const el = mediaRef.current;
    if (!el || !resolvedUrl) return;
    const onErr = () => {
      setPlaying(false);
      setToast({ icon:'x', title:'Formato no compatible', sub:`${file.name} · usa MP4, MOV o MKV con H.264`, id: Date.now(), duration: 5000 });
    };
    el.addEventListener('error', onErr);
    return () => el.removeEventListener('error', onErr);
  }, [resolvedUrl]);

  const showToast = (obj) => setToast({ ...obj, id: Date.now() });

  // zoom por botones (imagen): al volver a 1× recentra el contenido
  const zoomBy = (d) => {
    const nz = clamp(+(zoom + d).toFixed(1), 1, 5);
    setZoom(nz);
    if (nz === 1) setPan({ x: 0, y: 0 });
  };

  // acciones de reproducción
  const onToggle = () => setPlaying((p) => !p);
  const onSeek = (v) => {
    const c = clamp(v, 0, dur);
    setT(c);
    if (mediaRef.current && resolvedUrl) mediaRef.current.currentTime = c;
  };
  const onSkip = (d) => {
    const newT = clamp(t + d, 0, dur);
    setT(newT);
    if (mediaRef.current && resolvedUrl) mediaRef.current.currentTime = newT;
  };
  const onStep = (dir) => {
    setPlaying(false);
    const newT = clamp(t + dir * (1 / (file.fps || 30)), 0, dur);
    setT(newT);
    if (mediaRef.current && resolvedUrl) mediaRef.current.currentTime = newT;
  };

  // análisis de actividad: ejecuta (o alterna) RE/RA. Regla: solo un gráfico a la vez.
  const runAnalysis = async (mode) => {
    if (analyzing) return;                                  // ya hay un análisis en curso
    if (analysisMode === mode) { setAnalysisMode(null); return; } // segundo toque: ocultar
    if (analyses[mode]) { setAnalysisMode(mode); return; }  // cacheado: mostrar al instante
    setPlaying(false);
    setAnalyzing({ mode, progress: 0 });
    try {
      const el = mediaRef.current;
      const onP = (p) => setAnalyzing({ mode, progress: p });
      let values;
      if (mode === 'motion') {
        // una muestra por SEGUNDO (antes 120 fijas con seek preciso, demasiado lento).
        // Topes: mínimo 12 (clips muy cortos siguen mostrando barras) y máximo 180 (clips largos).
        const secs = Math.round(dur || (el && el.duration) || file.dur || 1);
        const samples = Math.max(12, Math.min(180, secs));
        if (el && resolvedUrl && el.videoWidth) {
          suppressTimeRef.current = true;
          try { values = await analyzeMotion(el, dur || el.duration || file.dur || 1, samples, onP); }
          finally { suppressTimeRef.current = false; }
        } else {
          values = simulatedProfile('motion', samples);
        }
      } else {
        if (resolvedUrl) {
          try { values = await analyzeAudio(resolvedUrl, 200, onP); }
          catch (_) { values = simulatedProfile('audio', 200); }
        } else {
          values = simulatedProfile('audio', 200);
        }
      }
      values = normalizeValues(values);
      setAnalyses((a) => ({ ...a, [mode]: values }));
      setAnalysisMode(mode);
    } catch (err) {
      showToast({ icon:'x', title:'No se pudo analizar', sub: err.message || 'Error desconocido', duration: 5000 });
    } finally {
      setAnalyzing(null);
    }
  };

  // anotar (pausa el vídeo automáticamente)
  const toggleAnnotate = () => {
    setAnnotating((a) => {
      if (!a && isMedia) setPlaying(false);
      return !a;
    });
  };
  const commitShape = (sh) => setShapes((s) => [...s, sh]);
  const undoShape = () => setShapes((s) => s.slice(0, -1));
  const clearShapes = () => setShapes([]);

  // superpone el canvas de anotaciones sobre el canvas de captura.
  // El canvas ya cubre exactamente el área del contenido (coordenadas relativas al vídeo/imagen),
  // por eso se escala directamente al tamaño nativo sin cálculo de offset adicional.
  const compositeAnn = (ctx, W, H) => {
    const ann = annCanvasRef.current;
    if (!ann || !ann.width || !ann.height || !shapes.length) return;
    ctx.drawImage(ann, 0, 0, ann.width, ann.height, 0, 0, W, H);
  };

  // captura del frame actual con anotaciones
  const capture = () => {
    if (isMedia) setPlaying(false);
    setFlashId((n) => n + 1);
    const name = `forenselab_${stampV()}.jpg`;

    const guardar = async (blob) => {
      try {
        const out = await window.NativeSave.saveBlob(blob, name, { kind:'image', mimeType:'image/jpeg' });
        lastSavedRef.current = out;
        setShareName(name);
        showToast({ icon:'camera', title:'Captura guardada', sub: out.web ? name : `${out.label} · ${name}`, action:'Compartir', onAction:'share' });
      } catch (e) {
        showToast({ icon:'x', title:'No se pudo guardar la captura', sub: e.message || name, duration: 6000 });
      }
    };

    setTimeout(() => {
      const el = mediaRef.current;
      if (file.type === 'video' && el && el.videoWidth) {
        const W = el.videoWidth, H = el.videoHeight;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d');
        ctx.drawImage(el, 0, 0, W, H);
        compositeAnn(ctx, W, H);
        cv.toBlob(guardar, 'image/jpeg', 0.95);
      } else if (file.type === 'image' && resolvedUrl) {
        const img = new Image();
        img.onload = () => {
          const W = img.naturalWidth, H = img.naturalHeight;
          const cv = document.createElement('canvas');
          cv.width = W; cv.height = H;
          const ctx = cv.getContext('2d');
          ctx.drawImage(img, 0, 0, W, H);
          compositeAnn(ctx, W, H);
          cv.toBlob(guardar, 'image/jpeg', 0.95);
        };
        img.src = resolvedUrl;
      }
    }, 200);
  };

  // grabación real: canvas compuesto (vídeo + anotaciones) + audio del stream original
  const toggleRecord = () => {
    if (recording) {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== 'inactive') rec.stop();
      if (recordRafRef.current) { cancelAnimationFrame(recordRafRef.current); recordRafRef.current = null; }
      return;
    }

    if (annotating) setAnnotating(false);
    const el = mediaRef.current;
    if (!resolvedUrl || !el) return;

    const finalizarGrabacion = (rec, mimeType) => {
      const name = `forenselab_${stampV()}.webm`;
      recChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      rec.onstop = async () => {
        if (recordRafRef.current) { cancelAnimationFrame(recordRafRef.current); recordRafRef.current = null; }
        const blob = new Blob(recChunksRef.current, { type: mimeType });
        setRecording(false);
        try {
          const kind = file.type === 'audio' ? 'audio' : 'video';
          const out = await window.NativeSave.saveBlob(blob, name, { kind, mimeType: mimeType || blob.type });
          lastSavedRef.current = out;
          setShareName(name);
          showToast({ icon:'video', title:'Grabación guardada', sub: out.web ? name : `${out.label} · ${name}`, action:'Compartir', onAction:'share' });
        } catch (e) {
          showToast({ icon:'x', title:'No se pudo guardar la grabación', sub: e.message || name, duration: 6000 });
        }
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
    };

    // Audio: grabar stream directo sin canvas
    if (file.type === 'audio' && typeof el.captureStream === 'function') {
      try {
        const stream = el.captureStream();
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        finalizarGrabacion(rec, rec.mimeType);
        return;
      } catch (_) {}
      return;
    }

    // Vídeo: canvas compuesto (frame + anotaciones) + pista de audio del elemento original
    if (file.type !== 'video' || !el.videoWidth) return;
    const W = el.videoWidth, H = el.videoHeight;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    const drawFrame = () => {
      ctx.drawImage(el, 0, 0, W, H);
      compositeAnn(ctx, W, H);
      recordRafRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    try {
      const canvasStream = cv.captureStream(30);
      if (typeof el.captureStream === 'function') {
        try { el.captureStream().getAudioTracks().forEach(t => canvasStream.addTrack(t)); } catch (_) {}
      }
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : '';
      const rec = new MediaRecorder(canvasStream, mime ? { mimeType: mime } : {});
      finalizarGrabacion(rec, rec.mimeType);
    } catch (_) {
      if (recordRafRef.current) { cancelAnimationFrame(recordRafRef.current); recordRafRef.current = null; }
    }
  };

  const onToastAction = () => {
    if (toast?.onAction === 'share') {
      const saved = lastSavedRef.current;
      if (saved && saved.uri && window.NativeSave.isNative()) window.NativeSave.shareFile(saved.uri, shareName);
      else setModal('share');
    }
    setToast(null);
  };

  const showZoomBar = !isMedia; // imagen: barra de zoom en lugar de reproducción

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', background:'var(--bg)' }}>
      <TopBar file={file} compact={landscape} onBack={onBack} onInfo={() => setModal('meta')} />

      {/* zona central */}
      <div style={{ position:'relative', flex:1, minHeight:0 }}>
        <MediaStage file={file} resolvedUrl={resolvedUrl} t={t} playing={playing} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan}
          annotating={annotating} showTimecode={tweaks.showTimecode} showGrid={tweaks.showGrid} mediaRef={mediaRef}
          muted={muted} onToggleMute={() => setMuted((m) => !m)}
          onImageLoad={(w, h) => { setNatW(w); setNatH(h); }}
          annotationLayer={
            <AnnLayer active={annotating} tool={tool} color={color} widthIdx={widthIdx} shapes={shapes} onCommit={commitShape} exportRef={annCanvasRef} natW={natW} natH={natH} />
          }>

          {/* (sin botón de play central: estorba al revisar el cuadro; se usa el de la barra inferior) */}

          {/* (la capa de anotación se pasa como prop annotationLayer para que siga el zoom) */}

          {/* indicador REC */}
          {recording && (
            <React.Fragment>
              <div style={{ position:'absolute', inset:0, pointerEvents:'none', border:'2px solid var(--danger)', boxShadow:'inset 0 0 40px rgba(255,77,82,.25)', animation:'recPulse 1.4s infinite' }} />
              <div style={{ position:'absolute', top:12, right:12, display:'flex', alignItems:'center', gap:7, background:'rgba(4,8,10,.72)', padding:'5px 10px', borderRadius:8, border:'1px solid rgba(255,77,82,.4)' }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:'var(--danger)', animation:'recPulse 1.4s infinite' }} />
                <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'#fff', letterSpacing:.5 }}>REC {fmtV(recT)}</span>
              </div>
            </React.Fragment>
          )}

          {/* barra de zoom (imagen) */}
          {showZoomBar && !annotating && (
            <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:4, background:'rgba(8,12,15,.7)', border:'1px solid var(--line2)', borderRadius:12, padding:4, backdropFilter:'blur(6px)' }}>
              <button onClick={() => zoomBy(-0.5)} style={zbtn}><IconV name="zoom-out" size={18} /></button>
              <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--hi)', minWidth:42, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
              <button onClick={() => zoomBy(0.5)} style={zbtn}><IconV name="zoom-in" size={18} /></button>
            </div>
          )}

          {/* destello de captura */}
          {flashId > 0 && <div key={flashId} style={{ position:'absolute', inset:0, background:'#fff', pointerEvents:'none', animation:'flash .6s ease-out forwards' }} />}

          {/* FAB (oculto durante anotación y transcodificación) */}
          {!annotating && xcodePhase !== 'loading' && xcodePhase !== 'running' && (
            <FABRail type={file.type} annotating={annotating} recording={recording} fabStyle={tweaks.fabStyle}
              onCapture={capture} onRecord={toggleRecord} onAnnotate={toggleAnnotate} compact={landscape} />
          )}

          {/* Overlay de transcodificación */}
          {(xcodePhase === 'loading' || xcodePhase === 'running') && (
            <TranscodeOverlay phase={xcodePhase} progress={xcodeProgress} fileName={file.name} />
          )}

          {/* Protector de pantalla durante el análisis RE/RA (oculta el preview del vídeo) */}
          {analyzing && <AnalysisOverlay analyzing={analyzing} />}
        </MediaStage>
      </div>

      {/* zona inferior */}
      {annotating ? (
        <AnnotateToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} widthIdx={widthIdx} setWidth={setWidth}
          canUndo={shapes.length > 0} onUndo={undoShape} onClear={clearShapes} onDone={toggleAnnotate} />
      ) : isMedia && xcodePhase !== 'loading' && xcodePhase !== 'running' ? (
        <PlaybackBar type={file.type} fps={file.fps || 30} t={t} dur={dur} playing={playing}
          onSeek={onSeek} onToggle={onToggle} onStep={onStep} onSkip={onSkip}
          analysisMode={analysisMode} analysisValues={analysisMode ? analyses[analysisMode] : null}
          analyzing={analyzing} onAnalyze={runAnalysis} compact={landscape} />
      ) : null}

      {/* modales */}
      <MetadataSheet open={modal === 'meta'} onClose={() => setModal(null)} file={file}
        liveDur={dur} liveRes={natW > 0 && natH > 0 ? `${natW}×${natH}` : null} />
      <ShareSheet open={modal === 'share'} onClose={() => setModal(null)} fileName={shareName} />

      <ToastV toast={toast} onAction={onToastAction} onDone={() => setToast(null)} />
    </div>
  );
}
const zbtn = { width:36, height:36, borderRadius:9, background:'transparent', border:'none', color:'var(--hi)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' };

window.ViewerScreen = ViewerScreen;
