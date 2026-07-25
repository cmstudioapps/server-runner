#!/bin/bash
# Gera ícones PNG para o ServerRunner
# Requer: ImageMagick (convert)
# Uso: bash scripts/generate-icons.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ICON_DIR="$PROJECT_DIR/build/icons"
SVG="$ICON_DIR/icon.svg"

if [ ! -f "$SVG" ]; then
    echo "SVG não encontrado: $SVG"
    exit 1
fi

echo "Gerando ícones a partir do SVG..."

for size in 64 128 256 512; do
    convert -background none -resize "${size}x${size}" "$SVG" "$ICON_DIR/${size}x${size}.png"
    echo "✓ ${size}x${size}.png"
done

# icon.png = 256x256 (padrão)
cp "$ICON_DIR/256x256.png" "$ICON_DIR/icon.png"
echo "✓ icon.png (256x256)"

# icon-512x512
cp "$ICON_DIR/512x512.png" "$ICON_DIR/icon-512x512.png"
echo "✓ icon-512x512.png"

echo "Pronto! Ícones gerados em: $ICON_DIR"
