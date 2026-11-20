const baseUrl = "https://ildarxxe.github.io/btx_plugin/popup_remote.html";
document.getElementById("remoteFrame").src = baseUrl + "?t=" + Date.now();

window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.source === 'BTX_REMOTE_POPUP' && data.payload) {
        chrome.runtime.sendMessage(data.payload);
    }
});