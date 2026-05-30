// app/annotation.jsx — capa de anotación con dibujo real sobre el visor (canvas)
// Coordenadas almacenadas normalizadas [0,1] para que escalen correctamente al girar la orientación.
const { useRef: useRefA, useEffect: useEffectA, useState: useStateA } = React;

// Grosores en píxeles según el ajuste fino / medio / grueso (índice 0..2)
const STROKE_W = [3.5, 7, 12];

// Dibuja una figura en el contexto 2D.
// sh.x0/y0/x1/y1 y sh.points[].x/y son normalizados [0,1].
// sh.w es grosor normalizado contra Math.min(canvasCSS_W, canvasCSS_H) al momento de creación.
// W, H son las dimensiones CSS actuales del canvas (sin DPR).
function drawShape(ctx, sh, W, H) {
  const actualW = sh.w * Math.min(W, H);
  ctx.strokeStyle = sh.color;
  ctx.fillStyle   = sh.color;
  ctx.lineWidth   = actualW;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  if (sh.tool === 'free') {
    const p = sh.points;
    if (!p || p.length < 2) {
      if (p && p.length === 1) {
        ctx.beginPath();
        ctx.arc(p[0].x * W, p[0].y * H, actualW / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    ctx.beginPath();
    ctx.moveTo(p[0].x * W, p[0].y * H);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x * W, p[i].y * H);
    ctx.stroke();
    return;
  }
  const x0 = sh.x0 * W, y0 = sh.y0 * H, x1 = sh.x1 * W, y1 = sh.y1 * H;
  if (sh.tool === 'rect') {
    ctx.beginPath();
    ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.stroke();
  } else if (sh.tool === 'circle') {
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (sh.tool === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const ang  = Math.atan2(y1 - y0, x1 - x0);
    const head = Math.max(14, actualW * 3.2);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(ang - Math.PI / 7), y1 - head * Math.sin(ang - Math.PI / 7));
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(ang + Math.PI / 7), y1 - head * Math.sin(ang + Math.PI / 7));
    ctx.stroke();
  }
}

// natW / natH: dimensiones naturales del contenido (videoWidth/videoHeight o naturalWidth/naturalHeight).
// El canvas se posiciona exactamente sobre el área renderizada del contenido (objectFit:contain).
function AnnotationLayer({ active, tool, color, widthIdx, shapes, onCommit, exportRef, natW, natH }) {
  const canvasRef = useRefA(null);
  const outerRef  = useRefA(null);
  const wrapRef   = useRefA(null);
  const drawingRef  = useRefA(null);
  const shapesRef   = useRefA(shapes);
  const natWRef     = useRefA(natW);
  const natHRef     = useRefA(natH);
  const [, force] = useStateA(0);

  shapesRef.current = shapes;
  natWRef.current   = natW;
  natHRef.current   = natH;

  const getContentArea = () => {
    const outer = outerRef.current;
    if (!outer) return null;
    const cW = outer.clientWidth, cH = outer.clientHeight;
    const nW = natWRef.current, nH = natHRef.current;
    if (nW > 0 && nH > 0) {
      const scale = Math.min(cW / nW, cH / nH);
      const rW = nW * scale, rH = nH * scale;
      return { x: Math.round((cW - rW) / 2), y: Math.round((cH - rH) / 2), w: Math.round(rW), h: Math.round(rH) };
    }
    return { x: 0, y: 0, w: cW, h: cH };
  };

  const redraw = () => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width / dpr;   // dimensiones CSS (sin DPR)
    const H = cv.height / dpr;
    ctx.save(); ctx.scale(dpr, dpr);
    shapesRef.current.forEach((s) => drawShape(ctx, s, W, H));
    if (drawingRef.current) drawShape(ctx, drawingRef.current, W, H);
    ctx.restore();
  };

  const fit = () => {
    const area = getContentArea();
    if (!area) return;
    const wrap = wrapRef.current;
    if (wrap) {
      wrap.style.left   = area.x + 'px';
      wrap.style.top    = area.y + 'px';
      wrap.style.width  = area.w + 'px';
      wrap.style.height = area.h + 'px';
    }
    const cv = canvasRef.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width  = Math.round(area.w * dpr);
    cv.height = Math.round(area.h * dpr);
    cv.style.width  = area.w + 'px';
    cv.style.height = area.h + 'px';
    redraw();
  };

  useEffectA(() => {
    fit();
    const ro = new ResizeObserver(fit);
    if (outerRef.current) ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffectA(() => {
    if (natW > 0 && natH > 0) fit();
  }, [natW, natH]);

  useEffectA(() => { redraw(); }, [shapes]);
  useEffectA(() => { if (exportRef) exportRef.current = canvasRef.current; });

  // Devuelve coordenadas normalizadas [0,1] relativas al canvas CSS
  const pos = (e) => {
    const cv = canvasRef.current;
    const r  = cv.getBoundingClientRect();
    const t  = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) / r.width, y: (t.clientY - r.top) / r.height };
  };

  const start = (e) => {
    if (!active) return;
    e.preventDefault();
    const p   = pos(e);
    const cv  = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const cW  = cv.width / dpr, cH = cv.height / dpr;
    // Normalizar grosor contra la dimensión menor del canvas para que escale proporcionalmente al girar
    const wNorm = STROKE_W[widthIdx] / Math.min(cW, cH);
    if (tool === 'free') drawingRef.current = { tool, color, w: wNorm, points: [p] };
    else drawingRef.current = { tool, color, w: wNorm, x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    force((n) => n + 1); redraw();
  };
  const move = (e) => {
    if (!active || !drawingRef.current) return;
    e.preventDefault();
    const p = pos(e), d = drawingRef.current;
    if (d.tool === 'free') d.points.push(p);
    else { d.x1 = p.x; d.y1 = p.y; }
    redraw();
  };
  const end = () => {
    if (!drawingRef.current) return;
    const d = drawingRef.current;
    let tiny = false;
    if (d.tool !== 'free') {
      const cv  = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const W   = cv ? cv.width / dpr : 1, H = cv ? cv.height / dpr : 1;
      // Convertir diferencia normalizada a píxeles para verificar tamaño mínimo
      tiny = Math.hypot((d.x1 - d.x0) * W, (d.y1 - d.y0) * H) < 6;
    }
    drawingRef.current = null;
    if (!tiny) onCommit(d); else redraw();
  };

  return (
    <div ref={outerRef} style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
      <div ref={wrapRef} style={{ position:'absolute', pointerEvents: active ? 'auto' : 'none' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          style={{ position:'absolute', inset:0, touchAction:'none', cursor: active ? 'crosshair' : 'default' }}
        />
      </div>
    </div>
  );
}

Object.assign(window, { AnnotationLayer, STROKE_W });
