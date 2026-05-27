// Generates simple violet square icons with "BWS" text for PWA
import { writeFileSync, mkdirSync } from 'fs';

function svgIcon(size: number): string {
  const fontSize = Math.round(size * 0.28);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#111827"/>
  <rect x="${Math.round(size*0.08)}" y="${Math.round(size*0.08)}" width="${Math.round(size*0.84)}" height="${Math.round(size*0.84)}" rx="${Math.round(size*0.14)}" fill="#7c3aed"/>
  <text x="50%" y="54%" font-family="system-ui,sans-serif" font-weight="800" font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle">BWS</text>
</svg>`;
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.svg', svgIcon(192));
writeFileSync('public/icons/icon-512.svg', svgIcon(512));
console.log('Icons generated.');
