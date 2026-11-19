// =====================================================================================
// МОДУЛЬ 99_main.js
// ТОЧКА ВХОДА: восстановление настроек, приём сообщений от popup/background, горячие клавиши Ctrl+Shift+X / Ctrl+Shift+Z
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: (код верхнего уровня)
// =====================================================================================

chrome.storage.local.get(['botConfig']).then(st => {
    if (st && st.botConfig) {
        BOT_CONFIG = { ...BOT_CONFIG, ...st.botConfig, isPaused: false };
        console.log("[Бот] Восстановлен сохранённый конфиг:", BOT_CONFIG);
    }
}).catch(() => {});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Бот] Получено сообщение:", request.action);
    if (request.action === "START_BOT") {
        if (isScriptRunning) return;
        BOT_CONFIG = request.config;
        console.log("[Бот] Получена команда СТАРТ из UI:", BOT_CONFIG);
        sendResponse({ status: "started" });
        cardAttempts = {};
        chrome.storage.local.set({ handledCardIds: [], botConfig: BOT_CONFIG }).then(() => startAutomation());
    }
    else if (request.action === "STOP_BOT") {
        stopBot("кнопка STOP в UI");
    }
    else if (request.action === "startWhatsAppAutomation") {
        if (request.data && request.data.openOnly) {
            // Ручной режим (Ctrl+Alt+W в открытой заявке): только открыть чат, ничего не отправлять
            console.log("[Бот WA] Ручное открытие чата для номера:", request.data.phone);
            openWhatsAppChatOnly(request.data.phone);
        } else {
            BOT_CONFIG = request.data.config || BOT_CONFIG;
            console.log("[Бот WA] Начинаем работу с номером:", request.data.phone);
            executeWhatsAppLogic(request.data.phone);
        }
    }
    else if (request.action === "resumeBitrixWorkflow") {
        if (request.stageType === 'stop') {
            (async () => {
                await returnToCRMAndEscape();
                stopBot("дневной лимит отправок");
                alert(`Достигнут дневной лимит отправок (${MAX_SENDS_PER_DAY}).\nПлагин остановлен, продолжите завтра — так меньше риск блокировки WhatsApp.\n(Лимит меняется константой MAX_SENDS_PER_DAY в начале content.js)`);
            })();
        } else if (request.stageType === 'skip') {
            console.log("[Бот CRM] Номер не найден в WhatsApp — пропускаем заявку без смены статуса.");
            (async () => {
                await addHandledCardId(await getCurrentCardId());
                await returnToCRMAndEscape();
                proceedToNextCardFromStorage();
            })();
        } else {
            console.log("[Бот CRM] Вернулись из WhatsApp, меняем стадию...");
            finishCardAndMoveNext();
        }
    }
});

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault();
        stopBot("Ctrl+Shift+Z");
        return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
        e.preventDefault();
        isScriptRunning = false;
        BOT_CONFIG.isPaused = false;
        localStorage.removeItem(STORAGE_KEY);
        alert("Работа плагина возобновлена!\nЗаявки без номера / без WhatsApp будут пропущены.");
        returnToCRMAndEscape().then(() => startAutomation());
    }
});