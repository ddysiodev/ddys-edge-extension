import { createApi } from './shared/api.js';
import { ensureOriginPermission } from './shared/edge-api.js';
import {
  addSubscription,
  clearCache,
  exportData,
  getState,
  importData,
  removeSubscription,
  saveDiagnostics,
  saveSettings
} from './shared/storage.js';
import { escapeHtml, escapeAttr } from './shared/ui.js';
import { safeJsonParse } from './shared/normalize.js';

const root = document.querySelector('#options');
let state = await getState();

render();

root.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  try {
    if (action === 'save') await save();
    if (action === 'diagnostics') await diagnostics();
    if (action === 'export') await downloadExport();
    if (action === 'import') root.querySelector('[name="importFile"]').click();
    if (action === 'clear-cache') await clear();
    if (action === 'add-subscription') await addSub();
    if (action === 'remove-subscription') await removeSub(target.dataset.id);
  } catch (error) {
    toast(error.message || '操作失败');
  }
});

root.addEventListener('change', async (event) => {
  if (event.target.name !== 'importFile') return;
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const payload = safeJsonParse(text);
  await importData(payload);
  state = await getState();
  render();
  toast('导入完成');
});

async function save() {
  const form = root.querySelector('[data-options-form]');
  const data = new FormData(form);
  const apiBase = String(data.get('apiBase') || '').trim();
  if (apiBase) await ensureOriginPermission(apiBase).catch(() => false);
  await saveSettings({
    apiBase,
    siteBase: data.get('siteBase'),
    cacheTtlMinutes: data.get('cacheTtlMinutes'),
    refreshMinutes: data.get('refreshMinutes'),
    requestTimeoutMs: data.get('requestTimeoutMs'),
    openTarget: data.get('openTarget'),
    notificationsEnabled: data.get('notificationsEnabled') === 'on',
    selectionBubbleEnabled: data.get('selectionBubbleEnabled') === 'on',
    newTabDashboardEnabled: data.get('newTabDashboardEnabled') === 'on'
  });
  chrome.runtime.sendMessage({ type: 'DDYS_REBUILD_ALARM' });
  state = await getState();
  render();
  toast('设置已保存');
}

async function diagnostics() {
  const api = await createApi({ settings: state.settings });
  const result = await api.diagnostics();
  await saveDiagnostics(result);
  state = await getState();
  render();
  toast('诊断完成');
}

async function downloadExport() {
  const payload = await exportData();
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ddys-edge-extension-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function clear() {
  await clearCache();
  state = await getState();
  render();
  toast('缓存已清理');
}

async function addSub() {
  const query = root.querySelector('[name="subscriptionQuery"]').value.trim();
  await addSubscription({ query });
  state = await getState();
  render();
  toast('订阅已添加');
}

async function removeSub(id) {
  await removeSubscription(id);
  state = await getState();
  render();
  toast('订阅已移除');
}

function render() {
  const settings = state.settings;
  root.innerHTML = `
    <section class="options-shell">
      <header class="topbar">
        <div class="brand-row">
          <div class="brand"><img src="assets/icons/icon-48.png" alt=""><div><div>DDYS 设置</div><div class="brand-subtitle">Edge 扩展</div></div></div>
          <div class="toolbar-actions"><button data-action="diagnostics">诊断</button><button data-action="export">导出</button><button data-action="import">导入</button></div>
        </div>
      </header>
      <section class="content grid two">
        <form class="setting-panel form-grid" data-options-form>
          <div class="section-title"><span>基础设置</span><button class="primary" type="button" data-action="save">保存</button></div>
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
          <button type="button" data-action="clear-cache">清理 API 缓存</button>
        </form>

        <section class="setting-panel">
          <div class="section-title"><span>本地数据</span></div>
          <div class="grid three">
            <div class="compact-item"><strong>${state.favorites.length}</strong><span class="muted small">收藏</span></div>
            <div class="compact-item"><strong>${state.watchLater.length}</strong><span class="muted small">稍后看</span></div>
            <div class="compact-item"><strong>${state.history.length}</strong><span class="muted small">历史</span></div>
          </div>
          <input class="hidden" name="importFile" type="file" accept="application/json">
          <div class="state-panel">${state.diagnostics ? `API ${state.diagnostics.ok ? '正常' : '异常'} / ${escapeHtml(state.diagnostics.checkedAt || '')}` : '尚未诊断'}</div>
        </section>

        <section class="setting-panel">
          <div class="section-title"><span>关键词订阅</span><button type="button" data-action="add-subscription">添加</button></div>
          <div class="search-row"><input name="subscriptionQuery" placeholder="影片名、演员或关键词"><span></span></div>
          <div class="item-list">
            ${state.subscriptions.length ? state.subscriptions.map((item) => `
              <div class="compact-item">
                <strong>${escapeHtml(item.query)}</strong>
                <span class="muted small">上次检查 ${escapeHtml(item.lastCheckedAt || '暂无')}</span>
                <div class="row-actions"><button class="danger" type="button" data-action="remove-subscription" data-id="${escapeAttr(item.id)}">移除</button></div>
              </div>
            `).join('') : '<div class="state-panel">暂无订阅</div>'}
          </div>
        </section>

        <section class="setting-panel">
          <div class="section-title"><span>诊断与权限</span></div>
          <div class="compact-item"><strong>API</strong><span class="muted small">${escapeHtml(settings.apiBase)}</span></div>
          <div class="compact-item"><strong>站点</strong><span class="muted small">${escapeHtml(settings.siteBase)}</span></div>
          <div class="compact-item"><strong>提醒</strong><span class="muted small">${settings.notificationsEnabled ? '已开启' : '已关闭'} / ${settings.refreshMinutes} 分钟</span></div>
          <button type="button" data-action="diagnostics">重新诊断</button>
        </section>
      </section>
      <div class="toast hidden" role="status"></div>
    </section>
  `;
}

function toast(message) {
  const el = root.querySelector('.toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 2200);
}
