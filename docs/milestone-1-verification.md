# Milestone 1 verification

Date: 2026-11-13
Scope: workspace, application startup, and database configuration foundation only.

## Environment

- Windows, PowerShell 5.1.
- Node.js 20.16.0, npm 10.8.1, Git 2.47.0.windows.1.
- Docker was not found on PATH or at its standard Windows Docker Desktop CLI path.
- No packages or tools were installed globally.

## Final verification results

| Check | Result | Evidence / limitation |
|---|---|---|
| `npm install` | Passed | Created the root lockfile and workspace dependency links. Final dependency selection reports zero vulnerabilities. |
| `npm ci` | Passed | Clean installation from the final lockfile; 141 packages added, 145 audited, zero vulnerabilities reported. |
| `npm run build:web` | Passed | Next.js built the initial route and not-found page successfully, including TypeScript checks. |
| `npm run build:api` | Passed | API compiled successfully. |
| `npm run build` | Passed | Rechecked shared package, API with final compiler settings, and optimized web build after the dependency adjustments. |
| `npm run typecheck` | Passed | Shared package, API source/tests, and generated Next.js route types checked after the clean install. |
| `npm test` | Passed | All 3 foundation tests passed after the clean install; no skipped or failed tests. |
| `npm run dev:api` and HTTP request | Passed | Real development process returned HTTP 200 and the expected JSON at `/health`. Explicit injection works with the development runner. |
| `npm run start:api` and HTTP request | Passed | Compiled API process returned HTTP 200 and the expected JSON at `/health`. |
| `npm run start:web` and HTTP request | Passed | Production server returned HTTP 200 with `Pharmacy Management System` and `Frontend is running` in the rendered HTML. |
| `npm run db:validate` | Passed after sandbox retry | Prisma accepted the model-free schema using a process-local placeholder DATABASE_URL. No database connection was attempted. |
| Git status / branch / remotes | Passed | Local repository on `main`, no commits and no remote configured. Files remain untracked for review. |
| Ignore rules | Passed | Local environment paths, node_modules, API/test/shared/web build folders, and existing debug log are ignored. Environment examples remain visible to Git. |
| Whitespace / conflict-marker review | Passed | Checked new code/configuration/documentation files. `git diff --check` also passed, but it alone does not inspect untracked files. |
| Source-document preservation | Passed | SHA-256 hashes of the analysis and both PDFs matched their pre-implementation values. |
| Docker Compose runtime / PostgreSQL readiness | Not run | Docker is unavailable. Compose configuration was prepared and manually reviewed, but not validated by Docker or started. |

The three tests exercise:

1. A real NestJS HTTP listener: correct health status/body, JSON content type, no
   Express identification header, and HTTP 404 for the unimplemented medicine route.
2. Default and boundary values for the API port configuration.
3. Rejection of malformed or out-of-range ports.

The HTTP test uses an ephemeral loopback port and closes its application. Separate
development and production smoke-check processes were stopped after verification;
no listeners remained on ports 3000 or 3001 at the final cleanup check.

There is no separate frontend unit-test suite in this milestone. The page was
verified through build/type checks and an HTTP response smoke check. Assignment
TC01–TC12 are not implemented or executed: the pharmacy features they test are
outside Milestone 1.

## Problems encountered and resolutions

- The initial NestJS CLI and Prisma 6.19.3 tooling introduced eight npm audit
  findings. The final setup uses TypeScript directly for API builds, `tsx` for
  development, and matching Prisma CLI/client 6.12.0. Prisma 6.12.0 avoids the
  flagged deepmerge-ts dependency. This also removed the unnecessary framework CLI
  dependency tree. The final clean installation reported zero vulnerabilities;
  no forced audit fix or incompatible major upgrade was used.
- TypeScript 5.9.3 is pinned for the framework toolchain rather than automatically
  adopting the latest TypeScript major. The common strict configuration is shared,
  while module/decorator settings follow each application's runtime needs.
- Prisma's first validation attempt hit a sandbox EPERM while resolving a user
  temporary-directory path. The same validation passed outside the sandbox using
  a placeholder connection URL. No real credentials or local `.env` files were needed.
- Git initially rejected the sandbox/user ownership mismatch. Changing ownership
  was denied by Windows. Because the newly initialized metadata had no commits or
  references, it was preserved in temporary storage and reinitialized under the
  project owner's account. Normal-user Git checks then passed. No global Git
  safe-directory setting was added; sandbox inspections used a command-scoped
  safe-directory setting for this project only.
- An optional YAML parser probe was unavailable in the dependency set. No package
  was added just to parse Compose. Docker-based configuration validation remains
  pending alongside the missing Docker runtime.
- `npm ls --depth=0` exited successfully but labeled the lockfile's optional
  `@img/sharp-wasm32` and `@emnapi/runtime` packages as extraneous, including after
  `npm ci`. They are optional entries in Next.js's image-tooling dependency tree,
  not manually added application dependencies; builds and startup checks passed.

## Remaining setup and scope

1. Install/start Docker with Compose v2 if using the supplied PostgreSQL setup.
2. Copy [the Docker environment example](../infrastructure/docker/.env.example)
   to its ignored `.env`, replace the password placeholder locally, and follow
   [the database setup instructions](../README.md#local-postgresql-with-docker-compose).
3. If using database tooling, copy [the API environment example](../apps/api/.env.example)
   to its ignored `.env` and set a matching DATABASE_URL. Neither app requires a
   database connection to display the initial page or serve liveness.
4. Validate/start Compose and verify PostgreSQL readiness on a machine with Docker.
5. Resolve the relevant [requirements questions](public-requirements.md)
   and obtain approval before Milestone 2, domain models, migrations, or pharmacy features.

No migrations, seeds, database client generation command, medicine/stock/sales
features, authentication, role permissions, mobile application, GitHub remote,
commit, push, deployment, or production backup/recovery process was added.
The installed Prisma package's lifecycle scripts may prepare its default client
stub; this is not a generated pharmacy data model or database integration.
