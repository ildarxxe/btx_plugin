// =====================================================================================
// МОДУЛЬ 10_bitrix_queue.js
// BITRIX: ОЧЕРЕДЬ ЗАЯВОК (открыть заявку -> чат -> пауза 2с/Esc в «Новых» -> отправка)
// =====================================================================================

const LEFT_CONFIRM_MODAL_ID = 'elki-touch1-left-confirm-modal';
const NEW_SKIP_TOAST_ID = 'elki-new-skip-banner';
const HANDLED_CARDS_STORAGE_KEY = 'handledCardIds';

let runGeneration = 0;

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

function isRunActive(gen = runGeneration) {
    return gen === runGeneration && isScriptRunning && !BOT_CONFIG.isPaused && !isStaleInstance();
}

function getCardId(card) {
    const direct = card.getAttribute('data-id');
    if (direct) return direct;
    const link = card.querySelector('.crm-kanban-item-title');
    const fromLink = link && ((link.getAttribute('href') || link.innerText || '').trim());
    return fromLink || (card.innerText || '').trim().slice(0, 80) || 'unknown';
}

async function getHandledCardIds() {
    const st = await chrome.storage.local.get([HANDLED_CARDS_STORAGE_KEY]);
    return Array.isArray(st[HANDLED_CARDS_STORAGE_KEY]) ? st[HANDLED_CARDS_STORAGE_KEY] : [];
}

async function addHandledCardId(id) {
    if (!id) return;
    const list = await getHandledCardIds();
    if (!list.includes(id)) {
        list.push(id);
        await chrome.storage.local.set({ [HANDLED_CARDS_STORAGE_KEY]: list });
    }
}

async function resetQueue() {
    currentCardId = null;
    cardAttempts = {};
    columnPreloaded = false;
    await chrome.storage.local.set({ [HANDLED_CARDS_STORAGE_KEY]: [] });
    try {
        if (typeof GM_setValue === 'function') {
            GM_setValue(HANDLED_CARDS_STORAGE_KEY, []);
        }
    } catch (e) {}
    console.log('[Бот Bitrix] Очередь заявок сброшена (handledCardIds и cardAttempts очищены).');
    if (typeof showBotToast === 'function') {
        showBotToast('Очередь заявок сброшена 🔄');
    }
}
window.resetQueue = resetQueue;

async function getCurrentCardId() {
    return currentCardId;
}

function removeLeftConfirmModal() {
    const existing = document.getElementById(LEFT_CONFIRM_MODAL_ID);
    if (existing) existing.remove();
}

function removeNewSkipBanner() {
    const existing = document.getElementById(NEW_SKIP_TOAST_ID);
    if (existing) existing.remove();
}

function resetBotRuntimeState() {
    runGeneration += 1;
    clearTimeout(idleTimer);
    idleTimer = null;
    isScriptRunning = false;
    BOT_CONFIG.isPaused = true;
    currentCardId = null;
    cardAttempts = {};
    columnPreloaded = false;
    bitrixChatSending = false;
    if (typeof customFlowBusy !== 'undefined') {
        customFlowBusy = false;
    }
    removeLeftConfirmModal();
    removeNewSkipBanner();
}

function startAutomation() {
    resetBotRuntimeState();
    runGeneration += 1;
    const gen = runGeneration;
    isScriptRunning = true;
    BOT_CONFIG.isPaused = false;
    console.log(`[Бот Bitrix] Старт рассылки. Режим: ${BOT_CONFIG.runMode}`);
    if (typeof showBotToast === 'function') {
        showBotToast(`Рассылка запущена (${BOT_CONFIG.runMode === 'new' ? 'Новые' : '1 касание'}) ▶`);
    }
    processNextCard(gen);
}

function forceStopAutomation(reason = 'горячая клавиша остановки') {
    resetBotRuntimeState();
    console.log(`[Бот Bitrix] Жёсткая остановка рассылки: ${reason}`);
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

async function clickReplyIfPresentInOpenChat(cardId, gen) {
    if (!isRunActive(gen)) return;
    const joinBtns = findAllInAnyDocument(SELECTORS.bitrix.messengerJoinBtns)
        .filter(b => isVisible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
    const replyBtn = joinBtns.find(b => /ответить/i.test((b.innerText || b.textContent || '').trim()));
    if (replyBtn) {
        console.log(`[Бот Bitrix] [Заявка ${cardId}] Нажимаем «Ответить» в чате...`);
        clickLikeUser(replyBtn);
        await sleep(900);
    }
}

// Пауза 2 сек перед первым сообщением только в рассылке «Новые»:
// если нажать Esc — возвращает { skipped: true }, иначе { skipped: false }
function waitBeforeFirstNewMessageWithEsc(cardId, titleText, gen, delayMs = 2000) {
    return new Promise((resolve) => {
        removeNewSkipBanner();

        if (!isRunActive(gen)) {
            resolve({ skipped: false, aborted: true });
            return;
        }

        const box = document.createElement('div');
        box.id = NEW_SKIP_TOAST_ID;
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
            'padding:12px 14px',
            'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
            'font:13px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif'
        ].join(';');

        box.innerHTML = `
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">Пауза перед отправкой (2 сек)</div>
            <div style="font-size:12px;color:#cbd5e1;margin-bottom:6px;word-break:break-word;">${(titleText || cardId || '').replace(/</g, '&lt;')}</div>
            <div style="font-size:11px;color:#fbbf24;">Нажмите <b>Esc</b>, чтобы пропустить заявку</div>
        `;

        (document.body || document.documentElement).appendChild(box);

        let settled = false;
        let timerId = null;
        let pollId = null;

        const cleanup = () => {
            clearTimeout(timerId);
            clearInterval(pollId);
            window.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
            try {
                if (typeof getAllDocuments === 'function') {
                    getAllDocuments().forEach(d => d.removeEventListener('keydown', onKeyDown, true));
                }
            } catch (e) {}
            removeNewSkipBanner();
        };

        const finish = (result) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(result);
        };

        const onKeyDown = (e) => {
            if (!isRunActive(gen)) {
                finish({ skipped: false, aborted: true });
                return;
            }
            if (e.key === 'Escape' || e.code === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                finish({ skipped: true, aborted: false });
            }
        };

        window.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        try {
            if (typeof getAllDocuments === 'function') {
                getAllDocuments().forEach(d => d.addEventListener('keydown', onKeyDown, true));
            }
        } catch (e) {}

        pollId = setInterval(() => {
            if (!isRunActive(gen)) {
                finish({ skipped: false, aborted: true });
            }
        }, 100);

        timerId = setTimeout(() => {
            finish({ skipped: false, aborted: false });
        }, delayMs);
    });
}

// После пропуска по Esc в «Новых»: 1-й Esc -> детали заявки, 2-й Esc -> общий список заявок
async function exitChatToDetailsThenList(gen) {
    if (!isRunActive(gen)) return;
    pressEscapeEverywhere();
    await sleep(700);
    if (!isRunActive(gen)) return;
    pressEscapeEverywhere();
    await sleep(700);
}

function askTouch1SendConfirmation(cardId, titleText, gen) {
    return new Promise((resolve) => {
        removeLeftConfirmModal();

        if (!isRunActive(gen)) {
            resolve(null);
            return;
        }

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
        let pollId = null;

        const finish = (answer) => {
            if (settled) return;
            settled = true;
            clearInterval(pollId);
            window.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
            removeLeftConfirmModal();
            resolve(answer);
        };

        const onKeyDown = (e) => {
            if (!isRunActive(gen)) {
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

        pollId = setInterval(() => {
            if (!isRunActive(gen)) {
                finish(null);
            }
        }, 150);

        const yesBtn = box.querySelector('#elki-confirm-yes');
        const noBtn = box.querySelector('#elki-confirm-no');
        if (yesBtn) yesBtn.addEventListener('click', () => finish(true));
        if (noBtn) noBtn.addEventListener('click', () => finish(false));
    });
}

async function scrollToFirstNonTodayCard(column, handledSet, gen) {
    for (let step = 0; step < 50; step++) {
        if (!isRunActive(gen)) return null;

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

    if (!isRunActive(gen)) return null;
    const fallbackCards = Array.from(column.querySelectorAll(SELECTORS.bitrix.cards));
    return fallbackCards.find(c => !handledSet.has(getCardId(c)) && !isCardDateToday(c)) || null;
}

async function sendSavedFlowInBitrixChat(flowKey, gen) {
    if (!isRunActive(gen)) return;
    const runner = (typeof runBitrixFlow === 'function')
        ? runBitrixFlow
        : (typeof window.runBitrixFlow === 'function' ? window.runBitrixFlow : null);
    if (!runner) {
        throw new Error("Не найдена функция runBitrixFlow (проверьте загрузку 32_bitrix_custom_flow.js).");
    }
    await runner(flowKey, gen);
}

async function processNextCard(gen = runGeneration) {
    removeLeftConfirmModal();
    removeNewSkipBanner();

    if (isStaleInstance()) {
        resetBotRuntimeState();
        return;
    }
    if (!isRunActive(gen)) return;

    const isNewMode = BOT_CONFIG.runMode === 'new';
    const columnSelector = isNewMode ? SELECTORS.bitrix.newColumn : SELECTORS.bitrix.touchColumn;
    const column = document.querySelector(columnSelector);

    if (!column) {
        if (!isRunActive(gen)) return;
        showAlert(`Не найдена колонка для режима '${BOT_CONFIG.runMode}'. Откройте канбан с заявками.`);
        return;
    }

    const handled = await getHandledCardIds();
    if (!isRunActive(gen)) return;
    const handledSet = new Set(handled);

    let card = null;
    if (isNewMode) {
        const allCards = Array.from(column.querySelectorAll(SELECTORS.bitrix.cards));
        card = allCards.find(c => !handledSet.has(getCardId(c))) || null;
        if (!card) {
            if (!isRunActive(gen)) return;
            console.log(`[Бот Bitrix] Новых заявок пока нет. Проверка через ${IDLE_POLL_MS / 1000} сек...`);
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (isRunActive(gen)) processNextCard(gen);
            }, IDLE_POLL_MS);
            return;
        }
    } else {
        card = await scrollToFirstNonTodayCard(column, handledSet, gen);
        if (!isRunActive(gen)) return;
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
        if (!isRunActive(gen)) return;
        console.warn(`[Бот Bitrix] [Заявка ${cardId}] Превышено число попыток — ставим на паузу.`);
        showAlert(`Заявка ${cardId} не обработана после 3 попыток. Нажмите «Сбросить очередь» или исправьте ошибку.`);
        return;
    }

    const cardTitleLink = card.querySelector('.crm-kanban-item-title');
    if (!cardTitleLink) {
        return;
    }

    const cardTitleText = (cardTitleLink.innerText || '').trim();
    console.log(`[Бот Bitrix] [Заявка ${cardId}] 1. Открываем заявку: ${cardTitleText}`);
    clickLikeUser(cardTitleLink);
    await sleep(1600);
    if (!isRunActive(gen)) return;

    console.log(`[Бот Bitrix] [Заявка ${cardId}] 2. Заходим в чат...`);
    const chatOpened = await openBitrixChatForCard(cardId, false);
    if (!isRunActive(gen)) return;

    if (!chatOpened) {
        console.warn(`[Бот Bitrix] [Заявка ${cardId}] Чат не открылся (кнопка .crm-entity-widget-client-action-im заблокирована/недоступна) — пропускаем заявку.`);
        await addHandledCardId(cardId);
        if (!isRunActive(gen)) return;
        await closeChatAndCard();
        if (!isRunActive(gen)) return;
        processNextCard(gen);
        return;
    }

    await sleep(700);
    if (!isRunActive(gen)) return;

    if (isNewMode) {
        try {
            if (hasSelfMessagesInBitrixChat()) {
                console.log(`[Бот Bitrix] [Заявка ${cardId}] В чате уже есть наши сообщения — пропускаем.`);
                await addHandledCardId(cardId);
                if (!isRunActive(gen)) return;
                await closeChatAndCard();
                if (!isRunActive(gen)) return;
                processNextCard(gen);
                return;
            }

            await clickReplyIfPresentInOpenChat(cardId, gen);
            if (!isRunActive(gen)) return;

            const waitRes = await waitBeforeFirstNewMessageWithEsc(cardId, cardTitleText, gen, 2000);
            if (waitRes.aborted || !isRunActive(gen)) return;

            if (waitRes.skipped) {
                console.log(`[Бот Bitrix] [Заявка ${cardId}] Пропущена по Esc перед первым сообщением.`);
                await addHandledCardId(cardId);
                if (!isRunActive(gen)) return;
                await exitChatToDetailsThenList(gen);
                if (!isRunActive(gen)) return;
                processNextCard(gen);
                return;
            }

            await sendSavedFlowInBitrixChat('firstTouch', gen);
            if (!isRunActive(gen)) return;
            await sleep(1000);
            if (!isRunActive(gen)) return;

            pressEscapeEverywhere();
            await sleep(800);
            if (!isRunActive(gen)) return;

            const moved = await moveCardToStage('touch1');
            if (!moved || !isRunActive(gen)) return;

            await addHandledCardId(cardId);
            if (!isRunActive(gen)) return;
            await returnToCRMAndEscape();
            if (!isRunActive(gen)) return;
            processNextCard(gen);
        } catch (e) {
            bitrixChatSending = false;
            if (!isRunActive(gen)) return;
            console.error(`[Бот CRM] [Заявка ${cardId}] Ошибка при отправке новых сообщений:`, e);
            showAlert("Ошибка при отправке сообщений в чате Bitrix: " + (e && e.message ? e.message : e));
        }
        return;
    }

    const answer = await askTouch1SendConfirmation(cardId, cardTitleText, gen);
    if (answer === null || !isRunActive(gen)) {
        removeLeftConfirmModal();
        return;
    }

    if (!answer) {
        console.log(`[Бот Bitrix] [Заявка ${cardId}] Выбрано «Нет» (Esc) — закрываем и идём дальше.`);
        await addHandledCardId(cardId);
        if (!isRunActive(gen)) return;
        await closeChatAndCard();
        if (!isRunActive(gen)) return;
        processNextCard(gen);
        return;
    }

    try {
        await clickReplyIfPresentInOpenChat(cardId, gen);
        if (!isRunActive(gen)) return;

        await sendSavedFlowInBitrixChat('touch1', gen);
        if (!isRunActive(gen)) return;
        await sleep(1000);
        if (!isRunActive(gen)) return;

        pressEscapeEverywhere();
        await sleep(800);
        if (!isRunActive(gen)) return;

        const moved = await moveCardToStage('touch3');
        if (!moved || !isRunActive(gen)) return;

        await addHandledCardId(cardId);
        if (!isRunActive(gen)) return;
        await returnToCRMAndEscape();
        if (!isRunActive(gen)) return;
        processNextCard(gen);
    } catch (e) {
        bitrixChatSending = false;
        if (!isRunActive(gen)) return;
        console.error(`[Бот CRM] [Заявка ${cardId}] Ошибка при отправке 1-го касания:`, e);
        showAlert("Ошибка при отправке сообщения 1-го касания: " + (e && e.message ? e.message : e));
    }
}

function proceedToNextCardFromStorage() {
    processNextCard(runGeneration);
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