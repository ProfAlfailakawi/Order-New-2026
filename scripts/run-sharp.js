import fs from 'fs';
import { execSync } from 'child_process';

const script = `
const sharp = require('sharp');

async function build() {
  try {
    const input = 'public/logo.png';
    console.log("Trimming and composing...");
    
    // Trim bounding box
    const trimmed = await sharp(input).trim().toBuffer();
    
    // Apple Touch Icon (180x180) - Solid white background, 10% padding
    await sharp(trimmed)
      .resize(144, 144, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .extend({ top: 18, bottom: 18, left: 18, right: 18, background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .toFile('public/icon-180.png');

    // Android/PWA Icon (192x192) - Transparent background allowed, but we'll use white
    await sharp(trimmed)
      .resize(150, 150, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .extend({ top: 21, bottom: 21, left: 21, right: 21, background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .toFile('public/icon-192.png');

    // Android/PWA Icon (512x512)
    await sharp(trimmed)
      .resize(400, 400, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .extend({ top: 56, bottom: 56, left: 56, right: 56, background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .toFile('public/icon-512.png');

    console.log("Done generating icons.");
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

build();
`;

fs.writeFileSync('generate-icons.cjs', script);
execSync('node generate-icons.cjs', { stdio: 'inherit' });
