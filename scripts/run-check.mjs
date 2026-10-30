// scripts/run-check.mjs
//
// Reliable verification runner that does not depend on the shell's cwd or the
// PowerShell execution policy (npx.ps1 is blocked here). Spawns tsc / vitest /
// vite via node with absolute paths and writes results to an absolute log.
//
// Usage: node scripts/run-check.mjs <tsc|vitest|build>

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NODE = process.execPath;

const which = process.argv[2];

const TASKS = {
  tsc: { bin: join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), args: ['--noEmit'], log: 'check-tsc.log' },
  vitest: { bin: join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), args: ['run', '--config', 'vitest.config.ts'], log: 'check-vitest.log' },
  build: { bin: join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), args: ['build'], log: 'check-build.log' },
};

const task = TASKS[which];
if (!task) {
  console.error(`unknown task: ${which}. use tsc | vitest | build`);
  process.exit(2);
}

const logPath = join(ROOT, task.log);
let out = `$ node ${task.bin} ${task.args.join(' ')}\n\n`;
let exit = 1;
try {
  const res = spawnSync(NODE, [task.bin, ...task.args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) out += `SPAWN ERROR: ${res.error.stack ?? res.error.message}\n`;
  out += (res.stdout ?? '') + '\n' + (res.stderr ?? '');
  exit = res.status ?? 1;
} catch (err) {
  out += `THROWN: ${err?.stack ?? String(err)}\n`;
}
out += `\n\nEXIT=${exit}\n`;
writeFileSync(logPath, out, 'utf8');
console.log(`wrote ${logPath} exit=${exit}`);
process.exit(exit);
