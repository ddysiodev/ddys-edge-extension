import { DdysAppView } from './shared/ui.js';
import { getSettings } from './shared/storage.js';

const root = document.querySelector('#app');
const settings = await getSettings();

if (settings.newTabDashboardEnabled === false) {
  root.innerHTML = `
    <section class="app-frame">
      <header class="topbar">
        <div class="brand-row">
          <div class="brand"><img src="assets/icons/icon-48.png" alt=""><div>DDYS</div></div>
        </div>
      </header>
      <section class="content">
        <div class="state-panel">新标签页面板已关闭</div>
      </section>
    </section>
  `;
} else {
  const app = new DdysAppView(root, { mode: 'newtab' });
  app.mount();
}
