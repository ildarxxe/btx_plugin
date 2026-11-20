const baseUrl = "https://ildarxxe.github.io/btx_plugin/popup_remote.html";
const frame = document.getElementById("remoteFrame");
frame.src = baseUrl + "?t=" + Date.now();

function postToRemotePopup(action, payload) {
    try {
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ source: "BTX_POPUP_HOST", action, payload }, "*");
        }
    } catch (e) {
        console.error("[PopupLoader] Ошибка отправки в remoteFrame:", e);
    }
}

window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object" || data.source !== "BTX_REMOTE_POPUP" || !data.payload) return;

    const payload = data.payload;
    if (payload.action === "LOAD_POPUP_STATE") {
        chrome.runtime.sendMessage({ action: "GET_POPUP_STATE" }, (response) => {
            void chrome.runtime.lastError;
            if (response && response.ok) {
                postToRemotePopup("POPUP_STATE_LOADED", response.state);
            }
        });
        return;
    }

    try {
        chrome.runtime.sendMessage(payload, () => {
            void chrome.runtime.lastError;
        });
    } catch (e) {
        console.error("[PopupLoader] Ошибка пересылки в background:", e);
    }
});