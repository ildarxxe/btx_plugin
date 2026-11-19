// =====================================================================================
// МОДУЛЬ 20_wa_search.js
// WHATSAPP: ПОИСК НОМЕРА (панель «Новый чат», результаты поиска, клик, пропуск заявки)
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: getFieldLabel, getSearchFields, findNewChatPanelInput, findNewChatButton, openNewChatPanel, typeIntoSearch, findResultsScope, getVisibleSearchResults, waitForSearchResult, clickWhatsAppResult, closeNewChatPanel, dumpSearchDebug, skipCurrentCardFromWA, handlePhoneNotFound, executeWhatsAppLogic
// =====================================================================================

function getFieldLabel(el) {
    return [
        el.getAttribute('aria-label'),
        el.getAttribute('placeholder'),
        el.getAttribute('aria-placeholder'),
        el.getAttribute('title')
    ].filter(Boolean).join(' ').toLowerCase();
}

function getSearchFields() {
    return Array.from(document.querySelectorAll('input, div[contenteditable="true"]'))
        .filter(el => el.getAttribute('data-tab') !== '10')
        .filter(el => /поиск|search|номер|number/.test(getFieldLabel(el)));
}

function findNewChatPanelInput() {
    return getSearchFields().find(el => /номер|number/.test(getFieldLabel(el)) && isVisible(el)) || null;
}

function findNewChatButton() {
    const labelRe = /(новый чат|new chat)/i;

    const byLabel = Array.from(document.querySelectorAll('[aria-label], [title]'))
        .find(el => labelRe.test((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')) && isVisible(el));
    if (byLabel) return byLabel.closest('button, [role="button"]') || byLabel;

    const byIcon = document.querySelector('[data-icon="new-chat-outline"], [data-icon="new-chat"], [data-icon="chat-new"]');
    if (byIcon) return byIcon.closest('button, [role="button"]') || byIcon;

    return null;
}

async function openNewChatPanel() {
    let input = findNewChatPanelInput();
    if (input) return input;

    const btn = findNewChatButton();
    if (btn) {
        console.log("[Бот WA] Кликаем по кнопке 'Новый чат'...");
        btn.click();
        for (let i = 0; i < 10 && !input; i++) {
            await sleep(300);
            input = findNewChatPanelInput();
        }
        if (input) return input;
    } else {
        console.warn("[Бот WA] Кнопка 'Новый чат' не найдена, пробуем Ctrl+Alt+N...");
    }

    simulateKeyCombo('KeyN', { ctrlKey: true, altKey: true });
    for (let i = 0; i < 10 && !input; i++) {
        await sleep(300);
        input = findNewChatPanelInput();
    }
    return input;
}

async function typeIntoSearch(el, text) {
    el.focus();
    if (el.tagName === 'INPUT') {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, text);
    }
}

function findResultsScope(input) {
    const others = getSearchFields().filter(f => f !== input);
    let node = input.parentElement;
    let scope = null;
    while (node && node !== document.documentElement) {
        if (others.some(o => node.contains(o))) break;
        if (node.querySelector(SEARCH_RESULT_ITEM_SELECTOR)) scope = node;
        node = node.parentElement;
    }
    return scope;
}

// Результаты поиска, видимые на экране ниже поля поиска панели "Новый чат"
function getVisibleSearchResults(input) {
    const inputRect = input.getBoundingClientRect();
    const all = Array.from(document.querySelectorAll(SEARCH_RESULT_ITEM_SELECTOR));
    // берём самые внешние элементы, чтобы вложенные (listitem > cell-frame-container) не считались дважды
    const outer = all.filter(el => !all.some(other => other !== el && other.contains(el)));

    return outer.filter(el => {
        if (!isVisible(el)) return false;
        if (WA_NEW_CHAT_MENU_RE.test(el.innerText || '')) return false;

        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) return false;
        if (r.top < inputRect.bottom - 5) return false;                       // выше поля поиска
        if (r.left > inputRect.right || r.right < inputRect.left) return false; // другая колонка

        // на экране сверху должен лежать именно этот элемент (список чатов под панелью перекрыт)
        const cx = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
        const cy = Math.min(Math.max(r.top + Math.min(r.height / 2, 20), 0), window.innerHeight - 1);
        const topEl = document.elementFromPoint(cx, cy);
        return !!topEl && el.contains(topEl);
    });
}

async function waitForSearchResult(input, phone, timeout = 10000, takeFirstIfAmbiguous = false) {
    const last10 = phone.slice(-10);
    const start = Date.now();
    let lastLogAt = -2000;
    const describe = it => (it.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60);

    while (Date.now() - start < timeout) {
        await sleep(500);
        const elapsed = Date.now() - start;

        let items = getVisibleSearchResults(input);

        // запасной способ (старый): область результатов над полем поиска
        if (items.length === 0 && elapsed > 5000) {
            const scope = findResultsScope(input);
            if (scope) {
                items = Array.from(scope.querySelectorAll(SEARCH_RESULT_ITEM_SELECTOR))
                    .filter(isVisible)
                    .filter(it => !WA_NEW_CHAT_MENU_RE.test(it.innerText || ''));
            }
        }

        if (elapsed - lastLogAt >= 2000) {
            lastLogAt = elapsed;
            console.log(`[Бот WA] Ждём результаты поиска (${Math.round(elapsed / 1000)} с), видно: ${items.length}`, items.map(describe));
        }

        // 1) Номер указан в тексте результата (номер, которого нет в контактах)
        const byDigits = items.find(it => (it.innerText || '').replace(/\D/g, '').includes(last10));
        if (byDigits) return byDigits;

        // даём результатам загрузиться и стабилизироваться
        if (elapsed < 3000 || items.length === 0) continue;

        // 2) Сохранённый контакт: в тексте имя, а не номер
        const uniqueTexts = new Set(items.map(describe));
        if (items.length === 1 || uniqueTexts.size === 1) {
            console.warn("[Бот WA] В результате нет цифр номера (сохранённый контакт) — берём его:", describe(items[0]));
            return items[0];
        }

        // 3) Несколько разных результатов без номера. В тесте и в режиме "1 касание" берём первый
        // (дальше есть проверка по id сообщений, что открыт чат именно этого номера).
        if (takeFirstIfAmbiguous || BOT_CONFIG.useTestPhone || BOT_CONFIG.runMode === 'touch1') {
            console.warn(`[Бот WA] Результатов: ${items.length}, цифр номера нет — берём первый:`, items.map(describe));
            return items[0];
        }
    }

    console.warn("[Бот WA] Результат поиска не найден. Видно на экране:", getVisibleSearchResults(input).map(describe));
    return null;
}

// Кликаем именно по кликабельной обёртке результата (div role="button"), а не по вложенному блоку
function clickWhatsAppResult(el) {
    const target = el.closest('[role="button"], [role="listitem"], [role="option"]') || el;
    try { target.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(type => {
        try {
            const Ctor = type.startsWith('pointer') && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
            target.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true }));
        } catch (e) {}
    });
    target.click();
}

function closeNewChatPanel() {
    const ev = () => new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
    document.dispatchEvent(ev());
    if (document.activeElement) document.activeElement.dispatchEvent(ev());
}

function dumpSearchDebug() {
    console.warn("[Бот WA] ДЕБАГ: поля поиска:", getSearchFields().map(f => ({
        tag: f.tagName, label: getFieldLabel(f), visible: isVisible(f)
    })));
    console.warn("[Бот WA] ДЕБАГ: кнопки в шапках (header):", Array.from(document.querySelectorAll('header button, header [role="button"]'))
        .map(b => ({ label: b.getAttribute('aria-label') || b.getAttribute('title') || '', icon: (b.querySelector('[data-icon]') || {}).dataset ? b.querySelector('[data-icon]').dataset.icon : '' })));
}

async function skipCurrentCardFromWA(reason, { closePanel = false } = {}) {
    console.warn(`[Бот WA] Пропускаем заявку без смены статуса. Причина: ${reason}`);
    if (closePanel) closeNewChatPanel();

    try {
        const st = await chrome.storage.local.get(['botState']);
        await addHandledCardId(st.botState && st.botState.cardId);
    } catch (e) {
        console.error("[Бот WA] Не удалось пометить заявку как пропущенную:", e);
    }

    chrome.runtime.sendMessage({ action: "returnToBitrix", stageType: 'skip' });
}

async function handlePhoneNotFound(phoneRaw) {
    await skipCurrentCardFromWA(`номер ${phoneRaw} не найден в WhatsApp`, { closePanel: true });
}

async function executeWhatsAppLogic(phoneRaw) {
    const phone = normalizePhone(phoneRaw);
    console.log(`[Бот WA] Ищем номер: ${phoneRaw} (для поиска: ${phone})`);

    try {
        const input = await openNewChatPanel();
        if (!input) {
            dumpSearchDebug();
            showAlert("Не удалось открыть панель 'Новый чат' в WhatsApp (не найдено поле 'Поиск имени или номера'). Смотрите строки ДЕБАГ в консоли.");
            return;
        }

        await sleep(500);
        await typeIntoSearch(input, phone);

        const item = await waitForSearchResult(input, phone);
        if (!item) {
            handlePhoneNotFound(phoneRaw);
            return;
        }

        console.log("[Бот WA] Контакт найден в 'Новый чат'! Кликаем:", (item.innerText || '').trim().replace(/\s+/g, ' '));
        clickWhatsAppResult(item);

        const msgBox = await waitForSelectorPoll(SELECTORS.whatsapp.msgBox, 6000);
        if (!msgBox) {
            handlePhoneNotFound(phoneRaw);
            return;
        }

        await sleep(1500);
        await analyzeChatAndExecute(phone);
    } catch (e) {
        console.error("[Бот WA] Ошибка executeWhatsAppLogic:", e);
        showAlert("Ошибка при поиске номера в WhatsApp. Проверьте консоль.");
    }
}