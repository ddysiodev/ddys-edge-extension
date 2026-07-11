# 用户需求与规划依据

本扩展按 Microsoft Edge MV3 独立扩展规划，优先满足真实用户每天会用到的入口，而不是只做 API 示例。

## 需求归纳

- 快速搜索：用户经常在网页、聊天、豆瓣、IMDb、论坛或搜索结果里看到片名，希望选中文字后直接查 DDYS。
- 低摩擦发现：不打开完整网站也能看最新、热门、日历和推荐结果。
- Edge 侧边栏：Edge 用户习惯把工具放在侧边栏，影片详情和资源列表适合更宽的栏位。
- 稍后处理：看到片子时先收藏或稍后看，之后再集中处理。
- 资源入口明确：详情页要直接展示在线和下载资源，避免多次跳转。
- 更新提醒：关注某个关键词、片名或剧集后，有新资源时收到通知。
- 本地私有：收藏、备注、记录和订阅优先本地保存，可导入导出。
- 可配置 API：默认使用官方 API，也允许用户切到自己的代理或缓存服务。
- 失败可解释：API 失败时要显示诊断信息，不让用户面对空白页。

## Edge 约束

- Microsoft Edge 扩展基于 Chromium，Manifest V3 后台使用 extension service worker。
- 侧边栏能力使用 `sidePanel`，适合承载完整 DDYS 面板。
- 定时任务使用 `chrome.alarms`，用户提醒使用 `chrome.notifications`。
- 快速搜索使用 `chrome.contextMenus`、`chrome.omnibox` 和内容脚本。
- 本地数据使用 `chrome.storage.local`。
- 扩展页面禁止远程代码，脚本都来自扩展包内。
- Microsoft Edge Add-ons 发布需要 zip、图标、商店描述、隐私说明和权限说明。

## 参考

- Microsoft Edge extensions: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/
- Sidebar for Microsoft Edge extensions: https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar
- Publish an extension: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- Manifest V3 for Microsoft Edge: https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/manifest-v3
- Chrome-compatible API namespace: Microsoft Edge Chromium extensions use the Chromium extension APIs, including the `chrome.*` namespace.
