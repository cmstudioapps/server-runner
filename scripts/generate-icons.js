/**
 * Gera ícones PNG para o ServerRunner
 * Requer: sharp (npm install sharp)
 *
 * Uso: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Tenta usar sharp
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('sharp não encontrado. Instale com: npm install sharp --save-dev');
  process.exit(1);
}

const SIZES = [64, 128, 256, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'build', 'icons');
const SVG_PATH = path.join(OUTPUT_DIR, 'icon.svg');

async function generateIcons() {
  // Verifica se o SVG existe
  if (!fs.existsSync(SVG_PATH)) {
    console.error(`SVG não encontrado: ${SVG_PATH}`);
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(SVG_PATH);

  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✓ Ícone ${size}x${size} criado: ${outputPath}`);
  }

  // Cria também icon.png (256x256)
  const iconPngPath = path.join(OUTPUT_DIR, 'icon.png');
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(iconPngPath);
  console.log(`✓ Ícone icon.png criado: ${iconPngPath}`);

  // Cria icon-512x512.png
  const icon512Path = path.join(OUTPUT_DIR, 'icon-512x512.png');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(icon512Path);
  console.log(`✓ Ícone icon-512x512.png criado: ${icon512Path}`);
}

generateIcons().catch(console.error);
