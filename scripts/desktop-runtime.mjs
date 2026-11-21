import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const runtime = JSON.parse(readFileSync(new URL('./desktop-runtime.json', import.meta.url), 'utf8'));
export const executable = resolve(root, `.local/runtimes/node-v${runtime.version}-win-x64/node.exe`);

export function verifiedDesktopNode() {
  if (process.platform !== runtime.platform || process.arch !== runtime.arch) {
    throw new Error('The pinned desktop runtime currently supports Windows x64 only.');
  }
  if (!existsSync(executable)) throw new Error('Run npm run desktop:setup to install the project-local desktop runtime.');
  const digest = createHash('sha256').update(readFileSync(executable)).digest('hex');
  if (digest !== runtime.sha256) throw new Error('Local desktop runtime checksum mismatch. No unverified executable was run.');
  if (execFileSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true, env: runtimeEnvironment() }).trim() !== `v${runtime.version}`) {
    throw new Error('Local desktop runtime version mismatch.');
  }
  return executable;
}

export function runtimeEnvironment(source = process.env) {
  const env = { ...source };
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = `${dirname(executable)};${env[pathKey] || ''}`;
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}
