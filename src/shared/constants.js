export const VERSION = '0.1.0';
export const DEFAULT_API_BASE = 'https://ddys.io/api/v1';
export const DEFAULT_SITE_BASE = 'https://ddys.io';
export const ALARM_NAME = 'ddys.subscription.refresh';
export const CONTEXT_SEARCH_ID = 'ddys-search-selection';
export const CONTEXT_OPEN_PANEL_ID = 'ddys-open-panel';
export const MAX_HISTORY_ITEMS = 80;
export const MAX_CACHE_ENTRIES = 80;
export const MAX_OMNIBOX_SUGGESTIONS = 5;

export const STORAGE_KEYS = {
  settings: 'settings',
  favorites: 'favorites',
  watchLater: 'watchLater',
  history: 'history',
  notes: 'notes',
  subscriptions: 'subscriptions',
  apiCache: 'apiCache',
  diagnostics: 'diagnostics'
};

export const DEFAULT_SETTINGS = Object.freeze({
  apiBase: DEFAULT_API_BASE,
  siteBase: DEFAULT_SITE_BASE,
  locale: 'zh-CN',
  cacheTtlMinutes: 15,
  refreshMinutes: 60,
  requestTimeoutMs: 12000,
  openTarget: 'foreground',
  notificationsEnabled: true,
  selectionBubbleEnabled: true,
  newTabDashboardEnabled: true
});

export const EMPTY_STATE = Object.freeze({
  favorites: [],
  watchLater: [],
  history: [],
  notes: {},
  subscriptions: [],
  apiCache: {},
  diagnostics: null
});

export const APP_TABS = [
  { id: 'discover', label: '发现' },
  { id: 'search', label: '搜索' },
  { id: 'calendar', label: '日历' },
  { id: 'library', label: '片库' },
  { id: 'alerts', label: '订阅' },
  { id: 'settings', label: '设置' }
];

export const MOVIE_TYPES = [
  { value: '', label: '全部' },
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'variety', label: '综艺' },
  { value: 'anime', label: '动漫' }
];
