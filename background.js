// ==========================================
// BACKGROUND: связь между Bitrix24 и WhatsApp Web
// ==========================================

// Слушаем сообщения от контент-скриптов
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openWhatsAppAndSearch") {
        // sender.tab — это вкладка Bitrix, с которой пришло сообщение
        const bitrixTabId = sender.tab ? sender.tab.id : null;
        handleWhatsAppTransition(request.data, bitrixTabId);
    } else if (request.action === "returnToBitrix") {
        handleBitrixReturn(request.stageType);
    }
    // sendResponse не используем, канал закрываем сразу
    return false;
});

async function handleWhatsAppTransition(data, bitrixTabId) {
    try {
        // Сохраняем состояние + id вкладки Bitrix (background в Firefox может "засыпать",
        // поэтому переменные в памяти ненадёжны — храним в storage)
        await chrome.storage.local.set({ botState: data, bitrixTabId: bitrixTabId });
        console.log("[BG] Сохранили botState и bitrixTabId:", bitrixTabId);

        const tabs = await chrome.tabs.query({});

        // Ищем вкладку WhatsApp ТОЛЬКО по заголовку (открыто два WhatsApp, нужен Business)
        const targetTab = tabs.find(tab => tab.title && tab.title.includes("WhatsApp Business"));

        if (targetTab) {
            await chrome.tabs.update(targetTab.id, { active: true });
            await chrome.windows.update(targetTab.windowId, { focused: true });

            chrome.tabs.sendMessage(targetTab.id, { action: "startWhatsAppAutomation", data: data })
                .catch(err => console.error("[BG] Не доставлено в WhatsApp:", err));
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

        // 1. Сначала пробуем вкладку, с которой стартовали
        if (stored.bitrixTabId) {
            try {
                bitrixTab = await chrome.tabs.get(stored.bitrixTabId);
            } catch (e) {
                console.warn("[BG] Сохранённая вкладка Bitrix больше не существует.");
            }
        }

        // 2. Запасной вариант: ищем любую вкладку с "bitrix24" в адресе.
        // (Шаблон "*://*.bitrix24.*/*" недопустим — звёздочка после точки в домене не разрешена,
        // поэтому раньше tabs.query падал с ошибкой.)
        if (!bitrixTab) {
            const allTabs = await chrome.tabs.query({});
            bitrixTab = allTabs.find(tab => tab.url && tab.url.includes("bitrix24"));
        }

        if (!bitrixTab) {
            console.error("[BG] Вкладка Bitrix не найдена!");
            return;
        }

        console.log("[BG] Возвращаемся во вкладку Bitrix:", bitrixTab.id, bitrixTab.url);

        await chrome.tabs.update(bitrixTab.id, { active: true });
        await chrome.windows.update(bitrixTab.windowId, { focused: true });

        // Небольшая пауза, чтобы вкладка успела "проснуться"
        await new Promise(resolve => setTimeout(resolve, 800));

        await chrome.tabs.sendMessage(bitrixTab.id, {
            action: "resumeBitrixWorkflow",
            stageType: stageType
        });
        console.log("[BG] resumeBitrixWorkflow отправлен.");
    } catch (e) {
        console.error("[BG] Ошибка handleBitrixReturn:", e);
    }
}