# DDYS Edge Extension

低端影视 DDYS 的 Microsoft Edge 独立扩展，面向日常用户而不是开发者示例。它提供搜索、最新、热门、日历、影片详情、资源入口、收藏、稍后看、观看记录、关键词订阅、浏览器通知、右键搜索、地址栏搜索、Edge 侧边栏、新标签页、设置、诊断和数据导入导出。

## 功能

- 工具栏弹窗：搜索、最新、热门、日历、收藏、稍后看、历史、订阅和设置。
- Edge 侧边栏：更大的浏览与详情视图。
- 新标签页：DDYS 快捷搜索、最新更新、热门和本地收藏。
- 右键菜单：选中文字后直接搜索 DDYS。
- 地址栏搜索：输入 `ddys 关键词` 使用 omnibox 搜索。
- 页面内容脚本：选中文字时显示 DDYS 快捷搜索按钮。
- 影片详情：简介、年份、类型、地区、评分、在线资源、下载资源和相关推荐。
- 本地数据：收藏、稍后看、观看记录、本地备注、关键词订阅。
- 更新提醒：后台定时检查订阅关键词并发送 Edge 通知。
- 设置：API Base、站点 Base、缓存时间、刷新间隔、打开方式、通知开关、选区按钮开关。
- 数据导入导出：完整 JSON 备份和恢复。
- 诊断：检查 API、权限、缓存和后台提醒状态。

## 安装

1. 下载 GitHub Release 中的 `ddys-edge-extension-v0.1.0.zip`。
2. 解压到本地目录。
3. 打开 Microsoft Edge `edge://extensions/`。
4. 开启开发人员模式。
5. 点击“加载解压缩的扩展”，选择解压后的目录。

## 权限说明

扩展使用 `storage` 保存本地收藏和设置，使用 `alarms` 与 `notifications` 做订阅提醒，使用 `contextMenus` 与 `omnibox` 做快速搜索，使用 `tabs` 打开 DDYS 页面，使用 `sidePanel` 提供 Edge 侧边栏。`http/https` 页面权限用于内容脚本选区搜索和自定义 API Base。

详细说明见 [docs/permissions.md](docs/permissions.md)。

## 开发与校验

```powershell
node tools\check.mjs
node --test tests\*.test.mjs
powershell -ExecutionPolicy Bypass -File tools\build-package.ps1
```

生成的发布包位于：

```text
..\..\..\releases\ddys-edge-extension-v0.1.0.zip
```

## 隐私

扩展默认只把查询发送到用户配置的 DDYS API Base。收藏、稍后看、观看记录、备注、订阅和设置保存在浏览器本地 `chrome.storage.local`。Microsoft Edge 的 Chromium 扩展运行时仍使用 `chrome.*` API 命名空间。详见 [PRIVACY.md](PRIVACY.md)。
