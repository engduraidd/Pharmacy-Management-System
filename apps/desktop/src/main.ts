import { app, BrowserWindow, dialog, nativeImage, session } from 'electron';
import { resolve, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { readConfiguration, WEB_URL } from './config';
import { ServiceGroup, requireFreePorts, responds, waitFor } from './lifecycle';

const root = resolve(__dirname, '../../..');
app.setName('PharmaDesk');
app.setPath('userData', resolve(root, '.local/desktop'));
app.setAppUserModelId('org.pharmadesk.development');
let window: BrowserWindow | undefined;
let exiting = false;
let finished = false;
let exitCode = 0;
export const services = new ServiceGroup(name => void fail(`${name} stopped unexpectedly. PharmaDesk will stop its remaining services.`));

function notify(type: string) {
  if (process.connected) process.send?.({ type }, () => {});
}
async function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  exitCode = code;
  console.log('[PharmaDesk] Stopping owned services...');
  const graceful = await services.stop();
  // A killed Node runner cannot execute its own pg_ctl cleanup. Recover only the
  // native postmaster PID it reported from its own spawn; the runner verifies it.
  const database = services.services.find(service => service.spec.name === 'PostgreSQL');
  let databaseClean = true;
  if (database?.postgresPid) {
    databaseClean = await new Promise<boolean>(resolve => {
      const control = spawn(database.spec.executable, [database.spec.args[0]!, '--stop-owned', String(database.postgresPid)], {
        cwd: root, env: database.spec.env, windowsHide: true, stdio: 'ignore',
      });
      control.once('error', () => resolve(false)); control.once('exit', code => resolve(code === 0));
    });
  }
  if (!graceful || !databaseClean) {
    exitCode = 1;
    console.error('[PharmaDesk] A service required forced shutdown. Data files were retained; check the database on next startup.');
  }
  console.log('[PharmaDesk] Owned services stopped.');
  notify('stopped');
  finished = true;
  app.exit(exitCode);
}
async function fail(message: string) {
  if (exiting) return;
  console.error(`[PharmaDesk] ${message}`);
  // Dialogs are asynchronous so Ctrl+C/shutdown stays responsive during a failure.
  if (app.isReady() && !process.env.PHARMADESK_LIFECYCLE_TEST) {
    void dialog.showMessageBox({ type: 'error', title: 'PharmaDesk could not continue', message });
  }
  notify('failed');
  await shutdown(1);
}

function installWindow() {
  const icon = nativeImage.createFromPath(resolve(root, 'apps/desktop/assets/icon.png'));
  window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 900, minHeight: 640, show: false,
    title: 'PharmaDesk — Pharmacy Management', icon, backgroundColor: '#f3f7f5', autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      allowRunningInsecureContent: false, webviewTag: false,
    },
  });
  window.removeMenu();
  window.on('page-title-updated', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const allowed = (url: string) => { try { return new URL(url).origin === WEB_URL; } catch { return false; } };
  window.webContents.on('will-navigate', (event, url) => { if (!allowed(url)) event.preventDefault(); });
  window.webContents.on('will-redirect', (event, url) => { if (!allowed(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('render-process-gone', () => void fail('The application view stopped unexpectedly. Please restart PharmaDesk.'));
  window.on('unresponsive', () => void fail('The application view is unresponsive. Please restart PharmaDesk.'));
  window.on('closed', () => { window = undefined; void shutdown(); });
  return window;
}

async function start() {
  const config = readConfiguration(root);
  const node = process.env.PHARMADESK_NODE;
  if (!node || !isAbsolute(node) || !existsSync(node)) throw new Error('Launch PharmaDesk with npm run dev:desktop so its Node.js runtime can be located.');
  await requireFreePorts([config.databasePort, config.apiPort, 3000]);
  const worker = resolve(__dirname, 'service-worker.js');
  console.log('[PharmaDesk] Starting PostgreSQL...');
  const database = services.start({ name: 'PostgreSQL', executable: node, args: [resolve(root, 'scripts/postgres.mjs')], cwd: root, env: config.databaseEnvironment });
  // PostgreSQL runner sends ready only after an authenticated SELECT 1 succeeds.
  await waitFor(async () => database.ready, services.abort.signal, 45_000);
  console.log('[PharmaDesk] PostgreSQL ready. Starting API...');
  const api = services.start({ name: 'API', executable: node, args: [worker, 'api'], cwd: resolve(root, 'apps/api'), env: config.apiEnvironment });
  await waitFor(async () => api.ready && await responds(`http://127.0.0.1:${config.apiPort}/health`, true), services.abort.signal);
  console.log('[PharmaDesk] API healthy. Starting frontend...');
  const web = services.start({ name: 'Frontend', executable: node, args: [worker, 'web'], cwd: resolve(root, 'apps/web'), env: config.webEnvironment });
  await waitFor(async () => web.ready && await responds(`${WEB_URL}/login`), services.abort.signal);
  services.abort.signal.throwIfAborted();
  console.log('[PharmaDesk] Frontend ready. Opening desktop...');
  const view = installWindow();
  await view.loadURL(WEB_URL);
  if (!exiting) { view.show(); notify('ready'); }
}

if (!app.requestSingleInstanceLock()) {
  console.log('[PharmaDesk] Another instance is already running.');
  app.exit(0);
} else {
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.focus(); });
  app.on('before-quit', event => { if (!finished) { event.preventDefault(); void shutdown(); } });
  app.on('window-all-closed', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
  process.on('message', message => {
    if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'shutdown') void shutdown();
  });
  process.on('disconnect', () => void shutdown());
  process.on('uncaughtException', () => void fail('An unexpected desktop error occurred. Please restart PharmaDesk.'));
  process.on('unhandledRejection', () => void fail('An unexpected desktop error occurred. Please restart PharmaDesk.'));
  void app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    await start();
  }).catch(error => {
    if (!exiting) void fail(error instanceof Error && /^(Port |Missing |Invalid |Desktop |The local |Launch |Service readiness)/.test(error.message)
      ? error.message : 'Startup failed. Check local setup and port availability. No database reset or migration was attempted.');
  });
}
