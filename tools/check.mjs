import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

const requiredFiles = [
  'manifest.json',
  'popup.html',
  'sidepanel.html',
  'options.html',
  'newtab.html',
  'README.md',
  'README.en.md',
  'PRIVACY.md',
  'LICENSE',
  'package.json',
  '_locales/zh_CN/messages.json',
  '_locales/en/messages.json',
  'assets/icons/icon-16.png',
  'assets/icons/icon-32.png',
  'assets/icons/icon-48.png',
  'assets/icons/icon-128.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'src/background.js',
  'src/content-script.js',
  'src/content-script.css',
  'src/popup.js',
  'src/sidepanel.js',
  'src/options.js',
  'src/newtab.js',
  'src/shared/api.js',
  'src/shared/edge-api.js',
  'src/shared/constants.js',
  'src/shared/normalize.js',
  'src/shared/storage.js',
  'src/shared/subscriptions.js',
  'src/shared/ui.js',
  'src/styles/app.css',
  'docs/user-research.md',
  'docs/permissions.md',
  'docs/store-listing.md',
  'docs/store-assets/edge-logo-300.png',
  'docs/store-assets/edge-tile-440x280.png',
  'docs/store-assets/edge-marquee-1400x560.png',
  'tests/api.test.mjs',
  'tests/normalize.test.mjs',
  'tests/storage.test.mjs',
  'tests/subscriptions.test.mjs',
  'tools/check.mjs',
  'tools/build-package.ps1'
];

for (const file of requiredFiles) await mustExist(file);
await checkJson();
await checkSyntax();
await checkManifest();
await checkHtml();
await checkPackage();
await checkDocs();
await checkForbiddenFiles();
await checkForbiddenText();

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, files: (await listFiles(root)).length, package: 'ddys-edge-extension' }, null, 2));

async function checkJson() {
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    if (!/\.json$/i.test(rel)) continue;
    try {
      JSON.parse(await fs.readFile(full, 'utf8'));
    } catch (error) {
      assert(false, `${rel} is not valid JSON: ${error.message}`);
    }
  }
}

async function checkSyntax() {
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    if (!/\.(js|mjs)$/i.test(rel)) continue;
    const result = spawnSync(process.execPath, ['--check', full], { stdio: 'inherit' });
    assert(result.status === 0, `${rel} failed node --check.`);
  }
}

async function checkManifest() {
  const manifest = JSON.parse(await read('manifest.json'));
  assert(manifest.manifest_version === 3, 'manifest_version must be 3.');
  assert(manifest.version === '0.1.0', 'manifest version mismatch.');
  assert(manifest.action?.default_popup === 'popup.html', 'action popup missing.');
  assert(manifest.background?.service_worker === 'src/background.js', 'service worker missing.');
  assert(manifest.background?.type === 'module', 'background must be module.');
  assert(manifest.side_panel?.default_path === 'sidepanel.html', 'side panel missing.');
  assert(manifest.options_page === 'options.html', 'options page missing.');
  assert(manifest.chrome_url_overrides?.newtab === 'newtab.html', 'new tab override missing.');
  assert(manifest.omnibox?.keyword === 'ddys', 'omnibox keyword mismatch.');
  for (const permission of ['storage', 'alarms', 'notifications', 'contextMenus', 'tabs', 'scripting', 'sidePanel', 'activeTab']) {
    assert(manifest.permissions.includes(permission), `manifest permission missing ${permission}.`);
  }
  assert(manifest.host_permissions.includes('https://ddys.io/*'), 'official DDYS host permission missing.');
  assert(manifest.content_security_policy?.extension_pages?.includes("script-src 'self'"), 'extension CSP must keep scripts local.');
  for (const size of ['16', '32', '48', '128']) assert(manifest.icons?.[size], `manifest icon ${size} missing.`);
}

async function checkHtml() {
  for (const file of ['popup.html', 'sidepanel.html', 'options.html', 'newtab.html']) {
    const html = await read(file);
    assert(!/<script(?![^>]+src=)/i.test(html), `${file} contains inline script.`);
    assert(!/https?:\/\/.*\.js/i.test(html), `${file} loads remote script.`);
    assert(html.includes('src/styles/app.css'), `${file} must load app CSS.`);
  }
}

async function checkPackage() {
  const pkg = JSON.parse(await read('package.json'));
  assert(pkg.name === 'ddys-edge-extension', 'package name mismatch.');
  assert(pkg.version === '0.1.0', 'package version mismatch.');
  assert(pkg.private === true, 'extension package must be private.');
  assert((await read('src/shared/constants.js')).includes(`VERSION = '${pkg.version}'`), 'runtime version must match package.json.');
  assert((await read('tools/build-package.ps1')).includes(`$Version = "${pkg.version}"`), 'build script version must match package.json.');
}

async function checkDocs() {
  const readme = await read('README.md');
  for (const fragment of ['右键菜单', '地址栏搜索', '订阅提醒', '导入导出', 'Edge']) {
    assert(readme.includes(fragment), `README.md missing ${fragment}.`);
  }
  const research = await read('docs/user-research.md');
  for (const fragment of ['Manifest V3', 'service worker', 'chrome.storage', 'Microsoft Edge Add-ons']) {
    assert(research.includes(fragment), `user research missing ${fragment}.`);
  }
}

async function checkForbiddenFiles() {
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    assert(!/(^|\/)(node_modules|dist|coverage|package|\.git)(\/|$)/.test(rel), `forbidden path: ${rel}`);
    assert(!/\.(log|tmp|cache|tgz|zip|crx|pem)$/i.test(rel), `forbidden file: ${rel}`);
    assert(!/(^|\/)\.env(\.|$)/.test(rel), `forbidden env file: ${rel}`);
    assert(!['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].includes(path.basename(rel)), `forbidden lockfile: ${rel}`);
  }
}

async function checkForbiddenText() {
  const patterns = ['ghp_', 'github_pat_', 'npm_', '\uFFFD'];
  for (const full of await listFiles(root)) {
    const rel = slash(path.relative(root, full));
    if (!isTextFile(rel) || rel === 'tools/check.mjs') continue;
    const text = await fs.readFile(full, 'utf8');
    for (const pattern of patterns) assert(!text.includes(pattern), `${rel} contains forbidden text pattern ${pattern}.`);
  }
}

async function mustExist(rel) {
  try {
    await fs.stat(path.join(root, rel));
  } catch {
    failures.push(`Missing required file: ${rel}`);
  }
}

async function read(rel) {
  return fs.readFile(path.join(root, rel), 'utf8');
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (['.git', 'node_modules', 'dist', 'coverage', 'package'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else out.push(full);
  }
  return out;
}

function isTextFile(rel) {
  return /\.(js|mjs|json|html|css|md|txt|ps1)$/i.test(rel) || rel === '.gitignore' || rel === 'LICENSE';
}

function slash(value) {
  return value.replace(/\\/g, '/');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
