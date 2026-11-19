window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'BTX_TM_SCRIPT') return;
    chrome.runtime.sendMessage(event.data.payload);
});
