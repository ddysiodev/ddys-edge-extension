import { APP_TABS, DEFAULT_SETTINGS, MOVIE_TYPES } from './constants.js';
import { createApi } from './api.js';
import {
  addHistory,
  addSubscription,
  clearCache,
  getState,
  saveSettings,
  setNote,
  toggleCollectionItem
} from './storage.js';
import { createTab, runtimeUrl } from './edge-api.js';
import { metaLine, movieSiteUrl, normalizeMovie, safeJsonParse, shortText } from './normalize.js';

export class DdysAppView {
  constructor(root, options = {}) {
    this.root = root;
    this.mode = options.mode || root?.dataset?.mode || 'popup';
    this.state = {
      activeTab: this.mode === 'newtab' ? 'discover' : 'discover',
      loading: false,
      query: '',
      searchType: 'movie',
      detail: null,
      detailSources: null,
      detailRelated: null,
      latest: [],
      hot: [],
      calendar: null,
      search: [],
      meta: null,
      error: '',
      local: null
    };
  }

  async mount() {
    this.state.local = await getState();
    this.render();
    this.bind();
    await this.loadDiscover();
    const params = new URLSearchParams(globalThis.location?.search || '');
    const q = params.get('q');
    if (q) {
      this.state.activeTab = 'search';
      this.state.query = q;
      await this.search(q);
    }
  }

  bind() {
    this.root.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-search-form]');
      if (!form) return;
      event.preventDefault();
      const query = form.querySelector('[name="q"]')?.value?.trim();
      if (query) {
        this.state.activeTab = 'search';
        await this.search(query);
      }
    });

    this.root.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const value = target.dataset.value || '';
      event.preventDefault();
      try {
        if (action === 'tab') {
          this.state.activeTab = value;
          this.render();
          if (value === 'calendar' && !this.state.calendar) await this.loadCalendar();
        } else if (action === 'refresh') {
          await this.loadDiscover(true);
        } else if (action === 'open-options') {
          await createTab(runtimeUrl('options.html'));
        } else if (action === 'open-sidepanel-page') {
          await createTab(runtimeUrl('sidepanel.html'));
        } else if (action === 'detail') {
          await this.openDetail(readPayload(target));
        } else if (action === 'favorite') {
          await this.toggle('favorites', readPayload(target));
        } else if (action === 'later') {
          await this.toggle('watchLater', readPayload(target));
        } else if (action === 'open-site') {
          await createTab(movieSiteUrl(readPayload(target), this.state.local.settings.siteBase), { active: this.state.local.settings.openTarget !== 'background' });
        } else if (action === 'subscribe') {
          await this.subscribe(value || this.state.query || readPayload(target).title);
        } else if (action === 'remove-cache') {
          await clearCache();
          await this.reloadState('缓存已清理');
        } else if (action === 'save-settings') {
          await this.saveSettingsFromForm();
        } else if (action === 'save-note') {
          await this.saveNoteFromForm(target);
        }
      } catch (error) {
        this.toast(error.message || '操作失败');
      }
    });
  }

  async api() {
    return createApi({ settings: this.state.local?.settings || DEFAULT_SETTINGS });
  }

  async loadDiscover(force = false) {
    this.state.loading = true;
    this.state.error = '';
    this.render();
    try {
      if (force) await clearCache();
      const api = await this.api();
      const [latest, hot] = await Promise.all([
        api.latest({ limit: this.mode === 'popup' ? 8 : 16 }),
        api.hot()
      ]);
      this.state.latest = Array.isArray(latest) ? latest.map(normalizeMovie) : [];
      this.state.hot = Array.isArray(hot) ? hot.map(normalizeMovie) : [];
    } catch (error) {
      this.state.error = error.message || '加载失败';
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  async loadCalendar() {
    this.state.loading = true;
    this.render();
    try {
      const now = new Date();
      const api = await this.api();
      this.state.calendar = await api.calendar({ year: now.getFullYear(), month: now.getMonth() + 1 });
    } catch (error) {
      this.state.error = error.message || '日历加载失败';
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  async search(query) {
    this.state.loading = true;
    this.state.error = '';
    this.state.query = query;
    this.render();
    try {
      const api = await this.api();
      const result = await api.search({ q: query, type: this.state.searchType || 'movie', per_page: this.mode === 'popup' ? 10 : 24 });
      this.state.search = result.data.map(normalizeMovie);
      this.state.meta = result.meta;
    } catch (error) {
      this.state.error = error.message || '搜索失败';
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  async openDetail(item) {
    const movie = normalizeMovie(item);
    await addHistory(movie);
    this.state.local = await getState();
    this.state.detail = movie;
    this.state.detailSources = null;
    this.state.detailRelated = null;
    this.render();
    if (!movie.slug) return;
    try {
      const api = await this.api();
      const [detail, sources, related] = await Promise.all([
        api.movieDetail(movie.slug).catch(() => movie),
        api.movieSources(movie.slug).catch(() => ({ online: [], download: [] })),
        api.movieRelated(movie.slug).catch(() => ({ series: [], related: [] }))
      ]);
      this.state.detail = normalizeMovie({ ...movie, ...detail });
      this.state.detailSources = sources || { online: [], download: [] };
      this.state.detailRelated = related || { series: [], related: [] };
      this.render();
    } catch (error) {
      this.toast(error.message || '详情加载失败');
    }
  }

  async toggle(name, item) {
    await toggleCollectionItem(name, item);
    await this.reloadState(name === 'favorites' ? '收藏已更新' : '稍后看已更新');
  }

  async subscribe(query) {
    const text = String(query || '').trim();
    if (!text) throw new Error('没有可订阅的关键词。');
    await addSubscription({ query: text, type: 'keyword' });
    await this.reloadState('订阅已添加');
  }

  async saveSettingsFromForm() {
    const form = this.root.querySelector('[data-settings-form]');
    const formData = new FormData(form);
    await saveSettings({
      apiBase: formData.get('apiBase'),
      siteBase: formData.get('siteBase'),
      cacheTtlMinutes: formData.get('cacheTtlMinutes'),
      refreshMinutes: formData.get('refreshMinutes'),
      requestTimeoutMs: formData.get('requestTimeoutMs'),
      openTarget: formData.get('openTarget'),
      notificationsEnabled: formData.get('notificationsEnabled') === 'on',
      selectionBubbleEnabled: formData.get('selectionBubbleEnabled') === 'on',
      newTabDashboardEnabled: formData.get('newTabDashboardEnabled') === 'on'
    });
    await this.reloadState('设置已保存');
  }

  async saveNoteFromForm(button) {
    const form = button.closest('[data-note-form]');
    await setNote(readPayload(button), form.querySelector('[name="note"]')?.value || '');
    await this.reloadState('备注已保存');
  }

  async reloadState(message) {
    this.state.local = await getState();
    this.render();
    if (message) this.toast(message);
  }

  render() {
    const local = this.state.local || { settings: DEFAULT_SETTINGS, favorites: [], watchLater: [], history: [], subscriptions: [], notes: {} };
    this.root.innerHTML = `
      <section class="app-frame">
        ${this.renderTopbar()}
        ${this.renderTabs()}
        <section class="content">
          ${this.state.error ? `<div class="state-panel">${escapeHtml(this.state.error)}</div>` : ''}
          ${this.state.loading ? `<div class="state-panel">加载中...</div>` : ''}
          ${this.renderActive(local)}
        </section>
      </section>
      <div class="toast hidden" role="status"></div>
    `;
  }

  renderTopbar() {
    return `
      <header class="topbar">
        <div class="brand-row">
          <div class="brand">
            <img src="assets/icons/icon-48.png" alt="">
            <div>
              <div>DDYS</div>
              <div class="brand-subtitle">${this.mode === 'newtab' ? '新标签页' : this.mode === 'sidepanel' ? 'Edge 侧边栏' : 'Edge 扩展'}</div>
            </div>
          </div>
          <div class="toolbar-actions">
            <button class="icon-button" data-action="refresh" title="刷新">刷</button>
            <button class="icon-button" data-action="open-options" title="设置">设</button>
            ${this.mode === 'popup' ? '<button class="icon-button" data-action="open-sidepanel-page" title="打开侧边栏页面">栏</button>' : ''}
          </div>
        </div>
        <form class="search-row" data-search-form>
          <input name="q" value="${escapeHtml(this.state.query)}" placeholder="搜索影片、剧集、演员或关键词" autocomplete="off">
          <button class="primary" type="submit">搜索</button>
        </form>
      </header>
    `;
  }

  renderTabs() {
    const tabs = this.mode === 'newtab' ? APP_TABS.filter((tab) => tab.id !== 'settings') : APP_TABS;
    return `
      <nav class="tabs" aria-label="DDYS views">
        ${tabs.map((tab) => `<button class="tab ${this.state.activeTab === tab.id ? 'is-active' : ''}" data-action="tab" data-value="${tab.id}">${tab.label}</button>`).join('')}
      </nav>
    `;
  }

  renderActive(local) {
    if (this.state.activeTab === 'search') return this.renderSearch();
    if (this.state.activeTab === 'calendar') return this.renderCalendar();
    if (this.state.activeTab === 'library') return this.renderLibrary(local);
    if (this.state.activeTab === 'alerts') return this.renderAlerts(local);
    if (this.state.activeTab === 'settings') return this.renderSettings(local);
    return this.renderDiscover(local);
  }

  renderDiscover(local) {
    return `
      <div class="detail-layout">
        <div class="grid">
          <section class="section">
            <div class="section-title"><span>最新更新</span><button data-action="subscribe" data-value="最新更新">订阅最新</button></div>
            ${renderMovieList(this.state.latest, local)}
          </section>
          <section class="section">
            <div class="section-title"><span>热门内容</span><button data-action="tab" data-value="calendar">看日历</button></div>
            ${renderMovieList(this.state.hot, local)}
          </section>
        </div>
        ${this.renderDetail(local)}
      </div>
    `;
  }

  renderSearch() {
    const label = this.state.query ? `搜索：${escapeHtml(this.state.query)}` : '搜索结果';
    return `
      <div class="detail-layout">
        <section class="section">
          <div class="section-title">
            <span>${label}</span>
            ${this.state.query ? `<button data-action="subscribe" data-value="${escapeAttr(this.state.query)}">订阅关键词</button>` : ''}
          </div>
          ${renderMovieList(this.state.search, this.state.local)}
        </section>
        ${this.renderDetail(this.state.local)}
      </div>
    `;
  }

  renderCalendar() {
    const days = normalizeCalendar(this.state.calendar);
    return `
      <section class="section">
        <div class="section-title"><span>${days.title}</span><button data-action="refresh">刷新</button></div>
        <div class="calendar-grid">
          ${days.cells.map((cell) => `
            <div class="calendar-day">
              <div class="calendar-date">${cell.day || ''}</div>
              ${cell.items.map((item) => `<a class="calendar-show" href="#" data-action="detail" data-payload="${payload(item)}">${escapeHtml(item.title || item.name || '')}</a>`).join('')}
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  renderLibrary(local) {
    return `
      <div class="grid">
        <section class="section">
          <div class="section-title"><span>收藏</span><span class="muted small">${local.favorites.length}</span></div>
          ${renderMovieList(local.favorites, local)}
        </section>
        <section class="section">
          <div class="section-title"><span>稍后看</span><span class="muted small">${local.watchLater.length}</span></div>
          ${renderMovieList(local.watchLater, local)}
        </section>
        <section class="section">
          <div class="section-title"><span>观看记录</span><span class="muted small">${local.history.length}</span></div>
          ${renderMovieList(local.history, local)}
        </section>
      </div>
    `;
  }

  renderAlerts(local) {
    return `
      <section class="section">
        <div class="section-title"><span>关键词订阅</span><button data-action="subscribe" data-value="${escapeAttr(this.state.query || '')}">添加当前搜索</button></div>
        <div class="item-list">
          ${local.subscriptions.length ? local.subscriptions.map((item) => `
            <div class="compact-item">
              <strong>${escapeHtml(item.query)}</strong>
              <span class="muted small">${item.enabled ? '已启用' : '已暂停'} / 上次检查 ${escapeHtml(item.lastCheckedAt || '暂无')}</span>
            </div>
          `).join('') : '<div class="state-panel">暂无订阅</div>'}
        </div>
      </section>
    `;
  }

  renderSettings(local) {
    const settings = local.settings;
    return `
      <form class="form-grid setting-panel" data-settings-form>
        <div class="field"><label>API Base</label><input name="apiBase" value="${escapeAttr(settings.apiBase)}"></div>
        <div class="field"><label>站点 Base</label><input name="siteBase" value="${escapeAttr(settings.siteBase)}"></div>
        <div class="grid two">
          <div class="field"><label>缓存分钟</label><input name="cacheTtlMinutes" type="number" min="0" max="1440" value="${settings.cacheTtlMinutes}"></div>
          <div class="field"><label>刷新分钟</label><input name="refreshMinutes" type="number" min="15" max="1440" value="${settings.refreshMinutes}"></div>
        </div>
        <div class="field"><label>请求超时毫秒</label><input name="requestTimeoutMs" type="number" min="3000" max="60000" value="${settings.requestTimeoutMs}"></div>
        <div class="field">
          <label>打开方式</label>
          <select name="openTarget">
            ${['foreground', 'background', 'site'].map((value) => `<option value="${value}" ${settings.openTarget === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <label class="switch-row"><span>浏览器通知</span><input name="notificationsEnabled" type="checkbox" ${settings.notificationsEnabled ? 'checked' : ''}></label>
        <label class="switch-row"><span>页面选区按钮</span><input name="selectionBubbleEnabled" type="checkbox" ${settings.selectionBubbleEnabled ? 'checked' : ''}></label>
        <label class="switch-row"><span>新标签页面板</span><input name="newTabDashboardEnabled" type="checkbox" ${settings.newTabDashboardEnabled ? 'checked' : ''}></label>
        <div class="row-actions">
          <button class="primary" type="button" data-action="save-settings">保存</button>
          <button type="button" data-action="remove-cache">清缓存</button>
        </div>
      </form>
    `;
  }

  renderDetail(local) {
    const item = this.state.detail;
    if (!item) return '<aside class="detail-panel"><div class="state-panel">选择影片查看详情</div></aside>';
    const movie = normalizeMovie(item);
    const sources = this.state.detailSources || { online: [], download: [] };
    const related = [...(this.state.detailRelated?.series || []), ...(this.state.detailRelated?.related || [])].map(normalizeMovie).slice(0, 6);
    const note = local?.notes?.[movie.slug] || '';
    return `
      <aside class="detail-panel">
        <div class="detail-hero">
          ${renderPoster(movie)}
          <div class="grid">
            <h1 class="detail-title">${escapeHtml(movie.title)}</h1>
            <div class="movie-meta">${escapeHtml(metaLine(movie))}</div>
            <div class="row-actions">
              <button data-action="favorite" data-payload="${payload(movie)}">收藏</button>
              <button data-action="later" data-payload="${payload(movie)}">稍后</button>
              <button data-action="open-site" data-payload="${payload(movie)}">打开</button>
              <button data-action="subscribe" data-value="${escapeAttr(movie.title)}">订阅</button>
            </div>
          </div>
        </div>
        ${movie.intro ? `<div class="summary">${escapeHtml(shortText(movie.intro, 260))}</div>` : ''}
        <form class="form-grid" data-note-form>
          <textarea name="note" rows="3" placeholder="本地备注">${escapeHtml(note)}</textarea>
          <button type="button" data-action="save-note" data-payload="${payload(movie)}">保存备注</button>
        </form>
        <section class="section">
          <div class="section-title"><span>在线资源</span><span class="muted small">${(sources.online || []).length}</span></div>
          ${renderResources(sources.online || [])}
        </section>
        <section class="section">
          <div class="section-title"><span>下载资源</span><span class="muted small">${(sources.download || []).length}</span></div>
          ${renderResources(sources.download || [])}
        </section>
        <section class="section">
          <div class="section-title"><span>相关内容</span></div>
          ${renderMovieList(related, local)}
        </section>
      </aside>
    `;
  }

  toast(message) {
    const toast = this.root.querySelector('.toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
  }
}

export function renderMovieList(items, local = {}) {
  const list = Array.isArray(items) ? items.map(normalizeMovie) : [];
  if (!list.length) return '<div class="state-panel">暂无内容</div>';
  const favoriteKeys = new Set((local?.favorites || []).map((item) => normalizeMovie(item).slug));
  const laterKeys = new Set((local?.watchLater || []).map((item) => normalizeMovie(item).slug));
  return `
    <div class="item-list">
      ${list.map((movie) => `
        <article class="movie-item">
          ${renderPoster(movie)}
          <div class="movie-body">
            <div class="movie-title" title="${escapeAttr(movie.title)}">${escapeHtml(movie.title)}</div>
            <div class="movie-meta">${escapeHtml(metaLine(movie) || '暂无元数据')}</div>
            <div class="movie-actions">
              <button data-action="detail" data-payload="${payload(movie)}">详情</button>
              <button data-action="favorite" data-payload="${payload(movie)}">${favoriteKeys.has(movie.slug) ? '已收藏' : '收藏'}</button>
              <button data-action="later" data-payload="${payload(movie)}">${laterKeys.has(movie.slug) ? '已稍后' : '稍后'}</button>
              <button data-action="open-site" data-payload="${payload(movie)}">打开</button>
            </div>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderPoster(movie) {
  const label = escapeHtml(String(movie.title || 'DDYS').slice(0, 2));
  if (!movie.poster) return `<div class="poster"><span>${label}</span></div>`;
  return `<div class="poster"><img src="${escapeAttr(movie.poster)}" alt="${escapeAttr(movie.title)}" loading="lazy"></div>`;
}

function renderResources(items) {
  if (!Array.isArray(items) || !items.length) return '<div class="state-panel">暂无资源</div>';
  return `
    <div class="item-list">
      ${items.map((item) => `
        <div class="resource-item">
          <strong>${escapeHtml(item.name || item.title || item.type || '资源')}</strong>
          <div class="movie-meta">${escapeHtml([item.quality, item.format, item.size, item.download_type].filter(Boolean).join(' / '))}</div>
          <div class="row-actions">
            ${item.url ? `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">打开资源</a>` : ''}
            ${item.extract_code ? `<span class="badge">提取码 ${escapeHtml(item.extract_code)}</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function normalizeCalendar(calendar) {
  const now = new Date();
  const year = Number(calendar?.year || now.getFullYear());
  const month = Number(calendar?.month || now.getMonth() + 1);
  const days = calendar?.days || groupCalendarMovies(calendar?.movies || []);
  const count = new Date(year, month, 0).getDate();
  const first = new Date(year, month - 1, 1).getDay();
  const cells = Array.from({ length: first }, () => ({ day: '', items: [] }));
  for (let day = 1; day <= count; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, items: (days[key] || []).map(normalizeMovie) });
  }
  while (cells.length % 7 !== 0) cells.push({ day: '', items: [] });
  return { title: `${year}-${String(month).padStart(2, '0')}`, cells };
}

function groupCalendarMovies(items) {
  const out = {};
  for (const item of items) {
    const key = item.date || item.release_date || '';
    if (!key) continue;
    out[key] = [...(out[key] || []), item];
  }
  return out;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function payload(value) {
  return escapeAttr(JSON.stringify(value || {}));
}

export function readPayload(element) {
  return safeJsonParse(element.dataset.payload || '{}', {});
}
