// =====================================================================================
// МОДУЛЬ 31_manual_open_chat.js
// РУЧНОЕ ОТКРЫТИЕ ЧАТА WHATSAPP ИЗ ОТКРЫТОЙ ЗАЯВКИ — горячая клавиша  Ctrl + Alt + W
//
// Откройте заявку вручную и нажмите Ctrl+Alt+W: плагин возьмёт номер телефона из карточки
// (так же, как при обычной работе), переключится на вкладку WhatsApp и откроет чат с этим номером.
// Больше ничего не делает: сообщения не отправляет, статус не меняет, заявку не помечает.
// Работает, пока плагин остановлен или на паузе (при работающем плагине сначала нажмите STOP / Ctrl+Shift+Z).
// Нужна открытая вкладка WhatsApp с заголовком «WhatsApp Business» (как и для обычной работы плагина).
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: openWhatsAppForCurrentCard, onOpenWhatsAppHotkey, attachOpenWhatsAppHotkey (вкладка Bitrix),
//           openWhatsAppChatOnly (вкладка WhatsApp)
// =====================================================================================

// ---------- Вкладка Bitrix: берём номер из открытой заявки и просим background открыть WhatsApp ----------
function openWhatsAppForCurrentCard() {
    if (isScriptRunning) {
        showBotToast("Плагин сейчас работает. Остановите его (кнопка STOP или Ctrl+Shift+Z) и повторите.", true);
        return;
    }

    // Номер из карточки (она открыта в боковой панели, поэтому ищем и в iframe)
    const phoneEl = findAllInAnyDocument(SELECTORS.bitrix.phoneWidget)
        .find(el => (el.innerText || '').trim().length > 0);
    if (!phoneEl) {
        showBotToast("В открытой заявке не найден номер телефона.", true);
        return;
    }

    const phone = phoneEl.innerText.trim();
    console.log(`[Бот Bitrix] Открываем чат WhatsApp для номера из заявки: ${phone}`);
    showBotToast(`Открываю чат WhatsApp: ${phone}`);

    // openOnly: true — на стороне WhatsApp будет только открыт чат (ничего не отправляется)
    chrome.runtime.sendMessage({
        action: "openWhatsAppAndSearch",
        data: { phone: phone, cardId: null, openOnly: true, config: BOT_CONFIG }
    });
}

// Горячая клавиша Ctrl+Alt+W (по физической клавише — работает при любой раскладке)
function onOpenWhatsAppHotkey(e) {
    if (!(e.ctrlKey && e.altKey && !e.shiftKey && e.code === 'KeyW')) return;
    if (!location.hostname.includes('bitrix24')) return; // только на вкладке Bitrix
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    openWhatsAppForCurrentCard();
}

// Слушаем клавиши и в основной странице, и в iframe
function attachOpenWhatsAppHotkey(doc) {
    if (doc.__elkiOpenWaHotkey) return;
    doc.__elkiOpenWaHotkey = true;
    doc.addEventListener('keydown', onOpenWhatsAppHotkey, true);
}
attachOpenWhatsAppHotkey(document);
setInterval(() => {
    try { getAllDocuments().forEach(attachOpenWhatsAppHotkey); } catch (e) {}
}, 3000);

// ---------- Вкладка WhatsApp: найти номер и открыть чат, больше ничего ----------
async function openWhatsAppChatOnly(phoneRaw) {
    const phone = normalizePhone(phoneRaw);
    console.log(`[Бот WA] Ручное открытие чата: ${phoneRaw} (для поиска: ${phone})`);

    try {
        const input = await openNewChatPanel();
        if (!input) {
            dumpSearchDebug();
            showBotToast("Не удалось открыть панель «Новый чат» в WhatsApp.", true);
            return;
        }

        await sleep(500);
        await typeIntoSearch(input, phone);

        // последний параметр: если результатов несколько и цифр номера в них нет — берём первый
        const item = await waitForSearchResult(input, phone, 10000, true);
        if (!item) {
            closeNewChatPanel();
            showBotToast(`Номер ${phoneRaw} не найден в WhatsApp.`, true);
            return;
        }

        clickWhatsAppResult(item);
        const msgBox = await waitForSelectorPoll(SELECTORS.whatsapp.msgBox, 6000);
        if (msgBox) {
            showBotToast(`Чат с ${phoneRaw} открыт`);
        } else {
            showBotToast("Не удалось открыть чат (поле ввода сообщения не появилось).", true);
        }
    } catch (e) {
        console.error("[Бот WA] Ошибка ручного открытия чата:", e);
        showBotToast("Ошибка при открытии чата WhatsApp. Подробности в консоли.", true);
    }
}
