import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

export const WEB_URL = 'http://127.0.0.1:3000';

/** Pass OS essentials, not the parent shell's credentials, to service processes. */
export function systemEnvironment(source: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const allowed = /^(path|pathext|systemroot|windir|comspec|temp|tmp|tmpdir|home|userprofile|appdata|localappdata|programfiles|programfiles\(x86\)|systemdrive|number_of_processors|lang|lc_all)$/i;
  return { ...Object.fromEntries(Object.entries(source).filter(([key]) => allowed.test(key))), NODE_ENV: 'development' };
}

export function readConfiguration(root: string) {
  const file = resolve(root, 'apps/api/.env');
  if (!existsSync(file)) throw new Error('Missing local API environment. Follow README setup first.');
  const values = parse(readFileSync(file));
  let database: URL;
  try { database = new URL(values.DATABASE_URL ?? ''); }
  catch { throw new Error('Invalid local database configuration.'); }
  const databasePort = Number(database.port || 5432);
  const apiPort = Number(values.PORT || 3001);
  if (!['postgresql:', 'postgres:'].includes(database.protocol) || database.hostname !== '127.0.0.1' ||
      !database.username || !database.password || !Number.isInteger(databasePort) || databasePort < 1 ||
      !Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535 || databasePort > 65535 ||
      new Set([databasePort, apiPort, 3000]).size !== 3) {
    throw new Error('Desktop requires distinct loopback PostgreSQL, API and web ports. Check the local environment.');
  }
  if (values.NODE_ENV === 'production' || values.WEB_ORIGIN !== WEB_URL) {
    throw new Error('Desktop development requires development mode and WEB_ORIGIN=http://127.0.0.1:3000.');
  }
  if (!existsSync(resolve(root, '.local/postgres/PG_VERSION'))) {
    throw new Error('The local PostgreSQL cluster is not initialized. Complete README setup first. Desktop never initializes or migrates data.');
  }
  const base = systemEnvironment(process.env);
  const api = { ...base } as NodeJS.ProcessEnv;
  for (const key of ['DATABASE_URL', 'PORT', 'WEB_ORIGIN', 'APP_TIME_ZONE', 'EXPIRY_ALERT_DAYS', 'DISPLAY_CURRENCY']) {
    if (values[key] !== undefined) api[key] = values[key];
  }
  return {
    databasePort, apiPort,
    databaseEnvironment: { ...base, DATABASE_URL: values.DATABASE_URL, PHARMADESK_DESKTOP: '1' },
    apiEnvironment: api,
    webEnvironment: { ...base, API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`, NEXT_TELEMETRY_DISABLED: '1' },
  };
}
