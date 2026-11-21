import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

export async function requireFreePorts(ports: number[]): Promise<void> {
  for (const port of ports) {
    await new Promise<void>((resolve, reject) => {
      const server = createServer();
      server.once('error', () => reject(new Error(`Port ${port} is unavailable. Stop its service in the original terminal before launching PharmaDesk. No existing process was stopped.`)));
      server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(() => resolve()));
    });
  }
}

export async function waitFor(check: () => Promise<boolean>, signal: AbortSignal, timeout = 120_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    if (await check()) { signal.throwIfAborted(); return; }
    await delay(200, undefined, { signal });
  }
  throw new Error('Service readiness timed out. Check local configuration and finish the manual database setup.');
}

export async function responds(url: string, health = false): Promise<boolean> {
  try {
    const result = await fetch(url, { signal: AbortSignal.timeout(2_000), redirect: 'manual' });
    if (health) return result.ok && (await result.json() as { status?: string }).status === 'ok';
    return result.ok || [301, 302, 303, 307, 308].includes(result.status);
  } catch { return false; }
}

export interface ServiceSpec { name: string; executable: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }

export class OwnedService {
  readonly child: ChildProcess;
  readonly exited: Promise<void>;
  ready = false;
  postgresPid?: number;
  stopping = false;
  private exitObserved = false;

  constructor(readonly spec: ServiceSpec, unexpected: (name: string) => void) {
    // No shell/npm intermediary: the IPC channel goes directly to the owned Node worker.
    this.child = spawn(spec.executable, spec.args, {
      cwd: spec.cwd, env: spec.env, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    this.child.on('message', message => {
      if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'ready') this.ready = true;
      if (spec.name === 'PostgreSQL' && typeof message === 'object' && message !== null &&
          'type' in message && message.type === 'postgres-process' && 'pid' in message &&
          typeof message.pid === 'number' && Number.isSafeInteger(message.pid) && message.pid > 0) this.postgresPid = message.pid;
    });
    this.exited = new Promise(resolve => {
      const finish = () => {
        if (this.exitObserved) return;
        this.exitObserved = true;
        resolve();
        if (!this.stopping) unexpected(spec.name);
      };
      this.child.once('exit', finish);
      this.child.once('error', finish);
    });
  }

  async stop(graceMs = 30_000): Promise<boolean> {
    this.stopping = true;
    if (this.exitObserved) return true;
    if (this.child.connected) this.child.send({ type: 'shutdown' }, () => {});
    const graceful = await Promise.race([this.exited.then(() => true), delay(graceMs, undefined, { ref: false }).then(() => false)]);
    if (graceful) return true;
    // Last resort for a hung *owned and still-live* child; never kill by image name.
    const pid = this.child.pid;
    if (!this.exitObserved && pid) {
      if (process.platform === 'win32') {
        await new Promise<void>(resolve => {
          const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5_000 });
          killer.once('error', () => resolve()); killer.once('exit', () => resolve());
        });
      } else this.child.kill('SIGKILL');
    }
    await Promise.race([this.exited, delay(5_000, undefined, { ref: false })]);
    return false;
  }
}

export class ServiceGroup {
  readonly services: OwnedService[] = [];
  readonly abort = new AbortController();
  private stopping?: Promise<boolean>;
  constructor(private readonly unexpected: (name: string) => void) {}
  start(spec: ServiceSpec): OwnedService {
    this.abort.signal.throwIfAborted();
    const service = new OwnedService(spec, name => {
      this.abort.abort(); this.unexpected(name);
    });
    this.services.push(service);
    return service;
  }
  stop(): Promise<boolean> {
    if (!this.stopping) {
      this.abort.abort();
      // Mark all first, so normal shutdown is never mistaken for a failure.
      for (const service of this.services) service.stopping = true;
      this.stopping = (async () => {
        let graceful = true;
        for (const service of [...this.services].reverse()) graceful = await service.stop() && graceful;
        return graceful;
      })();
    }
    return this.stopping;
  }
}
