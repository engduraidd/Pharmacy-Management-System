# PharmaDesk Windows desktop integration

## Current verification status

The desktop implementation is present, but **full lifecycle acceptance remains
blocked**. Do not treat this document as a completed desktop release sign-off.

- Nine desktop unit tests passed. They cover
  environment filtering, occupied-port refusal, readiness polling/cancellation,
  cooperative reverse shutdown, unexpected worker exit, a hung owned worker's
  PID-scoped fallback, PostgreSQL ownership rejection, the pinned local runtime,
  and the local runtime wrapper's cooperative shutdown/exit behavior.
- A real Electron launch detected the already-occupied PostgreSQL port, reported
  failure through IPC, and exited with code 1 without stopping existing services.
- The first sandboxed hung-worker test could not terminate its test-owned process;
  the same suite passed when run with the required Windows process permissions.
- Complete PostgreSQL/API/Next.js/window startup and shutdown are not yet claimed:
  browser-mode services occupy ports 55432, 3001 and 3000. The user has been asked
  to stop them in their original terminals; no unrelated process was terminated.
- The approved runtime update is complete: project-local **Node.js 22.23.5** and
  **Electron 45.3.2**, pinned exactly. System Node.js remains **20.16.0**. The runtime
  approval blocker is resolved; the occupied-port lifecycle blocker remains.
- Final `npm run desktop:npm -- audit --json` reports **0 known vulnerabilities**
  at verification on 2026-11-14. No database-writing integration suite, migrations
  or seed commands were run for this runtime update.

| Runtime-update check | Actual result |
|---|---|
| `npm run desktop:setup` | Passed; repeated run verifies/reuses local Node, installs dependencies and explicitly prepares the Electron binary. |
| `npm run desktop:node` | `v22.23.5`. |
| System `node --version` | Remains `v20.16.0`. |
| `npm test` under system Node 20 | Application 7/7 and the then-current desktop 8/8 passed. |
| Final `npm run test:desktop` | Desktop 9/9 passed after adding the runtime bridge regression test. |
| `npm run desktop:npm -- run test --workspace @pharmacy/api` | Application 7/7 passed under pinned Node 22. |
| `npm run build` under system Node 20 | Shared package, API and optimized Next.js build passed. |
| `npm run typecheck` | All workspaces passed. |
| Node 22 + Prisma/PostgreSQL | Read-only `SELECT 1` passed; no database records changed. |
| Electron 45.3.2 launch | Reached the occupied-port guard and application cleanup, then exited with the expected code 1. |
| Full service/window lifecycle suite | Still blocked by existing service listeners; not claimed as executed successfully. |

## Pinned runtime and security review

The [runtime manifest](../scripts/desktop-runtime.json) pins the Windows x64
standalone Node.js executable, official download URL and SHA-256 digest. The digest
was checked against the [official Node.js checksum manifest](https://nodejs.org/dist/v22.23.5/SHASUMS256.txt).
[Setup](../scripts/setup-desktop-runtime.mjs) downloads the executable to ignored
`.local/runtimes/node-v22.23.5-win-x64/node.exe`; it does not run a system installer,
write registry settings, or alter permanent PATH. Both setup and launch verify its
checksum and exact reported version; an existing mismatched executable is refused.

Electron 45.3.2 was checked against the [official stable releases](https://releases.electronjs.org/?channel=stable)
and [security advisory index](https://github.com/electron/electron/security/advisories).
The old 41.7.1 tree reported high-severity Electron/extraction vulnerabilities.
The replacement uses current Electron and its maintained extraction dependency;
the final npm audit reports no known advisories. No security rules were suppressed,
`engine-strict` remains enabled, and no forced audit overrides were applied.

Review included the following upstream fixes, whose affected ranges exclude the
selected stable version:

- [Webview worker Node integration](https://github.com/electron/electron/security/advisories/GHSA-9qh4-3jw8-366w).
- [External URL permission attribution](https://github.com/electron/electron/security/advisories/GHSA-997q-gvvc-jwmx).
- [Compromised eMudhra certificate mitigation](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9).

An audit is a point-in-time dependency check, not a guarantee against every future
vulnerability. Future runtime/Electron updates must deliberately update pins,
checksums, the lockfile and verification evidence.

The root engine range accepts the existing Node.js 20 line and the pinned Node.js
22 line. `.nvmrc`, application source and TypeScript target are unchanged. The
desktop package requires Node.js 22.12+ for installation. Consequently a fresh
**whole-monorepo dependency installation must use the local runtime**, even when
the browser application itself is developed with Node.js 20. The existing npm 10
CLI is reused under local Node.js 22; no global npm or Node tools are installed.

Electron's bundled Node.js runs its main process separately from this pinned
service runtime. Renderer Node integration remains disabled.

## Architectural decisions

The desktop main process is a lifecycle host, not another business backend. The
existing UI, NestJS services, Prisma schema, migrations and pharmacy rules remain
unchanged. There is no renderer preload or Node/Electron bridge.

Startup is:

1. Acquire Electron's single-instance lock using a stable workspace-local user
   data path. A second instance focuses the first and exits without services.
2. Read local API configuration without logging it. Require an existing cluster,
   loopback database, distinct service ports and the existing web origin.
3. Verify all three ports are free. Never attach to, stop, or replace an existing
   listener, even if it appears to be a pharmacy development service.
4. Launch the existing PostgreSQL runner in desktop mode. It neither initializes
   a cluster nor creates databases in this mode. It sends readiness only after
   connecting to the configured database and executing authenticated `SELECT 1`.
5. Start the built API in a direct Node child and check its HTTP health response.
6. Start the existing Next.js app in a direct Node child and wait for the login
   page to respond. A desktop-only custom server provides an explicit close API;
   the normal Next.js CLI and browser development scripts are unchanged.
7. Open a titled, icon-equipped BrowserWindow at `http://127.0.0.1:3000`.

Services are direct children without npm/shell intermediaries. IPC requests
shutdown on Windows; signals are not assumed to propagate to child processes.
Workers also close themselves when their IPC parent disconnects. The Node launcher
forwards Ctrl+C to the Electron main process through IPC.

Shutdown stops web, API, then PostgreSQL. Next.js closes its own HTTP connections
and development resources; Nest closes its application/Prisma lifecycle. PostgreSQL
uses `pg_ctl -m fast -w`, which disconnects clients, rolls back active work and
checkpoints before exiting. This replaces the installed wrapper's forceful Windows
stop implementation while retaining its existing startup/data location.

The wrapper's pinned-version `process` property is used narrowly to record the
native child PID. If the Node PostgreSQL runner dies, Electron can still invoke
graceful cleanup for that recorded postmaster. The control helper verifies that
the cluster PID file matches the recorded child before stopping anything.
Future embedded-postgres upgrades must recheck this integration seam.

Each worker has a bounded shutdown period. Only a still-live recorded child may
receive a last-resort PID-scoped process-tree termination; image-name or global
Node termination is never used. Such a fallback is reported as a failure, not
called graceful shutdown. Unrecoverable OS termination/power loss cannot guarantee
cleanup; PostgreSQL recovery remains necessary after a hard crash.

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, web security
  enabled, no webviews and no preload/renderer Node API.
- New windows are denied. Navigation and redirects are restricted to the exact
  local web origin. Device/permission requests are denied.
- Service environment values are filtered. The frontend gets its server-only API
  address, not database or seed credentials. No child output/configuration is
  forwarded into startup errors or the renderer.
- No migrations, seed commands, database resets or environment rewrites execute
  during desktop startup.
- The existing loopback HTTP endpoints still exist while the application runs.
  Electron is a desktop host, not an additional authorization boundary; backend
  login and role checks remain essential.

These settings follow [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security).
The direct custom Next.js server follows the installed Next.js custom-server API.

## Commands and prerequisites

Complete the manual [README database setup](../README.md) first, including client
generation and intentional migrations/seeding when needed. Never run browser mode
and desktop mode simultaneously on the same ports/data directory.

```powershell
npm run desktop:setup
npm run desktop:node
npm run dev:desktop
npm run test:desktop
npm run test:desktop:lifecycle
```

`desktop:setup` verifies/downloads the pinned executable and runs dependency
installation under it. Later lockfile installs use `npm run desktop:npm -- ci`,
followed by `npm run desktop:electron:install` to prepare the binary for offline use;
audits use `npm run desktop:npm -- audit`. The launcher explicitly passes the
verified local runtime path to each desktop-owned service, even when launched
from a system Node.js 20 terminal. Browser development commands are unchanged.

Desktop development compiles the API before launch; API/main-process edits require
a restart. Next.js retains development rendering. It is not a packaged installer,
Windows service, auto-updater, production deployment, or Docker service manager.
Local Electron profile/cache files live under ignored `.local/desktop`; PostgreSQL
retains its existing ignored `.local/postgres` directory. Existing configuration
files are read, not replaced.

## Files added or modified

| File | Purpose |
|---|---|
| [Root package](../package.json), [lockfile](../package-lock.json) | Desktop commands, workspace registration through existing globs, dependency lock. |
| [Desktop package](../apps/desktop/package.json), [TypeScript config](../apps/desktop/tsconfig.json) | Dedicated Electron workspace and builds. |
| [Main process](../apps/desktop/src/main.ts) | Single instance, readiness sequence, secure window and shutdown orchestration. |
| [Configuration](../apps/desktop/src/config.ts) | Local settings validation and filtered child environments. |
| [Lifecycle](../apps/desktop/src/lifecycle.ts) | Owned processes, readiness polling, reverse cleanup and bounded fallback. |
| [Service worker](../apps/desktop/src/service-worker.ts) | Direct API/Next.js hosts with cooperative shutdown. |
| [Unit tests](../apps/desktop/src/test/lifecycle.test.ts) | Ownership, readiness and failure behavior. |
| [PNG icon](../apps/desktop/assets/icon.png), [SVG source](../apps/desktop/assets/icon.svg) | Local pharmacy-cross application artwork. |
| [Node launcher](../scripts/desktop.mjs) | Locate Node/Electron and forward terminal interrupts through IPC. |
| [Runtime manifest](../scripts/desktop-runtime.json), [runtime helper](../scripts/desktop-runtime.mjs) | Pin and verify the local executable and construct child-only PATH settings. |
| [Runtime setup](../scripts/setup-desktop-runtime.mjs), [local CLI wrapper](../scripts/with-desktop-node.mjs) | Download the checksum-pinned runtime; reuse the existing npm CLI under Node.js 22 without changing the system installation. |
| [PostgreSQL runner](../scripts/postgres.mjs) | Preserve browser mode; add desktop readiness, no-init mode and cooperative shutdown. |
| [PostgreSQL control](../scripts/postgres-control.mjs) | Ownership-checked graceful native database shutdown. |
| [Lifecycle verification](../scripts/test-desktop.mjs) | Actual windows, real services, second instance, failure injection, persistent-data fingerprints. |
| [README](../README.md), this document | Commands, implementation choices, actual results and limitations. |

Generated TypeScript output remains ignored. No application domain code, database
schema, migrations, seed data, or existing environment file was modified.
