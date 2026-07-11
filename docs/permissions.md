# Edge 权限说明

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存设置、收藏、稍后看、观看记录、备注、订阅和 API 缓存。 |
| `alarms` | 按用户设置的间隔检查关键词订阅。 |
| `notifications` | 订阅命中新结果时发送 Edge 通知。 |
| `contextMenus` | 选中文字后右键搜索 DDYS。 |
| `activeTab` | 用户触发快捷键时读取当前活动标签页的选中文本。 |
| `tabs` | 打开 DDYS 站点、扩展详情页、设置页和搜索结果页。 |
| `scripting` | 快捷键触发时读取当前页面选中文本。 |
| `sidePanel` | 提供 Edge 侧边栏浏览和详情视图。 |
| `http://*/*`、`https://*/*` | 内容脚本选区搜索和自定义 API Base 访问。 |
| `https://ddys.io/*` | 访问官方 DDYS API 和站点。 |

扩展不使用远程脚本，不读取密码，不采集浏览历史，不上传本地收藏和备注。Edge Chromium 扩展 API 命名空间仍为 `chrome.*`。
