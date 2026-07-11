import {
  ALARM_NAME,
  CONTEXT_OPEN_PANEL_ID,
  CONTEXT_SEARCH_ID,
  MAX_OMNIBOX_SUGGESTIONS
} from './shared/constants.js';
import { createApi } from './shared/api.js';
import {
  callbackToPromise,
  createTab,
  getEdgeApi,
  notify,
  queryActiveTab,
  runtimeUrl,
  sendMessageToTab,
  setBadge
} from './shared/edge-api.js';
import { getSettings, getState, updateSubscriptions } from './shared/storage.js';
import { findSubscriptionMatches, shouldNotify, summarizeMatches, updateSubscriptionAfterCheck } from './shared/subscriptions.js';
import { movieSiteUrl, normalizeMovie, shortText } from './shared/normalize.js';

const chromeApi = getEdgeApi();

chromeApi.runtime.onInstalled.addListener(async () => {
  await setupMenus();
  await setupAlarm();
  await setBadge('');
  if (chromeApi.omnibox?.setDefaultSuggestion) {
    chromeApi.omnibox.setDefaultSuggestion({ description: '搜索 DDYS：输入影片、剧集、演员或关键词' });
  }
  if (chromeApi.sidePanel?.setPanelBehavior) {
    try {
      const maybePromise = chromeApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
      maybePromise?.catch?.(() => {});
    } catch {
      // Older Edge builds can expose sidePanel without promise helpers.
    }
  }
});

chromeApi.runtime.onStartup?.addListener(async () => {
  await setupAlarm();
});

chromeApi.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) checkSubscriptions().catch(() => {});
});

chromeApi.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === CONTEXT_SEARCH_ID) {
    openSearchPage(info.selectionText || '').catch(() => {});
  }
  if (info.menuItemId === CONTEXT_OPEN_PANEL_ID) {
    createTab(runtimeUrl('sidepanel.html')).catch(() => {});
  }
});

chromeApi.commands?.onCommand?.addListener((command) => {
  if (command === 'open-dashboard') {
    createTab(runtimeUrl('sidepanel.html')).catch(() => {});
  }
  if (command === 'search-selection') {
    searchCurrentSelection().catch(() => createTab(runtimeUrl('sidepanel.html')));
  }
});

chromeApi.omnibox?.onInputChanged?.addListener((text, suggest) => {
  handleOmniboxSuggest(text, suggest).catch(() => suggest([]));
});

chromeApi.omnibox?.onInputEntered?.addListener((text, disposition) => {
  openSearchPage(text, disposition === 'newBackgroundTab').catch(() => {});
});

chromeApi.notifications?.onClicked?.addListener((id) => {
  if (String(id).startsWith('ddys-subscriptions')) {
    createTab(runtimeUrl('sidepanel.html#alerts')).catch(() => {});
  }
});

chromeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, message: error.message || 'Background action failed.' }));
  return true;
});

async function handleMessage(message) {
  if (!message || typeof message !== 'object') return null;
  if (message.type === 'DDYS_GET_SETTINGS') return getSettings();
  if (message.type === 'DDYS_OPEN_SEARCH') return openSearchPage(message.query || '');
  if (message.type === 'DDYS_OPEN_MOVIE') return openMovie(message.movie || {});
  if (message.type === 'DDYS_CHECK_SUBSCRIPTIONS') return checkSubscriptions({ forceNotify: true });
  if (message.type === 'DDYS_REBUILD_ALARM') return setupAlarm();
  if (message.type === 'DDYS_OPEN_OPTIONS') return createTab(runtimeUrl('options.html'));
  return null;
}

async function setupMenus() {
  await callbackToPromise((done) => chromeApi.contextMenus.removeAll(done));
  chromeApi.contextMenus.create({
    id: CONTEXT_SEARCH_ID,
    title: '用 DDYS 搜索“%s”',
    contexts: ['selection']
  });
  chromeApi.contextMenus.create({
    id: CONTEXT_OPEN_PANEL_ID,
    title: '打开 DDYS 面板',
    contexts: ['action', 'page']
  });
}

async function setupAlarm() {
  const settings = await getSettings();
  await callbackToPromise((done) => chromeApi.alarms.clear(ALARM_NAME, done));
  chromeApi.alarms.create(ALARM_NAME, {
    delayInMinutes: Math.max(1, Math.min(5, settings.refreshMinutes)),
    periodInMinutes: settings.refreshMinutes
  });
  return { ok: true, refreshMinutes: settings.refreshMinutes };
}

async function openSearchPage(query, background = false) {
  const q = String(query || '').trim();
  const url = runtimeUrl(`sidepanel.html${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  await createTab(url, { active: !background });
  return { opened: true, query: q };
}

async function openMovie(input) {
  const settings = await getSettings();
  const movie = normalizeMovie(input);
  await createTab(movieSiteUrl(movie, settings.siteBase), { active: settings.openTarget !== 'background' });
  return { opened: true, movie };
}

async function searchCurrentSelection() {
  const tab = await queryActiveTab();
  if (!tab?.id) throw new Error('No active tab.');
  const response = await chromeApi.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => String(globalThis.getSelection?.() || '').trim()
  });
  const query = response?.[0]?.result || '';
  if (query) return openSearchPage(query);
  await sendMessageToTab(tab.id, { type: 'DDYS_REQUEST_SELECTION' }).catch(() => {});
  return openSearchPage('');
}

async function handleOmniboxSuggest(text, suggest) {
  const query = String(text || '').trim();
  if (!query) {
    suggest([{ content: '最新更新', description: '打开 DDYS 最新更新' }]);
    return;
  }
  const api = await createApi();
  const suggestions = await api.suggest(query).catch(() => []);
  const normalized = (Array.isArray(suggestions) ? suggestions : [])
    .slice(0, MAX_OMNIBOX_SUGGESTIONS)
    .map((item) => normalizeMovie(item));
  suggest(normalized.map((item) => ({
    content: item.title,
    description: `${item.title}${item.year ? ` (${item.year})` : ''}`
  })));
}

async function checkSubscriptions(options = {}) {
  const state = await getState();
  const settings = state.settings;
  const enabled = state.subscriptions.filter((item) => item.enabled !== false);
  if (!enabled.length) {
    await setBadge('');
    return { ok: true, checked: 0, matches: 0 };
  }

  const api = await createApi({ settings });
  const checked = [];
  const matches = [];
  for (const subscription of enabled) {
    const result = await api.search({ q: subscription.query, type: 'movie', per_page: 10 }).catch(() => ({ data: [] }));
    const match = findSubscriptionMatches(subscription, result.data || []);
    matches.push(match);
    checked.push(updateSubscriptionAfterCheck(subscription, match.seenKeys));
  }

  const untouched = state.subscriptions.filter((item) => !enabled.some((enabledItem) => enabledItem.id === item.id));
  await updateSubscriptions([...checked, ...untouched]);

  const summary = summarizeMatches(matches);
  await setBadge(summary.total ? String(Math.min(summary.total, 99)) : '');
  if (settings.notificationsEnabled && (options.forceNotify || shouldNotify(matches))) {
    await notify(`ddys-subscriptions-${Date.now()}`, {
      type: 'basic',
      iconUrl: runtimeUrl('assets/icons/icon-128.png'),
      title: summary.title,
      message: shortText(summary.message, 120),
      priority: 1
    });
  }
  return { ok: true, checked: enabled.length, matches: summary.total };
}
