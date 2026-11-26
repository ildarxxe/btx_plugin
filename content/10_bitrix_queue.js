// =====================================================================================
// МОДУЛЬ 10_bitrix_queue.js
// BITRIX: ОЧЕРЕДЬ ЗАЯВОК (открыть заявку -> чат или СМС «Сообщение» -> пауза 2с/Esc -> отправка)
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

function ensureQueueActive(gen) {
    if (!isRunActive(gen)) {
        throw new Error('BOT_ABORTED');
    }
}

async function queueSleep(ms, gen) {
    const step = 100;
    let left = Math.max(0, Number(ms) || 0);
    while (left > 0) {
        ensureQueueActive(gen);
        const chunk = Math.min(step, left);
        await sleep(chunk);
        left -= chunk;
    }
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

// Проверяем, есть ли в чате реальные сообщения менеджера (игнорируем системные блоки Wazzup с замочком)
function hasSelfMessagesInBitrixChat() {
    const selfMsgs = findAllInAnyDocument(
        '.bx-im-message-base__wrap.--self, .bx-im-message-list-author-group__container.--self'
    ).filter(isVisible);

    return selfMsgs.some(msg => {
        if (msg.querySelector('.bx-im-message-status__icon.--lock, [class*="--lock"]')) {
            return false;
        }
        const txt = (msg.innerText || msg.textContent || '').trim();
        if (!txt) return false;
        if (/^(переданы дополнительные данные|начат новый диалог|создана новая сделка|контактная информация сохранена|обращение направлено на)/i.test(txt)) {
            return false;
        }
        return true;
    });
}

// Проверяем, есть ли в чате сообщение от собеседника с исходящим СМС из Битрикс24
function hasOutgoingBitrixSmsInChat() {
    const opponentMsgs = findAllInAnyDocument(
        '.bx-im-message-base__wrap.--opponent, [data-testid="im-message-base-root"].--opponent'
    ).filter(isVisible);

    return opponentMsgs.some(msg => {
        const txt = (msg.innerText || msg.textContent || '');
        return /===\s*Исходящее сообщение,\s*автор:\s*Битрикс24/i.test(txt);
    });
}

// Ждём появления кнопки «Ответить» или активного поля ввода до 7 сек (на случай долгой прогрузки чата)
// Ждём появления кнопки «Ответить» или активного поля ввода до 7 сек; после клика по «Ответить» ждём активации поля ввода
async function clickReplyIfPresentInOpenChat(cardId, gen) {
    ensureQueueActive(gen);

    const findReplyBtn = () => {
        const bySelector = findAllInAnyDocument(SELECTORS.bitrix.messengerJoinBtns)
            .filter(b => isVisible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true')
            .find(b => /^ответить$/i.test((b.innerText || b.textContent || '').trim()));
        if (bySelector) return bySelector;

        const containers = findAllInAnyDocument('.bx-im-messenger, .bx-im-content-chat, .bx-im-textarea').filter(isVisible);
        for (const box of containers) {
            const btn = Array.from(box.querySelectorAll('button, [role="button"]'))
                .find(b => isVisible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && /^ответить$/i.test((b.innerText || b.textContent || '').trim()));
            if (btn) return btn;
        }
        return null;
    };

    const getActiveTextarea = () => {
        const ta = findAllInAnyDocument(SELECTORS.bitrix.messengerTextarea).find(isVisible);
        return (ta && !ta.disabled) ? ta : null;
    };

    // Ждём до 12 сек: если поле ввода уже активно — кнопки «Ответить» не было (или уже нажата);
    // если есть «Ответить» — жмём (повтор не чаще раза в 3 сек), пока не появится активное поле.
    // true — только когда поле ввода реально готово; false — поле так и не появилось.
    const deadline = Date.now() + 12000;
    let lastClickAt = 0;
    while (Date.now() < deadline) {
        ensureQueueActive(gen);
        if (getActiveTextarea()) return true;

        const replyBtn = findReplyBtn();
        if (replyBtn && Date.now() - lastClickAt > 3000) {
            console.log(`[Бот Bitrix] [Заявка ${cardId}] Нажимаем «Ответить» в чате...`);
            clickLikeUser(replyBtn);
            lastClickAt = Date.now();
        }
        await queueSleep(250, gen);
    }
    return Boolean(getActiveTextarea());
}

// Проверяем в таймлайне карточки, есть ли уже запись «Отправлено СМС-сообщение»
function hasSentSmsInDealTimeline() {
    const titles = findAllInAnyDocument('.crm-timeline__card-title, .crm-timeline__card-wrapper');
    return titles.some(el => /отправлено\s+смс-сообщение/i.test((el.innerText || el.textContent || '').trim()));
}

// Проверяем, есть ли в деталях сделки реальный номер телефона клиента
function dealHasClientPhoneNumber() {
    const phoneEls = findAllInAnyDocument(
        `${SELECTORS.bitrix.phoneWidget}, a[href^="tel:"], [data-cid="PHONE"] .crm-entity-widget-content-block-inner`
    );

    for (const el of phoneEls) {
        const href = (el.getAttribute && el.getAttribute('href')) || '';
        const raw = href.startsWith('tel:') ? href.slice(4) : (el.innerText || el.textContent || '');
        const digits = String(raw).replace(/\D/g, '');
        if (digits.length >= 7) {
            return true;
        }
    }

    const clientBlocks = findAllInAnyDocument('.crm-entity-widget-client-block, .crm-entity-widget-content-block-inner-phone');
    for (const block of clientBlocks) {
        const txt = (block.innerText || block.textContent || '');
        const phoneMatch = txt.match(/(?:\+?\d[\d\s\-()]{6,}\d)/);
        if (phoneMatch) {
            const digits = phoneMatch[0].replace(/\D/g, '');
            if (digits.length >= 7) return true;
        }
    }

    return false;
}

// Однократная вставка текста через beforeinput (без запасных вставок и дублей)
async function insertSingleTextIntoSmsEditor(editor, text, gen = runGeneration) {
    ensureQueueActive(gen);
    const clean = String(text || '').trim();
    if (!editor || !clean) return false;

    const norm = (s) => (s || '').replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();
    const read = () => norm(editor.innerText || editor.textContent);
    const want = norm(clean);

    if (read() === want) return true;

    editor.focus();
    ensureQueueActive(gen);
    editor.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: clean
    }));

    for (let i = 0; i < 20; i++) {
        ensureQueueActive(gen);
        await sleep(50);
        if (read() === want) return true;
    }

    console.warn('SMS editor: текст не совпал после beforeinput', read());
    return false;
}

// Отправка 1-го приветственного сообщения через вкладку «Сообщение» в деталях сделки
async function sendFirstGreetingViaDealSmsTab(cardId, gen) {
    ensureQueueActive(gen);

    const msgTabBtn =
        findAllInAnyDocument('#crm_scope_timeline_c_deal_13_message button.main-buttons-item-link, #crm_scope_timeline_c_deal_13_message, [data-top-menu-id="crm_scope_timeline_c_deal_13"][data-id="message"] button, [data-top-menu-id="crm_scope_timeline_c_deal_13"][data-id="message"]')
            .find(isVisible) ||
        findAllInAnyDocument('.main-buttons-item[data-id="message"] button, .main-buttons-item[data-id="message"]')
            .find(isVisible);

    if (!msgTabBtn) {
        console.warn(`[Бот Bitrix] [Заявка ${cardId}] Кнопка вкладки «Сообщение» в деталях сделки не найдена.`);
        return false;
    }

    await loadCustomFlowState();
    ensureQueueActive(gen);

    const items = (customFlowState.flows.firstTouch && Array.isArray(customFlowState.flows.firstTouch.items))
        ? customFlowState.flows.firstTouch.items
        : [];
    const firstTextItem = items.find(it => it && it.type === 'text' && String(it.text || '').trim());
    const greetingText = firstTextItem
        ? String(firstTextItem.text).trim()
        : String(MESSAGE_VARIANTS.msg1[0] || '').trim();

    if (!greetingText) {
        console.warn(`[Бот Bitrix] [Заявка ${cardId}] Нет первого текстового сообщения в сценарии.`);
        return false;
    }

    console.log(`[Бот Bitrix] [Заявка ${cardId}] Нажимаем вкладку «Сообщение» в деталях сделки...`);
    clickLikeUser(msgTabBtn);

    let editor = null;
    for (let i = 0; i < 24; i++) {
        ensureQueueActive(gen);
        editor = findAllInAnyDocument(
            '[data-test-role="messageservice-message-editor"] .ui-text-editor-editable[data-lexical-editor="true"], .messageservice-message-editor__content [contenteditable="true"]'
        ).find(isVisible);
        if (editor) break;
        await queueSleep(250, gen);
    }

    if (!editor) {
        console.warn(`[Бот Bitrix] [Заявка ${cardId}] Поле ввода в редакторе «Сообщение» не появилось.`);
        return false;
    }

    await queueSleep(200, gen);
    const okInsert = await insertSingleTextIntoSmsEditor(editor, greetingText, gen);
    const currentVal = (editor.innerText || editor.textContent || '').replace(/\u200B/g, '').trim();
    console.log(`[Бот Bitrix] [Заявка ${cardId}] Текст в «Сообщение» (ok=${okInsert}):`, JSON.stringify(currentVal));

    if (!okInsert || !currentVal) {
        console.warn(`[Бот Bitrix] [Заявка ${cardId}] Не удалось вставить текст в поле «Сообщение».`);
        return false;
    }

    await queueSleep(300, gen);

    const doc = editor.ownerDocument || document;
    const findSmsSendBtn = () => {
        const root = editor.closest('[data-test-role="messageservice-message-editor"], .messageservice-message-editor') || doc;
        const btns = Array.from(root.querySelectorAll('.messageservice-message-editor__footer__buttons button, button'));
        return btns.find(b => {
            if (!isVisible(b)) return false;
            if (b.disabled || b.getAttribute('aria-disabled') === 'true' || b.classList.contains('ui-btn-disabled')) {
                return false;
            }
            return /^отправить$/i.test((b.innerText || b.textContent || '').trim());
        }) || null;
    };

    let sendBtn = null;
    for (let i = 0; i < 15; i++) {
        ensureQueueActive(gen);
        sendBtn = findSmsSendBtn();
        if (sendBtn) break;
        await queueSleep(200, gen);
    }

    if (!sendBtn) {
        console.warn(`[Бот Bitrix] [Заявка ${cardId}] Кнопка «Отправить» в редакторе «Сообщение» не найдена или неактивна.`);
        return false;
    }

    ensureQueueActive(gen);
    console.log(`[Бот Bitrix] [Заявка ${cardId}] Нажимаем «Отправить» в редакторе «Сообщение»...`);
    clickLikeUser(sendBtn);

    for (let i = 0; i < 16; i++) {
        ensureQueueActive(gen);
        await queueSleep(250, gen);
        const stillEditor = findAllInAnyDocument('.messageservice-message-editor__content [contenteditable="true"]').find(isVisible);
        const txtNow = stillEditor ? (stillEditor.innerText || stillEditor.textContent || '').trim() : '';
        if (!stillEditor || !txtNow) {
            break;
        }
    }

    return true;
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
    ensureQueueActive(gen);
    pressEscapeEverywhere();
    await queueSleep(600, gen);
    pressEscapeEverywhere();
    await queueSleep(600, gen);
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
            'width:320px',
            'z-index:2147483647',
            'background:#1c2129',
            'color:#fff',
            'border:1px solid #384152',
            'border-radius:10px',
            'padding:14px',
            'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
            'font:13px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif'
        ].join(';');

        const targetLabels = { touch2: '2 касание', touch3: '3 касание', close: 'Закрыть' };
        const currentTarget = (typeof getTouch1TargetStage === 'function') ? getTouch1TargetStage() : 'touch3';
        const targetText = targetLabels[currentTarget] || '3 касание';

        box.innerHTML = `
            <div style="font-weight:700;font-size:14px;margin-bottom:6px;">1 касание — делать рассылку?</div>
            <div style="font-size:12px;color:#cbd5e1;margin-bottom:8px;word-break:break-word;">${(titleText || cardId || '').replace(/</g, '&lt;')}</div>
            <div style="font-size:11px;color:#93c5fd;margin-bottom:10px;">После отправки → <b>${targetText}</b></div>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
                <button id="elki-confirm-yes" type="button" style="flex:1;padding:8px;border:none;border-radius:6px;background:#25D366;color:#fff;font-weight:700;cursor:pointer;">Да (Enter)</button>
                <button id="elki-confirm-no" type="button" style="flex:1;padding:8px;border:none;border-radius:6px;background:#ef4444;color:#fff;font-weight:700;cursor:pointer;">Нет (Esc)</button>
            </div>
            <button id="elki-confirm-close-deal" type="button" style="width:100%;padding:7px 8px;margin-bottom:8px;border:1px solid #7f1d1d;border-radius:6px;background:#450a0a;color:#fecaca;font-weight:700;font-size:12px;cursor:pointer;">Нет и закрыть (Ctrl+Esc)</button>
            <div style="font-size:11px;color:#94a3b8;">Enter — отправить · Esc — пропустить · Ctrl+Esc — закрыть сделку</div>
        `;

        (document.body || document.documentElement).appendChild(box);

        let settled = false;
        let pollId = null;

        const cleanupDocs = () => {
            window.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
            try {
                if (typeof getAllDocuments === 'function') {
                    getAllDocuments().forEach(d => d.removeEventListener('keydown', onKeyDown, true));
                }
            } catch (e) {}
        };

        const finish = (answer) => {
            if (settled) return;
            settled = true;
            clearInterval(pollId);
            cleanupDocs();
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
                if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
                    finish('close_deal');
                } else {
                    finish('skip');
                }
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
                finish(null);
            }
        }, 150);

        const yesBtn = box.querySelector('#elki-confirm-yes');
        const noBtn = box.querySelector('#elki-confirm-no');
        const closeDealBtn = box.querySelector('#elki-confirm-close-deal');
        if (yesBtn) yesBtn.addEventListener('click', () => finish(true));
        if (noBtn) noBtn.addEventListener('click', () => finish('skip'));
        if (closeDealBtn) closeDealBtn.addEventListener('click', () => finish('close_deal'));
    });
}

async function sendSavedFlowInBitrixChat(flowKey, gen, options = {}) {
    ensureQueueActive(gen);
    const runner = (typeof runBitrixFlow === 'function')
        ? runBitrixFlow
        : (typeof window.runBitrixFlow === 'function' ? window.runBitrixFlow : null);
    if (!runner) {
        throw new Error("Не найдена функция runBitrixFlow (проверьте загрузку 32_bitrix_custom_flow.js).");
    }
    const res = await runner(flowKey, gen, options);
    ensureQueueActive(gen);
    if (res !== true) {
        throw new Error("Сценарий не вернул true — остановка до смены стадии.");
    }
}

async function processNextCard(gen = runGeneration) {
    removeLeftConfirmModal();
    removeNewSkipBanner();

    if (isStaleInstance()) {
        resetBotRuntimeState();
        return;
    }
    if (!isRunActive(gen)) return;

    try {
        ensureQueueActive(gen);

        const isNewMode = BOT_CONFIG.runMode === 'new';
        const columnSelector = isNewMode ? SELECTORS.bitrix.newColumn : SELECTORS.bitrix.touchColumn;
        const column = document.querySelector(columnSelector);

        if (!column) {
            showAlert(`Не найдена колонка для режима '${BOT_CONFIG.runMode}'. Откройте канбан с заявками.`);
            return;
        }

        const handled = await getHandledCardIds();
        ensureQueueActive(gen);
        const handledSet = new Set(handled);

        let card = null;
        if (isNewMode) {
            const allCards = Array.from(column.querySelectorAll(SELECTORS.bitrix.cards));
            card = allCards.find(c => !handledSet.has(getCardId(c))) || null;
            if (!card) {
                console.log(`[Бот Bitrix] Новых заявок пока нет. Проверка через ${IDLE_POLL_MS / 1000} сек...`);
                clearTimeout(idleTimer);
                idleTimer = setTimeout(() => {
                    if (isRunActive(gen)) processNextCard(gen);
                }, IDLE_POLL_MS);
                return;
            }
        } else {
            card = await scrollToFirstNonTodayCard(column, handledSet, gen);
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

        // Ждём до 10 сек, пока прогрузятся детали карточки в слайдере (кнопка «Чат», вкладка «Сообщение» или таймлайн)
        let cardReady = false;
        for (let i = 0; i < 40; i++) {
            ensureQueueActive(gen);
            const hasChatBtn = findAllInAnyDocument('a.crm-entity-widget-client-action-im').length > 0;
            const hasMsgTab = findAllInAnyDocument(
                '#crm_scope_timeline_c_deal_13_message, [data-top-menu-id="crm_scope_timeline_c_deal_13"][data-id="message"], .main-buttons-item[data-id="message"]'
            ).length > 0;
            const hasTimeline = findAllInAnyDocument('.crm-timeline__card-wrapper, .ui-entity-editor-section').length > 0;
            if (hasChatBtn || hasMsgTab || hasTimeline) {
                cardReady = true;
                break;
            }
            await queueSleep(250, gen);
        }

        if (!cardReady) {
            console.warn(`[Бот Bitrix] [Заявка ${cardId}] Детали заявки не прогрузились за 10 сек — закрываем без отметки «обработано».`);
            await returnToCRMAndEscape();
            processNextCard(gen);
            return;
        }

        await queueSleep(400, gen);

        console.log(`[Бот Bitrix] [Заявка ${cardId}] 2. Заходим в чат...`);
        const chatOpened = await openBitrixChatForCard(cardId, false);
        ensureQueueActive(gen);

        // Если кнопка чата неактивна/заблокирована
        if (!chatOpened) {
            if (isNewMode) {
                // Даём вкладке «Сообщение» ещё до 5 сек на догрузку
                let hasMsgTabNow = false;
                for (let i = 0; i < 20; i++) {
                    ensureQueueActive(gen);
                    hasMsgTabNow = findAllInAnyDocument(
                        '#crm_scope_timeline_c_deal_13_message button.main-buttons-item-link, #crm_scope_timeline_c_deal_13_message, [data-top-menu-id="crm_scope_timeline_c_deal_13"][data-id="message"] button, [data-top-menu-id="crm_scope_timeline_c_deal_13"][data-id="message"], .main-buttons-item[data-id="message"] button, .main-buttons-item[data-id="message"]'
                    ).some(isVisible);
                    if (hasMsgTabNow) break;
                    await queueSleep(250, gen);
                }

                if (hasSentSmsInDealTimeline()) {
                    console.log(`[Бот Bitrix] [Заявка ${cardId}] Чат неактивен, но «Отправлено СМС-сообщение» уже есть в истории — пропускаем.`);
                    await addHandledCardId(cardId);
                } else if (hasMsgTabNow) {
                    const smsSent = await sendFirstGreetingViaDealSmsTab(cardId, gen);
                    ensureQueueActive(gen);
                    if (smsSent) {
                        await addHandledCardId(cardId);
                    }
                } else {
                    console.warn(`[Бот Bitrix] [Заявка ${cardId}] Ни «Чат», ни вкладка «Сообщение» не появились — не помечаем обработанной.`);
                }

                pressEscapeEverywhere();
                await queueSleep(500, gen);
                await returnToCRMAndEscape();
                processNextCard(gen);
                return;
            }

            console.warn(`[Бот Bitrix] [Заявка ${cardId}] Чат не открылся — пропускаем заявку.`);
            await addHandledCardId(cardId);
            await closeChatAndCard();
            processNextCard(gen);
            return;
        }

        await queueSleep(250, gen);

        if (isNewMode) {
            if (hasSelfMessagesInBitrixChat()) {
                console.log(`[Бот Bitrix] [Заявка ${cardId}] В чате уже есть наши сообщения — пропускаем.`);
                await addHandledCardId(cardId);
                await closeChatAndCard();
                processNextCard(gen);
                return;
            }

            const smsAlreadySentInChat = hasOutgoingBitrixSmsInChat();
            if (smsAlreadySentInChat) {
                console.log(`[Бот Bitrix] [Заявка ${cardId}] В чате найдено исходящее СМС из Битрикс24 — отправим сценарий без 1-го приветственного сообщения.`);
            }

            // Сначала 2 сек на пропуск по Esc; «Ответить» жмём только после этого
            const waitRes = await waitBeforeFirstNewMessageWithEsc(cardId, cardTitleText, gen, 2000);
            if (waitRes.aborted) return;
            ensureQueueActive(gen);

            if (waitRes.skipped) {
                console.log(`[Бот Bitrix] [Заявка ${cardId}] Пропущена по Esc перед первым сообщением.`);
                await addHandledCardId(cardId);
                await exitChatToDetailsThenList(gen);
                processNextCard(gen);
                return;
            }

            const inputReady = await clickReplyIfPresentInOpenChat(cardId, gen);
            ensureQueueActive(gen);
            if (!inputReady) throw new Error(`В чате заявки ${cardId} не появилось поле ввода после «Ответить»`);

            await sendSavedFlowInBitrixChat('firstTouch', gen, { skipFirstText: smsAlreadySentInChat });
            await queueSleep(600, gen);

            pressEscapeEverywhere();
            await queueSleep(500, gen);

            const hasPhone = dealHasClientPhoneNumber();
            const targetStageForNew = hasPhone ? 'touch1' : 'close';
            if (!hasPhone) {
                console.log(`[Бот Bitrix] [Заявка ${cardId}] Номер телефона в деталях не найден (Instagram/соцсеть без номера) — закрываем сделку.`);
            }

            const moved = await moveCardToStage(targetStageForNew, gen);
            if (!moved) return;
            ensureQueueActive(gen);

            await addHandledCardId(cardId);
            await returnToCRMAndEscape();
            processNextCard(gen);
            return;
        }

        const answer = await askTouch1SendConfirmation(cardId, cardTitleText, gen);
        if (answer === null) {
            removeLeftConfirmModal();
            return;
        }
        ensureQueueActive(gen);

        if (answer === 'skip' || answer === false) {
            console.log(`[Бот Bitrix] [Заявка ${cardId}] Выбрано «Нет» (Esc) — закрываем и идём дальше.`);
            await addHandledCardId(cardId);
            await closeChatAndCard();
            processNextCard(gen);
            return;
        }

        if (answer === 'close_deal') {
            console.log(`[Бот Bitrix] [Заявка ${cardId}] Выбрано «Нет и закрыть» (Ctrl+Esc) — без отправки, закрываем сделку.`);
            pressEscapeEverywhere();
            await queueSleep(500, gen);
            ensureQueueActive(gen);

            const closed = await moveCardToStage('close', gen);
            if (!closed) return;
            ensureQueueActive(gen);

            await addHandledCardId(cardId);
            await returnToCRMAndEscape();
            processNextCard(gen);
            return;
        }

        const inputReady = await clickReplyIfPresentInOpenChat(cardId, gen);
        ensureQueueActive(gen);
        if (!inputReady) throw new Error(`В чате заявки ${cardId} не появилось поле ввода после «Ответить»`);

        await sendSavedFlowInBitrixChat('touch1', gen);
        await queueSleep(600, gen);

        pressEscapeEverywhere();
        await queueSleep(500, gen);

        const moved = await moveCardToStage('touch1_target', gen);
        if (!moved) return;
        ensureQueueActive(gen);

        await addHandledCardId(cardId);
        await returnToCRMAndEscape();
        processNextCard(gen);
    } catch (e) {
        bitrixChatSending = false;
        if (e && e.message === 'BOT_ABORTED') {
            return;
        }
        if (!isRunActive(gen)) return;
        console.error(`[Бот CRM] [Заявка ${currentCardId || '?'}] Ошибка обработки заявки:`, e);
        showAlert("Ошибка при обработке заявки (стадия НЕ изменена): " + (e && e.message ? e.message : e));
    }
}

function proceedToNextCardFromStorage() {
    processNextCard(runGeneration);
}

function extractCardDateRaw(card) {
    const byLastActivityAgo = card.querySelector('.crm-kanban-item-last-activity-time-ago');
    const byLastActivityBox = card.querySelector('.crm-kanban-item-last-activity-time');
    const byConfig = (typeof SELECTORS !== 'undefined' && SELECTORS?.bitrix?.cardDate)
        ? card.querySelector(SELECTORS.bitrix.cardDate)
        : null;
    const byItemDate = card.querySelector('.crm-kanban-item-date');

    const el = byLastActivityAgo || byLastActivityBox || byConfig || byItemDate;
    const selectorUsed = byLastActivityAgo
        ? '.crm-kanban-item-last-activity-time-ago'
        : (byLastActivityBox
            ? '.crm-kanban-item-last-activity-time'
            : (byConfig ? SELECTORS.bitrix.cardDate : (byItemDate ? '.crm-kanban-item-date' : 'none')));

    const rawText = el ? (el.innerText || el.textContent || '') : '';
    return {
        elFound: Boolean(el),
        selectorUsed,
        rawText: rawText.trim(),
        normText: rawText.trim().toLowerCase()
    };
}

function isCardDateToday(card, cardId = '', debug = false) {
    const info = extractCardDateRaw(card);
    const t = info.normText;

    // Если пусто — безопаснее считать сегодняшней, чтобы не дёрнуть лишнюю карточку
    if (!t) {
        if (debug) console.log(`[DBG Дата] card=${cardId} | пусто -> TODAY`);
        return true;
    }

    // Явно «сегодня» (включая «Сегодня 17:36»)
    if (t.includes('сегодня')) {
        if (debug) console.log(`[DBG Дата] card=${cardId} | raw="${info.rawText}" -> TODAY`);
        return true;
    }

    // Только время «17:36» — это тоже за сегодня
    if (/^\d{1,2}:\d{2}$/.test(t)) {
        if (debug) console.log(`[DBG Дата] card=${cardId} | raw="${info.rawText}" -> TODAY (время)`);
        return true;
    }

    // Относительное время в секундах/минутах/часах назад (например «15 минут назад», «2 часа назад»)
    if (/назад/.test(t) && /(секунд|минут|час)/.test(t)) {
        if (debug) console.log(`[DBG Дата] card=${cardId} | raw="${info.rawText}" -> TODAY (часы/минуты назад)`);
        return true;
    }

    // Всё остальное («вчера», «12 Ноя», «15 Окт», даты и т.д.) — НЕ сегодня, можно брать
    if (debug) console.log(`[DBG Дата] card=${cardId} | sel=${info.selectorUsed} | raw="${info.rawText}" -> NOT TODAY`);
    return false;
}

async function scrollToFirstNonTodayCard(column, handledSet, gen) {
    console.log(`[DBG Scroll] Старт поиска карточки «1 касания» не за сегодня. handledCount=${handledSet.size}`);

    for (let step = 0; step < 80; step++) {
        ensureQueueActive(gen);

        const cards = Array.from(column.querySelectorAll(SELECTORS.bitrix.cards));
        const datesSummary = cards.slice(-8).map(c => {
            const id = getCardId(c);
            const d = extractCardDateRaw(c).rawText || '<empty>';
            return `${id}[${d}]`;
        });

        console.log(`[DBG Scroll] Шаг ${step}: карточек в DOM=${cards.length} | последние 8: ${datesSummary.join(', ')}`);

        const candidate = cards.find(c => {
            const id = getCardId(c);
            if (handledSet.has(id)) return false;
            const today = isCardDateToday(c, id, true);
            return !today;
        });

        if (candidate) {
            const cid = getCardId(candidate);
            const rawDate = extractCardDateRaw(candidate).rawText;
            console.log(`[DBG Scroll] НАЙДЕНА подходящая карточка: id=${cid}, дата="${rawDate}" на шаге ${step}`);
            candidate.scrollIntoView({ block: 'center' });
            await queueSleep(350, gen);
            return candidate;
        }

        const scrollers = getKanbanScrollers(column);
        console.log(`[DBG Scroll] Шаг ${step}: подходящих нет. Найдено скроллеров=${scrollers.length}`);

        for (let idx = 0; idx < scrollers.length; idx++) {
            const sc = scrollers[idx];
            const beforeTop = sc.scrollTop;
            const beforeH = sc.scrollHeight;
            sc.scrollTop = sc.scrollHeight;
            sc.dispatchEvent(new Event('scroll', { bubbles: true }));
            console.log(`[DBG Scroll]   scroller[${idx}] (${sc.className || sc.tagName}): top ${beforeTop} -> ${sc.scrollTop}, height ${beforeH} -> ${sc.scrollHeight}`);
        }

        if (cards.length) {
            cards[cards.length - 1].scrollIntoView({ block: 'end' });
        }

        await queueSleep(900, gen);

        const afterCardsCount = column.querySelectorAll(SELECTORS.bitrix.cards).length;
        const afterHeights = scrollers.map(sc => sc.scrollHeight);
        console.log(`[DBG Scroll] После ожидания шага ${step}: карточек=${afterCardsCount}, heights=[${afterHeights.join(', ')}]`);
    }

    console.warn(`[DBG Scroll] Достигнут лимит 80 шагов, финальная проверка DOM...`);
    ensureQueueActive(gen);
    const fallbackCards = Array.from(column.querySelectorAll(SELECTORS.bitrix.cards));
    return fallbackCards.find(c => {
        const id = getCardId(c);
        return !handledSet.has(id) && !isCardDateToday(c, id, true);
    }) || null;
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