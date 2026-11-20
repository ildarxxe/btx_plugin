// ==========================================
// BACKGROUND: связь между Bitrix24, попапом и WhatsApp Web (для Tampermonkey)
// ==========================================

const CUSTOM_FLOW_KEY = "elki_custom_flow_v1";

async function sendToTampermonkey(tabId, payload) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (msg) => {
                window.postMessage({ source: "BTX_EXT_BG", ...msg }, "*");
            },
            args: [payload]
        });
    } catch (err) {
        console.error("[BG] Не удалось передать команду на вкладку:", err);
    }
}

async function broadcastToBitrixTabs(payload) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (tab.url && tab.url.includes("bitrix24")) {
            await sendToTampermonkey(tab.id, payload);
        }
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || typeof request !== "object") return false;

    if (request.action === "GET_POPUP_STATE") {
        (async () => {
            try {
                const stored = await chrome.storage.local.get(["runMode", "useTestPhone", "testPhone", CUSTOM_FLOW_KEY]);
                sendResponse({
                    ok: true,
                    state: {
                        runMode: stored.runMode || "new",
                        useTestPhone: typeof stored.useTestPhone === "boolean" ? stored.useTestPhone : false,
                        testPhone: stored.testPhone || "87781193946",
                        customFlow: stored[CUSTOM_FLOW_KEY] || null
                    }
                });
            } catch (e) {
                console.error("[BG] Ошибка GET_POPUP_STATE:", e);
                sendResponse({ ok: false });
            }
        })();
        return true;
    }

    if (request.action === "SAVE_CUSTOM_FLOW") {
        (async () => {
            try {
                await chrome.storage.local.set({ [CUSTOM_FLOW_KEY]: request.payload });
            } catch (e) {
                console.warn("[BG] Не удалось сохранить в chrome.storage.local (возможно, большой файл), передаём напрямую в TM:", e);
            }
            await broadcastToBitrixTabs({
                action: "SAVE_CUSTOM_FLOW_TO_TM",
                payload: request.payload
            });
            if (sendResponse) sendResponse({ ok: true });
        })();
        return true;
    }

    if (request.action === "SAVE_RUN_CONFIG_AND_START") {
        (async () => {
            const cfg = request.config || {};
            try {
                await chrome.storage.local.set({
                    runMode: cfg.runMode,
                    useTestPhone: cfg.useTestPhone,
                    testPhone: cfg.testPhone,
                    isPaused: false
                });
            } catch (e) {}

            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab && activeTab.id) {
                await sendToTampermonkey(activeTab.id, { action: "START_BOT", config: cfg });
            }
            if (sendResponse) sendResponse({ ok: true });
        })();
        return true;
    }

    if (request.action === "STOP_BOT_FROM_POPUP") {
        (async () => {
            try {
                await chrome.storage.local.set({ isPaused: true, botState: null });
            } catch (e) {}
            await broadcastToBitrixTabs({ action: "STOP_BOT" });
            if (sendResponse) sendResponse({ ok: true });
        })();
        return true;
    }

    if (request.action === "openWhatsAppAndSearch") {
        const bitrixTabId = sender.tab ? sender.tab.id : null;
        handleWhatsAppTransition(request.data, bitrixTabId);
    } else if (request.action === "returnToBitrix") {
        handleBitrixReturn(request.stageType);
    } else if (request.action === "FORWARD_TO_TAB") {
        (async () => {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab) {
                await sendToTampermonkey(activeTab.id, request.payload);
            }
        })();
    }

    return false;
});

async function handleWhatsAppTransition(data, bitrixTabId) {
    try {
        await chrome.storage.local.set({ botState: data, bitrixTabId: bitrixTabId });
        console.log("[BG] Сохранили botState и bitrixTabId:", bitrixTabId);

        const tabs = await chrome.tabs.query({});
        const targetTab = tabs.find(tab => tab.title && tab.title.includes("WhatsApp Business"));

        if (targetTab) {
            await chrome.tabs.update(targetTab.id, { active: true });
            await chrome.windows.update(targetTab.windowId, { focused: true });

            await sendToTampermonkey(targetTab.id, { action: "startWhatsAppAutomation", data: data });
        } else {
            console.warn("[BG] Вкладка с заголовком 'WhatsApp Business' не найдена!");
        }
    } catch (e) {
        console.error("[BG] Ошибка handleWhatsAppTransition:", e);
    }
}

async function handleBitrixReturn(stageType) {
    try {
        const stored = await chrome.storage.local.get(["bitrixTabId"]);
        let bitrixTab = null;

        if (stored.bitrixTabId) {
            try {
                bitrixTab = await chrome.tabs.get(stored.bitrixTabId);
            } catch (e) {
                console.warn("[BG] Сохранённая вкладка Bitrix больше не существует.");
            }
        }

        if (!bitrixTab) {
            const allTabs = await chrome.tabs.query({});
            bitrixTab = allTabs.find(tab => tab.url && tab.url.includes("bitrix24"));
        }

        if (!bitrixTab) {
            console.error("[BG] Вкладка Bitrix не найдена!");
            return;
        }

        console.log("[BG] Возвращаемся во вкладку Bitrix:", bitrixTab.id);
        await chrome.tabs.update(bitrixTab.id, { active: true });
        await chrome.windows.update(bitrixTab.windowId, { focused: true });

        await new Promise(resolve => setTimeout(resolve, 800));

        await sendToTampermonkey(bitrixTab.id, {
            action: "resumeBitrixWorkflow",
            stageType: stageType
        });
    } catch (e) {
        console.error("[BG] Ошибка handleBitrixReturn:", e);
    }
}