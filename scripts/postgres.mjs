import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';
import { setTimeout as delay } from 'node:timers/promises';
import { stopOwnedPostgres } from './postgres-control.mjs';

dotenv.config({ path: 'apps/api/.env', quiet: true });
if (process.env.NODE_ENV === 'production') throw new Error('Portable runner is for local development only.');
if (!process.env.DATABASE_URL) throw new Error('Run npm run demo:configure first.');
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1') throw new Error('Portable runner requires a loopback DATABASE_URL.');
const directory = resolve('.local/postgres');
if (process.argv[2] === '--stop-owned') {
  try { await stopOwnedPostgres(Number(process.argv[3]), directory); process.exit(0); }
  catch { console.error('PostgreSQL ownership check or graceful cleanup failed. No unrelated process was targeted.'); process.exit(1); }
}
const desktop = process.env.PHARMADESK_DESKTOP === '1';
if (desktop && !existsSync(resolve(directory, 'PG_VERSION'))) {
  throw new Error('Complete the local database setup before launching desktop mode.');
}
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  port: Number(url.port || '55432'), persistent: true, authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {},
});
let ownedPostmaster;
// Report the native child as soon as the wrapper spawns it, including during
// startup, so Electron can recover gracefully if this Node runner itself dies.
Object.defineProperty(pg, 'process', {
  get: () => ownedPostmaster,
  set: child => {
    ownedPostmaster = child;
    if (child?.pid && process.connected) process.send?.({ type: 'postgres-process', pid: child.pid });
  },
});
let stopping = false;
let startup;
let keepAlive;
// embedded-postgres 17.11's default Windows stop uses taskkill /F. Replace only
// its stop hook with pg_ctl fast shutdown (finish rollback/checkpoint, retain data).
// process is the wrapper's owned ChildProcess; never infer ownership from a pid file.
pg.stop = async () => {
  const owned = pg.process;
  if (!owned || owned.exitCode !== null || owned.signalCode !== null) return;
  const exited = new Promise(resolve => owned.once('exit', resolve));
  await stopOwnedPostgres(owned.pid, directory);
  await Promise.race([exited, delay(2_000)]);
  pg.process = undefined;
};
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(keepAlive);
  await startup?.catch(() => {});
  try { await pg.stop(); }
  catch { console.error('PostgreSQL could not shut down gracefully. Data files were preserved.'); code = 1; }
  process.exit(code);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
process.on('disconnect', () => void stop());
process.on('message', message => { if (message?.type === 'shutdown') void stop(); });
startup = (async () => {
try {
  if (!existsSync(resolve(directory, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  pg.process.once('exit', () => { if (!stopping) void stop(1); });
  const client = pg.getPgClient(desktop ? url.pathname.slice(1) : 'postgres', '127.0.0.1');
  await client.connect();
  await client.query('SELECT 1');
  for (const connection of desktop ? [] : [process.env.DATABASE_URL, process.env.TEST_DATABASE_URL].filter(Boolean)) {
    const name = new URL(connection).pathname.slice(1);
    if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Invalid local database name.');
    const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (found.rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  }
  await client.end();
  if (stopping) return;
  console.log(`Persistent PostgreSQL 17 is ready on 127.0.0.1:${url.port}. Keep this terminal open; Ctrl+C stops it without deleting data.`);
  if (process.connected) process.send?.({ type: 'ready' });
  keepAlive = setInterval(() => {}, 60_000);
} catch {
  console.error('Local PostgreSQL could not start. Check port availability and .local/postgres permissions. No data was deleted.');
  // Let startup settle before cooperative cleanup; avoid waiting on ourselves.
  setImmediate(() => void stop(1));
}
})();
