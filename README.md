# ForenseLab Mobile

Prototipo de app móvil **Android** para análisis forense de medios digitales
(imágenes, vídeo y audio). Permite visualizar, anotar y exportar evidencias **sin
modificar el archivo original** (flujo 100 % no destructivo).

La interfaz es HTML + React 18 (sin build step: el JSX se transpila en el navegador con
Babel Standalone) y se empaqueta como APK con **Capacitor**.

## Características

- **Visor multimedia** con controles forenses: reproducción, salto ±10 s y paso de frame
  cuadro a cuadro (botones `‹F` / `F›`).
- **Anotación** sobre la evidencia (libre, rectángulo, círculo, flecha) en una capa canvas.
- **Captura** del frame actual y **grabación** del visor (vídeo + anotaciones + audio).
- **Análisis de actividad** sobre la barra de progreso:
  - **RE** — detecta *movimiento* en el vídeo comparando frames consecutivos.
  - **RA** — detecta *actividad de audio* (energía RMS por bloque).
  - Los picos se resaltan en tamaño y color; al tocarlos se salta a ese punto. Solo un
    gráfico visible a la vez (RE **o** RA).
- **Metadatos** del archivo y rejilla/sello de tiempo forense.

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18.3 (UMD local en `vendor/`) |
| JSX | Babel Standalone 7 (transpila en el navegador) |
| Empaquetado móvil | Capacitor 6 (Android) |
| Tipografía | IBM Plex Sans + IBM Plex Mono |

React y Babel se cargan desde `vendor/` (copias locales), por lo que la app funciona
**sin conexión**. `ffmpeg.wasm` se carga de forma diferida y solo se usa para transcodificar
formatos que el navegador no puede reproducir.

## Estructura

```
forenselab.html      # Punto de entrada (navegador). Variables CSS y orden de carga.
image-slot.js        # Web Component <image-slot>.
tweaks-panel.jsx     # Panel de ajuste en tiempo de diseño.
frames/              # Marco de dispositivo Android (Material 3).
app/                 # theme, annotation, viewer, viewer-screen, home, app, transcoder.
vendor/              # React + Babel (copias locales para uso offline).
www/                 # Directorio web que empaqueta Capacitor (copia de la raíz).
android/             # Proyecto nativo Android (Capacitor).
scripts/build-apk.sh # Sincroniza www, ejecuta cap sync y compila el APK.
```

> El código fuente vive en la **raíz** (`app/`, `frames/`, etc.). `www/` es la copia que
> consume Capacitor: se regenera desde la raíz con `scripts/build-apk.sh` (o `npm run sync`).

## Ejecutar en el navegador

```bash
npx serve .
# o
python3 -m http.server 8080
```

Abre `http://localhost:8080/forenselab.html`.

## Compilar el APK

Requisitos: **Node.js**, **JDK 17** y el **Android SDK** (define `ANDROID_HOME`, p. ej.
`~/Android/Sdk`).

```bash
npm install            # primera vez
./scripts/build-apk.sh # sincroniza www → cap sync → gradlew assembleDebug
```

El APK se genera en:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Instalarlo en un dispositivo/emulador conectado:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Pasos manuales (equivalente al script)

```bash
# 1. Copiar los assets web de la raíz a www/
cp -f forenselab.html index.html image-slot.js tweaks-panel.jsx www/
rm -rf www/app www/frames www/vendor && cp -rf app frames vendor www/

# 2. Sincronizar Capacitor (copia www → android/app/src/main/assets/public)
npx cap sync android

# 3. Compilar
cd android && ./gradlew assembleDebug
```

> Para un APK **release** firmado para distribución hay que crear un keystore y configurar
> `signingConfigs` en `android/app/build.gradle`.

## Licencia

ISC
