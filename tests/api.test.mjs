import test from 'node:test';
import assert from 'node:assert/strict';
import { DdysExtensionApi, makeCacheKey } from '../src/shared/api.js';
import { createMemoryEdge } from '../src/shared/edge-api.js';
import { saveSettings } from '../src/shared/storage.js';

test('requests DDYS API, unwraps results, and caches GET responses', async () => {
  globalThis.chrome = createMemoryEdge();
  const settings = await saveSettings({ apiBase: 'https://api.example.test', cacheTtlMinutes: 30 });
  let calls = 0;
  const api = new DdysExtensionApi(settings, {
    fetch: async (url) => {
      calls += 1;
      assert.match(String(url), /\/latest/);
      return new Response(JSON.stringify({ success: true, data: [{ id: 1, title: 'A', slug: 'a' }] }), { status: 200 });
    }
  });

  const first = await api.latest({ limit: 1 });
  const second = await api.latest({ limit: 1 });
  assert.equal(first[0].title, 'A');
  assert.equal(second[0].slug, 'a');
  assert.equal(calls, 1);
});

test('builds stable cache keys', () => {
  assert.equal(makeCacheKey('https://example.test/a'), makeCacheKey('https://example.test/a'));
  assert.notEqual(makeCacheKey('https://example.test/a'), makeCacheKey('https://example.test/b'));
});
