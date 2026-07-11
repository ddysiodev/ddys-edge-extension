export function getEdgeApi() {
  if (!globalThis.chrome) {
    throw new Error('Microsoft Edge extension API is not available.');
  }
  return globalThis.chrome;
}

export function hasEdgeApi() {
  return Boolean(globalThis.chrome?.runtime?.id);
}

export function callbackToPromise(factory) {
  const chromeApi = getEdgeApi();
  return new Promise((resolve, reject) => {
    factory((result) => {
      const error = chromeApi.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}

export function storageGet(keys) {
  return callbackToPromise((done) => getEdgeApi().storage.local.get(keys, done));
}

export function storageSet(value) {
  return callbackToPromise((done) => getEdgeApi().storage.local.set(value, done));
}

export function storageRemove(keys) {
  return callbackToPromise((done) => getEdgeApi().storage.local.remove(keys, done));
}

export function runtimeUrl(path) {
  return getEdgeApi().runtime.getURL(path);
}

export async function createTab(url, options = {}) {
  const active = options.active !== false;
  return callbackToPromise((done) => getEdgeApi().tabs.create({ url, active }, done));
}

export async function queryActiveTab() {
  const tabs = await callbackToPromise((done) => getEdgeApi().tabs.query({ active: true, currentWindow: true }, done));
  return tabs?.[0] || null;
}

export async function sendMessageToTab(tabId, message) {
  return callbackToPromise((done) => getEdgeApi().tabs.sendMessage(tabId, message, done));
}

export async function notify(id, options) {
  return callbackToPromise((done) => getEdgeApi().notifications.create(id, options, done));
}

export async function setBadge(text, color = '#0e7c66') {
  const chromeApi = getEdgeApi();
  await callbackToPromise((done) => chromeApi.action.setBadgeBackgroundColor({ color }, done));
  await callbackToPromise((done) => chromeApi.action.setBadgeText({ text }, done));
}

export async function ensureOriginPermission(url) {
  const chromeApi = getEdgeApi();
  const origin = new URL(url).origin;
  const origins = [`${origin}/*`];
  const contains = await callbackToPromise((done) => chromeApi.permissions.contains({ origins }, done));
  if (contains) return true;
  return callbackToPromise((done) => chromeApi.permissions.request({ origins }, done));
}

export function createMemoryEdge(initial = {}) {
  const area = { ...initial };
  const listeners = new Map();
  const chromeApi = {
    runtime: {
      id: 'test-extension',
      lastError: null,
      getURL(path) {
        return `edge-extension://test/${path}`;
      },
      onMessage: makeEvent(listeners, 'runtime.onMessage'),
      onInstalled: makeEvent(listeners, 'runtime.onInstalled'),
      sendMessage(message, callback) {
        callback?.({ ok: true, message });
      }
    },
    storage: {
      local: {
        get(keys, callback) {
          if (!keys) {
            callback({ ...area });
            return;
          }
          if (Array.isArray(keys)) {
            callback(Object.fromEntries(keys.map((key) => [key, area[key]])));
            return;
          }
          if (typeof keys === 'string') {
            callback({ [keys]: area[keys] });
            return;
          }
          callback({ ...keys, ...Object.fromEntries(Object.keys(keys).map((key) => [key, area[key] ?? keys[key]])) });
        },
        set(value, callback) {
          Object.assign(area, value);
          callback?.();
        },
        remove(keys, callback) {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete area[key];
          callback?.();
        }
      }
    },
    alarms: {
      create(name, info) {
        area[`alarm:${name}`] = info;
      },
      clear(name, callback) {
        delete area[`alarm:${name}`];
        callback?.(true);
      },
      onAlarm: makeEvent(listeners, 'alarms.onAlarm')
    },
    notifications: {
      create(id, options, callback) {
        area[`notification:${id}`] = options;
        callback?.(id);
      }
    },
    contextMenus: {
      removeAll(callback) {
        area.contextMenus = [];
        callback?.();
      },
      create(item) {
        area.contextMenus = [...(area.contextMenus || []), item];
      },
      onClicked: makeEvent(listeners, 'contextMenus.onClicked')
    },
    action: {
      setBadgeText(details, callback) {
        area.badgeText = details.text;
        callback?.();
      },
      setBadgeBackgroundColor(details, callback) {
        area.badgeColor = details.color;
        callback?.();
      }
    },
    permissions: {
      contains(_details, callback) {
        callback(true);
      },
      request(_details, callback) {
        callback(true);
      }
    },
    tabs: {
      create(details, callback) {
        callback?.({ id: Date.now(), ...details });
      },
      query(_details, callback) {
        callback?.([{ id: 1, url: 'https://example.test/' }]);
      },
      sendMessage(_tabId, message, callback) {
        callback?.({ ok: true, message });
      }
    },
    __area: area,
    __listeners: listeners
  };
  return chromeApi;
}

function makeEvent(listeners, name) {
  return {
    addListener(fn) {
      listeners.set(name, [...(listeners.get(name) || []), fn]);
    }
  };
}
