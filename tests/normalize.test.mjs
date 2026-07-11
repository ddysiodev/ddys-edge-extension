import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl, itemKey, metaLine, movieSiteUrl, normalizeMovie, unwrapPaginated } from '../src/shared/normalize.js';

test('normalizes DDYS movie-like records', () => {
  const movie = normalizeMovie({
    name: '星际穿越',
    id: 42,
    cover: 'https://img.test/poster.jpg',
    release_year: 2014,
    score: 9.4
  });
  assert.equal(movie.title, '星际穿越');
  assert.equal(movie.slug, 42);
  assert.equal(movie.poster, 'https://img.test/poster.jpg');
  assert.equal(movie.year, 2014);
  assert.equal(movie.rating, 9.4);
  assert.equal(itemKey(movie), '42');
  assert.match(metaLine(movie), /2014/);
});

test('builds API and site urls safely', () => {
  assert.equal(buildUrl('https://ddys.io/api/v1/', '/search', { q: 'test', empty: '' }), 'https://ddys.io/api/v1/search?q=test');
  assert.equal(movieSiteUrl({ slug: 'demo', url: '/movies/demo' }, 'https://ddys.io/'), 'https://ddys.io/movies/demo');
});

test('unwraps paginated envelopes', () => {
  const result = unwrapPaginated({ success: true, data: [{ id: 1 }], meta: { total: 1, page: 1, per_page: 10, total_pages: 1 } });
  assert.equal(result.data.length, 1);
  assert.equal(result.meta.total, 1);
});
