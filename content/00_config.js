// =====================================================================================
// МОДУЛЬ 00_config.js
// КОНСТАНТЫ, НАСТРОЙКИ, СЕЛЕКТОРЫ, ОБЩЕЕ СОСТОЯНИЕ
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: PRICE_FILE_PATH, MESSAGE_VARIANTS, PRICE_FILE_NAMES, MAX_SENDS_PER_DAY, DELAYS, TOUCH1_MAX_MESSAGES, RU_MONTHS, RU_WEEKDAYS, SELECTORS, STORAGE_KEY, BOT_CONFIG, isScriptRunning, idleTimer, INSTANCE_ID, PHONE_WAIT_MS, IDLE_POLL_MS, MESSENGER_WAIT_MS, MESSENGER_ESC_GAP_MS, CHAT_BTN_WAIT_MS, MESSENGER_ANSWER_GRACE_MS, UNKNOWN_SOURCE_TEXT, currentCardId, cardAttempts, columnPreloaded, SEARCH_RESULT_ITEM_SELECTOR, WA_NEW_CHAT_MENU_RE, lastVariantIndex, MSG_SELECTOR, BITRIX_CHAT_SELECTORS, BITRIX_CHAT_DELAYS, BITRIX_FILE_UPLOAD_WAIT_MS, bitrixChatSending
// =====================================================================================

// Полифилл для работы старого кода внутри Tampermonkey
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    window.chrome = window.chrome || {};
    chrome.runtime = {
        sendMessage: (payload) => window.postMessage({ source: 'BTX_TM_SCRIPT', payload }, '*'),
        onMessage: {
            addListener: (cb) => window.addEventListener('message', (e) => {
                if (e.data && e.data.source === 'BTX_EXT_BG') cb(e.data, {}, () => {});
            })
        }
    };
    chrome.storage = {
        local: {
            get: async (keys) => {
                const res = {};
                (Array.isArray(keys) ? keys : [keys]).forEach(k => { res[k] = GM_getValue(k); });
                return res;
            },
            set: async (obj) => {
                Object.entries(obj).forEach(([k, v]) => GM_setValue(k, v));
            }
        }
    };
}

const PRICE_FILE_PATH = 'https://github.com/ildarxxe/btx_plugin/blob/main/price.pdf';

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
        // Все кнопки панели над полем ввода (на месте «Ответить» бывает «Присоединиться» и др.)
        messengerJoinBtns: '.bx-imol-textarea_join-panel-item-button button, button[data-testid="openlines-chat-control-panel-answer-btn"]',
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

let currentCardId = null;

let cardAttempts = {};

let columnPreloaded = false;

const SEARCH_RESULT_ITEM_SELECTOR = '[data-testid="cell-frame-container"], [role="listitem"], [role="option"]';

// Строки-меню панели "Новый чат", которые не являются результатом поиска
const WA_NEW_CHAT_MENU_RE = /(новая группа|новый контакт|новое сообщество|new group|new contact|new community)/i;

const lastVariantIndex = {};

const MSG_SELECTOR = '[data-id^="true_"], [data-id^="false_"]';

const BITRIX_CHAT_SELECTORS = {
    textarea: 'textarea[data-testid="im-textarea-input"]',
    sendBtn: 'button[data-testid="im-textarea-send-btn"]',
    attachBtn: 'button[data-testid="im-upload-menu-attach-btn"]',
    // Кнопка отправки в окне предпросмотра прикреплённого файла (без текста, только иконка)
    previewSendBtn: 'button[data-testid="im-upload-preview-send-btn"]'
};

// Паузы в чате Bitrix, мс (чтобы сообщения уходили не мгновенно друг за другом)
const BITRIX_CHAT_DELAYS = { betweenMessages: [1500, 3500] };

const BITRIX_FILE_UPLOAD_WAIT_MS = 20000;

let bitrixChatSending = false;