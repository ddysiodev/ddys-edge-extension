import { DdysAppView } from './shared/ui.js';

const app = new DdysAppView(document.querySelector('#app'), { mode: 'popup' });
app.mount();
