import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron } from '@playwright/test';
import dotenv from 'dotenv';
import { verifiedDesktopNode } from './desktop-runtime.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const apiRequire = createRequire(resolve(root, 'apps/api/package.json'));
const { requireFreePorts, waitFor } = require('../apps/desktop/dist/lifecycle.js');
const { systemEnvironment, readConfiguration } = require('../apps/desktop/dist/config.js');
const config = readConfiguration(root);
const ports = [config.databasePort, config.apiPort, 3000];
const env = { ...systemEnvironment(process.env), PHARMADESK_NODE: verifiedDesktopNode(), PHARMADESK_LIFECYCLE_TEST: '1' };
const executablePath = require('electron');
const mainPath = resolve(root, 'apps/desktop/dist/main.js');
const checks = [];
const initialEnvironment = createHash('sha256').update(readFileSync(resolve(root, 'apps/api/.env'))).digest('hex');
let active;
let baseline;

async function launch() {
  const electron = await _electron.launch({ executablePath, args: [resolve(root, 'apps/desktop')], cwd: root, env, timeout: 180_000 });
  active = electron;
  return electron;
}
async function closed(electron, trigger) {
  const exited = once(electron.process(), 'exit');
  await trigger();
  const [code] = await Promise.race([exited, delay(100_000, undefined, { ref: false }).then(() => { throw new Error('Desktop did not exit after shutdown.'); })]);
  active = undefined;
  await requireFreePorts(ports);
  return code;
}
async function snapshot() {
  const { PrismaClient } = apiRequire('@prisma/client');
  const local = dotenv.parse(readFileSync(resolve(root, 'apps/api/.env')));
  const client = new PrismaClient({ datasources: { db: { url: local.DATABASE_URL } } });
  try {
    // Read-only fingerprints include every record, not just counts. Values stay private.
    const tables = await client.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const hash = createHash('sha256');
    for (const { tablename } of tables) {
      assert.match(tablename, /^[a-zA-Z0-9_]+$/);
      const records = await client.$queryRawUnsafe(`SELECT row_to_json(t)::text AS row FROM "${tablename}" t ORDER BY row_to_json(t)::text`);
      hash.update(tablename).update(JSON.stringify(records));
    }
    return hash.digest('hex');
  } finally { await client.$disconnect(); }
}

try {
  await requireFreePorts(ports);
  // Leave an unrelated Node TCP listener running throughout successful lifecycles.
  const sentinel = createServer(); sentinel.listen(0, '127.0.0.1'); await once(sentinel, 'listening');
  try {
    let electron = await launch();
    let page = await electron.firstWindow({ timeout: 180_000 });
    await page.waitForURL('**/login', { timeout: 30_000 });
    await page.getByRole('button', { name: /sign in/i }).waitFor();
    const info = await electron.evaluate(({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0];
      const prefs = view.webContents.getLastWebPreferences();
      return { title: view.getTitle(), isolated: prefs.contextIsolation, node: prefs.nodeIntegration, sandbox: prefs.sandbox, preload: prefs.preload };
    });
    assert.match(info.title, /PharmaDesk/); assert.equal(info.isolated, true);
    assert.equal(info.node, false); assert.equal(info.sandbox, true); assert(!info.preload);
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
    baseline = await snapshot();
    checks.push('Ordered PostgreSQL/API/frontend readiness and secured login window');

    // The second instance must exit while the first instance and services remain live.
    const { spawn } = await import('node:child_process');
    const second = spawn(executablePath, [resolve(root, 'apps/desktop')], { cwd: root, env, windowsHide: true, stdio: 'ignore' });
    const [secondCode] = await once(second, 'exit');
    assert.equal(secondCode, 0);
    assert.equal((await fetch('http://127.0.0.1:3001/health')).status, 200);
    checks.push('Second Electron instance prevented from starting services');
    assert.equal(await closed(electron, () => page.close()), 0);
    assert.equal(sentinel.listening, true);
    checks.push('Window close stops owned services and leaves unrelated listener alive');

    for (const reason of ['application-quit', 'SIGINT', 'api', 'web', 'database']) {
      electron = await launch();
      page = await electron.firstWindow({ timeout: 180_000 });
      await page.waitForURL('**/login');
      assert.equal(await snapshot(), baseline);
      const code = await closed(electron, async () => {
        await electron.evaluate(({ app }, { reason, mainPath }) => {
          if (reason === 'application-quit') { app.quit(); return; }
          if (reason === 'SIGINT') { process.emit('SIGINT'); return; }
          const { services } = require(mainPath);
          const index = { database: 0, api: 1, web: 2 }[reason];
          services.services[index].child.kill(); // Only this instance's recorded child.
        }, { reason, mainPath });
      });
      assert.equal(code, ['application-quit', 'SIGINT'].includes(reason) ? 0 : 1);
      assert.equal(sentinel.listening, true);
      checks.push(`${reason}: all owned ports released; unrelated listener preserved`);
    }

    // Startup conflict before any database child exists.
    const blocker = createServer(); blocker.listen(3000, '127.0.0.1'); await once(blocker, 'listening');
    try {
      const failed = spawn(executablePath, [resolve(root, 'apps/desktop')], { cwd: root, env, windowsHide: true, stdio: 'ignore' });
      const [code] = await once(failed, 'exit');
      assert.equal(code, 1); assert.equal(blocker.listening, true);
      await requireFreePorts([config.databasePort, config.apiPort]);
      checks.push('Occupied frontend port fails safely without starting PostgreSQL or stopping its owner');
    } finally { blocker.close(); }

    // Final restart verifies persistence after normal and unexpected exits.
    electron = await launch(); await electron.firstWindow({ timeout: 180_000 });
    assert.equal(await snapshot(), baseline);
    assert.equal(await closed(electron, () => electron.evaluate(({ app }) => app.quit())), 0);
    assert.equal(createHash('sha256').update(readFileSync(resolve(root, 'apps/api/.env'))).digest('hex'), initialEnvironment);
    checks.push('All database records and environment file unchanged across restarts');
  } finally { sentinel.close(); }
  console.log(checks.map(check => `PASS: ${check}`).join('\n'));
} catch (error) {
  // Never print configuration, renderer contents, or Playwright launch environment.
  console.error('Desktop lifecycle verification failed: ' + (error instanceof assert.AssertionError ? 'assertion mismatch' : 'startup, readiness or shutdown check failed'));
  if (active) await active.evaluate(({ app }) => app.quit()).catch(() => {});
  process.exitCode = 1;
}
