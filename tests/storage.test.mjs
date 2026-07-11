import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryEdge } from '../src/shared/edge-api.js';
import {
  addHistory,
  addSubscription,
  exportData,
  getState,
  importData,
  saveSettings,
  toggleCollectionItem
} from '../src/shared/storage.js';

test('stores settings, collections, history, subscriptions, and export data', async () => {
  globalThis.chrome = createMemoryEdge();
  const settings = await saveSettings({ apiBase: 'https://api.example.test/v1/', cacheTtlMinutes: 7 });
  assert.equal(settings.apiBase, 'https://api.example.test/v1');
  assert.equal(settings.cacheTtlMinutes, 7);

  const movie = { title: '测试影片', slug: 'movie-a', year: 2026 };
  let toggled = await toggleCollectionItem('favorites', movie);
  assert.equal(toggled.active, true);
  toggled = await toggleCollectionItem('favorites', movie);
  assert.equal(toggled.active, false);

  await toggleCollectionItem('watchLater', movie);
  await addHistory(movie);
  await addSubscription({ query: '测试影片' });
  const exported = await exportData();
  assert.equal(exported.watchLater.length, 1);
  assert.equal(exported.history.length, 1);
  assert.equal(exported.subscriptions[0].query, '测试影片');
});

test('imports backup data', async () => {
  globalThis.chrome = createMemoryEdge();
  await importData({
    settings: { apiBase: 'https://proxy.test/api' },
    favorites: [{ title: '导入影片', slug: 'imported' }],
    subscriptions: [{ query: '导入' }]
  });
  const state = await getState();
  assert.equal(state.settings.apiBase, 'https://proxy.test/api');
  assert.equal(state.favorites[0].title, '导入影片');
  assert.equal(state.subscriptions[0].query, '导入');
});
