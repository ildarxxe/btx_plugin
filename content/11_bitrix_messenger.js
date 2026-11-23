// =====================================================================================
// МОДУЛЬ 11_bitrix_messenger.js
// BITRIX: МЕССЕНДЖЕР (кнопка «Чат» -> если есть «Ответить», нажимаем; закрытие через Escape)
// =====================================================================================

async function doubleEscape() {
    pressEscapeEverywhere();
    await sleep(MESSENGER_ESC_GAP_MS);
    pressEscapeEverywhere();
    await sleep(MESSENGER_ESC_GAP_MS);
}

async function ensureCardOpen(cardId) {
    if (findInAnyDocument(SELECTORS.bitrix.sidePanelIframe)) return true;
    const column = document.querySelector(
        BOT_CONFIG.runMode === 'new' ? SELECTORS.bitrix.newColumn : SELECTORS.bitrix.touchColumn
    );
    const card = column && Array.from(column.querySelectorAll(SELECTORS.bitrix.cards)).find(c => getCardId(c) === cardId);
    const link = card && card.querySelector('.crm-kanban-item-title');
    if (!link) return false;
    link.click();
    await sleep(1500);
    return true;
}

function isChatActionButtonAvailable(el) {
    if (!el || !isVisible(el)) return false;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    if (el.classList.contains('crm-entity-widget-client-action-disabled') || el.classList.contains('--disabled')) {
        return false;
    }
    return el.classList.contains('crm-entity-widget-client-action-available') || Boolean(el.getAttribute('href'));
}

// Открывает чат по синему значку «Чат». Если появляется кнопка «Ответить» — нажимает её.
// Если кнопка чата заблокирована (<a class="crm-entity-widget-client-action-im"></a> без available) — сразу возвращает false.
async function openBitrixChatForCard(cardId, clickAnswerIfPresent = false) {
    const start = Date.now();
    let chatBtn = null;

    while (Date.now() - start < CHAT_BTN_WAIT_MS) {
        if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return false;
        const allImBtns = findAllInAnyDocument('a.crm-entity-widget-client-action-im');
        if (allImBtns.length) {
            const avail = allImBtns.find(isChatActionButtonAvailable);
            if (avail) {
                chatBtn = avail;
                break;
            }
        }
        await sleep(400);
    }

    if (!chatBtn) {
        console.log(`[Бот CRM] [Заявка ${cardId}] Кнопка 'Чат' не найдена или заблокирована.`);
        return false;
    }

    console.log(`[Бот CRM] [Заявка ${cardId}] Нажимаем синий значок 'Чат'...`);
    clickLikeUser(chatBtn);

    const started = Date.now();
    let chatLoadedAt = 0;

    while (Date.now() - started < MESSENGER_WAIT_MS) {
        if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return false;

        if (clickAnswerIfPresent) {
            const panelBtns = findAllInAnyDocument(SELECTORS.bitrix.messengerJoinBtns)
                .filter(e => isVisible(e) && !e.disabled && e.getAttribute('aria-disabled') !== 'true');
            const replyBtn = panelBtns.find(e => /^ответить$/i.test((e.innerText || e.textContent || '').trim()));
            if (replyBtn) {
                console.log(`[Бот CRM] [Заявка ${cardId}] Нажимаем 'Ответить'.`);
                clickLikeUser(replyBtn);
                await sleep(1000);
                return true;
            }
        }

        const ta = findAllInAnyDocument(SELECTORS.bitrix.messengerTextarea).find(isVisible);
        if (ta && !ta.disabled) {
            return true;
        }

        const joinBtns = findAllInAnyDocument(SELECTORS.bitrix.messengerJoinBtns)
            .filter(e => isVisible(e) && !e.disabled && e.getAttribute('aria-disabled') !== 'true');
        if (joinBtns.some(e => /^ответить$/i.test((e.innerText || e.textContent || '').trim()))) {
            return true;
        }

        if (!chatLoadedAt && findAllInAnyDocument(SELECTORS.bitrix.messengerOpened).some(isVisible)) {
            chatLoadedAt = Date.now();
        }
        if (chatLoadedAt && (Date.now() - chatLoadedAt >= 800)) {
            return true;
        }

        await sleep(400);
    }

    return findAllInAnyDocument(SELECTORS.bitrix.messengerOpened).some(isVisible) ||
        findAllInAnyDocument(SELECTORS.bitrix.messengerTextarea).some(isVisible);
}

async function closeChatAndCard() {
    await doubleEscape();
    await returnToCRMAndEscape();
}

async function returnToCRMAndEscape() {
    console.log("[Бот CRM] Закрываем окно/карточку (Escape)...");
    pressEscapeEverywhere();

    for (let i = 0; i < 8; i++) {
        if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return;
        await sleep(700);
        if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return;

        const popup = findInAnyDocument(SELECTORS.bitrix.todoPopup);
        const slider = Array.from(document.querySelectorAll(SELECTORS.bitrix.sidePanelIframe)).find(isVisible);

        if (!popup && !slider) {
            console.log("[Бот CRM] Карточка/панель закрыта.");
            return;
        }

        if (popup) {
            pressEscapeEverywhere();
        } else if (i >= 2) {
            pressEscapeEverywhere();
        }
    }
}