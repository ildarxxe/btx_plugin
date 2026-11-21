// =====================================================================================
// МОДУЛЬ 10_bitrix_queue.js
// BITRIX: ОЧЕРЕДЬ ЗАЯВОК (открыть заявку -> чат -> при необходимости «Ответить» -> отправка)
// =====================================================================================

const LEFT_CONFIRM_MODAL_ID = 'elki-touch1-left-confirm-modal';

const RUN_HOTKEYS = {
    start: {
        codes: new Set(['Equal', 'NumpadAdd', 'Plus']),
        keys: new Set(['=', '+'])
    },
    stop: {
        codes: new Set(['Minus', 'NumpadSubtract']),
        keys: new Set(['-', '–', '—'])
    }
};

function getCardId(card) {
    const direct = card.getAttribute('data-id');
    if (direct) return direct;
    const link = card.querySelector('.crm-kanban-item-title');
    const fromLink = link && ((link.getAttribute('href') || link.innerText || '').trim());
    return fromLink || (card.innerText || '').trim().slice(0, 80) || 'unknown';
}

async function getHandledCardIds() {
    const st = await chrome.storage.local.get(['handledCardIds']);
    return Array.isArray(st.handledCardIds) ? st.handledCardIds : [];
}

async function addHandledCardId(id) {
    if (!id) return;
    const list = await getHandledCardIds();
    if (!list.includes(id)) {
        list.push(id);
        await chrome.storage.local.set({ handledCardIds: list });
    }
}

async function getCurrentCardId() {
    return currentCardId;
}

function resetBotRuntimeState() {
    clearTimeout(idleTimer);
    idleTimer = null;
    isScriptRunning = false;
    BOT_CONFIG.isPaused = true;
    currentCardId = null;
    cardAttempts = {};
    columnPreloaded = false;
    bitrixChatSending = false;
    removeLeftConfirmModal();
}

function startAutomation() {
    resetBotRuntimeState();
    isScriptRunning = true;
    BOT_CONFIG.isPaused = false;
    console.log(`[Бот Bitrix] Старт рассылки. Режим: ${BOT_CONFIG.runMode}`);
    if (typeof showBotToast === 'function') {
        showBotToast(`Рассылка запущена (${BOT_CONFIG.runMode === 'new' ? 'Новые' : '1 касание'}) ▶`);
    }
    processNextCard();
}

function forceStopAutomation(reason = 'горячая клавиша остановки') {
    resetBotRuntimeState();
    console.log(`[Бот Bitrix] Остановка рассылки: ${reason}`);
    if (typeof stopBot === 'function') {
        try {
            stopBot(reason);
        } catch (e) {
            console.warn('[Бот Bitrix] Ошибка при вызове stopBot:', e);
        }
    }
    if (typeof showBotToast === 'function') {
        showBotToast('Рассылка остановлена ⏹', true);
    }
}

function removeLeftConfirmModal() {
    const existing = document.getElementById(LEFT_CONFIRM_MODAL_ID);
    if (existing) existing.remove();
}

function matchesRunHotkey(event, cfg) {
    if (!cfg) return false;
    if (!event.ctrlKey || !event.shiftKey || event.metaKey) return false;
    return cfg.codes.has(event.code) || cfg.keys.has(event.key);
}

function onRunControlHotkey(e) {
    if (!location.hostname.includes('bitrix24')) return;

    if (matchesRunHotkey(e, RUN_HOTKEYS.start)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        startAutomation();
        return;
    }

    if (matchesRunHotkey(e, RUN_HOTKEYS.stop)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        forceStopAutomation('горячая клавиша остановки');
    }
}

function attachRunControlHotkeys(doc) {
    if (!doc || doc.__elkiRunControlHotkey) return;
    doc.__elkiRunControlHotkey = true;
    doc.addEventListener('keydown', onRunControlHotkey, true);
}

attachRunControlHotkeys(document);
window.addEventListener('keydown', onRunControlHotkey, true);
try {
    if (typeof getAllDocuments === 'function') {
        getAllDocuments().forEach(attachRunControlHotkeys);
    }
} catch (e) {}

setInterval(() => {
    try {
        if (typeof getAllDocuments === 'function') {
            getAllDocuments().forEach(attachRunControlHotkeys);
        }
    } catch (e) {}
}, 3000);

function hasSelfMessagesInBitrixChat() {
    const selfMsgs = findAllInAnyDocument(
        '.bx-im-message-base__wrap.--self, .bx-im-message-list-author-group__container.--self'
    ).filter(isVisible);
    return selfMsgs.length > 0;
}

// Внутри уже открытого чата: если есть кнопка «Ответить» — нажимаем, если нет — просто идём дальше
async function clickReplyIfPresentInOpenChat(cardId) {
    const joinBtns = findAllInAnyDocument(SELECTORS.bitrix.messengerJoinBtns)
        .filter(b => isVisible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
    const replyBtn = joinBtns.find(b => /ответить/i.test((b.innerText || b.textContent || '').trim()));
    if (replyBtn) {
        console.log(`[Бот Bitrix] [Заявка ${cardId}] Нажимаем «Ответить» в чате...`);
        clickLikeUser(replyBtn);
        await sleep(900);
    }
}

// Модалка слева (не перекрывает чат), ждёт Enter = Да, Esc = Нет
function askTouch1SendConfirmation(cardId, titleText) {
    return new Promise((resolve) => {
        removeLeftConfirmModal();

        const box = document.createElement('div');
        box.id = LEFT_CONFIRM_MODAL_ID;
        box.style.cssText = [
            'position:fixed',
            'left:20px',
            'top:25%',
            'width:310px',
            'z-index:2147483647',
            'background:#1c2129',
            'color:#fff',
            'border:1px solid #384152',
            'border-radius:10px',
            'padding:14px',
            'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
            'font:13px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif'
        ].join(';');

        box.innerHTML = `
            <div style="font-weight:700;font-size:14px;margin-bottom:6px;">1 касание — делать рассылку?</div>
            <div style="font-size:12px;color:#cbd5e1;margin-bottom:12px;word-break:break-word;">${(titleText || cardId || '').replace(/</g, '&lt;')}</div>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
                <button id="elki-confirm-yes" type="button" style="flex:1;padding:8px;border:none;border-radius:6px;background:#25D366;color:#fff;font-weight:700;cursor:pointer;">Да (Enter)</button>
                <button id="elki-confirm-no" type="button" style="flex:1;padding:8px;border:none;border-radius:6px;background:#ef4444;color:#fff;font-weight:700;cursor:pointer;">Нет (Esc)</button>
            </div>
            <div style="font-size:11px;color:#94a3b8;">Enter — отправить и в «3 касание» · Esc — закрыть и пропустить</div>
        `;

        document.body.appendChild(box);

        let settled = false;
        const finish = (answer) => {
            if (settled) return;
            settled = true;
            window.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
            removeLeftConfirmModal();
            resolve(answer);
        };

        const onKeyDown = (e) => {
            if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) {
                finish(null);
                return;
            }
            if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                finish(true);
            } else if (e.key === 'Escape' || e.code === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                finish(false);
            }
        };

        window.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('keydown', onKeyDown, true);

        const yesBtn = box.querySelector('#elki-confirm-yes');
        const noBtn = box.querySelector('#elki-confirm-no');
        if (yesBtn) yesBtn.addEventListener('click', () => finish(true));
        if (noBtn) noBtn.addEventListener('click', () => finish(false));
    });
}

// Прокручивает колонку «1 касание» вниз до первой заявки с датой не «сегодня»
async function scrollToFirstNonTodayCard(column, handledSet) {
    for (let step = 0; step < 50; step++) {
        if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return null;

        const cards = Array.from(column.querySelectorAll(SELECTORS.bitrix.cards));
        const candidate = cards.find(c => {
            const id = getCardId(c);
            return !handledSet.has(id) && !isCardDateToday(c);
        });
        if (candidate) {
            candidate.scrollIntoView({ block: 'center' });
            await sleep(400);
            return candidate;
        }

        const scrollers = getKanbanScrollers(column);
        for (const sc of scrollers) {
            sc.scrollTop = sc.scrollHeight;
            sc.dispatchEvent(new Event('scroll', { bubbles: true }));
        }
        if (cards.length) {
            cards[cards.length - 1].scrollIntoView({ block: 'end' });
        }
        await sleep(900);
    }

    const fallbackCards = Array.from(column.querySelectorAll(SELECTORS.bitrix.cards));
    return fallbackCards.find(c => !handledSet.has(getCardId(c)) && !isCardDateToday(c)) || null;
}

async function sendSavedFlowInBitrixChat(flowKey) {
    if (typeof runBitrixFlow === 'function') {
        await runBitrixFlow(flowKey);
        return;
    }
    throw new Error("Модуль 32_bitrix_custom_flow.js не подключён.");
}

async function processNextCard() {
    removeLeftConfirmModal();

    if (isStaleInstance()) {
        resetBotRuntimeState();
        return;
    }
    if (BOT_CONFIG.isPaused || !isScriptRunning) return;

    const isNewMode = BOT_CONFIG.runMode === 'new';
    const columnSelector = isNewMode ? SELECTORS.bitrix.newColumn : SELECTORS.bitrix.touchColumn;
    const column = document.querySelector(columnSelector);

    if (!column) {
        showAlert(`Не найдена колонка для режима '${BOT_CONFIG.runMode}'. Откройте канбан с заявками.`);
        return;
    }

    const handled = await getHandledCardIds();
    const handledSet = new Set(handled);

    let card = null;
    if (isNewMode) {
        const allCards = Array.from(column.querySelectorAll(SELECTORS.bitrix.cards));
        card = allCards.find(c => !handledSet.has(getCardId(c))) || null;
        if (!card) {
            console.log(`[Бот Bitrix] Новых заявок пока нет. Проверка через ${IDLE_POLL_MS / 1000} сек...`);
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => processNextCard(), IDLE_POLL_MS);
            return;
        }
    } else {
        card = await scrollToFirstNonTodayCard(column, handledSet);
        if (!card) {
            alert("В колонке «1 касание» нет заявок с датой не «сегодня» для обработки.");
            resetBotRuntimeState();
            return;
        }
    }

    const cardId = getCardId(card);
    currentCardId = cardId;

    cardAttempts[cardId] = (cardAttempts[cardId] || 0) + 1;
    if (cardAttempts[cardId] > 3) {
        console.warn(`[Бот Bitrix] [Заявка ${cardId}] Превышено число попыток — пропускаем.`);
        await addHandledCardId(cardId);
        await closeChatAndCard();
        processNextCard();
        return;
    }

    const cardTitleLink = card.querySelector('.crm-kanban-item-title');
    if (!cardTitleLink) {
        await addHandledCardId(cardId);
        processNextCard();
        return;
    }

    const cardTitleText = (cardTitleLink.innerText || '').trim();
    console.log(`[Бот Bitrix] [Заявка ${cardId}] 1. Открываем заявку: ${cardTitleText}`);
    clickLikeUser(cardTitleLink);
    await sleep(1600);
    if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return;

    // 2. Внутри открытой заявки жмём синюю кнопку «Чат» и заходим в чат
    console.log(`[Бот Bitrix] [Заявка ${cardId}] 2. Заходим в чат...`);
    const chatOpened = await openBitrixChatForCard(cardId, false);
    if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return;

    if (!chatOpened) {
        console.warn(`[Бот Bitrix] [Заявка ${cardId}] Чат не открылся — пропускаем заявку.`);
        await addHandledCardId(cardId);
        await closeChatAndCard();
        processNextCard();
        return;
    }

    await sleep(700);

    if (isNewMode) {
        try {
            // 3. Уже внутри чата: проверяем, есть ли наши сообщения (--self)
            if (hasSelfMessagesInBitrixChat()) {
                console.log(`[Бот Bitrix] [Заявка ${cardId}] В чате уже есть наши сообщения — пропускаем.`);
                await addHandledCardId(cardId);
                await closeChatAndCard();
                processNextCard();
                return;
            }

            // 4. Если своих сообщений нет — нажимаем «Ответить» (если кнопка есть) и шлём сценарий
            await clickReplyIfPresentInOpenChat(cardId);
            await sendSavedFlowInBitrixChat('firstTouch');
            await sleep(1000);
            if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return;

            pressEscapeEverywhere();
            await sleep(800);

            const moved = await moveCardToStage('touch1');
            if (!moved) return;

            await addHandledCardId(cardId);
            await returnToCRMAndEscape();
            processNextCard();
        } catch (e) {
            console.error(`[Бот CRM] [Заявка ${cardId}] Ошибка при отправке новых сообщений:`, e);
            showAlert("Ошибка при отправке сообщений в чате Bitrix: " + (e && e.message ? e.message : e));
        }
        return;
    }

    // Режим «1 касание»: чат открыт, показываем модалку слева (Enter = Да, Esc = Нет)
    const answer = await askTouch1SendConfirmation(cardId, cardTitleText);
    if (answer === null || BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) {
        removeLeftConfirmModal();
        return;
    }

    if (!answer) {
        console.log(`[Бот Bitrix] [Заявка ${cardId}] Выбрано «Нет» (Esc) — закрываем и идём дальше.`);
        await addHandledCardId(cardId);
        await closeChatAndCard();
        processNextCard();
        return;
    }

    try {
        await clickReplyIfPresentInOpenChat(cardId);
        await sendSavedFlowInBitrixChat('touch1');
        await sleep(1000);
        if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return;

        pressEscapeEverywhere();
        await sleep(800);

        const moved = await moveCardToStage('touch3');
        if (!moved) return;

        await addHandledCardId(cardId);
        await returnToCRMAndEscape();
        processNextCard();
    } catch (e) {
        console.error(`[Бот CRM] [Заявка ${cardId}] Ошибка при отправке 1-го касания:`, e);
        showAlert("Ошибка при отправке сообщения 1-го касания: " + (e && e.message ? e.message : e));
    }
}

function proceedToNextCardFromStorage() {
    processNextCard();
}

function isCardDateToday(card) {
    const el = card.querySelector(SELECTORS.bitrix.cardDate);
    const t = ((el && el.innerText) || '').trim().toLowerCase();
    if (!t) return false;
    const now = new Date();

    if (t.includes('сегодня')) return true;
    if (t.includes('вчера')) return false;

    if (t.includes('назад')) {
        const m = t.match(/(\d+)\s*(секунд|минут|час)/);
        if (!m) return true;
        const n = parseInt(m[1], 10);
        const ms = m[2] === 'час' ? n * 3600e3 : (m[2] === 'минут' ? n * 60e3 : n * 1e3);
        return sameDay(new Date(now.getTime() - ms), now);
    }

    let m = t.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return sameDay(new Date(+m[3], +m[2] - 1, +m[1]), now);

    m = t.match(/(\d{1,2})\s+([а-яё]+)/);
    if (m && RU_MONTHS[m[2]] !== undefined) {
        return sameDay(new Date(now.getFullYear(), RU_MONTHS[m[2]], +m[1]), now);
    }
    return false;
}

function isScrollableEl(el) {
    if (!el || el.scrollHeight <= el.clientHeight + 5) return false;
    const oy = getComputedStyle(el).overflowY;
    return oy === 'auto' || oy === 'scroll' || oy === 'overlay';
}

function getKanbanScrollers(column) {
    const found = new Set();
    const add = el => { if (isScrollableEl(el)) found.add(el); };
    add(column);
    column.querySelectorAll('*').forEach(add);
    let n = column.parentElement;
    while (n && n !== document.documentElement) { add(n); n = n.parentElement; }
    return Array.from(found);
}