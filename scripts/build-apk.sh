#!/usr/bin/env bash
# build-apk.sh — Sincroniza los assets web a www/, ejecuta `cap sync` y compila el APK.
#
# Uso:
#   ./scripts/build-apk.sh            # APK debug (por defecto)
#   ./scripts/build-apk.sh release    # APK release (requiere keystore configurado)
#
# Requisitos: Node.js, JDK 17 y Android SDK (ANDROID_HOME o ~/Android/Sdk).

set -euo pipefail

# Raíz del proyecto (carpeta padre de este script), sin importar desde dónde se invoque.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VARIANT="${1:-debug}"
case "$VARIANT" in
  debug)   GRADLE_TASK="assembleDebug";   APK="android/app/build/outputs/apk/debug/app-debug.apk" ;;
  release) GRADLE_TASK="assembleRelease"; APK="android/app/build/outputs/apk/release/app-release.apk" ;;
  *) echo "Variante desconocida: '$VARIANT' (usa 'debug' o 'release')" >&2; exit 1 ;;
esac

# Localiza el Android SDK si no está exportado.
if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -d "$HOME/Android/Sdk" ]]; then
    export ANDROID_HOME="$HOME/Android/Sdk"
  elif [[ -d "$HOME/Library/Android/sdk" ]]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  fi
fi
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"

if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "ERROR: no se encontró el Android SDK. Exporta ANDROID_HOME." >&2
  exit 1
fi

# Asegura local.properties con la ruta del SDK (gradle lo necesita).
if [[ ! -f android/local.properties ]]; then
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
  echo "→ Creado android/local.properties"
fi

echo "→ [1/3] Sincronizando assets web raíz → www/"
cp -f forenselab.html index.html image-slot.js tweaks-panel.jsx www/
rm -rf www/app www/frames www/vendor
cp -rf app frames vendor www/

echo "→ [2/3] npx cap sync android"
npx cap sync android

echo "→ [3/3] Compilando APK ($VARIANT)"
( cd android && ./gradlew "$GRADLE_TASK" )

echo ""
if [[ -f "$APK" ]]; then
  echo "✅ APK generado: $APK"
  echo "   Instalar:  adb install -r \"$APK\""
else
  echo "⚠️  Build terminó pero no se encontró el APK esperado en: $APK" >&2
  exit 1
fi
