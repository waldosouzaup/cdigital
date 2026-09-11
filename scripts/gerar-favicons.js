/**
 * Gerador de Favicons e Ícones Oficiais do Comitê Digital
 * Identidade visual: cd (verde green-500 #2FBF83) + • (lime-400 #C4D830)
 * Baseado no docs/DESIGN-SYSTEM.md (§7.9) e src/components/marca.tsx.
 *
 * Utiliza vetores <path> reais extraídos da tipografia oficial Inter 900,
 * garantindo renderização nítida e independente de fontes externas em qualquer navegador.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '..');

// Vetores exatos das letras 'c' e 'd' da tipografia oficial Inter Black (peso 900)
// Calculados para caixa de 512x512 com kerning óptico e alinhamento centrado
const PATH_C =
  'M171 347.34Q149.67 347.34 134.50 338.85Q119.32 330.35 111.29 315.18Q103.27 300 103.27 279.84Q103.27 259.69 111.29 244.51Q119.32 229.34 134.50 220.84Q149.67 212.34 171 212.34Q184.59 212.34 195.61 215.86Q206.63 219.38 214.77 225.88Q222.91 232.38 227.72 241.58Q232.52 250.78 233.70 262.15L190.45 268.59Q189.63 263.44 188.05 259.51Q186.47 255.59 184.13 252.89Q181.78 250.20 178.68 248.85Q175.57 247.50 171.70 247.50Q165.49 247.50 160.92 251.02Q156.35 254.53 153.83 261.68Q151.31 268.83 151.31 279.61Q151.31 290.27 153.83 297.54Q156.35 304.80 160.92 308.50Q165.49 312.19 171.70 312.19Q175.57 312.19 178.68 310.78Q181.78 309.38 184.18 306.62Q186.59 303.87 188.17 299.77Q189.75 295.66 190.45 290.39L233.70 296.72Q232.52 308.44 227.72 317.75Q222.91 327.07 214.83 333.69Q206.74 340.31 195.67 343.83Q184.59 347.34 171 347.34Z';

const PATH_D =
  'M285.55 346.64Q271.61 346.64 259.83 339.32Q248.05 331.99 241.02 317.11Q233.99 302.23 233.99 279.61Q233.99 255.82 241.38 241Q248.76 226.17 260.48 219.26Q272.20 212.34 285.09 212.34Q294.81 212.34 302.14 215.68Q309.46 219.02 314.44 224.65Q319.42 230.27 321.88 236.95L322.59 236.95L322.59 170.39L369.70 170.39L369.70 345L323.05 345L323.05 323.44L321.88 323.44Q319.19 330.12 314.15 335.33Q309.11 340.55 301.96 343.59Q294.81 346.64 285.55 346.64M302.90 310.55Q309.34 310.55 314.03 306.74Q318.72 302.93 321.24 296.02Q323.76 289.10 323.76 279.61Q323.76 269.88 321.24 262.91Q318.72 255.94 314.03 252.19Q309.34 248.44 302.90 248.44Q296.45 248.44 291.88 252.19Q287.31 255.94 284.91 262.91Q282.51 269.88 282.51 279.61Q282.51 289.22 284.91 296.19Q287.31 303.16 291.88 306.86Q296.45 310.55 302.90 310.55Z';

function buildSvg({ maskable = false } = {}) {
  const rx = maskable ? 0 : 112; // Cantos arredondados squircle (22%)
  const strokeW = maskable ? 0 : 14;
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

  ${
    !maskable
      ? `
  <!-- Brilho radial sutil -->
  <circle cx="256" cy="256" r="230" fill="url(#emblem-glow)" />
  <!-- Borda de destaque visível no tema escuro do navegador -->
  <rect x="7" y="7" width="498" height="498" rx="105" fill="none" stroke="#2FBF83" stroke-width="${strokeW}" stroke-opacity="0.4" />
  `
      : ''
  }

  <!-- Marca oficial: cd + • (vetores puros) -->
  <g ${transform}>
    <path d="${PATH_C}" fill="url(#primary-grad)" />
    <path d="${PATH_D}" fill="url(#primary-grad)" />
    <circle cx="398" cy="320" r="26" fill="url(#lime-grad)" />
  </g>
</svg>`;
}

/**
 * Converte um buffer PNG em DIB (Device Independent Bitmap) BMP padrão ICO 32bpp.
 * Garante compatibilidade universal com Chrome, Firefox, Safari, Edge e Windows/Linux.
 */
async function pngToDib(pngBuf, width, height) {
  const raw = await sharp(pngBuf).raw().toBuffer(); // RGBA, top-down
  const bpp = 32;
  const dibHeaderSize = 40;
  const xorSize = width * height * 4;
  const andRowBytes = Math.ceil(width / 32) * 4;
  const andSize = andRowBytes * height;
  const totalSize = dibHeaderSize + xorSize + andSize;

  const buf = Buffer.alloc(totalSize);

  // BITMAPINFOHEADER
  buf.writeUInt32LE(dibHeaderSize, 0); // biSize
  buf.writeInt32LE(width, 4); // biWidth
  buf.writeInt32LE(height * 2, 8); // biHeight (dobrado para XOR + AND)
  buf.writeUInt16LE(1, 12); // biPlanes
  buf.writeUInt16LE(bpp, 14); // biBitCount
  buf.writeUInt32LE(0, 16); // biCompression (BI_RGB)
  buf.writeUInt32LE(xorSize + andSize, 20); // biSizeImage
  buf.writeInt32LE(0, 24); // biXPelsPerMeter
  buf.writeInt32LE(0, 28); // biYPelsPerMeter
  buf.writeUInt32LE(0, 32); // biClrUsed
  buf.writeUInt32LE(0, 36); // biClrImportant

  // Bitmap XOR: BGRA, bottom-up
  let offset = dibHeaderSize;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      buf[offset++] = raw[srcIdx + 2]; // B
      buf[offset++] = raw[srcIdx + 1]; // G
      buf[offset++] = raw[srcIdx]; // R
      buf[offset++] = raw[srcIdx + 3]; // A
    }
  }

  // Máscara AND: 1 bit por pixel, bottom-up, alinhada em 32 bits
  for (let y = height - 1; y >= 0; y--) {
    const rowStart = offset;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const a = raw[srcIdx + 3];
      if (a === 0) {
        const byteOffset = rowStart + Math.floor(x / 8);
        const bitOffset = 7 - (x % 8);
        buf[byteOffset] |= 1 << bitOffset;
      }
    }
    offset += andRowBytes;
  }

  return buf;
}

/**
 * Cria arquivo ICO multi-resolução padrão contendo imagens DIB Bitmap
 */
async function createIco(images) {
  const dibs = [];
  for (const img of images) {
    const dib = await pngToDib(img.buf, img.width, img.height);
    dibs.push({ width: img.width, height: img.height, dib });
  }

  const count = dibs.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + count * dirEntrySize;

  let totalLength = dirSize;
  for (const d of dibs) totalLength += d.dib.length;

  const out = Buffer.alloc(totalLength);
  out.writeUInt16LE(0, 0); // reserved
  out.writeUInt16LE(1, 2); // 1 = ICO
  out.writeUInt16LE(count, 4); // quantidade de imagens

  let currentOffset = dirSize;
  let entryPos = headerSize;

  for (const d of dibs) {
    out.writeUInt8(d.width >= 256 ? 0 : d.width, entryPos + 0);
    out.writeUInt8(d.height >= 256 ? 0 : d.height, entryPos + 1);
    out.writeUInt8(0, entryPos + 2); // color count
    out.writeUInt8(0, entryPos + 3); // reserved
    out.writeUInt16LE(1, entryPos + 4); // planes
    out.writeUInt16LE(32, entryPos + 6); // bit count
    out.writeUInt32LE(d.dib.length, entryPos + 8);
    out.writeUInt32LE(currentOffset, entryPos + 12);

    d.dib.copy(out, currentOffset);
    currentOffset += d.dib.length;
    entryPos += dirEntrySize;
  }

  return out;
}

async function main() {
  const standardSvg = buildSvg({ maskable: false });
  const maskableSvg = buildSvg({ maskable: true });

  // 1. Salvar SVG vetorial em public/
  fs.writeFileSync(path.join(rootDir, 'public', 'favicon.svg'), standardSvg, 'utf8');
  console.log('✔ public/favicon.svg gerado com vetores reais');

  // 2. Renderizar PNGs em múltiplos tamanhos
  const buf16 = await sharp(Buffer.from(standardSvg)).resize(16, 16).png().toBuffer();
  const buf32 = await sharp(Buffer.from(standardSvg)).resize(32, 32).png().toBuffer();
  const buf48 = await sharp(Buffer.from(standardSvg)).resize(48, 48).png().toBuffer();
  const buf180 = await sharp(Buffer.from(standardSvg)).resize(180, 180).png().toBuffer();
  const buf192 = await sharp(Buffer.from(standardSvg)).resize(192, 192).png().toBuffer();
  const buf512 = await sharp(Buffer.from(standardSvg)).resize(512, 512).png().toBuffer();
  const bufMaskable = await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toBuffer();

  // 3. Criar ICO multi-resolução (16x16, 32x32, 48x48) em formato DIB BMP padrão
  const icoBuffer = await createIco([
    { width: 16, height: 16, buf: buf16 },
    { width: 32, height: 32, buf: buf32 },
    { width: 48, height: 48, buf: buf48 },
  ]);

  // 4. Salvar favicon.ico em public/ (estático direto)
  fs.writeFileSync(path.join(rootDir, 'public', 'favicon.ico'), icoBuffer);
  console.log('✔ public/favicon.ico gerado');

  // 5. Salvar icon.png e apple-icon.png em public/
  fs.writeFileSync(path.join(rootDir, 'public', 'icon.png'), buf32);
  fs.writeFileSync(path.join(rootDir, 'public', 'apple-icon.png'), buf180);
  console.log('✔ public/icon.png e public/apple-icon.png gerados');

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
