// Gera todos os ícones da tríade a partir de assets/logo.png e assets/realworld.png.
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const logo = 'assets/logo.png';
mkdirSync('build', { recursive: true });
mkdirSync('extension/icons', { recursive: true });

// Ícone com fundo branco arredondado leve para boa leitura em barras escuras do Windows.
async function square(size, pad = 0, bg = null) {
  const inner = Math.round(size * (1 - pad * 2));
  const img = await sharp(logo).resize(inner, inner).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, gravity: 'center' }])
    .png()
    .toBuffer();
}

writeFileSync('build/icon.png', await square(512, 0.02));
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
writeFileSync('build/icon.ico', await pngToIco(await Promise.all(icoSizes.map((s) => square(s, 0.02)))));
for (const s of [16, 32, 48, 128]) writeFileSync(`extension/icons/icon-${s}.png`, await square(s, 0.02));
writeFileSync('public/icon-128.png', await square(128, 0.02));

// Android
const res = 'android/app/src/main/res';
if (existsSync(res)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  const white = { r: 255, g: 255, b: 255, alpha: 1 };
  for (const [d, k] of Object.entries(dens)) {
    const dir = `${res}/mipmap-${d}`;
    mkdirSync(dir, { recursive: true });
    const legacy = Math.round(48 * k);
    const round = await sharp({ create: { width: legacy, height: legacy, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}" fill="#fff"/></svg>`) },
        { input: await sharp(logo).resize(Math.round(legacy * 0.78)).png().toBuffer(), gravity: 'center' },
      ])
      .png()
      .toBuffer();
    writeFileSync(`${dir}/ic_launcher.png`, round);
    writeFileSync(`${dir}/ic_launcher_round.png`, round);
    const fg = Math.round(108 * k);
    writeFileSync(`${dir}/ic_launcher_foreground.png`, await square(fg, 0.2));
  }
  // splash
  for (const dir of ['drawable', 'drawable-port-mdpi', 'drawable-port-hdpi', 'drawable-port-xhdpi', 'drawable-port-xxhdpi', 'drawable-port-xxxhdpi', 'drawable-land-mdpi', 'drawable-land-hdpi', 'drawable-land-xhdpi', 'drawable-land-xxhdpi', 'drawable-land-xxxhdpi']) {
    const p = `${res}/${dir}/splash.png`;
    if (!existsSync(p)) continue;
    const meta = await sharp(p).metadata();
    const s = Math.round(Math.min(meta.width, meta.height) * 0.32);
    const out = await sharp({ create: { width: meta.width, height: meta.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .composite([{ input: await sharp(logo).resize(s).png().toBuffer(), gravity: 'center' }])
      .png()
      .toBuffer();
    writeFileSync(p, out);
  }
  writeFileSync(`${res}/values/ic_launcher_background.xml`, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n');
}
console.log('ícones ok');
