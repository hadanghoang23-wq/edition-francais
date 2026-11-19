// Fails the build if textbook content leaked into dist/ (the app shell must stay content-free).
// Probes are SHA-256 fingerprints of a few lines from the book's CD transcriptions, so this
// repository itself contains no textbook text. Every window of the same length in the bundle is hashed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dist = path.resolve('dist');
const banned = /\.(mp3|m4a|zip|jpg|jpeg)$/i;
const probes = [
  { len: 22, sha: '24e56581bba8d2859f734bd45cdfde72aa319ca3e4b9238fdd5a97235d937a69' },
  { len: 20, sha: '3944ded7b28aed70ca9f0f4c4f8d6d391aebf072ed7ec5e60e006c2ab802645a' },
  { len: 21, sha: '0bb252325f5da7c31c6bfa11358abe25078483e784bd15dac01a015c8775558b' },
  { len: 15, sha: '35be08bc6b30d61d32a292dc5f8d2307a46a75522fbf20593ee1c8d63fb1d751' },
];
const lengths = [...new Set(probes.map((p) => p.len))];
const wanted = new Set(probes.map((p) => p.sha));

const bad = [];
for (const file of fs.readdirSync(dist, { recursive: true })) {
  const p = path.join(dist, String(file));
  if (fs.statSync(p).isDirectory()) continue;
  if (banned.test(p)) bad.push(`media file in build: ${file}`);
  if (!/\.(js|html|css|json|webmanifest)$/.test(p)) continue;
  const text = fs.readFileSync(p, 'utf8');
  for (const len of lengths) {
    for (let i = 0; i + len <= text.length; i++) {
      // cheap pre-filter: probes start with an uppercase letter
      const ch = text.charCodeAt(i);
      if (ch < 65 || ch > 90) continue;
      const h = crypto.createHash('sha256').update(text.slice(i, i + len)).digest('hex');
      if (wanted.has(h)) { bad.push(`textbook text found in ${file} at offset ${i}`); break; }
    }
  }
}
if (bad.length) {
  console.error('Content check FAILED:\n' + bad.join('\n'));
  process.exit(1);
}
console.log('Content check passed: dist/ contains no textbook content.');
