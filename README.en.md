# DDYS Edge Extension

A standalone Microsoft Edge extension for DDYS users. It includes search, latest updates, hot movies, calendar, movie details, sources, favorites, watch later, local history, keyword subscriptions, Edge notifications, context-menu search, omnibox search, Edge sidebar, new tab dashboard, settings, diagnostics, and JSON import/export.

## Features

- Toolbar popup for search, discovery, calendar, library, subscriptions, and settings.
- Edge sidebar with a wider browsing and detail layout.
- New tab dashboard with quick search, latest updates, hot movies, and local library.
- Context-menu search for selected text.
- Omnibox search with the `ddys` keyword.
- Content script selection bubble for quick DDYS search.
- Movie detail view with intro, metadata, online sources, downloads, and related items.
- Local data for favorites, watch later, history, notes, and subscriptions.
- Background subscription checks with Edge notifications.
- Settings for API base, site base, cache TTL, refresh interval, open target, notifications, and selection bubble.
- JSON export and import.
- Diagnostics for API, permissions, cache, and notification status.

## Install

1. Download `ddys-edge-extension-v0.1.0.zip` from GitHub Releases.
2. Extract it locally.
3. Open Microsoft Edge `edge://extensions/`.
4. Enable Developer mode.
5. Click "Load unpacked" and select the extracted folder.

## Verification

```powershell
node tools\check.mjs
node --test tests\*.test.mjs
powershell -ExecutionPolicy Bypass -File tools\build-package.ps1
```

The release zip is written to:

```text
..\..\..\releases\ddys-edge-extension-v0.1.0.zip
```
