/**
 * Gerador de Favicons e Ícones Oficiais do Comitê Digital
 * Identidade visual: cd (verde green-500 #2FBF83) + • (lime-400 #C4D830)
 * Baseado no docs/DESIGN-SYSTEM.md (§7.9) e src/components/marca.tsx.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '..');

function buildSvg({ maskable = false } = {}) {
  const rx = maskable ? 0 : 112; // 22% rounded corner for squircle
  const strokeW = maskable ? 0 : 7;
  const transform = maskable ? 'transform="translate(51, 51) scale(0.8)"' : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="primary-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3ED18C" />
      <stop offset="100%" stop-color="#2FBF83" />
    </linearGradient>
    <linearGradient id="lime-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D6E85F" />
      <stop offset="100%" stop-color="#C4D830" />
    </linearGradient>
    <radialGradient id="emblem-glow" cx="45%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#2FBF83" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#2FBF83" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Fundo dark emerald (ink-900 oficial) -->
  <rect width="512" height="512" rx="${rx}" fill="#0C1512" />
  
  ${!maskable ? `
  <!-- Brilho radial sutil -->
  <circle cx="256" cy="256" r="230" fill="url(#emblem-glow)" />
  <!-- Borda de destaque sutil -->
  <rect x="${strokeW}" y="${strokeW}" width="${512 - strokeW * 2}" height="${512 - strokeW * 2}" rx="${rx - strokeW}" fill="none" stroke="#2FBF83" stroke-width="${strokeW}" stroke-opacity="0.25" />
  ` : ''}

  <!-- Marca oficial: cd + • -->
  <g ${transform}>
    <text x="96" y="352"
      font-family="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Liberation Sans', 'Helvetica Neue', Arial, sans-serif"
      font-weight="900"
      font-size="246"
      letter-spacing="-14"
      fill="url(#primary-grad)">cd</text>
    <circle cx="398" cy="324" r="26" fill="url(#lime-grad)" />
  </g>
</svg>`;
}

function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + count * dirEntrySize;
  
  let currentOffset = dirSize;
  const entries = [];
  
  for (const item of pngBuffers) {
    entries.push({
      width: item.width >= 256 ? 0 : item.width,
      height: item.height >= 256 ? 0 : item.height,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bitCount: 32,
      bytesInRes: item.buffer.length,
      imageOffset: currentOffset,
      buffer: item.buffer
    });
    currentOffset += item.buffer.length;
  }
  
  const out = Buffer.alloc(currentOffset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  
  let entryPos = headerSize;
  for (const entry of entries) {
    out.writeUInt8(entry.width, entryPos + 0);
    out.writeUInt8(entry.height, entryPos + 1);
    out.writeUInt8(entry.colorCount, entryPos + 2);
    out.writeUInt8(entry.reserved, entryPos + 3);
    out.writeUInt16LE(entry.planes, entryPos + 4);
    out.writeUInt16LE(entry.bitCount, entryPos + 6);
    out.writeUInt32LE(entry.bytesInRes, entryPos + 8);
    out.writeUInt32LE(entry.imageOffset, entryPos + 12);
    entryPos += dirEntrySize;
    entry.buffer.copy(out, entry.imageOffset);
  }
  
  return out;
}

async function main() {
  const standardSvg = buildSvg({ maskable: false });
  const maskableSvg = buildSvg({ maskable: true });

  // 1. Salvar public/favicon.svg
  fs.writeFileSync(path.join(rootDir, 'public', 'favicon.svg'), standardSvg, 'utf8');
  console.log('✔ public/favicon.svg gerado');

  // 2. Renderizar PNGs em múltiplos tamanhos
  const buf16 = await sharp(Buffer.from(standardSvg)).resize(16, 16).png().toBuffer();
  const buf32 = await sharp(Buffer.from(standardSvg)).resize(32, 32).png().toBuffer();
  const buf48 = await sharp(Buffer.from(standardSvg)).resize(48, 48).png().toBuffer();
  const buf180 = await sharp(Buffer.from(standardSvg)).resize(180, 180).png().toBuffer();
  const buf192 = await sharp(Buffer.from(standardSvg)).resize(192, 192).png().toBuffer();
  const buf512 = await sharp(Buffer.from(standardSvg)).resize(512, 512).png().toBuffer();
  const bufMaskable = await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toBuffer();

  // 3. Criar ICO multi-resolução
  const icoBuffer = createIco([
    { width: 16, height: 16, buffer: buf16 },
    { width: 32, height: 32, buffer: buf32 },
    { width: 48, height: 48, buffer: buf48 },
  ]);

  // 4. Salvar favicon.ico em src/app/ (Next.js App Router)
  fs.writeFileSync(path.join(rootDir, 'src', 'app', 'favicon.ico'), icoBuffer);
  console.log('✔ src/app/favicon.ico gerado');

  // 5. Salvar icon.png e apple-icon.png no src/app/ para o Next.js App Router
  fs.writeFileSync(path.join(rootDir, 'src', 'app', 'icon.png'), buf32);
  fs.writeFileSync(path.join(rootDir, 'src', 'app', 'apple-icon.png'), buf180);
  console.log('✔ src/app/icon.png e src/app/apple-icon.png gerados');

  // 6. Atualizar ícones do PWA em public/icons/
  const iconsDir = path.join(rootDir, 'public', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), buf192);
  fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), buf512);
  fs.writeFileSync(path.join(iconsDir, 'icon-512-maskable.png'), bufMaskable);
  fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), buf180);
  console.log('✔ public/icons/ atualizados (icon-192, icon-512, icon-512-maskable, apple-touch-icon)');
}

main().catch((err) => {
  console.error('Erro ao gerar ícones:', err);
  process.exit(1);
});
