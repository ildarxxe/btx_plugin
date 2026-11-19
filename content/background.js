// ==========================================
// BACKGROUND: связь между Bitrix24 и WhatsApp Web (для Tampermonkey)
// ==========================================

// Вспомогательная функция: доставляет сообщение на страницу, где работает Tampermonkey
async function sendToTampermonkey(tabId, payload) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (msg) => {
                window.postMessage({ source: 'BTX_EXT_BG', ...msg }, '*');
            },
            args: [payload]
        });
    } catch (err) {
        console.error("[BG] Не удалось передать команду на вкладку:", err);
    }
}

// Слушаем сообщения от popup_loader.js (переходник от страницы и iframe)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openWhatsAppAndSearch") {
        const bitrixTabId = sender.tab ? sender.tab.id : null;
        handleWhatsAppTransition(request.data, bitrixTabId);
    } else if (request.action === "returnToBitrix") {
        handleBitrixReturn(request.stageType);
    } else if (request.action === "FORWARD_TO_TAB") {
        // Команды от popup (Старт / Стоп)
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
        const stored = await chrome.storage.local.get(['bitrixTabId']);
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
