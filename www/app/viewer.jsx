// app/viewer.jsx — Pantalla de visor/análisis. Toda la funcionalidad principal vive aquí.
const { useState: useS, useEffect: useE, useRef: useR, useCallback } = React;
const { Icon, Badge, Sheet, Toast, fmtTime, stamp, TYPE_META, FORMATS, AnnotationLayer } = window;

// Paleta de 8 colores para anotación
const PALETTE = ['#FF4D52','#FF9F0A','#FFD60A','#34C759','#32D2E0','#4C8DFF','#FFFFFF','#0B0E11'];
const TOOLS = [
  { id:'free',  icon:'pen-line', label:'Libre' },
  { id:'rect',  icon:'square',   label:'Rectángulo' },
  { id:'circle',icon:'circle',   label:'Círculo' },
  { id:'arrow', icon:'arrow-up-right', label:'Flecha' },
];
const WIDTH_LABELS = ['Fino','Medio','Grueso'];

// ───────────────────────── Onda de audio ─────────────────────────
function Waveform({ t, dur, playing }) {
  const ref = useR(null);
  const wrap = useR(null);
  // alturas estables generadas con pseudo-aleatorio sembrado
  const bars = useR(null);
  if (!bars.current) {
    const n = 96, a = [];
    for (let i = 0; i < n; i++) {
      const s = Math.sin(i * 0.9) * 0.5 + Math.sin(i * 0.27) * 0.5;
      a.push(0.18 + Math.abs(s) * 0.74 * (0.5 + ((i * 9301 + 49297) % 233) / 466));
    }
    bars.current = a;
  }
  const draw = () => {
    const cv = ref.current, w = wrap.current; if (!cv || !w) return;
    const dpr = window.devicePixelRatio || 1;
    const W = w.clientWidth, H = w.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const arr = bars.current, n = arr.length;
    const gap = 3, bw = (W - gap * (n - 1)) / n;
    const prog = dur ? t / dur : 0;
    for (let i = 0; i < n; i++) {
      const bh = arr[i] * H * 0.82;
      const x = i * (bw + gap), y = (H - bh) / 2;
      const played = i / n <= prog;
      // el canvas no resuelve var(): se usa el valor calculado del token
      ctx.fillStyle = played ? getCSS('--accent') : 'rgba(154,167,177,.26)';
      roundRect(ctx, x, y, bw, bh, Math.min(bw/2, 2));
      ctx.fill();
    }
  };
  useE(() => { draw(); const ro = new ResizeObserver(draw); if (wrap.current) ro.observe(wrap.current); return () => ro.disconnect(); }, []);
  useE(() => { draw(); }, [t, dur]);
  return <div ref={wrap} style={{ width:'100%', height:'100%' }}><canvas ref={ref} /></div>;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function getCSS(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#20D3C2'; }

// ───────────────────────── Barra de progreso deslizable ─────────────────────────
function SeekBar({ t, dur, onSeek }) {
  const track = useR(null);
  const [drag, setDrag] = useS(false);
  const ratio = dur ? Math.min(1, t / dur) : 0;
  const apply = (clientX) => {
    const r = track.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onSeek(x * dur);
  };
  const down = (e) => { setDrag(true); e.currentTarget.setPointerCapture?.(e.pointerId); apply(e.clientX); };
  const moveE = (e) => { if (drag) apply(e.clientX); };
  const up = () => setDrag(false);
  return (
    <div ref={track} onPointerDown={down} onPointerMove={moveE} onPointerUp={up}
      style={{ position:'relative', height:26, display:'flex', alignItems:'center', cursor:'pointer', touchAction:'none' }}>
      <div style={{ position:'absolute', left:0, right:0, height:4, borderRadius:3, background:'var(--s3)' }} />
      <div style={{ position:'absolute', left:0, width:`${ratio*100}%`, height:4, borderRadius:3, background:'var(--accent)' }} />
      <div style={{ position:'absolute', left:`${ratio*100}%`, width:14, height:14, marginLeft:-7, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 0 4px var(--accent-glow)' }} />
    </div>
  );
}

// ───────────────────────── Gráfico de análisis de actividad ─────────────────────────
// Histograma superpuesto sobre la barra de progreso. Cada barra representa un tramo del
// archivo; su altura y color resaltan los picos (movimiento en vídeo / energía en audio).
// 'motion' usa tonos cálidos (ámbar→rojo); 'audio' usa tonos fríos (azul→cian).
function AnalysisGraph({ mode, values, dur, t, onSeek }) {
  const ref = useR(null);
  const n = values.length;
  const prog = dur ? Math.min(1, t / dur) : 0;
  const apply = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onSeek(x * dur);
  };
  // hue desplaza con el valor: picos altos → más rojo (motion) / más cian (audio)
  const hueFor = (v) => mode === 'motion' ? (44 - v * 44) : (208 - v * 46);
  return (
    <div ref={ref}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); apply(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons) apply(e.clientX); }}
      style={{ position:'relative', height:42, display:'flex', alignItems:'flex-end', gap:1,
        cursor:'pointer', touchAction:'none', marginBottom:6, padding:'0 2px',
        borderRadius:8, background:'rgba(0,0,0,.24)', border:'1px solid var(--line)' }}>
      {values.map((v, i) => {
        const played = (i + 0.5) / n <= prog;
        const h = 12 + v * 88;                               // resalte en TAMAÑO
        const sat = 45 + v * 50, lig = 30 + v * 34;          // resalte en COLOR
        const a = (played ? 0.55 : 0.3) + v * 0.45;
        return <div key={i} style={{ flex:1, minWidth:0, height:`${h}%`, borderRadius:2,
          background:`hsla(${hueFor(v)}, ${sat}%, ${lig}%, ${a})`,
          boxShadow: v > 0.7 ? `0 0 5px hsla(${hueFor(v)},92%,56%,.6)` : 'none' }} />;
      })}
      {/* cabezal de reproducción */}
      <div style={{ position:'absolute', top:2, bottom:2, left:`${prog*100}%`, width:2, marginLeft:-1,
        background:'var(--hi)', opacity:.85, borderRadius:2, pointerEvents:'none' }} />
    </div>
  );
}

// ───────────────────────── Controles de reproducción ─────────────────────────
function PlaybackBar({ type, fps, t, dur, playing, onSeek, onToggle, onStep, onSkip,
                       analysisMode, analysisValues, analyzing, onAnalyze, compact }) {
  const isVideo = type === 'video';
  const bigD = compact ? 48 : 58, smD = compact ? 38 : 44;  // tamaños (compacto en horizontal)
  const ctrlBtn = (icon, on, big) => (
    <button onClick={on} style={{
      width:big ? bigD : smD, height:big ? bigD : smD, borderRadius:'50%',
      background:big ? 'var(--accent)' : 'transparent',
      color:big ? 'var(--accent-ink)' : 'var(--hi)',
      border:big ? 'none' : '1px solid var(--line2)',
      display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
      boxShadow:big ? '0 6px 20px var(--accent-glow)' : 'none', flexShrink:0,
    }}>
      <Icon name={icon} size={big ? (compact ? 22 : 26) : 20} stroke={2.2} />
    </button>
  );
  // Botón de paso de frame: muestra la flecha + "F" (cuadro anterior / siguiente)
  const frameBtn = (dir) => (
    <button onClick={() => onStep(dir)} title={dir < 0 ? 'Cuadro anterior' : 'Cuadro siguiente'} style={{
      width:compact ? 42 : 48, height:smD, borderRadius:13, background:'transparent', color:'var(--hi)',
      border:'1px solid var(--line2)', display:'flex', alignItems:'center', justifyContent:'center', gap:1,
      cursor:'pointer', flexShrink:0, fontFamily:'var(--mono)', fontSize:14, fontWeight:700,
    }}>
      {dir < 0 && <Icon name="chevron-left" size={15} stroke={2.6} />}
      <span style={{ lineHeight:1 }}>F</span>
      {dir > 0 && <Icon name="chevron-right" size={15} stroke={2.6} />}
    </button>
  );
  // Botón RE / RA: alterna el gráfico de análisis. Solo uno puede estar activo a la vez.
  const anaBtn = (id, label, title) => {
    const active = analysisMode === id;
    const busy = analyzing && analyzing.mode === id;
    return (
      <button onClick={() => onAnalyze(id)} title={title} disabled={!!analyzing}
        style={{ minWidth:42, height:28, padding:'0 10px', borderRadius:8, cursor: analyzing ? 'default' : 'pointer',
          fontFamily:'var(--mono)', fontSize:12, fontWeight:700, letterSpacing:.5,
          display:'flex', alignItems:'center', justifyContent:'center',
          background: active ? 'var(--accent)' : 'var(--s3)',
          color: active ? 'var(--accent-ink)' : busy ? 'var(--accent)' : 'var(--mid)',
          border:'1px solid ' + (active ? 'transparent' : 'var(--line2)'),
          opacity: analyzing && !busy ? .5 : 1 }}>
        {busy ? `${Math.round(analyzing.progress * 100)}%` : label}
      </button>
    );
  };
  const anaLabel = analyzing
    ? (analyzing.mode === 'motion' ? 'Analizando movimiento…' : 'Analizando audio…')
    : analysisMode === 'motion' ? 'Movimiento detectado · toca un pico para saltar'
    : analysisMode === 'audio'  ? 'Actividad de audio · toca un pico para saltar'
    : 'Análisis de actividad';
  return (
    <div style={{ padding: compact ? '5px 16px 7px' : '10px 16px 12px', background:'var(--s2)', borderTop:'1px solid var(--line)' }}>
      {/* fila de análisis: leyenda + botones RE / RA */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom: compact ? 4 : 7 }}>
        <span style={{ fontFamily:'var(--mono)', fontSize:10.5, color:'var(--lo)', letterSpacing:.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{anaLabel}</span>
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          {isVideo && anaBtn('motion', 'RE', 'Resaltar movimiento en el vídeo')}
          {anaBtn('audio', 'RA', 'Resaltar actividad de audio')}
        </div>
      </div>
      {/* histograma de análisis sobre la barra de progreso */}
      {analysisMode && analysisValues && (
        <AnalysisGraph mode={analysisMode} values={analysisValues} dur={dur} t={t} onSeek={onSeek} />
      )}
      <SeekBar t={t} dur={dur} onSeek={onSeek} />
      <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:11.5, color:'var(--mid)', marginTop:2 }}>
        <span style={{ color:'var(--hi)' }}>{fmtTime(t)}</span>
        <span>{fmtTime(dur)}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap: compact ? 12 : 14, marginTop: compact ? 5 : 8 }}>
        {ctrlBtn('rewind-10', () => onSkip(-10))}
        {isVideo && frameBtn(-1)}
        {ctrlBtn(playing ? 'pause' : 'play', onToggle, true)}
        {isVideo && frameBtn(1)}
        {ctrlBtn('forward-10', () => onSkip(10))}
      </div>
      {/* la línea de paso de frame se oculta en horizontal para ahorrar altura */}
      {isVideo && !compact && (
        <div style={{ textAlign:'center', marginTop:7, fontFamily:'var(--mono)', fontSize:10, color:'var(--lo)', letterSpacing:.4 }}>
          PASO DE FRAME · {fps} FPS · {(1000/fps).toFixed(0)} ms
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Barra de acciones flotante (FAB) ─────────────────────────
function FABRail({ type, annotating, recording, fabStyle, onCapture, onRecord, onAnnotate, compact }) {
  const actions = [
    { id:'cap', icon:'camera', label:'Captura', on:onCapture, active:false, danger:false },
    { id:'rec', icon:recording ? 'stop' : 'record', label:recording ? 'Detener' : 'Grabar', on:onRecord, active:recording, danger:recording },
    { id:'ann', icon:'pencil', label:'Anotar', on:onAnnotate, active:annotating, danger:false },
  ];

  // en horizontal se fuerzan iconos (sin etiqueta) y tamaño menor para no robar altura
  const labeled = fabStyle === 'labels' && !compact;
  const d = compact ? 42 : 48;
  return (
    <div style={{ position:'absolute', right: compact ? 10 : 12, top:'50%', transform:'translateY(-50%)', zIndex:30, display:'flex', flexDirection:'column', gap: compact ? 10 : 12, alignItems:'flex-end' }}>
      {actions.map((a) => {
        const accent = a.danger ? 'var(--danger)' : a.active ? 'var(--accent)' : null;
        return (
          <button key={a.id} onClick={a.on} style={{
            display:'flex', alignItems:'center', gap:9,
            background: accent ? (a.danger ? 'var(--danger)' : 'var(--accent)') : 'rgba(20,24,29,.82)',
            color: accent ? (a.danger ? '#fff' : 'var(--accent-ink)') : 'var(--hi)',
            border:`1px solid ${accent ? 'transparent' : 'var(--line2)'}`,
            borderRadius: labeled ? 24 : '50%',
            padding: labeled ? '0 16px 0 12px' : 0,
            height:d, width: labeled ? 'auto' : d,
            backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
            boxShadow: accent ? `0 6px 18px ${a.danger ? 'rgba(255,77,82,.4)' : 'var(--accent-glow)'}` : '0 4px 14px rgba(0,0,0,.4)',
            cursor:'pointer', flexShrink:0,
            animation: a.danger ? 'recPulse 1.4s infinite' : 'none',
          }}>
            <span style={{ width:labeled ? 24 : '100%', height:d, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name={a.icon} size={a.id==='rec' && recording ? 18 : (compact ? 20 : 22)} stroke={2.1} />
            </span>
            {labeled && <span style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap' }}>{a.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────── Submenú de anotación ─────────────────────────
function AnnotateToolbar({ tool, setTool, color, setColor, widthIdx, setWidth, canUndo, onUndo, onClear, onDone }) {
  const swatch = (c) => (
    <button key={c} onClick={() => setColor(c)} style={{
      width:30, height:30, borderRadius:'50%', background:c, cursor:'pointer',
      border: color === c ? '2.5px solid var(--hi)' : '2px solid rgba(255,255,255,.18)',
      boxShadow: color === c ? '0 0 0 3px var(--accent-glow)' : 'none', flexShrink:0,
    }} />
  );
  return (
    <div style={{ background:'var(--s2)', borderTop:'1px solid var(--line)', padding:'10px 14px 12px' }}>
      {/* herramientas */}
      <div style={{ display:'flex', gap:8 }}>
        {TOOLS.map((tl) => (
          <button key={tl.id} onClick={() => setTool(tl.id)} style={{
            flex:1, height:44, borderRadius:11, cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
            background: tool === tl.id ? 'var(--accent)' : 'var(--s3)',
            color: tool === tl.id ? 'var(--accent-ink)' : 'var(--mid)',
            border:'1px solid ' + (tool === tl.id ? 'transparent' : 'var(--line)'),
          }}>
            <Icon name={tl.icon} size={18} />
          </button>
        ))}
      </div>
      {/* color + grosor */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:11 }}>
        <div style={{ display:'flex', gap:7, flex:1, flexWrap:'wrap' }}>{PALETTE.map(swatch)}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:11 }}>
        <span style={{ fontSize:11, color:'var(--lo)', fontFamily:'var(--mono)', width:54 }}>GROSOR</span>
        <div style={{ display:'flex', gap:6, flex:1 }}>
          {WIDTH_LABELS.map((w, i) => (
            <button key={w} onClick={() => setWidth(i)} style={{
              flex:1, height:34, borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:600,
              display:'flex', alignItems:'center', justifyContent:'center', gap:7,
              background: widthIdx === i ? 'var(--s3)' : 'transparent',
              color: widthIdx === i ? 'var(--hi)' : 'var(--lo)',
              border:'1px solid ' + (widthIdx === i ? 'var(--line2)' : 'var(--line)'),
            }}>
              <span style={{ width:[6,11,17][i], height:[6,11,17][i], borderRadius:'50%', background:'currentColor' }} />
              {w}
            </button>
          ))}
        </div>
      </div>
      {/* acciones */}
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button onClick={onUndo} disabled={!canUndo} style={actBtn(!canUndo)}>
          <Icon name="undo" size={17} /> Deshacer
        </button>
        <button onClick={onClear} disabled={!canUndo} style={actBtn(!canUndo)}>
          <Icon name="trash" size={17} /> Limpiar
        </button>
        <button onClick={onDone} style={{ ...actBtn(false), background:'var(--accent)', color:'var(--accent-ink)', border:'none', flex:1.2, fontWeight:700 }}>
          <Icon name="check" size={18} stroke={2.4} /> Listo
        </button>
      </div>
    </div>
  );
}
function actBtn(disabled) {
  return {
    flex:1, height:42, borderRadius:11, cursor: disabled ? 'default' : 'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontSize:13, fontWeight:600,
    background:'var(--s3)', color: disabled ? 'var(--lo)' : 'var(--hi)',
    border:'1px solid var(--line)', opacity: disabled ? .5 : 1,
  };
}

// ───────────────────────── Hojas modales ─────────────────────────
function MetaRow({ k, v }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:14, padding:'11px 0', borderBottom:'1px solid var(--line)' }}>
      <span style={{ fontSize:13, color:'var(--mid)' }}>{k}</span>
      <span style={{ fontSize:12.5, color:'var(--hi)', fontFamily:'var(--mono)', textAlign:'right' }}>{v}</span>
    </div>
  );
}
function MetadataSheet({ open, onClose, file, liveDur, liveRes }) {
  const m = TYPE_META[file.type];
  // Usa los datos reales del medio ya cargado si el archivo no los traía (p. ej. abierto del dispositivo)
  const res = file.res || liveRes;
  const dur = (file.dur && file.dur > 0) ? file.dur : (liveDur || 0);
  return (
    <Sheet open={open} onClose={onClose} title="Metadatos del archivo">
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
        <Badge color={m.color} bg="var(--s3)"><Icon name={m.icon} size={12} color={m.color} />{m.label}</Badge>
        <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--mid)' }}>{file.container}</span>
      </div>
      <MetaRow k="Nombre" v={file.name} />
      <MetaRow k="Tamaño" v={file.size} />
      <MetaRow k="Fecha de creación" v={file.created} />
      <MetaRow k="Fecha de modificación" v={file.modified} />
      {res && <MetaRow k="Resolución" v={res + ' px'} />}
      {dur > 0 && <MetaRow k="Duración" v={fmtTime(dur)} />}
      {file.fps && <MetaRow k="Cuadros por segundo" v={file.fps + ' FPS'} />}
      <MetaRow k="Formato / códec" v={file.codec} />
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:14, padding:'10px 12px', background:'var(--accent-glow)', borderRadius:11 }}>
        <Icon name="shield" size={17} color="var(--accent)" />
        <span style={{ fontSize:12, color:'var(--accent)' }}>Solo lectura · el archivo original nunca se modifica</span>
      </div>
    </Sheet>
  );
}

function Segmented({ options, value, onChange, cols }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols || options.length}, 1fr)`, gap:7 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={{
          height:40, borderRadius:10, cursor:'pointer', fontSize:12.5, fontWeight:600,
          background: value === o ? 'var(--accent)' : 'var(--s3)',
          color: value === o ? 'var(--accent-ink)' : 'var(--mid)',
          border:'1px solid ' + (value === o ? 'transparent' : 'var(--line)'),
        }}>{o}</button>
      ))}
    </div>
  );
}
function ShareSheet({ open, onClose, fileName }) {
  const doShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'ForenseLab – evidencia', text: fileName }); } catch (_) {}
    } else {
      try { await navigator.clipboard.writeText(fileName); } catch (_) {}
    }
    onClose();
  };
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(fileName); } catch (_) {}
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Compartir archivo">
      <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--mid)', marginBottom:16, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{fileName}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {navigator.share && (
          <button onClick={doShare} style={{ height:50, borderRadius:13, background:'var(--accent)', color:'var(--accent-ink)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontSize:15, fontWeight:700 }}>
            <Icon name="share" size={20} color="var(--accent-ink)" /> Compartir…
          </button>
        )}
        <button onClick={doCopy} style={{ height:50, borderRadius:13, background:'var(--s3)', color:'var(--hi)', border:'1px solid var(--line)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontSize:14, fontWeight:600 }}>
          <Icon name="copy" size={18} /> Copiar nombre de archivo
        </button>
      </div>
    </Sheet>
  );
}

window.ViewerParts = { Waveform, SeekBar, AnalysisGraph, PlaybackBar, FABRail, AnnotateToolbar, MetadataSheet, ShareSheet, PALETTE };
