"""
Genera los íconos de lanzador de ForenseLab Mobile.
Concepto: marco de vídeo con botón de reproducción + lupa de análisis forense.
Requiere cairosvg (pip install cairosvg).
"""
import cairosvg, os

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..",
                                    "android", "app", "src", "main", "res"))

DEFS = '''
  <defs>
    <radialGradient id="bg" cx="32%" cy="26%" r="85%">
      <stop offset="0%"   stop-color="#172026"/>
      <stop offset="100%" stop-color="#070A0D"/>
    </radialGradient>
    <radialGradient id="glow" cx="60%" cy="58%" r="45%">
      <stop offset="0%"   stop-color="#20D3C2" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#20D3C2" stop-opacity="0"/>
    </radialGradient>
  </defs>
'''

# ── Arte del icono (lupa analizando un fotograma de vídeo). viewBox 0..108 ──
ART = '''
  <!-- marco de vídeo -->
  <rect x="20" y="29" width="50" height="37" rx="7.5" fill="none" stroke="#20D3C2" stroke-width="4.4"/>
  <!-- líneas de escaneo forense dentro del fotograma -->
  <line x1="27" y1="39"   x2="63" y2="39"   stroke="#20D3C2" stroke-width="2" stroke-opacity="0.32"/>
  <line x1="27" y1="47.5" x2="63" y2="47.5" stroke="#20D3C2" stroke-width="2" stroke-opacity="0.32"/>
  <line x1="27" y1="56"   x2="47" y2="56"   stroke="#20D3C2" stroke-width="2" stroke-opacity="0.32"/>
  <!-- botón de reproducción (vídeo) -->
  <path d="M39 39 L39 56 L54 47.5 Z" fill="#20D3C2"/>
  <!-- lupa: lente sobre la esquina inferior derecha del fotograma -->
  <circle cx="71" cy="65" r="15.5" fill="#0B0E11"/>
  <circle cx="71" cy="65" r="15.5" fill="none" stroke="#20D3C2" stroke-width="4.4"/>
  <!-- retícula / mira forense en la lente -->
  <line x1="71" y1="56.5" x2="71" y2="73.5" stroke="#20D3C2" stroke-width="1.8" stroke-opacity="0.85"/>
  <line x1="62.5" y1="65" x2="79.5" y2="65" stroke="#20D3C2" stroke-width="1.8" stroke-opacity="0.85"/>
  <circle cx="71" cy="65" r="3.1" fill="#20D3C2"/>
  <!-- mango de la lupa -->
  <line x1="82.5" y1="76.5" x2="92" y2="86" stroke="#15A89A" stroke-width="6.4" stroke-linecap="round"/>
  <line x1="82.5" y1="76.5" x2="92" y2="86" stroke="#20D3C2" stroke-width="2.3" stroke-linecap="round" stroke-opacity="0.7"/>
'''

# Icono completo (heredado / legacy): fondo redondeado + arte
SVG_FULL = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  {DEFS}
  <rect width="108" height="108" rx="22" fill="url(#bg)"/>
  <circle cx="62" cy="60" r="48" fill="url(#glow)"/>
  {ART}
  <rect x="0.75" y="0.75" width="106.5" height="106.5" rx="21.3" fill="none" stroke="#232A31" stroke-width="1.4"/>
</svg>'''

# Foreground adaptativo: solo el arte, transparente, escalado a la zona segura
SVG_FG = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <g transform="translate(54 54) scale(0.82) translate(-55 -52)">
    {ART}
  </g>
</svg>'''

# Fondo adaptativo: degradado oscuro de marca con leve halo teal
SVG_BG = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  {DEFS}
  <rect width="108" height="108" fill="url(#bg)"/>
  <circle cx="62" cy="60" r="54" fill="url(#glow)"/>
</svg>'''

LEGACY = {  # ic_launcher.png / ic_launcher_round.png (icono completo)
    "mipmap-mdpi": 48, "mipmap-hdpi": 72, "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144, "mipmap-xxxhdpi": 192,
}
ADAPTIVE = {  # capas adaptativas: 108dp → px por densidad
    "mipmap-mdpi": 108, "mipmap-hdpi": 162, "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324, "mipmap-xxxhdpi": 432,
}

def render(svg, path, px):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=path, output_width=px, output_height=px)
    print(f"  {os.path.relpath(path, BASE)} → {px}px")

for folder, px in LEGACY.items():
    render(SVG_FULL, os.path.join(BASE, folder, "ic_launcher.png"), px)
    render(SVG_FULL, os.path.join(BASE, folder, "ic_launcher_round.png"), px)

for folder, px in ADAPTIVE.items():
    render(SVG_FG, os.path.join(BASE, folder, "ic_launcher_foreground.png"), px)
    render(SVG_BG, os.path.join(BASE, folder, "ic_launcher_background.png"), px)

print("\nÍconos generados correctamente.")
