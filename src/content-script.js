(function ddysContentScript() {
  const state = {
    enabled: true,
    selection: '',
    bubble: null
  };

  chrome.runtime.sendMessage({ type: 'DDYS_GET_SETTINGS' }, (response) => {
    if (response?.ok && response.result) {
      state.enabled = response.result.selectionBubbleEnabled !== false;
    }
  });

  document.addEventListener('selectionchange', debounce(updateBubble, 120), { passive: true });
  document.addEventListener('scroll', hideBubble, { passive: true });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'DDYS_REQUEST_SELECTION') {
      sendResponse({ selection: readSelection() });
    }
  });

  function updateBubble() {
    if (!state.enabled) return;
    const text = readSelection();
    if (text.length < 2 || text.length > 80) {
      hideBubble();
      return;
    }
    const range = getSelectionRange();
    if (!range) {
      hideBubble();
      return;
    }
    state.selection = text;
    const rect = range.getBoundingClientRect();
    const bubble = getBubble();
    bubble.querySelector('span').textContent = text;
    bubble.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
    bubble.style.top = `${Math.max(8, rect.bottom + window.scrollY + 8)}px`;
    bubble.style.display = 'flex';
  }

  function getBubble() {
    if (state.bubble) return state.bubble;
    const bubble = document.createElement('div');
    bubble.className = 'ddys-selection-bubble';
    bubble.innerHTML = '<span></span><button type="button">搜索 DDYS</button>';
    bubble.querySelector('button').addEventListener('click', () => {
      const query = state.selection || readSelection();
      if (query) chrome.runtime.sendMessage({ type: 'DDYS_OPEN_SEARCH', query });
      hideBubble();
    });
    document.documentElement.appendChild(bubble);
    state.bubble = bubble;
    return bubble;
  }

  function hideBubble() {
    if (state.bubble) state.bubble.style.display = 'none';
  }

  function readSelection() {
    return String(window.getSelection?.() || '').trim().replace(/\s+/g, ' ');
  }

  function getSelectionRange() {
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0) return null;
    return selection.getRangeAt(0);
  }

  function debounce(fn, wait) {
    let timer = 0;
    return function debounced() {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }
})();
