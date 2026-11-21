import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

/** Stop only the postmaster PID recorded from our own spawned ChildProcess. */
export async function stopOwnedPostgres(pid, directory = resolve('.local/postgres')) {
  const pidFile = resolve(directory, 'postmaster.pid');
  if (!existsSync(pidFile)) return;
  if (!Number.isSafeInteger(pid) || pid <= 0 || Number(readFileSync(pidFile, 'utf8').split(/\r?\n/)[0]) !== pid) {
    throw new Error('PostgreSQL ownership could not be verified. No process was stopped.');
  }
  const binaries = await import(`@embedded-postgres/${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`);
  await new Promise((resolve, reject) => {
    const control = spawn(binaries.pg_ctl, ['-D', directory, '-m', 'fast', '-w', '-t', '20', 'stop'], {
      windowsHide: true, stdio: 'ignore',
    });
    control.once('error', () => reject(new Error('PostgreSQL control could not start.')));
    control.once('exit', code => code === 0 ? resolve() : reject(new Error('PostgreSQL graceful shutdown failed.')));
  });
}
