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

// Открывает чат по синему значку «Чат». Если появляется кнопка «Ответить» — нажимает её.
// Если кнопки «Ответить» нет — просто оставляет открытый чат для отправки.
async function openBitrixChatForCard(cardId, clickAnswerIfPresent = false) {
    const chatBtn = await waitForEnabledAnyDoc(SELECTORS.bitrix.chatBtn, CHAT_BTN_WAIT_MS);
    if (!chatBtn) {
        console.log(`[Бот CRM] [Заявка ${cardId}] Кнопка 'Чат' не найдена/недоступна.`);
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
                .filter(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true');
            const replyBtn = panelBtns.find(e => /ответить/i.test((e.innerText || e.textContent || '').trim()));
            if (replyBtn) {
                console.log(`[Бот CRM] [Заявка ${cardId}] Нажимаем 'Ответить'.`);
                clickLikeUser(replyBtn);
                await sleep(1000);
                return true;
            }
        }

        const ta = findInAnyDocument(SELECTORS.bitrix.messengerTextarea);
        if (ta && !ta.disabled) {
            return true;
        }

        if (!chatLoadedAt && findInAnyDocument(SELECTORS.bitrix.messengerOpened)) {
            chatLoadedAt = Date.now();
        }
        if (chatLoadedAt && (Date.now() - chatLoadedAt >= MESSENGER_ANSWER_GRACE_MS)) {
            return true;
        }

        await sleep(400);
    }

    return !!findInAnyDocument(SELECTORS.bitrix.messengerOpened) || !!findInAnyDocument(SELECTORS.bitrix.messengerTextarea);
}

async function closeChatAndCard() {
    await doubleEscape();
    await returnToCRMAndEscape();
}

async function returnToCRMAndEscape() {
    console.log("[Бот CRM] Закрываем окно/карточку (Escape)...");
    pressEscapeEverywhere();

    for (let i = 0; i < 8; i++) {
        await sleep(700);

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