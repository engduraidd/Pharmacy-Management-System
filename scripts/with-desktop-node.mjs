import { spawn } from 'node:child_process';
import { isAbsolute, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { verifiedDesktopNode, runtimeEnvironment, root } from './desktop-runtime.mjs';

const [command, ...args] = process.argv.slice(2);
const node = verifiedDesktopNode();
let target;
if (command === 'node') target = args;
else if (command === 'npm') {
  // npm run supplies its existing CLI path: reuse npm, do not install a global copy.
  const cli = process.env.npm_execpath;
  if (!cli || !isAbsolute(cli) || basename(cli) !== 'npm-cli.js' || !existsSync(cli)) {
    throw new Error('Use npm run desktop:npm -- <arguments> to locate the existing npm CLI safely.');
  }
  target = [cli, ...args];
} else throw new Error('Choose node or npm for the pinned runtime.');
const child = spawn(node, target, { cwd: root, env: runtimeEnvironment(), windowsHide: true,
  stdio: command === 'node' ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit' });
function interrupt() { if (child.connected) child.send({ type: 'shutdown' }, () => {}); }
// Direct desktop launchers receive cooperative interrupts; npm console tools
// retain their ordinary console handling. Never force-kill the invoked tool.
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);
process.on('message', message => { if (message?.type === 'shutdown') interrupt(); });
process.on('disconnect', interrupt);
child.once('error', () => { console.error('Project-local runtime command could not start.'); process.exitCode = 1; });
child.once('exit', code => {
  process.exitCode = code ?? 1;
  if (process.connected) process.disconnect();
});
