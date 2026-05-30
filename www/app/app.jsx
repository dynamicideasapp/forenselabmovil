// app/app.jsx — raíz: navegación, esquemas de acento y Tweaks (fullscreen, sin marco simulado)
const { useState: useA, useEffect: useAE } = React;
const { HomeScreen, ViewerScreen } = window;
const { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle } = window;

// Esquemas de color de acento (se aplican como variables CSS)
const SCHEMES = {
  Teal:  { accent:'#20D3C2', press:'#15A89A', ink:'#04201D', glow:'rgba(32,211,194,.28)' },
  Azul:  { accent:'#4C8DFF', press:'#2F6FE0', ink:'#061634', glow:'rgba(76,141,255,.28)' },
  'Ámbar': { accent:'#F5B53C', press:'#D8972A', ink:'#241600', glow:'rgba(245,181,60,.26)' },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "Teal",
  "fab": "Iconos",
  "showTimecode": true,
  "showGrid": false
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useA({ name:'home' });
  const [recents, setRecents] = useA([]);

  // aplica el esquema de acento a las variables CSS globales
  useAE(() => {
    const s = SCHEMES[t.accent] || SCHEMES.Teal;
    const r = document.documentElement.style;
    r.setProperty('--accent', s.accent);
    r.setProperty('--accent-press', s.press);
    r.setProperty('--accent-ink', s.ink);
    r.setProperty('--accent-glow', s.glow);
  }, [t.accent]);

  const openFile = (file) => {
    setRecents((prev) => [file, ...prev.filter((f) => f.id !== file.id)]);
    setScreen({ name:'viewer', file });
  };

  const tweaks = {
    fabStyle: t.fab === 'Etiquetas' ? 'labels' : 'icons',
    showTimecode: t.showTimecode,
    showGrid: t.showGrid,
  };

  return (
    <React.Fragment>
      <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
        <div style={{ position:'relative', width:'100%', height:'100%' }}>
          {screen.name === 'home'
            ? <HomeScreen recents={recents} onOpen={openFile} tweaks={tweaks} />
            : <ViewerScreen file={screen.file} onBack={() => setScreen({ name:'home' })} tweaks={tweaks} />}
        </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Apariencia" />
        <TweakRadio label="Color de acento" value={t.accent} options={['Teal','Azul','Ámbar']} onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Visor" />
        <TweakRadio label="Estilo de acciones (FAB)" value={t.fab} options={['Iconos','Etiquetas']} onChange={(v) => setTweak('fab', v)} />
        <TweakToggle label="Sello de tiempo en vídeo" value={t.showTimecode} onChange={(v) => setTweak('showTimecode', v)} />
        <TweakToggle label="Rejilla forense (regla de tercios)" value={t.showGrid} onChange={(v) => setTweak('showGrid', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
