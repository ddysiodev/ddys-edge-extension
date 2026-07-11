import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findSubscriptionMatches,
  shouldNotify,
  summarizeMatches,
  updateSubscriptionAfterCheck
} from '../src/shared/subscriptions.js';

test('finds fresh subscription matches and updates seen keys', () => {
  const subscription = { query: '科幻', lastSeenKeys: ['old'] };
  const match = findSubscriptionMatches(subscription, [
    { title: '旧片', slug: 'old' },
    { title: '新片', slug: 'new' }
  ]);
  assert.equal(match.fresh.length, 1);
  assert.equal(match.fresh[0].title, '新片');
  assert.equal(shouldNotify([match]), true);

  const updated = updateSubscriptionAfterCheck(subscription, match.seenKeys);
  assert.ok(updated.lastSeenKeys.includes('new'));
  assert.ok(updated.lastCheckedAt);
  assert.equal(summarizeMatches([match]).total, 1);
});
