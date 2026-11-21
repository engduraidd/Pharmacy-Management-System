import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api, ApiError } from '../src/lib/api';

test('unstructured proxy failures explain that the API is unavailable', async context => {
  for (const status of [500, 502, 503, 504]) {
    context.mock.method(globalThis, 'fetch', async () => new Response('Internal Server Error', { status }));
    await assert.rejects(api('/auth/login', { method: 'POST', body: {} }), error => {
      assert(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.match(error.message, /API is unavailable/);
      assert.match(error.message, /Start the backend or restart PharmaDesk/);
      return true;
    });
    context.mock.restoreAll();
  }
});

test('structured authentication, Origin, and backend errors are preserved', async context => {
  for (const [status, message] of [
    [401, 'Incorrect username or password.'],
    [403, 'Request origin is not allowed.'],
    [500, 'The request could not be completed. Please try again.'],
  ] as const) {
    context.mock.method(globalThis, 'fetch', async () => Response.json({ message }, { status }));
    await assert.rejects(api('/auth/login', { method: 'POST', body: {} }), error => {
      assert(error instanceof ApiError);
      assert.equal(error.status, status); assert.equal(error.message, message);
      return true;
    });
    context.mock.restoreAll();
  }
});

test('connection failures provide the existing safe connectivity message', async context => {
  context.mock.method(globalThis, 'fetch', async () => { throw new TypeError('private network details'); });
  await assert.rejects(api('/auth/login'), error => {
    assert(error instanceof ApiError);
    assert.equal(error.status, 0);
    assert.equal(error.message, 'Cannot reach the pharmacy server. Check that the API is running.');
    return true;
  });
});

test('successful responses retain the same-origin cookie and JSON request behavior', async context => {
  context.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, '/api/auth/login'); assert.equal(init.credentials, 'same-origin');
    assert.equal(init.method, 'POST'); assert.equal(init.cache, 'no-store');
    assert.deepEqual(init.headers, { 'Content-Type': 'application/json' });
    return Response.json({ user: { role: 'EMPLOYEE' } });
  });
  assert.deepEqual(await api('/auth/login', { method: 'POST', body: {} }), { user: { role: 'EMPLOYEE' } });
});
