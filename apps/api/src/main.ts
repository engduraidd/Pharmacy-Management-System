import 'dotenv/config';
import { createApplication } from './application';
import { parsePort } from './config/environment';
import { settings } from './config/settings';

async function bootstrap() {
  const port = parsePort(process.env.PORT);
  settings();
  const app = await createApplication();
  await app.listen(port, '127.0.0.1');
}

void bootstrap().catch(() => {
  console.error('API startup failed. Check configuration and port availability.');
  process.exitCode = 1;
});
