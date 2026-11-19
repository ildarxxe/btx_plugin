const PRICE_FILE_PATH = 'price.pdf';

const MESSAGE_VARIANTS = {
    msg1: [
        "Здравствуйте! Меня зовут Алина, менеджер компании Elki.kz 🎄 Отправляю Вам наш прайс-лист с нашими вариантами",
        "Добрый день! Это Алина, менеджер Elki.kz 🎄 Высылаю Вам наш прайс-лист с вариантами ёлок",
        "Здравствуйте! Я Алина из компании Elki.kz 🎄 Направляю Вам прайс-лист с нашими моделями",
        "Добрый день! Меня зовут Алина, я менеджер компании Elki.kz 🎄 Прикрепляю наш прайс-лист с вариантами",
        "Здравствуйте! Алина, менеджер Elki.kz 🎄 Отправляю Вам прайс-лист — в нём все наши варианты"
    ],
    msg2: [
        "Ознакомьтесь, как будут вопросы - я на связи \nЕсть видео и фото почти на все модели, если нужны будут - напишите название - я отправлю",
        "Посмотрите, пожалуйста, а если появятся вопросы — я на связи \nПочти на все модели у нас есть фото и видео: напишите название модели, и я пришлю",
        "Ознакомьтесь, пожалуйста, и если возникнут вопросы — пишите, я всегда на связи \nНа большинство моделей есть видео и фото — просто напишите название, и я отправлю",
        "Буду рада ответить на любые вопросы, я на связи \nФото и видео есть почти на все модели — напишите название, и я пришлю",
        "Изучите, пожалуйста, прайс, а по любым вопросам обращайтесь — я на связи \nЕсли нужны фото или видео какой-то модели — напишите её название, я отправлю"
    ],
    msg3: [
        "Здравствуйте! Хотела узнать, удалось ли Вам посмотреть наш прайс-лист? Может, уже присмотрели себе ёлочку? Если есть вопросы или нужна помощь с выбором, я с удовольствием подскажу и помогу найти ту самую ёлочку для Вашего дома 🎄🤗",
        "Здравствуйте! Хотела уточнить, получилось ли Вам посмотреть наш прайс-лист? Возможно, Вы уже выбрали ёлочку? Если нужна помощь с выбором или есть вопросы — с радостью подскажу 🎄",
        "Добрый день! Подскажите, удалось ли Вам ознакомиться с нашим прайс-листом? Если есть вопросы или нужна помощь с выбором ёлочки для Вашего дома — я на связи 🎄🤗",
        "Здравствуйте! Это снова Алина из Elki.kz 🎄 Хотела узнать, посмотрели ли Вы прайс-лист и не присмотрели ли уже подходящую ёлочку? Буду рада помочь с выбором",
        "Добрый день! Напоминаю о себе — Алина, Elki.kz 🎄 Удалось ли Вам изучить наш прайс-лист? Если появились вопросы или нужна консультация по выбору — пишите, с удовольствием помогу 🤗"
    ]
};

const PRICE_FILE_NAMES = ["Pricelist_Elki.pdf", "Прайс-лист_Elki.kz.pdf", "Elki_price.pdf", "Прайс_Elki.pdf"];

const MAX_SENDS_PER_DAY = 30;
const DELAYS = {
    beforeFirstMessage: [1500, 4000],
    betweenMessages: [3000, 8000],
    betweenClients: [45000, 60000],
    testBetweenClients: [3000, 6000]
};

const TOUCH1_MAX_MESSAGES = 3;

const RU_MONTHS = {
    'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
    'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
};
const RU_WEEKDAYS = {
    'воскресенье': 0, 'понедельник': 1, 'вторник': 2, 'среда': 3,
    'четверг': 4, 'пятница': 5, 'суббота': 6
};

const SELECTORS = {
    bitrix: {
        newColumn: '[data-testid="kanban-column-C13:NEW"]',
        touchColumn: '[data-testid="kanban-column-C13:UC_QUTSPY"]',
        cards: '.main-kanban-item',
        cardDate: '.crm-kanban-item-date',
        phoneWidget: '.crm-entity-widget-client-contact-phone',
        stageTouch1: '.crm-entity-section-status-step[data-id="C13:UC_QUTSPY"]',
        stageTouch2: '.crm-entity-section-status-step[data-id="C13:UC_LOXVY8"]',
        modalForm: 'form[name*="partial_editor_form"]',
        dateInput: 'input[name="UF_CRM_1782717007483"]',
        categorySelect: '[data-name="UF_CRM_1782717199942"]',
        clientTypeSelect: '[data-name="UF_CRM_1782799322263"]',
        // Поле "Источник" в модалке смены статуса (появляется не всегда).
        // В разметке: <div data-cid="SOURCE_ID"> ... <div class="ui-ctl-dropdown"> (там же скрытый input[name=SOURCE_ID] — его не берём)
        sourceBlock: '[data-cid="SOURCE_ID"]',
        sourceSelect: '[data-cid="SOURCE_ID"] .ui-ctl-dropdown',
        // Мессенджер открыт (список сообщений чата)
        messengerOpened: '[data-testid="im-message-list"], .bx-im-content-chat__dialog_container',
        // Кнопка "Чат" в деталях заявки (берём только доступную — у заблокированной нет класса -available)
        chatBtn: 'a.crm-entity-widget-client-action-im.crm-entity-widget-client-action-available',
        // Кнопка "Ответить" внизу мессенджера Bitrix (открытые линии)
        messengerAnswerBtn: 'button[data-testid="openlines-chat-control-panel-answer-btn"]',
        messengerTextarea: 'textarea[data-testid="im-textarea-input"]',
        saveButton: '.ui-btn.ui-btn-primary',
        todoPopup: '.crm-activity__todo-create-notification-popup',
        sidePanelIframe: 'iframe[data-testid="main-sidepanel-iframe"], iframe.side-panel-iframe'
    },
    whatsapp: {
        searchInput: 'input[aria-label*="Поиск"], input[data-tab="3"]',
        chatContainer: '[data-testid="conversation-panel-body"]',
        messageRows: '[role="row"]',
        msgBox: 'div[contenteditable="true"][data-tab="10"]',
        attachBtn: 'span[data-icon="plus"], span[data-icon="plus-rounded"], span[data-icon="clip"], [aria-label="Прикрепить"], [aria-label="Attach"]',
        fileInput: 'input[type="file"]',
        sendBtn: [
            'div[role="button"][aria-label^="Отправить"]',
            'div[role="button"][aria-label^="Send"]',
            'button[aria-label^="Отправить"]',
            'button[aria-label^="Send"]',
            'span[data-icon="send"]',
            'span[data-icon="wds-ic-send-filled"]'
        ].join(',')
    }
};

const STORAGE_KEY = 'b24_wa_bot_state';

let BOT_CONFIG = {
    runMode: 'new',
    useTestPhone: false,
    testPhone: '87781193946',
    isPaused: false
};

let isScriptRunning = false;
let idleTimer = null;

const INSTANCE_ID = Date.now() + '-' + Math.random().toString(36).slice(2);
document.documentElement.setAttribute('data-elki-bot-instance', INSTANCE_ID);
function isStaleInstance() {
    return document.documentElement.getAttribute('data-elki-bot-instance') !== INSTANCE_ID;
}

function stopBot(reason) {
    isScriptRunning = false;
    BOT_CONFIG.isPaused = true;
    clearTimeout(idleTimer);
    console.log(`[Бот] Остановлен (${reason}).`);
}

const PHONE_WAIT_MS = 10000;
const IDLE_POLL_MS = 5000;

// Мессенджер Bitrix: сколько ждать появления кнопки "Ответить" и пауза между двумя Escape
const MESSENGER_WAIT_MS = 30000;
const MESSENGER_ESC_GAP_MS = 1000;
const CHAT_BTN_WAIT_MS = 4000;
// Мессенджер уже загрузился (виден список сообщений), а кнопки "Ответить" всё нет — ждём ещё столько,
// затем считаем, что диалог уже взяли вручную
const MESSENGER_ANSWER_GRACE_MS = 3000;
const UNKNOWN_SOURCE_TEXT = 'Неизвестный источник';

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
        BOT_CONFIG = request.data.config || BOT_CONFIG;
        console.log("[Бот WA] Начинаем работу с номером:", request.data.phone);
        executeWhatsAppLogic(request.data.phone);
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

let currentCardId = null;
let cardAttempts = {};
let columnPreloaded = false;

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
    console.log(`[Бот] Заявка ${id} помечена как обработанная/пропущенная.`);
}

async function getCurrentCardId() {
    if (currentCardId) return currentCardId;
    const st = await chrome.storage.local.get(['botState']);
    return (st.botState && st.botState.cardId) || null;
}

function startAutomation() {
    clearTimeout(idleTimer);
    isScriptRunning = true;
    columnPreloaded = false;
    console.log(`[Бот ДЕБАГ] Запуск автоматизации. Режим: ${BOT_CONFIG.runMode}. Конфиг:`, JSON.stringify(BOT_CONFIG));
    if (BOT_CONFIG.useTestPhone) {
        console.warn(`[Бот] ВНИМАНИЕ: включён ТЕСТОВЫЙ режим, все сообщения пойдут на номер ${BOT_CONFIG.testPhone}!`);
    }
    processNextCard();
}

async function processNextCard() {
    if (isStaleInstance()) {
        isScriptRunning = false;
        clearTimeout(idleTimer);
        console.warn("[Бот] Устаревший экземпляр скрипта остановлен. Обновите страницу (F5), если бот не запускается.");
        return;
    }
    if (BOT_CONFIG.isPaused || !isScriptRunning) return;

    const targetColumnSelector = BOT_CONFIG.runMode === 'new' ? SELECTORS.bitrix.newColumn : SELECTORS.bitrix.touchColumn;
    const column = document.querySelector(targetColumnSelector);

    if (!column) {
        showAlert(`Не найдена колонка для режима '${BOT_CONFIG.runMode}'. Откройте страницу со всеми заявками (канбан).`);
        return;
    }

    if (BOT_CONFIG.runMode === 'touch1' && !columnPreloaded) {
        await loadAllColumnCards(column);
        columnPreloaded = true;
        if (BOT_CONFIG.isPaused || !isScriptRunning) return;
    }

    const handled = await getHandledCardIds();
    if (BOT_CONFIG.isPaused || !isScriptRunning) return;
    const allCards = Array.from(column.querySelectorAll(SELECTORS.bitrix.cards));
    let cards = allCards.filter(c => !handled.includes(getCardId(c)));
    let todayCount = 0;

    if (BOT_CONFIG.runMode === 'touch1') {
        const notToday = cards.filter(c => !isCardDateToday(c));
        todayCount = cards.length - notToday.length;
        cards = notToday;
        cards.reverse();
    }

    console.log(`[Бот ДЕБАГ] В колонке: ${allCards.length}, пропущено/обработано: ${allCards.length - cards.length - todayCount}` +
        (BOT_CONFIG.runMode === 'touch1' ? `, сегодняшних (не трогаем): ${todayCount}` : '') +
        `, к обработке: ${cards.length}`);

    if (cards.length === 0) {
        if (BOT_CONFIG.runMode === 'new') {
            console.log(`[Бот ДЕБАГ] Новых заявок пока нет. Проверим снова через ${IDLE_POLL_MS / 1000} сек. (остановить — кнопка STOP в плагине)`);
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => processNextCard(), IDLE_POLL_MS);
            return;
        }
        if (allCards.length === 0) {
            alert("В выбранной колонке нет заявок для обработки!");
        } else {
            console.log("[Бот ДЕБАГ] Все заявки в этой колонке обработаны или пропущены.");
            alert("Очередь заявок завершена!\n(Оставшиеся в колонке заявки были пропущены: нет номера или нет WhatsApp.)");
        }
        isScriptRunning = false;
        return;
    }

    const card = cards[0];
    const cardId = getCardId(card);
    currentCardId = cardId;

    cardAttempts[cardId] = (cardAttempts[cardId] || 0) + 1;
    if (cardAttempts[cardId] > 3) {
        console.warn(`[Бот ДЕБАГ] [Заявка ${cardId}] Открывалась уже ${cardAttempts[cardId] - 1} раза — похоже на зацикливание, пропускаем её.`);
        await addHandledCardId(cardId);
        await returnToCRMAndEscape();
        processNextCard();
        return;
    }

    const cardTitleLink = card.querySelector('.crm-kanban-item-title');

    if (!cardTitleLink) {
        await addHandledCardId(cardId);
        processNextCard();
        return;
    }

    console.log(`[Бот ДЕБАГ] [Заявка ${cardId}] Открываем: ${cardTitleLink.innerText}`);
    cardTitleLink.click();

    waitForElementWithDebug(SELECTORS.bitrix.phoneWidget, PHONE_WAIT_MS, cardId)
        .then(async phoneElement => {
            let phoneNumber = phoneElement ? phoneElement.innerText.trim() : "";

            if (BOT_CONFIG.useTestPhone) {
                phoneNumber = BOT_CONFIG.testPhone;
                console.log(`[Бот ДЕБАГ] [Заявка ${cardId}] [ТЕСТ РЕЖИМ] Используем тестовый номер: ${phoneNumber}`);
            }

            if (!phoneNumber) {
                console.warn(`[Бот ДЕБАГ] [Заявка ${cardId}] Номер пустой. Пропускаем.`);
                await addHandledCardId(cardId);
                await returnToCRMAndEscape();
                processNextCard();
                return;
            }

            // Мессенджер Bitrix — только в боевом режиме "Новые" (в тестовом не трогаем реальный диалог)
            if (BOT_CONFIG.runMode === 'new' && !BOT_CONFIG.useTestPhone) {
                const messengerOk = await openMessengerAndAnswer(cardId);
                if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return;
                if (!messengerOk) return; // пауза и алерт уже показаны внутри
            }

            const stateData = { phone: phoneNumber, cardId: cardId, config: BOT_CONFIG };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateData));
            await chrome.storage.local.set({ lastSent: false });

            chrome.runtime.sendMessage({
                action: "openWhatsAppAndSearch",
                data: stateData
            });
        })
        .catch(async err => {
            console.warn(`[Бот ДЕБАГ] [Заявка ${cardId}] Номера телефона нет — пропускаем без смены статуса.`);
            await addHandledCardId(cardId);
            await returnToCRMAndEscape();
            processNextCard();
        });
}

function pressEscapeEverywhere() {
    const makeEvent = (type) => new KeyboardEvent(type, {
        key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true
    });
    for (const d of getAllDocuments()) {
        const targets = [d, d.body, d.activeElement].filter(Boolean);
        for (const t of targets) {
            t.dispatchEvent(makeEvent('keydown'));
            t.dispatchEvent(makeEvent('keyup'));
        }
    }
}

function clickLikeUser(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    el.click();
}

// Ждём элемент (во всех документах), который не заблокирован. Прерывается по STOP.
async function waitForEnabledAnyDoc(selector, timeout, interval = 500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return null;
        const el = findAllInAnyDocument(selector).find(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true');
        if (el) return el;
        await sleep(interval);
    }
    return null;
}

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

    while (Date.now() - started < MESSENGER_WAIT_MS) {
        if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return false;

        answerBtn = findAllInAnyDocument(SELECTORS.bitrix.messengerAnswerBtn)
            .find(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true') || null;
        if (answerBtn) break;

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

function waitForElementWithDebug(selector, timeout = 15000, cardIndex) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const findEl = () => {
            let el = document.querySelector(selector);
            if (el && el.innerText.trim().length > 0) return el;

            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc) {
                        el = iframeDoc.querySelector(selector);
                        if (el && el.innerText.trim().length > 0) return el;
                    }
                } catch (e) {}
            }
            return null;
        };

        const immediate = findEl();
        if (immediate) return resolve(immediate);

        const interval = setInterval(() => {
            const found = findEl();
            if (found) {
                clearInterval(interval);
                resolve(found);
                return;
            }

            if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                reject(new Error(`Элемент ${selector} не дождался загрузки.`));
            }
        }, 1000);
    });
}

function normalizePhone(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
    else if (digits.length === 10) digits = '7' + digits;
    return digits;
}

function isVisible(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
}

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

const SEARCH_RESULT_ITEM_SELECTOR = '[data-testid="cell-frame-container"], [role="listitem"], [role="option"]';

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

// Строки-меню панели "Новый чат", которые не являются результатом поиска
const WA_NEW_CHAT_MENU_RE = /(новая группа|новый контакт|новое сообщество|new group|new contact|new community)/i;

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

async function waitForSearchResult(input, phone, timeout = 10000) {
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
        if (BOT_CONFIG.useTestPhone || BOT_CONFIG.runMode === 'touch1') {
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

async function analyzeChatAndExecute(phone) {
    const test = BOT_CONFIG.useTestPhone;
    const messages = await waitForChatMessages();

    console.log(`[Бот WA] Анализ чата: сообщений найдено ${messages.length}`,
        messages.map(m => `${m.dir === 'out' ? '→' : '←'} ${m.date ? m.date.toLocaleDateString('ru-RU') : '??.??'} | ${m.text.slice(0, 40)}`));

    if (chatPeerMismatch(messages, phone)) {
        await skipCurrentCardFromWA("открыт чат с другим номером (в WhatsApp не тот чат)");
        return;
    }

    if (BOT_CONFIG.runMode === 'new') {
        if (test || messages.length === 0) {
            console.log("[Бот WA] Режим 'new': отправляем 1-е, 2-е сообщения и файл...");
            await sendNewClientMessages();
        } else {
            console.log("[Бот WA] Режим 'new': в чате уже есть сообщения — ничего не пишем, меняем статус на '1 касание'.");
            returnToCRMAndReturn();
        }
        return;
    }

    if (BOT_CONFIG.runMode === 'touch1') {
        const decision = decideTouch1(messages);
        if (!decision.send) {
            await skipCurrentCardFromWA(decision.reason);
            return;
        }
        console.log("[Бот WA] Режим 'touch1': условия выполнены, отправляем 3-е сообщение...");
        await sendThirdMessage();
    }
}

function decideTouch1(messages) {
    const test = BOT_CONFIG.useTestPhone;
    const skip = (reason) => ({ send: false, reason });

    if (messages.length === 0) return skip("чата нет или он пустой");
    if (messages.some(m => m.dir === 'in')) return skip("в чате есть ответ от клиента");
    if (!messages.some(m => m.dir === 'out' && /elki\.kz/i.test(m.text))) {
        return skip("в чате нет нашего первого сообщения (со словом Elki.kz)");
    }

    if (!test) {
        if (messages.length > TOUCH1_MAX_MESSAGES) {
            return skip(`в чате ${messages.length} сообщений (ожидалось не больше ${TOUCH1_MAX_MESSAGES}: два текста и файл)`);
        }
        if (messages.some(m => !m.date)) return skip("не удалось определить дату сообщений");
        if (messages.some(m => isTodayDate(m.date))) return skip("в чате есть сообщения за сегодня");
    }
    return { send: true };
}

async function sendNewClientMessages() {
    try {
        if (!(await checkDailyLimit())) return;
        await humanPause(DELAYS.beforeFirstMessage);
        await typeAndSendMessage(pickVariant('msg1'));
        await humanPause(DELAYS.betweenMessages);
        await typeAndSendMessage(pickVariant('msg2'));
        await humanPause(DELAYS.betweenMessages);
        await sendFileToChat();
        await incrementSendCount();
        await chrome.storage.local.set({ lastSent: true });
        await sleep(4000);
    } catch (e) {
        console.error("[Бот WA] Ошибка при отправке сообщений клиенту:", e);
        showAlert("Ошибка при отправке сообщений в WhatsApp. Проверьте консоль.");
        return;
    }
    returnToCRMAndReturn();
}

async function sendThirdMessage() {
    try {
        if (!(await checkDailyLimit())) return;
        await humanPause(DELAYS.beforeFirstMessage);
        await typeAndSendMessage(pickVariant('msg3'));
        await incrementSendCount();
        await chrome.storage.local.set({ lastSent: true });
        await sleep(3000);
    } catch (e) {
        console.error("[Бот WA] Ошибка при отправке 3-го сообщения:", e);
        showAlert("Ошибка при отправке сообщения в WhatsApp. Проверьте консоль.");
        return;
    }
    returnToCRMAndReturn();
}

function returnToCRMAndReturn() {
    const stageType = BOT_CONFIG.runMode === 'new' ? 'touch1' : 'touch2_simple';
    console.log(`[Бот WA] Возвращаемся в Bitrix, stageType: ${stageType}`);
    try {
        chrome.runtime.sendMessage({ action: "returnToBitrix", stageType: stageType }, () => {
            if (chrome.runtime.lastError) {
                console.error("[Бот WA] Ошибка связи с background:", chrome.runtime.lastError.message);
            }
        });
    } catch (e) {
        console.error("[Бот WA] sendMessage упал:", e);
        showAlert("Потеряна связь с расширением. Перезагрузите вкладку WhatsApp (F5) и запустите заново.");
    }
}

async function finishCardAndMoveNext() {
    await sleep(2000);

    try {
        const isNewMode = BOT_CONFIG.runMode === 'new';
        const stageSelector = isNewMode ? SELECTORS.bitrix.stageTouch1 : SELECTORS.bitrix.stageTouch2;
        const stageName = isNewMode ? '1 касание' : '2 касание';

        const stageBtn = await waitForElementAnyDoc(stageSelector, 8000);
        if (!stageBtn) {
            showAlert(`Не найдена кнопка статуса '${stageName}' (селектор: ${stageSelector}).`);
            return;
        }

        console.log(`[Бот CRM] Нажимаем кнопку стадии '${stageName}'...`);
        stageBtn.click();

        if (isNewMode) {
            await fillAndSubmitModalForm();
        } else {
            await sleep(1500);
            await addHandledCardId(await getCurrentCardId());
            await returnToCRMAndEscape();
            proceedToNextCardFromStorage();
        }
    } catch (e) {
        console.error("[Бот CRM] Ошибка finishCardAndMoveNext:", e);
        showAlert("Ошибка при смене стадии. Проверьте консоль.");
    }
}

async function waitForModalField(selector, timeout = 12000, interval = 300) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const form = findInAnyDocument(SELECTORS.bitrix.modalForm);
        const el = (form && form.querySelector(selector)) || findInAnyDocument(selector);
        if (el) return el;
        await sleep(interval);
    }
    return null;
}

function dumpModalDebug() {
    const form = findInAnyDocument(SELECTORS.bitrix.modalForm);
    console.warn("[Бот CRM] ДЕБАГ: форма найдена:", !!form);
    if (form) {
        console.warn("[Бот CRM] ДЕБАГ: длина HTML формы:", form.innerHTML.length);
        console.warn("[Бот CRM] ДЕБАГ: input name в форме:",
            Array.from(form.querySelectorAll('input[name]')).map(i => i.name));
        console.warn("[Бот CRM] ДЕБАГ: data-name в форме:",
            Array.from(form.querySelectorAll('[data-name]')).map(e => e.getAttribute('data-name')));
    }
    console.warn("[Бот CRM] ДЕБАГ: все [data-name^=UF_CRM] во всех документах:",
        findAllInAnyDocument('[data-name^="UF_CRM"]').map(e => e.getAttribute('data-name')));
    console.warn("[Бот CRM] ДЕБАГ: все input[name^=UF_CRM] во всех документах:",
        findAllInAnyDocument('input[name^="UF_CRM"]').map(i => i.name));
}

function findSourceField(form) {
    let el = (form && form.querySelector(SELECTORS.bitrix.sourceSelect)) || findInAnyDocument(SELECTORS.bitrix.sourceSelect);
    if (el) return el;
    if (!form) return null;

    // Запасной поиск: подпись поля начинается со слова "Источник"
    const labels = Array.from(form.querySelectorAll('label, span, div, td, th')).filter(n => {
        const own = Array.from(n.childNodes).filter(c => c.nodeType === 3).map(c => c.textContent).join('').trim();
        return own.length > 0 && own.length < 40 && /^источник/i.test(own);
    });
    for (const lab of labels) {
        const wrap = lab.closest('.ui-entity-editor-content-block, .ui-entity-editor-field, .main-ui-control-field, .ui-form-row, tr') || lab.parentElement;
        const ctl = wrap && wrap.querySelector('select, [data-name], .main-ui-select, .ui-ctl-dropdown, .ui-ctl-element');
        if (ctl) return ctl;
    }
    return null;
}

// Поле "Источник" появляется в модалке не всегда. Если есть — выбираем "Неизвестный источник".
async function fillSourceFieldIfPresent() {
    let field = null;
    for (let i = 0; i < 3 && !field; i++) {
        field = findSourceField(findInAnyDocument(SELECTORS.bitrix.modalForm));
        if (!field) await sleep(400);
    }
    if (!field) {
        console.log("[Бот CRM] Поля 'Источник' в модалке нет — пропускаем.");
        return;
    }

    const wanted = UNKNOWN_SOURCE_TEXT.toLowerCase();
    if ((field.tagName || '').toLowerCase() === 'select') {
        const opt = Array.from(field.options).find(o => (o.text || '').toLowerCase().includes(wanted));
        if (!opt) {
            console.warn(`[Бот CRM] В поле 'Источник' нет значения '${UNKNOWN_SOURCE_TEXT}'. Варианты:`, Array.from(field.options).map(o => o.text));
            return;
        }
        if (field.value !== opt.value) {
            field.value = opt.value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
        console.log(`[Бот CRM] Источник: выбрано '${UNKNOWN_SOURCE_TEXT}'.`);
        return;
    }

    const readValue = () => ((field.innerText || field.textContent || '') + '').toLowerCase();
    if (readValue().includes(wanted)) {
        console.log(`[Бот CRM] Источник уже '${UNKNOWN_SOURCE_TEXT}'.`);
        return;
    }
    await selectDropdownOption(field, UNKNOWN_SOURCE_TEXT);
    await sleep(300);
    if (readValue().includes(wanted)) {
        console.log(`[Бот CRM] Источник: подтверждено '${UNKNOWN_SOURCE_TEXT}'.`);
    } else {
        console.warn(`[Бот CRM] Источник не выставился (сейчас: '${readValue().trim()}'). Закрываем меню повторным кликом.`);
        field.click();
        await sleep(300);
    }
}

async function fillAndSubmitModalForm() {
    const form0 = await waitForElementAnyDoc(SELECTORS.bitrix.modalForm, 12000);
    if (!form0) {
        showAlert("Модальное окно смены статуса не появилось вовремя.");
        return;
    }
    console.log("[Бот CRM] Модалка найдена, ждём загрузки полей...");

    // Набор полей в модалке меняется (например, категории/типа клиента может не быть, а "Источник" — быть),
    // поэтому ждём появления ЛЮБОГО из известных полей, а не только категории.
    const anyFieldSelector = [SELECTORS.bitrix.dateInput, SELECTORS.bitrix.categorySelect,
        SELECTORS.bitrix.clientTypeSelect, SELECTORS.bitrix.sourceBlock].join(', ');
    const anyField = await waitForModalField(anyFieldSelector, 12000);
    if (!anyField) {
        dumpModalDebug();
        showAlert("Модалка появилась, но поля в ней не загрузились (или у них другие селекторы). Смотрите строки ДЕБАГ в консоли.");
        return;
    }
    await sleep(1000);

    const dateInput = await waitForModalField(SELECTORS.bitrix.dateInput, 3000);
    if (dateInput) {
        dateInput.value = getFormattedTodayDate();
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log("[Бот CRM] Дата заполнена.");
    } else {
        console.warn("[Бот CRM] Поле даты не найдено в модалке.");
    }

    const categoryFresh = await waitForModalField(SELECTORS.bitrix.categorySelect, 1500);
    if (categoryFresh) {
        await selectDropdownOption(categoryFresh, "Уличные елки");
    } else {
        console.log("[Бот CRM] Поля 'категория' в модалке нет — пропускаем.");
    }

    const clientTypeEl = await waitForModalField(SELECTORS.bitrix.clientTypeSelect, 1500);
    if (clientTypeEl) {
        await selectDropdownOption(clientTypeEl, "B2C");
    } else {
        console.log("[Бот CRM] Поля 'тип клиента' в модалке нет — пропускаем.");
    }

    await fillSourceFieldIfPresent();

    await sleep(1000);

    const form = findInAnyDocument(SELECTORS.bitrix.modalForm) || form0;
    const saveBtn = findSaveButton(form);
    if (!saveBtn) {
        showAlert("Не найдена кнопка 'Сохранить' в модалке Битрикса.");
        return;
    }

    saveBtn.click();
    await sleep(2000);
    await addHandledCardId(await getCurrentCardId());
    await returnToCRMAndEscape();
    proceedToNextCardFromStorage();
}

function findSaveButton(form) {
    let btn = form.querySelector(SELECTORS.bitrix.saveButton);
    if (btn) return btn;

    const popup = form.closest('.popup-window, .bx-core-popup-container, .ui-sidepanel-layout, .main-ui-popup');
    if (popup) {
        btn = popup.querySelector(SELECTORS.bitrix.saveButton);
        if (btn) return btn;
    }

    const doc = form.ownerDocument;
    const candidates = Array.from(doc.querySelectorAll('button, a.ui-btn, span.ui-btn, .ui-btn'));
    return candidates.find(b => /^(сохранить|save)$/i.test((b.innerText || '').trim())) || null;
}

function proceedToNextCardFromStorage() {
    setTimeout(async () => {
        const st = await chrome.storage.local.get(['lastSent']);
        if (st.lastSent) {
            await chrome.storage.local.set({ lastSent: false });
            const ms = rand(...(BOT_CONFIG.useTestPhone ? DELAYS.testBetweenClients : DELAYS.betweenClients));
            console.log(`[Бот] Пауза ${Math.round(ms / 1000)} сек. перед следующим клиентом (чтобы WhatsApp не принял за спам). STOP прерывает паузу.`);
            await interruptibleSleep(ms);
        }
        processNextCard();
    }, 1000);
}

function getAllDocuments(rootDoc = document, depth = 0) {
    const docs = [rootDoc];
    if (depth > 3) return docs;
    rootDoc.querySelectorAll('iframe').forEach(iframe => {
        try {
            const d = iframe.contentDocument;
            if (d) docs.push(...getAllDocuments(d, depth + 1));
        } catch (e) {
        }
    });
    return docs;
}

function findInAnyDocument(selector) {
    for (const d of getAllDocuments()) {
        const el = d.querySelector(selector);
        if (el) return el;
    }
    return null;
}

function findAllInAnyDocument(selector) {
    const result = [];
    for (const d of getAllDocuments()) {
        result.push(...d.querySelectorAll(selector));
    }
    return result;
}

async function waitForElementAnyDoc(selector, timeout = 8000, interval = 300) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = findInAnyDocument(selector);
        if (el) return el;
        await sleep(interval);
    }
    return null;
}

function clickSendButton(sendEl) {
    const target = sendEl.closest('button') || sendEl.closest('[role="button"]') || sendEl;
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    target.click();
}

async function waitForSelectorPoll(selector, timeout = 8000, interval = 300) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el) return el;
        await sleep(interval);
    }
    return null;
}

async function typeAndSendMessage(text) {
    const msgBox = document.querySelector(SELECTORS.whatsapp.msgBox);
    if (!msgBox) throw new Error("Не найдено поле ввода сообщения в WhatsApp.");
    msgBox.focus();
    document.execCommand('insertText', false, text);
    await sleep(rand(700, 1800));

    const sendEl = await waitForSelectorPoll(SELECTORS.whatsapp.sendBtn, 2000, 200);
    if (sendEl) {
        clickSendButton(sendEl);
    } else {
        msgBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }
    await sleep(500);
}

function findDocumentInput() {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    return inputs.find(i => {
        const acc = (i.accept || '').toLowerCase();
        return !acc.includes('image') && !acc.includes('video');
    }) || null;
}

function clickAttachMenuItem(texts) {
    const nodes = Array.from(document.querySelectorAll(
        '[role="menuitem"], li, button, div[role="button"], span'
    ));

    const item = nodes.find(n => {
        const t = (n.innerText || '').trim().toLowerCase();
        return texts.includes(t);
    });
    if (!item) return false;

    const target = item.closest('li, button, [role="button"], [role="menuitem"]') || item;
    target.click();
    return true;
}

async function sendFileToChat() {
    console.log(`[Бот WA] Отправка PDF файла...`);

    const msgBox = document.querySelector(SELECTORS.whatsapp.msgBox);
    if (!msgBox) {
        showAlert("Не найдено поле ввода сообщения в WhatsApp для отправки файла.");
        return;
    }

    let dt;
    try {
        const fileUrl = chrome.runtime.getURL(PRICE_FILE_PATH);
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const file = new File([blob], pickFileName(), { type: "application/pdf" });
        dt = new DataTransfer();
        dt.items.add(file);
    } catch (e) {
        console.error("[Бот WA] Не удалось загрузить price.pdf из расширения:", e);
        showAlert("Не удалось загрузить price.pdf. Проверьте, что файл лежит в папке расширения и указан в web_accessible_resources в manifest.json.");
        return;
    }

    let sendBtn = null;

    try {
        const attachBtn = document.querySelector(SELECTORS.whatsapp.attachBtn);
        if (attachBtn) {
            console.log("[Бот WA] Способ 1: открываем меню 'Прикрепить'...");
            (attachBtn.closest('button') || attachBtn.closest('[role="button"]') || attachBtn).click();
            await sleep(1000);

            let docInput = findDocumentInput();

            if (!docInput) {
                const clicked = clickAttachMenuItem(['документ', 'document']);
                console.log(`[Бот WA] Клик по пункту 'Документ': ${clicked}`);

                for (let i = 0; i < 10 && !docInput; i++) {
                    await sleep(300);
                    docInput = findDocumentInput();
                }
            }

            if (docInput) {
                console.log(`[Бот WA] Найден input для документов, accept="${docInput.accept}"`);
                docInput.files = dt.files;
                docInput.dispatchEvent(new Event('input', { bubbles: true }));
                docInput.dispatchEvent(new Event('change', { bubbles: true }));
                sendBtn = await waitForSelectorPoll(SELECTORS.whatsapp.sendBtn, 6000);
            } else {
                console.warn("[Бот WA] Input для документов не найден. Image-input НЕ используем.");
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
                await sleep(500);
            }
        } else {
            console.warn("[Бот WA] Кнопка 'Прикрепить' не найдена, переходим к paste.");
        }
    } catch (e) {
        console.warn("[Бот WA] Способ 1 завершился ошибкой:", e);
    }

    if (!sendBtn) {
        console.warn("[Бот WA] input не сработал, пробуем paste...");
        try {
            msgBox.focus();
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dt
            });
            msgBox.dispatchEvent(pasteEvent);
            sendBtn = await waitForSelectorPoll(SELECTORS.whatsapp.sendBtn, 5000);
        } catch (e) {
            console.warn("[Бот WA] Способ 2 завершился ошибкой:", e);
        }
    }

    if (!sendBtn) {
        console.warn("[Бот WA] paste не сработал, пробуем drop...");
        try {
            const panel = document.querySelector(SELECTORS.whatsapp.chatContainer) || msgBox;
            ['dragenter', 'dragover', 'drop'].forEach(type => {
                panel.dispatchEvent(new DragEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: dt
                }));
            });
            sendBtn = await waitForSelectorPoll(SELECTORS.whatsapp.sendBtn, 5000);
        } catch (e) {
            console.warn("[Бот WA] Способ 3 завершился ошибкой:", e);
        }
    }

    if (sendBtn) {
        await sleep(2000);
        clickSendButton(sendBtn);
        console.log("[Бот WA] Файл отправлен!");
    } else {
        console.error("[Бот WA] Ни один способ не открыл окно предпросмотра файла.");
        showAlert("Не удалось открыть предпросмотр файла в WhatsApp. Проверьте селекторы (кнопка отправки, input[type=file]) в DevTools.");
    }
}

async function selectDropdownOption(container, optionText) {
    if (!container) return;
    container.click();
    await sleep(700);

    const items = findAllInAnyDocument('.main-ui-select-item, .menu-popup-item');
    const wanted = optionText.toLowerCase();
    const target = items.find(item => (item.innerText || '').toLowerCase().includes(wanted));
    if (target) {
        target.click();
        console.log(`[Бот CRM] Выбрано значение: ${optionText}`);
    } else {
        console.warn(`[Бот CRM] Не найдено значение '${optionText}' в списке (элементов в списке: ${items.length}).`);
    }
    await sleep(500);
}

function getFormattedTodayDate() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:00`;
}

function simulateKeyCombo(code, modifiers) {
    document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...modifiers }));
    document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, ...modifiers }));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);

        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Элемент ${selector} не дождался загрузки.`));
        }, timeout);
    });
}

function triggerPause(reason) {
    isScriptRunning = false;
    BOT_CONFIG.isPaused = true;
    alert(`⏸ ПЛАГИН НА ПАУЗЕ!\nПричина: ${reason}\n\nЧтобы продолжить, вернитесь в CRM и нажмите [Ctrl + Shift + X].`);
}

function showAlert(message) {
    isScriptRunning = false;
    alert(`[ОШИБКА ПЛАГИНА]:\n${message}\n\nУстраните проблему и нажмите [Ctrl + Shift + X] для продолжения.`);
}

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

function rand(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

async function humanPause([min, max]) {
    await sleep(rand(min, max));
}

async function interruptibleSleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (BOT_CONFIG.isPaused || !isScriptRunning) return;
        await sleep(Math.min(1000, Math.max(0, end - Date.now())));
    }
}

const lastVariantIndex = {};
function pickVariant(key) {
    const list = MESSAGE_VARIANTS[key];
    let idx = rand(0, list.length - 1);
    if (list.length > 1 && idx === lastVariantIndex[key]) idx = (idx + 1) % list.length;
    lastVariantIndex[key] = idx;
    return list[idx];
}

function pickFileName() {
    return PRICE_FILE_NAMES[rand(0, PRICE_FILE_NAMES.length - 1)];
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getTodaySendCount() {
    const st = await chrome.storage.local.get(['sendStats']);
    return (st.sendStats && st.sendStats.date === todayKey()) ? st.sendStats.count : 0;
}

async function incrementSendCount() {
    const count = await getTodaySendCount();
    await chrome.storage.local.set({ sendStats: { date: todayKey(), count: count + 1 } });
    console.log(`[Бот WA] Отправок сегодня: ${count + 1} из ${MAX_SENDS_PER_DAY}`);
}

async function checkDailyLimit() {
    if (BOT_CONFIG.useTestPhone) return true;
    const count = await getTodaySendCount();
    if (count >= MAX_SENDS_PER_DAY) {
        console.warn(`[Бот WA] Дневной лимит отправок исчерпан (${count}/${MAX_SENDS_PER_DAY}).`);
        chrome.runtime.sendMessage({ action: "returnToBitrix", stageType: 'stop' });
        return false;
    }
    return true;
}

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function sameDay(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isTodayDate(d) {
    return sameDay(d, new Date());
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

// Прокручиваемые контейнеры колонки: сама колонка, её потомки и предки (где именно скроллится канбан — зависит от версии Bitrix)
function getKanbanScrollers(column) {
    const found = new Set();
    const add = el => { if (isScrollableEl(el)) found.add(el); };
    add(column);
    column.querySelectorAll('*').forEach(add);
    let n = column.parentElement;
    while (n && n !== document.documentElement) { add(n); n = n.parentElement; }
    return Array.from(found);
}

function isColumnLoading(column) {
    return Array.from(column.querySelectorAll('[class*="loader"], [class*="preloader"], [class*="spinner"]')).some(isVisible);
}

async function loadAllColumnCards(column) {
    // Число в шапке колонки может быть суммой в тенге, а не количеством — используем, только если это чистое целое число
    const totalEl = column.querySelector('.main-kanban-column-total-item');
    const totalText = totalEl ? (totalEl.innerText || '').trim() : '';
    const total = /^\d+$/.test(totalText) ? parseInt(totalText, 10) : NaN;

    let prev = -1;
    let stable = 0;
    for (let i = 0; i < 60; i++) {
        if (BOT_CONFIG.isPaused || !isScriptRunning) return;
        const items = column.querySelectorAll(SELECTORS.bitrix.cards);
        const count = items.length;
        if (!isNaN(total) && count >= total) break;

        if (count === prev && !isColumnLoading(column)) {
            stable++;
            if (stable >= 5) break;
        } else {
            if (count !== prev) stable = 0;
            prev = count;
        }

        const scrollers = getKanbanScrollers(column);
        if (i === 0 || i % 10 === 0) {
            console.log(`[Бот ДЕБАГ] Прокрутка колонки: контейнеров ${scrollers.length}, карточек ${count}`,
                scrollers.map(sc => `${sc.tagName}.${String(sc.className).split(' ').slice(0, 2).join('.')} ${sc.scrollHeight}/${sc.clientHeight}`));
        }
        for (const sc of scrollers) {
            sc.scrollTop = sc.scrollHeight;
            sc.dispatchEvent(new Event('scroll', { bubbles: true }));
            sc.dispatchEvent(new WheelEvent('wheel', { deltaY: 400, bubbles: true }));
        }
        if (items.length) items[items.length - 1].scrollIntoView({ block: 'end' });
        await sleep(1200);
    }
    console.log(`[Бот ДЕБАГ] Колонка догружена: карточек ${column.querySelectorAll(SELECTORS.bitrix.cards).length}` + (isNaN(total) ? '' : ` из ${total}`));
}

function parseWhatsAppDateLabel(text) {
    const t = (text || '').trim().toLowerCase();
    if (!t || t.length > 40) return null;
    const now = new Date();

    if (t === 'сегодня' || t === 'today') return startOfDay(now);
    if (t === 'вчера' || t === 'yesterday') {
        const d = startOfDay(now);
        d.setDate(d.getDate() - 1);
        return d;
    }

    if (RU_WEEKDAYS[t] !== undefined) {
        let diff = (now.getDay() - RU_WEEKDAYS[t] + 7) % 7;
        if (diff === 0) diff = 7;
        const d = startOfDay(now);
        d.setDate(d.getDate() - diff);
        return d;
    }

    let m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (m) {
        const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
        return new Date(y, +m[2] - 1, +m[1]);
    }

    m = t.match(/^(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?(?:\s*г\.?)?$/);
    if (m && RU_MONTHS[m[2]] !== undefined) {
        return new Date(m[3] ? +m[3] : now.getFullYear(), RU_MONTHS[m[2]], +m[1]);
    }
    return null;
}

function parsePrePlainText(s) {
    const m = (s || '').match(/\[[^\]]*?,\s*(\d{1,2})([./])(\d{1,2})[./](\d{4})\]/);
    if (!m) return null;
    let day = +m[1];
    let month = +m[3];
    if (m[2] === '/') { month = +m[1]; day = +m[3]; }
    return new Date(+m[4], month - 1, day);
}

const MSG_SELECTOR = '[data-id^="true_"], [data-id^="false_"]';

function collectChatMessages() {
    const scope = document.querySelector('#main') || document;
    const els = scope.querySelectorAll('[role="row"], ' + MSG_SELECTOR);
    const result = [];
    const seen = new Set();
    let currentDate = null;

    for (const el of els) {
        if (el.matches(MSG_SELECTOR)) {
            const id = el.getAttribute('data-id');
            if (seen.has(id)) continue;
            seen.add(id);

            const pre = el.hasAttribute('data-pre-plain-text') ? el : el.querySelector('[data-pre-plain-text]');
            let date = pre ? parsePrePlainText(pre.getAttribute('data-pre-plain-text')) : null;
            if (!date) date = currentDate;

            result.push({
                id: id,
                dir: id.startsWith('true_') ? 'out' : 'in',
                date: date,
                text: (el.innerText || '').replace(/\s+/g, ' ').trim()
            });
        } else if (!el.querySelector(MSG_SELECTOR)) {
            const label = parseWhatsAppDateLabel(el.innerText);
            if (label) currentDate = label;
        }
    }
    return result;
}

async function waitForChatMessages(timeout = 6000) {
    const start = Date.now();
    let last = -1;
    let stable = 0;
    while (Date.now() - start < timeout) {
        const n = collectChatMessages().length;
        if (n === last) stable++;
        else { stable = 0; last = n; }
        if (stable >= (n > 0 ? 2 : 5)) break;
        await sleep(500);
    }
    return collectChatMessages();
}

function chatPeerMismatch(messages, phone) {
    const last10 = phone.slice(-10);
    for (const m of messages) {
        const found = (m.id || '').match(/_(\d+)@(?:c\.us|s\.whatsapp\.net)/);
        if (found) return !found[1].endsWith(last10);
    }
    return false;
}

// ==========================================
// ОТПРАВКА ПЕРВЫХ СООБЩЕНИЙ В ЧАТ BITRIX ПО ГОРЯЧЕЙ КЛАВИШЕ  Ctrl + Alt + Enter
// Откройте диалог в мессенджере Bitrix, нажмите «Ответить», затем Ctrl+Alt+Enter:
// плагин отправит 1-е сообщение, 2-е сообщение и PDF-файл. Работает всегда — запущен плагин, на паузе или остановлен.
// ==========================================
const BITRIX_CHAT_SELECTORS = {
    textarea: 'textarea[data-testid="im-textarea-input"]',
    sendBtn: 'button[data-testid="im-textarea-send-btn"]',
    attachBtn: 'button[data-testid="im-upload-menu-attach-btn"]'
};
// Паузы в чате Bitrix, мс (чтобы сообщения уходили не мгновенно друг за другом)
const BITRIX_CHAT_DELAYS = { betweenMessages: [1500, 3500] };
const BITRIX_FILE_UPLOAD_WAIT_MS = 20000;

let bitrixChatSending = false;

// Небольшое уведомление в углу страницы (не блокирует работу, в отличие от alert)
function showBotToast(text, isError = false) {
    try {
        let box = document.getElementById('elki-bot-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'elki-bot-toast';
            box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;max-width:380px;' +
                'padding:10px 14px;border-radius:8px;font:13px/1.4 sans-serif;color:#fff;' +
                'box-shadow:0 2px 10px rgba(0,0,0,.3);';
            document.body.appendChild(box);
        }
        box.style.background = isError ? '#d9363e' : '#1f8f4d';
        box.textContent = text;
        box.style.display = 'block';
        clearTimeout(box._hideTimer);
        box._hideTimer = setTimeout(() => { box.style.display = 'none'; }, isError ? 9000 : 4000);
    } catch (e) {}
}

// Ждём активный (не заблокированный) элемент. Не зависит от состояния плагина (старт/пауза)
async function waitEnabledInBitrix(selector, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = findAllInAnyDocument(selector).find(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true');
        if (el) return el;
        await sleep(300);
    }
    return null;
}

// Отправка одного текстового сообщения
async function sendBitrixChatText(text) {
    const B = BITRIX_CHAT_SELECTORS;
    const ta = findInAnyDocument(B.textarea);
    if (!ta || ta.disabled) throw new Error("поле ввода недоступно (нажмите «Ответить» в чате)");

    ta.focus();
    ta.value = text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(rand(600, 1400));

    // кнопка отправки становится активной только после ввода текста
    const btn = await waitEnabledInBitrix(B.sendBtn, 3000);
    if (btn) {
        clickLikeUser(btn);
    } else {
        console.warn("[Бот Bitrix] Кнопка отправки не активна — жмём Enter в поле ввода.");
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }

    // ждём, пока поле очистится (значит, сообщение ушло)
    for (let i = 0; i < 12; i++) {
        await sleep(300);
        const cur = findInAnyDocument(B.textarea);
        if (!cur || !(cur.value || '').trim()) return;
    }
    throw new Error("сообщение не отправилось (поле ввода не очистилось)");
}

// Скрытый input[type=file] для вложений чата (не аватар чата в шапке и не только-для-картинок)
function findBitrixChatFileInput() {
    return findAllInAnyDocument('input[type="file"]').find(i =>
        !i.classList.contains('bx-im-chat-header__avatar_input') &&
        !/^\s*image\//i.test(i.accept || '')
    ) || null;
}

// Отправка PDF-файла в чат Bitrix. Способы: input[type=file] -> paste -> drop
async function sendBitrixChatFile() {
    const B = BITRIX_CHAT_SELECTORS;

    let dt;
    try {
        const response = await fetch(chrome.runtime.getURL(PRICE_FILE_PATH));
        const blob = await response.blob();
        dt = new DataTransfer();
        dt.items.add(new File([blob], pickFileName(), { type: 'application/pdf' }));
    } catch (e) {
        console.error("[Бот Bitrix] Не удалось загрузить price.pdf:", e);
        throw new Error("не удалось загрузить price.pdf (для вкладки Bitrix добавьте домен в web_accessible_resources → matches в manifest.json)");
    }

    const ta = findInAnyDocument(B.textarea);
    let attached = false;

    // Способ 1: input[type=file] (при необходимости открываем меню «Прикрепить»)
    let input = findBitrixChatFileInput();
    if (!input) {
        const attachBtn = findInAnyDocument(B.attachBtn);
        if (attachBtn) {
            clickLikeUser(attachBtn);
            await sleep(900);
            input = findBitrixChatFileInput();
            if (!input) {
                const items = findAllInAnyDocument('.menu-popup-item, [role="menuitem"]').filter(isVisible);
                console.log("[Бот Bitrix] Пункты меню 'Прикрепить':", items.map(i => (i.innerText || '').trim().slice(0, 40)));
                const pick = items.find(i => /(файл|компьютер|устройств|загруз|upload|device|file)/i.test(i.innerText || ''));
                if (pick) {
                    clickLikeUser(pick);
                    await sleep(900);
                    input = findBitrixChatFileInput();
                }
            }
        }
    }
    if (input) {
        console.log(`[Бот Bitrix] Найден input для файла, accept="${input.accept}"`);
        input.files = dt.files;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        attached = true;
    }

    // Способ 2: вставка из буфера обмена в поле ввода
    if (!attached && ta) {
        console.warn("[Бот Bitrix] input для файла не найден — пробуем paste.");
        ta.focus();
        ta.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
        attached = true;
    }

    // Нажимаем отправку, когда файл загрузился
    const deadline = Date.now() + BITRIX_FILE_UPLOAD_WAIT_MS;
    while (Date.now() < deadline) {
        // а) отдельное окно «отправка файлов» с кнопкой «Отправить»
        const popupBtn = findAllInAnyDocument('button, .ui-btn, [role="button"]').find(b =>
            isVisible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true' &&
            /^(отправить|send)$/i.test((b.innerText || '').trim()) && !b.matches(B.sendBtn)
        );
        if (popupBtn) { clickLikeUser(popupBtn); await sleep(1500); return; }

        // б) основная кнопка отправки: активна, когда файл прикреплён к сообщению
        const mainBtn = findAllInAnyDocument(B.sendBtn).find(b => !b.disabled && b.getAttribute('aria-disabled') !== 'true');
        if (mainBtn) { clickLikeUser(mainBtn); await sleep(1500); return; }

        await sleep(500);
    }
    throw new Error("файл не прикрепился или не появилась кнопка отправки (пришлите разметку окна чата после нажатия «Прикрепить»)");
}

// 1-е сообщение, 2-е сообщение, файл
async function sendFirstMessagesToBitrixChat() {
    if (bitrixChatSending) {
        showBotToast("Отправка уже идёт, подождите…");
        return;
    }

    const ta = findInAnyDocument(BITRIX_CHAT_SELECTORS.textarea);
    if (!ta) {
        showBotToast("Не вижу поля ввода в чате Bitrix. Откройте диалог и нажмите «Ответить».", true);
        return;
    }
    if (ta.disabled) {
        showBotToast("Поле ввода заблокировано. Нажмите «Ответить» в диалоге.", true);
        return;
    }
    if ((ta.value || '').trim()) {
        showBotToast("В поле ввода уже есть текст — очистите его и повторите.", true);
        return;
    }

    bitrixChatSending = true;
    try {
        showBotToast("Отправляю 1-е сообщение…");
        await sendBitrixChatText(pickVariant('msg1'));
        await humanPause(BITRIX_CHAT_DELAYS.betweenMessages);

        showBotToast("Отправляю 2-е сообщение…");
        await sendBitrixChatText(pickVariant('msg2'));
        await humanPause(BITRIX_CHAT_DELAYS.betweenMessages);

        showBotToast("Отправляю файл…");
        await sendBitrixChatFile();

        showBotToast("Готово: 2 сообщения и файл отправлены ✅");
        console.log("[Бот Bitrix] Первые сообщения и файл отправлены в чат Bitrix.");
    } catch (e) {
        console.error("[Бот Bitrix] Ошибка отправки в чат:", e);
        showBotToast("Ошибка: " + (e && e.message ? e.message : e), true);
    } finally {
        bitrixChatSending = false;
    }
}

// Горячая клавиша Ctrl+Alt+Enter (по физической клавише — работает при любой раскладке)
function onBitrixChatHotkey(e) {
    if (!(e.ctrlKey && e.altKey && !e.shiftKey && (e.code === 'Enter' || e.code === 'NumpadEnter'))) return;
    if (!location.hostname.includes('bitrix24')) return; // только на вкладке Bitrix
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    sendFirstMessagesToBitrixChat();
}

// Слушаем клавиши и в основной странице, и в iframe (если мессенджер открыт внутри карточки)
function attachBitrixChatHotkey(doc) {
    if (doc.__elkiChatHotkey) return;
    doc.__elkiChatHotkey = true;
    doc.addEventListener('keydown', onBitrixChatHotkey, true);
}
attachBitrixChatHotkey(document);
setInterval(() => {
    try { getAllDocuments().forEach(attachBitrixChatHotkey); } catch (e) {}
}, 3000);