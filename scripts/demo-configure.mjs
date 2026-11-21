import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

const file = 'apps/api/.env';
if (existsSync(file)) {
  console.log('Existing API environment preserved. Use the example to add any missing settings.');
} else {
  const dbPassword = randomBytes(24).toString('hex');
  const secret = () => randomBytes(18).toString('base64url');
  writeFileSync(file, [
    'NODE_ENV=development', 'PORT=3001',
    `DATABASE_URL=postgresql://pharmacy_dev:${dbPassword}@127.0.0.1:55432/pharmacy_mvp?schema=public`,
    `TEST_DATABASE_URL=postgresql://pharmacy_dev:${dbPassword}@127.0.0.1:55432/pharmacy_mvp_test?schema=public`,
    'WEB_ORIGIN=http://127.0.0.1:3000', 'APP_TIME_ZONE=Asia/Baghdad',
    'EXPIRY_ALERT_DAYS=30', 'DISPLAY_CURRENCY=IQD', 'ALLOW_DEMO_SEED=true',
    'SEED_OWNER_USERNAME=owner.demo', `SEED_OWNER_PASSWORD=${secret()}`,
    'SEED_EMPLOYEE_USERNAME=employee.demo', `SEED_EMPLOYEE_PASSWORD=${secret()}`, '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Generated ignored apps/api/.env with random local-only passwords. No passwords printed.');
}
