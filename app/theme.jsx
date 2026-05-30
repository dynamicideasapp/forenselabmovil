// app/theme.jsx — tokens, iconografía, datos de muestra y átomos de UI compartidos
// Todos los comentarios en español. Exporta al objeto global window.
const { useState, useEffect, useRef, createElement } = React;

// ───────────────────────── Iconos (trazo, estilo técnico) ─────────────────────────
// Mapa nombre -> contenido SVG (paths). Estilo Lucide simplificado, 24x24.
const ICON_PATHS = {
  'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
  'folder-open': 'M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6A2 2 0 0 1 18.45 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2',
  'info': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  'chevron-right': 'm9 18 6-6-6-6',
  'chevron-left': 'm15 18-6-6 6-6',
  'pause': 'M8 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zM18 4h-2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z',
  'rewind-10': 'M11 19 2.5 12 11 5v14zM22 19l-8.5-7L22 5v14z',
  'forward-10': 'M13 5l8.5 7L13 19V5zM2 5l8.5 7L2 19V5z',
  'step-back': 'M18 20 8 12l10-8v16zM6 4v16',
  'step-forward': 'M6 4l10 8-10 8V4zM18 4v16',
  'camera': 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z',
  'pencil': 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5 13-13zM15 5l4 4',
  'crop-rotate': 'M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2',
  'rotate-ccw': 'M3 7v6h6M3.5 13a9 9 0 1 0 2.6-7.4L3 8',
  'rotate-cw': 'M21 7v6h-6M20.5 13a9 9 0 1 1-2.6-7.4L21 8',
  'flip-h': 'M12 3v18M16 7l4 5-4 5V7zM8 7l-4 5 4 5V7z',
  'flip-v': 'M3 12h18M7 8l5-4 5 4H7zM7 16l5 4 5-4H7z',
  'undo': 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  'trash': 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2',
  'check': 'M20 6 9 17l-5-5',
  'share': 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  'x': 'M18 6 6 18M6 6l12 12',
  'image': 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  'video': 'M16 8l5.4-2.7A1 1 0 0 1 23 6.2v11.6a1 1 0 0 1-1.6.9L16 16M3 6h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  'music': 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  'shield': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  'zoom-in': 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6',
  'zoom-out': 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11h6',
  'maximize': 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  'clock': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  'whatsapp': 'M3 21l1.6-5A8.5 8.5 0 1 1 8 19.5L3 21z',
  'mail': 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 6L2 7',
  'copy': 'M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  'more': 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  'pen-line': 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
  'square': 'M4 4h16v16H4z',
  'circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  'arrow-up-right': 'M7 17 17 7M8 7h9v9',
  'ratio': 'M12 16V8M8 12h8M3 5h18v14H3z',
  'volume-2': 'M11 5 6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14',
  'volume-x': 'M11 5 6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6',
};

// Iconos con relleno (no trazo)
const ICON_FILLED = {
  'play': 'M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z',
  'record': 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  'stop': 'M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z',
};

function Icon({ name, size = 22, color = 'currentColor', stroke = 2, style }) {
  const filled = ICON_FILLED[name];
  const d = filled || ICON_PATHS[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ display:'block', flexShrink:0, ...style }}>
      <path d={d} />
    </svg>
  );
}

const TYPE_META = {
  video: { icon:'video', label:'VÍDEO', color:'var(--blue)' },
  image: { icon:'image', label:'IMAGEN', color:'var(--accent)' },
  audio: { icon:'music', label:'AUDIO', color:'var(--warn)' },
};

const FORMATS = {
  video:['MP4 H.264','MP4 H.265','MOV','MKV','WebM','AVI','3GP','TS','MTS','M2TS','M4V','FLV','WMV','MPEG'],
  image:['JPG','PNG','TIFF','BMP','HEIC','WebP','CR2','NEF','DNG','ARW'],
  audio:['MP3','WAV','AAC','OGG','FLAC','M4A','OPUS','WMA'],
};

// ───────────────────────── Utilidades ─────────────────────────
// Formatea segundos a HH:MM:SS
function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(ss)}`;
}
// Sello de tiempo para nombres de archivo: YYYYMMDD_HHmmss
function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ───────────────────────── Átomos de UI ─────────────────────────

// Etiqueta monoespaciada tipo "badge"
function Badge({ children, color = 'var(--mid)', bg = 'var(--s3)', style }) {
  return (
    <span style={{
      fontFamily:'var(--mono)', fontSize:10.5, fontWeight:600, letterSpacing:.6,
      color, background:bg, padding:'3px 7px', borderRadius:5,
      lineHeight:1, display:'inline-flex', alignItems:'center', gap:5, ...style,
    }}>{children}</span>
  );
}

// Hoja inferior modal reutilizable (bottom sheet) con fondo oscurecido
function Sheet({ open, onClose, children, title, maxH = '80%' }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); requestAnimationFrame(() => setShown(true)); }
    else { setShown(false); const t = setTimeout(() => setMounted(false), 240); return () => clearTimeout(t); }
  }, [open]);
  if (!mounted) return null;
  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:60, display:'flex', flexDirection:'column',
      justifyContent:'flex-end',
      background:`rgba(2,4,6,${shown ? .58 : 0})`, transition:'background .24s ease',
    }}>
      <div onClick={(e) => e.stopPropagation()} className="noscroll" style={{
        background:'var(--s1)', borderTopLeftRadius:20, borderTopRightRadius:20,
        borderTop:'1px solid var(--line2)', boxShadow:'0 -20px 50px rgba(0,0,0,.5)',
        transform:`translateY(${shown ? 0 : 100}%)`, transition:'transform .26s cubic-bezier(.2,.9,.25,1)',
        maxHeight:maxH, display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        <div style={{ display:'flex', justifyContent:'center', paddingTop:10 }}>
          <div style={{ width:40, height:4, borderRadius:2, background:'var(--line2)' }} />
        </div>
        {title && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px 8px' }}>
            <div style={{ fontSize:16, fontWeight:600 }}>{title}</div>
            <button onClick={onClose} style={{ background:'none', border:'none', padding:6, margin:-6, cursor:'pointer', color:'var(--mid)' }}>
              <Icon name="x" size={20} />
            </button>
          </div>
        )}
        <div className="noscroll" style={{ overflowY:'auto', padding:'4px 18px 22px' }}>{children}</div>
      </div>
    </div>
  );
}

// Notificación tipo "toast" con acción opcional
function Toast({ toast, onAction, onDone }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, toast.duration || 3600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div style={{
      position:'absolute', left:14, right:14, bottom:18, zIndex:80,
      display:'flex', alignItems:'center', gap:12,
      background:'#0e1419', border:'1px solid var(--line2)', borderRadius:14,
      padding:'12px 14px', boxShadow:'0 14px 40px rgba(0,0,0,.55)',
      animation:'toastIn .26s cubic-bezier(.2,.9,.25,1)',
    }}>
      <div style={{ width:30, height:30, borderRadius:8, background:'var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', flexShrink:0 }}>
        <Icon name={toast.icon || 'check'} size={18} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600 }}>{toast.title}</div>
        {toast.sub && <div style={{ fontSize:11, color:'var(--mid)', fontFamily:'var(--mono)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{toast.sub}</div>}
      </div>
      {toast.action && (
        <button onClick={onAction} style={{
          background:'none', border:'1px solid var(--line2)', color:'var(--accent)',
          fontWeight:600, fontSize:12.5, padding:'7px 12px', borderRadius:9, cursor:'pointer', flexShrink:0,
        }}>{toast.action}</button>
      )}
    </div>
  );
}

// keyframes globales (una sola vez)
(function injectKeyframes(){
  if (document.getElementById('fl-keyframes')) return;
  const s = document.createElement('style');
  s.id = 'fl-keyframes';
  s.textContent = `
    @keyframes toastIn { from { transform:translateY(14px); opacity:0 } to { transform:none; opacity:1 } }
    @keyframes recPulse { 0%,100% { opacity:1 } 50% { opacity:.35 } }
    @keyframes flash { 0% { opacity:0 } 8% { opacity:.92 } 100% { opacity:0 } }
    @keyframes spin { to { transform:rotate(360deg) } }
    @keyframes barPulse { 0%,100% { transform:scaleY(.4) } 50% { transform:scaleY(1) } }
  `;
  document.head.appendChild(s);
})();

Object.assign(window, {
  Icon, Badge, Sheet, Toast,
  TYPE_META, FORMATS, fmtTime, stamp,
});
