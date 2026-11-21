import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { ServiceGroup, requireFreePorts, waitFor } from '../lifecycle';
import { systemEnvironment } from '../config';

test('service environment excludes credentials and Node injection settings', () => {
  assert.deepEqual(systemEnvironment({ Path: 'os-path', SystemRoot: 'windows', DATABASE_URL: 'private', SEED_OWNER_PASSWORD: 'private', NODE_OPTIONS: '--inspect', ELECTRON_RUN_AS_NODE: '1' }), { Path: 'os-path', SystemRoot: 'windows', NODE_ENV: 'development' });
});

test('desktop runtime is pinned and isolated from the system runtime and PATH', async () => {
  const script = pathToFileURL(resolve(__dirname, '../../../../scripts/desktop-runtime.mjs')).href;
  const { verifiedDesktopNode, runtimeEnvironment, runtime } = await import(script);
  const before = process.env.Path ?? process.env.PATH;
  const node = verifiedDesktopNode();
  assert.equal(runtime.version, '22.23.5');
  assert.equal(execFileSync(node, ['--version'], { encoding: 'utf8', windowsHide: true }).trim(), 'v22.23.5');
  const env = runtimeEnvironment({ Path: 'original-path', NODE_OPTIONS: 'private', NODE_PATH: 'private', ELECTRON_RUN_AS_NODE: '1' });
  assert.match(env.Path, /\.local[\\/]runtimes[\\/]node-v22\.23\.5-win-x64/);
  assert(env.Path.endsWith(';original-path'));
  assert.equal(env.NODE_OPTIONS, undefined); assert.equal(env.NODE_PATH, undefined); assert.equal(env.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(process.env.Path ?? process.env.PATH, before);
});

test('local runtime bridge forwards shutdown and exits when its owned tool exits', async () => {
  const script = resolve(__dirname, '../../../../scripts/with-desktop-node.mjs');
  const child = spawn(process.execPath, [script, 'node', '-e',
    "console.log('desktop-interrupt-ready');process.on('message',m=>{if(m.type==='shutdown')process.exit(0)});"],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore', 'ipc'] });
  const exited = once(child, 'exit');
  try {
    let ready = false;
    child.stdout!.on('data', data => { if (data.toString().includes('desktop-interrupt-ready')) ready = true; });
    await waitFor(async () => ready, new AbortController().signal, 10_000);
    child.send({ type: 'shutdown' });
    const result = await Promise.race([exited, new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error('Runtime bridge did not exit')), 10_000).unref();
    })]);
    assert.equal(result[0], 0);
  } finally { if (child.connected) child.disconnect(); }
});

test('occupied port is rejected without closing its unrelated listener', async () => {
  const server = createServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert(address && typeof address === 'object');
  try {
    await assert.rejects(requireFreePorts([address.port]), /No existing process was stopped/);
    assert.equal(server.listening, true);
  } finally { server.close(); }
});

test('readiness polls actual state, times out and supports cancellation', async () => {
  let checks = 0;
  await waitFor(async () => ++checks === 2, new AbortController().signal, 2_000);
  assert.equal(checks, 2);
  await assert.rejects(waitFor(async () => false, new AbortController().signal, 20), /timed out/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(waitFor(async () => true, abort.signal), /aborted/i);
});

test('owned workers shut down cooperatively in reverse order; repeated stop is safe', async () => {
  const group = new ServiceGroup(() => assert.fail('Unexpected exit'));
  const code = "process.send({type:'ready'});process.on('message',m=>{if(m.type==='shutdown')process.exit(0)});";
  const first = group.start({ name: 'first', executable: process.execPath, args: ['-e', code], cwd: process.cwd(), env: systemEnvironment(process.env) });
  const second = group.start({ name: 'second', executable: process.execPath, args: ['-e', code], cwd: process.cwd(), env: systemEnvironment(process.env) });
  const exited: string[] = [];
  first.child.on('exit', () => exited.push('first')); second.child.on('exit', () => exited.push('second'));
  try {
    await waitFor(async () => first.ready && second.ready, group.abort.signal, 5_000);
    assert.equal(await group.stop(), true);
    assert.equal(await group.stop(), true);
    assert.deepEqual(exited, ['second', 'first']);
  } finally { await group.stop(); }
});

test('unexpected owned worker termination aborts startup and cleans remaining children', async () => {
  let name = '';
  const group = new ServiceGroup(value => { name = value; });
  group.start({ name: 'failed-api', executable: process.execPath, args: ['-e', 'process.exit(2)'], cwd: process.cwd(), env: systemEnvironment(process.env) });
  await waitFor(async () => name !== '', new AbortController().signal, 5_000);
  assert.equal(name, 'failed-api'); assert.equal(group.abort.signal.aborted, true);
  assert.equal(await group.stop(), true);
});

test('hung worker fallback targets only the recorded owned child', async () => {
  const group = new ServiceGroup(() => assert.fail('Stop was classified as unexpected'));
  const service = group.start({ name: 'hung-test', executable: process.execPath,
    args: ['-e', "process.send({type:'ready'});process.on('message',()=>{});"], cwd: process.cwd(), env: systemEnvironment(process.env) });
  try {
    await waitFor(async () => service.ready, group.abort.signal, 5_000);
    assert.equal(await service.stop(50), false);
    assert.notEqual(service.child.exitCode === null && service.child.signalCode === null, true);
  } finally { await group.stop(); }
});

test('PostgreSQL recovery refuses a PID that is not its recorded postmaster', async () => {
  const script = pathToFileURL(resolve(__dirname, '../../../../scripts/postgres-control.mjs')).href;
  const { stopOwnedPostgres } = await import(script) as { stopOwnedPostgres(pid: number, directory: string): Promise<void> };
  const directory = mkdtempSync(join(tmpdir(), 'pharmadesk-ownership-'));
  const file = join(directory, 'postmaster.pid');
  writeFileSync(file, '12345\n');
  try { await assert.rejects(stopOwnedPostgres(54321, directory), /ownership could not be verified/); }
  finally { unlinkSync(file); rmdirSync(directory); }
});
