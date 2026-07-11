import { DEFAULT_SETTINGS, EMPTY_STATE, MAX_HISTORY_ITEMS, STORAGE_KEYS } from './constants.js';
import { itemKey, normalizeMovie } from './normalize.js';
import { storageGet, storageSet } from './edge-api.js';

export async function getSettings() {
  const data = await storageGet(STORAGE_KEYS.settings);
  return normalizeSettings(data[STORAGE_KEYS.settings]);
}

export async function saveSettings(input) {
  const settings = normalizeSettings({ ...(await getSettings()), ...(input || {}) });
  await storageSet({ [STORAGE_KEYS.settings]: settings });
  return settings;
}

export async function getState() {
  const data = await storageGet(Object.values(STORAGE_KEYS));
  return {
    settings: normalizeSettings(data[STORAGE_KEYS.settings]),
    favorites: normalizeList(data[STORAGE_KEYS.favorites]),
    watchLater: normalizeList(data[STORAGE_KEYS.watchLater]),
    history: normalizeList(data[STORAGE_KEYS.history]),
    notes: data[STORAGE_KEYS.notes] && typeof data[STORAGE_KEYS.notes] === 'object' ? data[STORAGE_KEYS.notes] : {},
    subscriptions: normalizeSubscriptions(data[STORAGE_KEYS.subscriptions]),
    apiCache: data[STORAGE_KEYS.apiCache] && typeof data[STORAGE_KEYS.apiCache] === 'object' ? data[STORAGE_KEYS.apiCache] : {},
    diagnostics: data[STORAGE_KEYS.diagnostics] || null
  };
}

export async function setCollection(name, list) {
  const key = STORAGE_KEYS[name];
  if (!key) throw new Error(`Unknown collection: ${name}`);
  const normalized = normalizeList(list);
  await storageSet({ [key]: normalized });
  return normalized;
}

export async function toggleCollectionItem(name, item) {
  const key = STORAGE_KEYS[name];
  if (!key) throw new Error(`Unknown collection: ${name}`);
  const state = await getState();
  const list = normalizeList(state[name]);
  const movie = stampMovie(item);
  const keyValue = itemKey(movie);
  const exists = list.some((entry) => itemKey(entry) === keyValue);
  const next = exists ? list.filter((entry) => itemKey(entry) !== keyValue) : [movie, ...list];
  await storageSet({ [key]: next });
  return { active: !exists, list: next };
}

export async function addHistory(item) {
  const state = await getState();
  const movie = stampMovie(item);
  const keyValue = itemKey(movie);
  const next = [movie, ...state.history.filter((entry) => itemKey(entry) !== keyValue)].slice(0, MAX_HISTORY_ITEMS);
  await storageSet({ [STORAGE_KEYS.history]: next });
  return next;
}

export async function setNote(item, note) {
  const state = await getState();
  const key = itemKey(item);
  const notes = { ...state.notes };
  if (String(note || '').trim()) notes[key] = String(note).trim();
  else delete notes[key];
  await storageSet({ [STORAGE_KEYS.notes]: notes });
  return notes;
}

export async function addSubscription(input) {
  const state = await getState();
  const query = String(input?.query || input?.title || '').trim();
  if (!query) throw new Error('订阅关键词不能为空。');
  const subscription = {
    id: input?.id || `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: input?.type || 'keyword',
    query,
    enabled: input?.enabled !== false,
    createdAt: input?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastCheckedAt: input?.lastCheckedAt || '',
    lastSeenKeys: Array.isArray(input?.lastSeenKeys) ? input.lastSeenKeys : []
  };
  const next = [subscription, ...state.subscriptions.filter((item) => item.id !== subscription.id)];
  await storageSet({ [STORAGE_KEYS.subscriptions]: next });
  return subscription;
}

export async function updateSubscriptions(subscriptions) {
  const next = normalizeSubscriptions(subscriptions);
  await storageSet({ [STORAGE_KEYS.subscriptions]: next });
  return next;
}

export async function removeSubscription(id) {
  const state = await getState();
  const next = state.subscriptions.filter((item) => item.id !== id);
  await storageSet({ [STORAGE_KEYS.subscriptions]: next });
  return next;
}

export async function readCache() {
  const data = await storageGet(STORAGE_KEYS.apiCache);
  return data[STORAGE_KEYS.apiCache] && typeof data[STORAGE_KEYS.apiCache] === 'object' ? data[STORAGE_KEYS.apiCache] : {};
}

export async function writeCache(cache) {
  await storageSet({ [STORAGE_KEYS.apiCache]: cache || {} });
}

export async function clearCache() {
  await storageSet({ [STORAGE_KEYS.apiCache]: {} });
}

export async function saveDiagnostics(result) {
  const diagnostics = { ...result, checkedAt: new Date().toISOString() };
  await storageSet({ [STORAGE_KEYS.diagnostics]: diagnostics });
  return diagnostics;
}

export async function exportData() {
  const state = await getState();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    favorites: state.favorites,
    watchLater: state.watchLater,
    history: state.history,
    notes: state.notes,
    subscriptions: state.subscriptions
  };
}

export async function importData(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('导入数据不是有效 JSON。');
  const next = {
    [STORAGE_KEYS.settings]: normalizeSettings(payload.settings),
    [STORAGE_KEYS.favorites]: normalizeList(payload.favorites),
    [STORAGE_KEYS.watchLater]: normalizeList(payload.watchLater),
    [STORAGE_KEYS.history]: normalizeList(payload.history),
    [STORAGE_KEYS.notes]: payload.notes && typeof payload.notes === 'object' ? payload.notes : {},
    [STORAGE_KEYS.subscriptions]: normalizeSubscriptions(payload.subscriptions)
  };
  await storageSet(next);
  return getState();
}

export function normalizeSettings(input = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...(input || {}) };
  return {
    ...merged,
    apiBase: String(merged.apiBase || DEFAULT_SETTINGS.apiBase).replace(/\/+$/, ''),
    siteBase: String(merged.siteBase || DEFAULT_SETTINGS.siteBase).replace(/\/+$/, ''),
    cacheTtlMinutes: clamp(merged.cacheTtlMinutes, DEFAULT_SETTINGS.cacheTtlMinutes, 0, 1440),
    refreshMinutes: clamp(merged.refreshMinutes, DEFAULT_SETTINGS.refreshMinutes, 15, 1440),
    requestTimeoutMs: clamp(merged.requestTimeoutMs, DEFAULT_SETTINGS.requestTimeoutMs, 3000, 60000),
    notificationsEnabled: merged.notificationsEnabled !== false,
    selectionBubbleEnabled: merged.selectionBubbleEnabled !== false,
    newTabDashboardEnabled: merged.newTabDashboardEnabled !== false,
    openTarget: ['foreground', 'background', 'site'].includes(merged.openTarget) ? merged.openTarget : DEFAULT_SETTINGS.openTarget
  };
}

export function normalizeList(value) {
  return Array.isArray(value) ? value.map((item) => normalizeMovie(item)).filter((item) => item.title) : [...EMPTY_STATE.favorites];
}

export function normalizeSubscriptions(value) {
  return Array.isArray(value)
    ? value
      .filter((item) => item && String(item.query || '').trim())
      .map((item) => ({
        id: item.id || `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        type: item.type || 'keyword',
        query: String(item.query).trim(),
        enabled: item.enabled !== false,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
        lastCheckedAt: item.lastCheckedAt || '',
        lastSeenKeys: Array.isArray(item.lastSeenKeys) ? item.lastSeenKeys : []
      }))
    : [...EMPTY_STATE.subscriptions];
}

function stampMovie(item) {
  return {
    ...normalizeMovie(item),
    savedAt: new Date().toISOString()
  };
}

function clamp(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
