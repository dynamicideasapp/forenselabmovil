"""
Genera los íconos de lanzador para ForenseLab Mobile.
Diseño: lupa forense con retícula sobre fotograma de vídeo.
"""
import cairosvg, os

SVG = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <defs>
    <radialGradient id="bgGrad" cx="35%" cy="28%" r="75%">
      <stop offset="0%"   stop-color="#1B2026"/>
      <stop offset="100%" stop-color="#070A0D"/>
    </radialGradient>
    <radialGradient id="glowLens" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#20D3C2" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#20D3C2" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Fondo -->
  <rect width="108" height="108" rx="20" fill="url(#bgGrad)"/>

  <!-- ── Tira de cine ─────────────────────────────── -->
  <!-- Franja lateral izquierda de perforaciones -->
  <rect x="9" y="24" width="13" height="60" rx="2" fill="#0E1216"/>
  <rect x="12" y="29" width="7" height="5"  rx="1.5" fill="#232A31"/>
  <rect x="12" y="38" width="7" height="5"  rx="1.5" fill="#232A31"/>
  <rect x="12" y="47" width="7" height="5"  rx="1.5" fill="#232A31"/>
  <rect x="12" y="56" width="7" height="5"  rx="1.5" fill="#232A31"/>
  <rect x="12" y="65" width="7" height="5"  rx="1.5" fill="#232A31"/>
  <rect x="12" y="74" width="7" height="5"  rx="1.5" fill="#232A31"/>

  <!-- Franja lateral derecha de perforaciones -->
  <rect x="86" y="24" width="13" height="60" rx="2" fill="#0E1216"/>
  <rect x="89" y="29" width="7" height="5"  rx="1.5" fill="#232A31"/>
  <rect x="89" y="38" width="7" height="5"  rx="1.5" fill="#232A31"/>
  <rect x="89" y="47" width="7" height="5"  rx="1.5" fill="#232A31"/>
  <rect x="89" y="56" width="7" height="5"  rx="1.5" fill="#232A31"/>
  <rect x="89" y="65" width="7" height="5"  rx="1.5" fill="#232A31"/>
  <rect x="89" y="74" width="7" height="5"  rx="1.5" fill="#232A31"/>

  <!-- Área de imagen del fotograma -->
  <rect x="22" y="24" width="64" height="60" fill="#10151A"/>

  <!-- Líneas de escaneado forense (suaves, teal) -->
  <line x1="22" y1="38" x2="86" y2="38" stroke="#20D3C2" stroke-width="0.8" stroke-opacity="0.25"/>
  <line x1="22" y1="52" x2="86" y2="52" stroke="#20D3C2" stroke-width="0.8" stroke-opacity="0.25"/>
  <line x1="22" y1="66" x2="86" y2="66" stroke="#20D3C2" stroke-width="0.8" stroke-opacity="0.25"/>

  <!-- Líneas verticales de grilla -->
  <line x1="43" y1="24" x2="43" y2="84" stroke="#20D3C2" stroke-width="0.8" stroke-opacity="0.18"/>
  <line x1="65" y1="24" x2="65" y2="84" stroke="#20D3C2" stroke-width="0.8" stroke-opacity="0.18"/>

  <!-- ── Lupa forense ─────────────────────────────── -->
  <!-- Halo de luz (glow) -->
  <circle cx="62" cy="57" r="28" fill="url(#glowLens)"/>

  <!-- Fondo oscuro de la lente -->
  <circle cx="62" cy="57" r="22" fill="#070A0D" fill-opacity="0.92"/>

  <!-- Aro exterior de la lupa -->
  <circle cx="62" cy="57" r="22" fill="none" stroke="#20D3C2" stroke-width="3.2" filter="url(#glow)"/>

  <!-- Aro interior delgado -->
  <circle cx="62" cy="57" r="18.5" fill="none" stroke="#20D3C2" stroke-width="0.8" stroke-opacity="0.45"/>

  <!-- Retícula / mira: línea horizontal -->
  <line x1="44" y1="57" x2="80" y2="57" stroke="#20D3C2" stroke-width="1.3" stroke-opacity="0.85"/>
  <!-- Retícula: línea vertical -->
  <line x1="62" y1="39" x2="62" y2="75" stroke="#20D3C2" stroke-width="1.3" stroke-opacity="0.85"/>

  <!-- Marcas de precisión en la retícula -->
  <line x1="55" y1="54.5" x2="55" y2="59.5" stroke="#20D3C2" stroke-width="0.9" stroke-opacity="0.55"/>
  <line x1="69" y1="54.5" x2="69" y2="59.5" stroke="#20D3C2" stroke-width="0.9" stroke-opacity="0.55"/>
  <line x1="59.5" y1="50" x2="64.5" y2="50" stroke="#20D3C2" stroke-width="0.9" stroke-opacity="0.55"/>
  <line x1="59.5" y1="64" x2="64.5" y2="64" stroke="#20D3C2" stroke-width="0.9" stroke-opacity="0.55"/>

  <!-- Punto central -->
  <circle cx="62" cy="57" r="2.8" fill="#20D3C2" filter="url(#glow)"/>

  <!-- Mango de la lupa -->
  <line x1="79.5" y1="74.5" x2="92" y2="87" stroke="#15A89A" stroke-width="6" stroke-linecap="round"/>
  <line x1="79.5" y1="74.5" x2="92" y2="87" stroke="#20D3C2" stroke-width="2" stroke-linecap="round" stroke-opacity="0.6"/>

  <!-- Borde exterior sutil del ícono -->
  <rect width="108" height="108" rx="20" fill="none" stroke="#232A31" stroke-width="1.5"/>
</svg>
'''

BASE = "/media/marcelo/433 gb/APLICACIONES/06 forenselab mobil/FORENSE LAB MOBILE/android/app/src/main/res"

SIZES = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

for folder, px in SIZES.items():
    for name in ("ic_launcher.png", "ic_launcher_round.png"):
        path = os.path.join(BASE, folder, name)
        cairosvg.svg2png(bytestring=SVG.encode(), write_to=path, output_width=px, output_height=px)
        print(f"  {folder}/{name} → {px}×{px}px")

# Foreground adaptativo (108×108, sin el fondo redondeado)
SVG_FG = SVG.replace(
    '<rect width="108" height="108" rx="20" fill="url(#bgGrad)"/>',
    ''
).replace(
    '<rect width="108" height="108" rx="20" fill="none" stroke="#232A31" stroke-width="1.5"/>',
    ''
)

for name in ("ic_launcher_foreground.png",):
    path = os.path.join(BASE, "mipmap-xxxhdpi", name)
    cairosvg.svg2png(bytestring=SVG_FG.encode(), write_to=path, output_width=432, output_height=432)
    print(f"  mipmap-xxxhdpi/{name} → 432×432px (adaptive fg)")

print("\nÍconos generados correctamente.")
