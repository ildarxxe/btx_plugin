// =====================================================================================
// МОДУЛЬ 11_bitrix_messenger.js
// BITRIX: МЕССЕНДЖЕР (кнопка «Чат» → «Ответить»/«Присоединиться»), закрытие карточки через Escape
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: doubleEscape, ensureCardOpen, openMessengerAndAnswer, returnToCRMAndEscape
// =====================================================================================

async function doubleEscape() {
    pressEscapeEverywhere();
    await sleep(MESSENGER_ESC_GAP_MS);
    pressEscapeEverywhere();
    await sleep(MESSENGER_ESC_GAP_MS);
}

// Если Escape закрыл не только мессенджер, но и карточку — открываем её заново,
// иначе после WhatsApp не найдётся кнопка стадии.
async function ensureCardOpen(cardId) {
    if (findInAnyDocument(SELECTORS.bitrix.phoneWidget)) return true;
    console.warn(`[Бот CRM] [Заявка ${cardId}] Карточка закрылась после Escape — открываем заново.`);
    const column = document.querySelector(SELECTORS.bitrix.newColumn);
    const card = column && Array.from(column.querySelectorAll(SELECTORS.bitrix.cards)).find(c => getCardId(c) === cardId);
    const link = card && card.querySelector('.crm-kanban-item-title');
    if (!link) {
        console.warn(`[Бот CRM] [Заявка ${cardId}] Не нашли карточку в колонке для повторного открытия.`);
        return false;
    }
    link.click();
    try {
        await waitForElementWithDebug(SELECTORS.bitrix.phoneWidget, PHONE_WAIT_MS, cardId);
        return true;
    } catch (e) {
        console.warn(`[Бот CRM] [Заявка ${cardId}] Карточка не открылась повторно.`);
        return false;
    }
}

// Режим 'new' (не тестовый), заявка с номером: "Чат" -> ждём мессенджер (до 30 сек) -> "Ответить" -> 2x Escape.
// Нет доступной кнопки "Чат" — мессенджер не открывался, Escape НЕ жмём (иначе закроется карточка).
// Мессенджер не загрузился за 30 сек — пауза плагина + алерт. Кнопки "Ответить" нет, но мессенджер загружен
// (диалог уже взят вручную) — просто 2x Escape. Возвращает true, если можно идти в WhatsApp.
async function openMessengerAndAnswer(cardId) {
    const chatBtn = await waitForEnabledAnyDoc(SELECTORS.bitrix.chatBtn, CHAT_BTN_WAIT_MS);
    if (!chatBtn) {
        console.log(`[Бот CRM] [Заявка ${cardId}] Кнопка 'Чат' недоступна — мессенджер не открываем, идём в WhatsApp.`);
        return true;
    }

    console.log(`[Бот CRM] [Заявка ${cardId}] Открываем мессенджер Bitrix (кнопка 'Чат')...`);
    clickLikeUser(chatBtn);

    // Ждём одно из трёх:
    //  1) кнопку "Ответить" -> нажимаем;
    //  2) мессенджер загрузился (виден список сообщений), но кнопки нет -> диалог уже взяли вручную;
    //  3) за 30 сек. не загрузилось ничего -> пауза и алерт.
    const started = Date.now();
    let answerBtn = null;
    let messengerSeenAt = 0;
    let textareaSeenAt = 0;
    let alreadyAnswered = false;
    let wrongBtnLabel = null; // текст кнопки, если это не «Ответить» (например, «Присоединиться»)

    while (Date.now() - started < MESSENGER_WAIT_MS) {
        if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return false;

        // Кнопки панели над полем ввода. Нужна именно «Ответить»; если там что-то другое
        // (например, «Присоединиться») — останавливаем плагин с алертом
        const panelBtns = findAllInAnyDocument(SELECTORS.bitrix.messengerJoinBtns)
            .filter(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true');
        if (panelBtns.length > 0) {
            const replyBtn = panelBtns.find(e => /ответить/i.test((e.innerText || e.textContent || '').trim()));
            if (replyBtn) {
                answerBtn = replyBtn;
            } else {
                wrongBtnLabel = panelBtns.map(e => (e.innerText || e.textContent || '').trim() || '(без текста)').join(' / ');
            }
            break;
        }

        if (!messengerSeenAt && findInAnyDocument(SELECTORS.bitrix.messengerOpened)) {
            messengerSeenAt = Date.now();
            console.log(`[Бот CRM] [Заявка ${cardId}] Мессенджер загрузился, ждём кнопку 'Ответить' или поле ввода...`);
        }

        const textarea = findInAnyDocument(SELECTORS.bitrix.messengerTextarea);
        if (textarea && !textarea.disabled) {
            if (!textareaSeenAt) textareaSeenAt = Date.now();
            if (Date.now() - textareaSeenAt >= MESSENGER_ANSWER_GRACE_MS) {
                alreadyAnswered = true;
                break;
            }
        } else {
            textareaSeenAt = 0;
        }
        await sleep(500);
        if (messengerSeenAt && Date.now() - messengerSeenAt >= MESSENGER_ANSWER_GRACE_MS) {
            alreadyAnswered = true;
            break;
        }
        await sleep(500);
    }
    if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return false;

    if (wrongBtnLabel) {
        console.warn(`[Бот CRM] [Заявка ${cardId}] Вместо кнопки 'Ответить' в мессенджере: '${wrongBtnLabel}'.`);
        triggerPause(`заявка ${cardId}: вместо кнопки «Ответить» в мессенджере Bitrix кнопка «${wrongBtnLabel}».` +
            `\nСообщение клиенту НЕ отправлено, статус НЕ менялся. Возьмите диалог вручную (мессенджер оставлен открытым).`);
        return false;
    }

    if (answerBtn) {
        console.log(`[Бот CRM] [Заявка ${cardId}] Нажимаем 'Ответить'.`);
        clickLikeUser(answerBtn);
        await sleep(1000);
    } else if (alreadyAnswered) {
        console.log(`[Бот CRM] [Заявка ${cardId}] Мессенджер загружен, но кнопки 'Ответить' нет — диалог уже взят вручную. Просто закрываем мессенджер.`);
    } else {
        console.warn(`[Бот CRM] [Заявка ${cardId}] Мессенджер не загрузился за ${MESSENGER_WAIT_MS / 1000} сек.`);
        triggerPause(`заявка ${cardId}: мессенджер Bitrix не загрузился за ${MESSENGER_WAIT_MS / 1000} сек.` +
            `\nСообщение клиенту НЕ отправлено, статус НЕ менялся. Проверьте заявку вручную.`);
        return false;
    }

    await doubleEscape();
    if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return false;

    await ensureCardOpen(cardId);
    return true;
}

async function returnToCRMAndEscape() {
    console.log("[Бот CRM] Закрываем карточку (Escape)...");
    pressEscapeEverywhere();

    for (let i = 0; i < 8; i++) {
        await sleep(800);

        const popup = findInAnyDocument(SELECTORS.bitrix.todoPopup);
        const slider = Array.from(document.querySelectorAll(SELECTORS.bitrix.sidePanelIframe)).find(isVisible);

        if (!popup && !slider) {
            console.log("[Бот CRM] Карточка закрыта.");
            return;
        }

        if (popup) {
            console.log(`[Бот CRM] Появилась модалка планирования дел — жмём Escape ещё раз (попытка ${i + 1}).`);
            pressEscapeEverywhere();
        } else if (i >= 2) {
            pressEscapeEverywhere();
        }
    }
    console.warn("[Бот CRM] Не удалось полностью закрыть карточку за отведённое время, идём дальше.");
}
