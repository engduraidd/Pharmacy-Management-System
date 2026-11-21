import { resolve } from 'node:path';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';

// This file runs in system Node.js, not in Electron or the renderer.
const role = process.argv[2];
const root = resolve(__dirname, '../../..');
let cleanup: (() => Promise<void>) | undefined;
let stopping = false;
let startup: Promise<void>;

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  await startup.catch(() => {});
  try { await cleanup?.(); } catch { code = 1; }
  process.exit(code);
}
process.on('message', message => {
  if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'shutdown') void shutdown();
});
process.on('disconnect', () => void shutdown());
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
process.on('uncaughtException', () => void shutdown(1));
process.on('unhandledRejection', () => void shutdown(1));

async function start() {
  if (role === 'api') {
    const { createApplication } = require(resolve(root, 'apps/api/dist/application.js')) as {
      createApplication(): Promise<import('@nestjs/common').INestApplication>;
    };
    const app = await createApplication();
    cleanup = () => app.close();
    await app.listen(Number(process.env.PORT || 3001), '127.0.0.1');
  } else if (role === 'web') {
    const webRequire = createRequire(resolve(root, 'apps/web/package.json'));
    const next = webRequire('next') as typeof import('next').default;
    let server: Server | undefined;
    const app = next({ dev: true, dir: resolve(root, 'apps/web'), hostname: '127.0.0.1', port: 3000 });
    cleanup = async () => {
      if (server?.listening) {
        const closed = new Promise<void>(resolve => server!.close(() => resolve()));
        server.closeAllConnections(); // Only this service's HTTP sockets.
        await closed;
      }
      await app.close();
    };
    await app.prepare();
    const handler = app.getRequestHandler();
    server = createServer((req, res) => { void handler(req, res); });
    server.on('upgrade', app.getUpgradeHandler());
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(3000, '127.0.0.1', resolve);
    });
  } else throw new Error('Unknown desktop service.');
  if (process.connected && !stopping) process.send?.({ type: 'ready' });
}
startup = start();
void startup.catch(() => shutdown(1));
