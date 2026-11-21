import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifiedDesktopNode, runtimeEnvironment } from './desktop-runtime.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...runtimeEnvironment(), PHARMADESK_NODE: verifiedDesktopNode() };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
const child = spawn(require('electron'), [resolve(root, 'apps/desktop')], {
  cwd: root, env, windowsHide: true, stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  if (child.connected) child.send({ type: 'shutdown' }, () => {});
}
// Windows does not deliver POSIX signals to child processes reliably: use IPC.
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('message', message => { if (message?.type === 'shutdown') stop(); });
process.on('disconnect', stop);
child.on('error', () => { console.error('PharmaDesk could not launch. Check the local Electron installation.'); process.exitCode = 1; });
child.on('exit', code => {
  process.exitCode = code ?? 1;
  if (process.connected) process.disconnect();
});
