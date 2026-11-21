import { mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { runtime, executable, verifiedDesktopNode } from './desktop-runtime.mjs';

if (process.platform !== runtime.platform || process.arch !== runtime.arch) {
  throw new Error('Desktop runtime setup currently supports Windows x64 only.');
}
if (existsSync(executable)) {
  verifiedDesktopNode();
  console.log(`Verified existing project-local Node.js ${runtime.version}. System Node.js unchanged.`);
} else {
  const response = await fetch(runtime.url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error('Official Node.js runtime download failed.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== runtime.sha256) {
    throw new Error('Official runtime download did not match the pinned SHA-256 checksum.');
  }
  await mkdir(dirname(executable), { recursive: true });
  const temporary = `${executable}.${randomUUID()}.download`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    // Only a new local runtime is installed; existing runtime files are never replaced.
    if (existsSync(executable)) throw new Error('Runtime appeared during setup; rerun to verify it.');
    await rename(temporary, executable);
  } finally { await unlink(temporary).catch(() => {}); }
  verifiedDesktopNode();
  console.log(`Installed verified project-local Node.js ${runtime.version}. System Node.js unchanged.`);
}
