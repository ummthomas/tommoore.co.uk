// Builds a password-protected page for a static host.
//
// The readable source lives in private/<page>/ (git-ignored). This script inlines any
// images that have landed in private/<page>/images/, encrypts the whole page with
// AES-256-GCM using a key derived from the password (PBKDF2-SHA256, 600k iterations),
// and writes a public page that only holds the ciphertext plus a password form.
//
// Usage: node tools/protect.mjs patchwork "Patchwork"
// The password is read from .env as <PAGE>_PASSWORD, e.g. PATCHWORK_PASSWORD.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { join, extname } from 'node:path';

const [page, title] = process.argv.slice(2);
if (!page || !title) {
  console.error('Usage: node tools/protect.mjs <page> "<Title>"');
  process.exit(1);
}

const envName = `${page.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_PASSWORD`;
const env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const password = process.env[envName] || (env.match(new RegExp(`^${envName}=(.+)$`, 'm')) || [])[1];
if (!password) {
  console.error(`Set ${envName} in .env`);
  process.exit(1);
}

const dir = join('private', page);
let html = readFileSync(join(dir, 'source.html'), 'utf8');

// Swap each placeholder slot for its image once the export exists
const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
let inlined = 0;
html = html.replace(
  /<div class="img-slot" style="([^"]*)" data-file="([^"]+)"><span>(.*?)<br>.*?<\/span><\/div>/g,
  (slot, style, file, label) => {
    const path = join(dir, 'images', file);
    if (!existsSync(path)) return slot;
    inlined++;
    const data = readFileSync(path).toString('base64');
    const keep = style.split(';').map((s) => s.trim()).filter((s) => s.startsWith('view-transition-name')).join('; ');
    const alt = label.replace(/\s*\(slide \d+\)/, '').replace(/"/g, '&quot;');
    return `<img src="data:${types[extname(file).toLowerCase()]};base64,${data}" class="img-fluid" alt="${alt}"${keep ? ` style="${keep}"` : ''}>`;
  }
);

// Inline any other image the source points at in its private images folder, e.g. src="images/screens/screen-01.webp".
// Each file is embedded once, as a blob URL that every img pointing at it shares.
const shared = new Map();
html = html.replace(/src="(images\/[^"]+)"/g, (attr, rel) => {
  const path = join(dir, rel);
  if (!existsSync(path)) {
    console.warn(`Missing ${path}`);
    return attr;
  }
  if (!shared.has(rel)) shared.set(rel, `data:${types[extname(path).toLowerCase()]};base64,${readFileSync(path).toString('base64')}`);
  return `data-private-src="${rel}"`;
});
if (shared.size) {
  inlined += shared.size;
  const loader = `<script>
      (function () {
        const files = ${JSON.stringify(Object.fromEntries(shared))};
        const urls = {};
        for (const [name, data] of Object.entries(files)) {
          const [meta, b64] = data.split(',');
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          urls[name] = URL.createObjectURL(new Blob([bytes], { type: meta.slice(5, -7) }));
        }
        document.querySelectorAll('[data-private-src]').forEach((img) => { img.src = urls[img.dataset.privateSrc]; });
      })();
    </script>
`;
  html = html.replace('</body>', `    ${loader}  </body>`);
}

const salt = randomBytes(16);
const iv = randomBytes(12);
const iterations = 600000;
const key = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const payload = Buffer.concat([cipher.update(html, 'utf8'), cipher.final(), cipher.getAuthTag()]);

const b64 = (b) => b.toString('base64');
const lock = readFileSync(join('tools', 'lock-template.html'), 'utf8')
  .replaceAll('{{TITLE}}', title)
  .replace('{{SALT}}', b64(salt))
  .replace('{{IV}}', b64(iv))
  .replace('{{ITERATIONS}}', String(iterations))
  .replace('{{PAYLOAD}}', b64(payload));

writeFileSync(`${page}.html`, lock);
console.log(`Wrote ${page}.html (${Math.round(lock.length / 1024)} KB, ${inlined} image(s) inlined)`);
