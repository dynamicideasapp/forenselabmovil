// app/home.jsx — pantalla de inicio, selector de archivo y panel "Acerca de"
const { useState: useH, useRef: useHR } = React;
const { Icon: IconH, Badge: BadgeH, Sheet: SheetH, TYPE_META: TMH, FORMATS: FMT } = window;

// Fila de archivo reutilizable (recientes y selector)
function FileRow({ file, onClick, compact }) {
  const m = TMH[file.type];
  const meta = file.type === 'audio' || file.type === 'video'
    ? file.dur ? `${file.size} · ${window.fmtTime(file.dur)}` : file.size
    : file.res ? `${file.size} · ${file.res} px` : file.size;
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:13, width:'100%', textAlign:'left',
      padding:'12px 12px', background:'var(--s1)', border:'1px solid var(--line)',
      borderRadius:13, cursor:'pointer', marginBottom:9,
    }}>
      <span style={{ width:42, height:42, borderRadius:10, background:'var(--s3)', display:'flex', alignItems:'center', justifyContent:'center', color:m.color, flexShrink:0 }}>
        <IconH name={m.icon} size={21} />
      </span>
      <span style={{ flex:1, minWidth:0 }}>
        <span style={{ display:'block', fontFamily:'var(--mono)', fontSize:13, color:'var(--hi)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{file.name}</span>
        <span style={{ display:'block', fontSize:11.5, color:'var(--lo)', marginTop:2 }}>{meta}</span>
      </span>
      <IconH name="chevron-right" size={18} color="var(--lo)" />
    </button>
  );
}

// Panel "Acerca de"
function AboutSheet({ open, onClose }) {
  const group = (title, arr) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11.5, color:'var(--lo)', fontFamily:'var(--mono)', marginBottom:8 }}>{title}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {arr.map((x) => <BadgeH key={x} bg="var(--s3)" color="var(--mid)">{x}</BadgeH>)}
      </div>
    </div>
  );
  return (
    <SheetH open={open} onClose={onClose} title="Acerca de" maxH="86%">
      <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:16 }}>
        <span style={{ width:52, height:52, borderRadius:14, background:'var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)' }}>
          <IconH name="shield" size={28} />
        </span>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>ForenseLab Mobile</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--mid)' }}>v1.0.0 · análisis pericial</div>
        </div>
      </div>
      <p style={{ fontSize:13.5, lineHeight:1.55, color:'var(--mid)', margin:'0 0 16px' }}>
        Herramienta de análisis forense de medios digitales para uso policial y pericial.
        Permite abrir, visualizar, anotar y exportar imágenes, vídeo y audio preservando la
        evidencia original sin modificarla.
      </p>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'12px 13px', background:'var(--accent-glow)', borderRadius:12, marginBottom:18 }}>
        <IconH name="shield" size={18} color="var(--accent)" />
        <span style={{ fontSize:12.5, color:'var(--accent)' }}>Flujo 100% no destructivo · el original nunca se modifica</span>
      </div>
      {group('VÍDEO', FMT.video)}
      {group('FOTO', FMT.image)}
      {group('AUDIO', FMT.audio)}
    </SheetH>
  );
}

function HomeScreen({ recents, onOpen, tweaks }) {
  const [about, setAbout] = useH(false);
  const fileInputRef = useHR(null);

  const handleDeviceFile = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    const extUp = ext.toUpperCase();
    const VIDEO_EXTS = ['mp4','mkv','avi','mov','ts','mts','m2ts','wmv','flv','mpeg','mpg','m4v','webm','3gp','h264','h265','hevc'];
    const IMAGE_EXTS = ['jpg','jpeg','png','gif','webp','bmp','heic','heif','tiff','tif','svg'];
    const type = f.type.startsWith('video/') ? 'video'
               : f.type.startsWith('image/') ? 'image'
               : f.type.startsWith('audio/') ? 'audio'
               : VIDEO_EXTS.includes(ext) ? 'video'
               : IMAGE_EXTS.includes(ext) ? 'image'
               : 'audio';

    const needsTranscode = type === 'video' && window.Transcoder?.needsTranscode(f);
    const url = needsTranscode ? null : URL.createObjectURL(f);

    onOpen({
      id: 'device_' + Date.now(),
      type,
      name: f.name,
      url,
      rawFile: needsTranscode ? f : null,
      needsTranscode: !!needsTranscode,
      slot: null,
      size: (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB',
      created: new Date(f.lastModified).toISOString().replace('T', ' ').slice(0, 19),
      modified: new Date(f.lastModified).toISOString().replace('T', ' ').slice(0, 19),
      res: null, dur: 0, fps: null, codec: f.type || extUp, container: extUp,
    });
  };

  return (
    <div className="noscroll" style={{ position:'absolute', inset:0, overflowY:'auto', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      {/* encabezado */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 18px 4px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:34, height:34, borderRadius:9, background:'var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)' }}>
            <IconH name="shield" size={19} />
          </span>
          <div>
            <div style={{ fontSize:17, fontWeight:700, letterSpacing:-.2 }}>ForenseLab</div>
            <div style={{ fontFamily:'var(--mono)', fontSize:9.5, color:'var(--lo)', letterSpacing:1.5, marginTop:-1, whiteSpace:'nowrap' }}>PERICIAL · MÓVIL</div>
          </div>
        </div>
        <button onClick={() => setAbout(true)} style={{ width:38, height:38, borderRadius:10, background:'var(--s2)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--mid)' }}>
          <IconH name="info" size={20} />
        </button>
      </div>

      {/* botón principal: abrir archivo */}
      <div style={{ padding:'18px 18px 6px' }}>
        <button onClick={() => fileInputRef.current.click()} style={{
          width:'100%', padding:'26px 20px', borderRadius:20, cursor:'pointer', textAlign:'left',
          background:'linear-gradient(150deg, rgba(32,211,194,.14), rgba(32,211,194,.04))',
          border:'1px solid var(--accent)', position:'relative', overflow:'hidden',
          display:'flex', alignItems:'center', gap:18,
        }}>
          <span style={{ width:64, height:64, borderRadius:16, background:'var(--accent)', color:'var(--accent-ink)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 8px 24px var(--accent-glow)' }}>
            <IconH name="folder-open" size={30} stroke={2.2} />
          </span>
          <span>
            <span style={{ display:'block', fontSize:21, fontWeight:700, color:'var(--hi)' }}>Abrir archivo</span>
            <span style={{ display:'block', fontSize:13, color:'var(--mid)', marginTop:3 }}>Imagen · Vídeo · Audio</span>
          </span>
        </button>
      </div>

      {/* acceso reciente */}
      <div style={{ padding:'18px 18px 0', flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontSize:13, fontWeight:600, color:'var(--mid)' }}>Acceso reciente</span>
          <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--lo)' }}>{recents.length} archivos</span>
        </div>
        {recents.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--lo)', fontSize:13, padding:'30px 0' }}>Aún no hay archivos abiertos</div>
        ) : recents.slice(0, 5).map((f) => <FileRow key={f.id} file={f} onClick={() => onOpen(f)} />)}
      </div>

      {/* pie: promesa no destructiva */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'14px 18px 22px', color:'var(--lo)' }}>
        <IconH name="shield" size={15} color="var(--accent)" />
        <span style={{ fontSize:11.5 }}>El archivo original nunca se modifica</span>
      </div>

      <input ref={fileInputRef} type="file"
        accept="video/*,.avi,.mkv,.ts,.mts,.m2ts,.mov,.3gp,.wmv,.flv,.mpeg,.mpg,.m4v,.h264,.h265,.hevc,image/*,audio/*,.wma"
        onChange={handleDeviceFile} style={{ display:'none' }} />
      <AboutSheet open={about} onClose={() => setAbout(false)} />
    </div>
  );
}

window.HomeScreen = HomeScreen;
