import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APPLICATION_NAME } from '@pharmacy/shared';
import { createApplication } from '../src/application';
import { parsePort } from '../src/config/environment';

test('health is reachable over HTTP without a database and exposes only liveness', async () => {
  const app = await createApplication();
  try {
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.deepEqual(await response.json(), { status: 'ok', application: APPLICATION_NAME });
    assert.equal((await fetch(`${baseUrl}/medicines`)).status, 401);
  } finally {
    await app.close();
  }
});

test('API configuration accepts the default and valid port boundaries', () => {
  assert.equal(parsePort(undefined), 3001);
  assert.equal(parsePort('1'), 1);
  assert.equal(parsePort('65535'), 65535);
});

test('API configuration rejects malformed and out-of-range ports', () => {
  for (const value of ['', '0', '-1', '65536', '3001.5', '3e3', 'invalid']) {
    assert.throws(() => parsePort(value), /PORT must be an integer between 1 and 65535/);
  }
});
