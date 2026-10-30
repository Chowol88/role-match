// scripts/smoke.mjs — hit the running dev server and record what it serves.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // accept the local mkcert cert

const BASE = 'https://localhost:5173';
const paths = ['/', '/sample-a-tailored-cv.docx', '/sample-b-tailored-cv.docx', '/sample-c-tailored-cv.docx'];
const lines = [];

for (const p of paths) {
  try {
    const res = await fetch(BASE + p);
    const buf = Buffer.from(await res.arrayBuffer());
    const sig = p.endsWith('.docx') ? buf.subarray(0, 2).toString('latin1') : '';
    lines.push(`${p}  ->  ${res.status} ${res.headers.get('content-type') ?? ''}  ${buf.length}B ${sig}`);
  } catch (e) {
    lines.push(`${p}  ->  ERROR ${e.message}`);
  }
}

const out = lines.join('\n') + '\n';
writeFileSync(join(ROOT, 'smoke.log'), out, 'utf8');
console.log(out);
