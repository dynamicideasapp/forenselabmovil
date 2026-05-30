# ForenseLab Mobile — CLAUDE.md

## Qué es este proyecto

Prototipo de interfaz de una app móvil Android para análisis forense de medios digitales
(imágenes, vídeo y audio). Permite visualizar, anotar y exportar evidencias sin modificar
el archivo original (flujo 100 % no destructivo).

Corre en el runtime "omelette" / en cualquier navegador moderno. No hay build step ni
package manager: todo es HTML + React 18 (CDN) + Babel standalone (transpilación JSX
en-browser).

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18.3 (UMD desde unpkg) |
| JSX | Babel Standalone 7.29 (transpila en el navegador) |
| Tipografía | IBM Plex Sans + IBM Plex Mono (Google Fonts) |
| Componente imagen | `<image-slot>` (Web Component, `image-slot.js`) |
| Panel de tweaks | `tweaks-panel.jsx` (protocolo omelette `__edit_mode_*`) |

## Estructura de archivos

```
forenselab.html          # Punto de entrada. Define variables CSS globales y carga scripts.
image-slot.js            # Web Component <image-slot>. Carga antes que cualquier JSX.
tweaks-panel.jsx         # Panel de ajuste en tiempo de diseño. Exporta a window.
frames/
  android-frame.jsx      # Marco de dispositivo Android (Material 3). Exporta a window.
app/
  theme.jsx              # Tokens, iconos SVG, datos de muestra, átomos (Badge, Sheet, Toast).
  annotation.jsx         # Capa de anotación canvas (libre, rectángulo, círculo, flecha).
  viewer.jsx             # Visor principal: vídeo / imagen / audio con controles forenses.
  viewer-screen.jsx      # Pantalla wrapper que envuelve al visor.
  home.jsx               # Pantalla de inicio: selector de archivo y acceso reciente.
  app.jsx                # Raíz: navegación, escalado del dispositivo, esquemas de acento.
screenshots/             # Capturas de pantalla del prototipo (referencia visual).
```

## Orden de carga (forenselab.html)

El orden importa porque no hay módulos ES — todo exporta a `window`:

1. `image-slot.js`  (plain JS, antes de cualquier Babel)
2. `frames/android-frame.jsx`
3. `tweaks-panel.jsx`
4. `app/theme.jsx`
5. `app/annotation.jsx`
6. `app/viewer.jsx`
7. `app/viewer-screen.jsx`
8. `app/home.jsx`
9. `app/app.jsx`  ← monta el árbol React

## API global (`window`)

Todos los módulos exportan con `Object.assign(window, { ... })` o `window.X = X`.

| Exporta | Módulo |
|---------|--------|
| `AndroidDevice`, `AndroidStatusBar`, etc. | `android-frame.jsx` |
| `useTweaks`, `TweaksPanel`, `TweakRadio`, etc. | `tweaks-panel.jsx` |
| `Icon`, `Badge`, `Sheet`, `Toast`, `SAMPLE_FILES`, `TYPE_META`, `FORMATS`, `fmtTime`, `stamp` | `theme.jsx` |
| `AnnotationLayer` | `annotation.jsx` |
| `ViewerScreen` (implícito vía `viewer-screen.jsx`) | `viewer-screen.jsx` |
| `HomeScreen` | `home.jsx` |

## Variables CSS (tokens de diseño)

Definidas en `<style>` dentro de `forenselab.html`. Se aplican en toda la app:

```
--bg, --s1, --s2, --s3          # Fondos (escala oscura)
--line, --line2                 # Bordes
--hi, --mid, --lo               # Texto (alto / medio / bajo contraste)
--accent, --accent-press, --accent-ink, --accent-glow  # Color principal (cambiable)
--danger, --warn, --blue        # Semánticos
--sans, --mono                  # Fuentes
```

El esquema de acento se cambia en tiempo real desde `TweaksPanel` → `app.jsx` lo aplica
con `document.documentElement.style.setProperty(...)`.

## Convenciones de código

- Todos los comentarios y textos de UI **en español**.
- Cada archivo empieza con un comentario de una línea explicando su rol.
- React se destructura localmente: `const { useState } = React` con alias de módulo
  (`useH`, `useS`, etc.) para evitar colisiones entre archivos en el mismo scope global.
- No hay props drilling profundo: los datos de muestra (`SAMPLE_FILES`) y átomos de UI
  se acceden directamente desde `window`.
- Los iconos son paths SVG inline en `ICON_PATHS` / `ICON_FILLED` (tema.jsx); se renderizan
  con el componente `<Icon name="..." />`.

## Dimensiones del dispositivo

El marco Android tiene dimensiones externas **428 × 908 px**. El escalado automático en
`app.jsx` (listener `resize`) encaja el marco en el viewport con `transform: scale(...)`.

## Cómo ejecutar

```bash
# Opción A — servidor estático simple
npx serve .
python3 -m http.server 8080

# Opción B — abrir directamente en Chrome/Firefox
# (algunas funciones de image-slot requieren servidor para fetch del sidecar)
open forenselab.html
```

## Pantallas implementadas

| Pantalla | Archivo | Descripción |
|----------|---------|-------------|
| Home | `app/home.jsx` | Lista de recientes, selector de archivo, panel "Acerca de" |
| Viewer | `app/viewer.jsx` + `viewer-screen.jsx` | Visor multimedia con controles forenses |
| Annotation | `app/annotation.jsx` | Superposición canvas para dibujar sobre la evidencia |

## Datos de muestra

`SAMPLE_FILES` en `theme.jsx` define 5 archivos ficticios (2 vídeos, 2 imágenes, 1 audio)
que simulan la carpeta de evidencias. Son solo para el prototipo; no existen en disco.
