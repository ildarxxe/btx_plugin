// =====================================================================================
// МОДУЛЬ 00_config.js
// КОНСТАНТЫ, НАСТРОЙКИ, СЕЛЕКТОРЫ, ОБЩЕЕ СОСТОЯНИЕ
// =====================================================================================

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

console.warn('[BOT BUILD CHECK] 5.0', window.location.href);

const PRICE_FILE_PATH = 'https://ildarxxe.github.io/btx_plugin/price.pdf';

const MESSAGE_VARIANTS = {
    msg1: [
        "Здравствуйте! Меня зовут Алина, менеджер компании Elki.kz 🎄 Отправляю Вам наш прайс-лист с нашими вариантами"
    ],
    msg2: [
        "Ознакомьтесь, как будут вопросы - я на связи \nЕсть видео и фото почти на все модели, если нужны будут - напишите название - я отправлю"
    ],
    msg3: [
        "Здравствуйте! Хотела узнать, удалось ли Вам посмотреть наш прайс-лист? Может, уже присмотрели себе ёлочку? Если есть вопросы или нужна помощь с выбором, я с удовольствием подскажу и помогу найти ту самую ёлочку для Вашего дома 🎄🤗"
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

const CUSTOM_FLOW_STORAGE_KEY = 'elki_custom_flow_v1';

const DEFAULT_HOTKEYS = {
    firstTouch: { ctrlKey: true, altKey: true, shiftKey: false, code: 'Enter', label: 'Ctrl+Alt+Enter' },
    touch1: { ctrlKey: true, altKey: true, shiftKey: true, code: 'Enter', label: 'Ctrl+Alt+Shift+Enter' },
    touch2: { ctrlKey: true, altKey: true, shiftKey: false, code: 'Digit2', label: 'Ctrl+Alt+2' }
};

const DEFAULT_CUSTOM_FLOWS = {
    firstTouch: {
        items: [
            { id: 'ft_1', type: 'text', text: MESSAGE_VARIANTS.msg1[0] },
            { id: 'ft_2', type: 'text', text: MESSAGE_VARIANTS.msg2[0] },
            { id: 'ft_3', type: 'file', fileId: '__DEFAULT_PRICE__', fileName: 'price.pdf', mimeType: 'application/pdf', base64: null }
        ]
    },
    touch1: {
        items: [
            { id: 't1_1', type: 'text', text: MESSAGE_VARIANTS.msg3[0] }
        ]
    },
    touch2: {
        items: [
            { id: 't2_1', type: 'text', text: "Здравствуйте! Напоминаю о себе — остались ли вопросы по прайсу и моделям ёлочек? 🎄" }
        ]
    }
};

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
        touch2Column: '[data-testid="kanban-column-C13:UC_LOXVY8"]',
        cards: '.main-kanban-item',
        cardDate: '.crm-kanban-item-last-activity-time-ago, .crm-kanban-item-last-activity-time, .crm-kanban-item-date',
        phoneWidget: '.crm-entity-widget-client-contact-phone',
        stageTouch1: '.crm-entity-section-status-step[data-id="C13:UC_QUTSPY"]',
        stageTouch2: '.crm-entity-section-status-step[data-id="C13:UC_LOXVY8"]',
        stageTouch3: '.crm-entity-section-status-step[data-id="C13:UC_VA6RW8"]',
        stageClose: '.crm-entity-section-status-step[data-id="C13:WON"]',
        closeOutcomeDialog: '[data-testid="crm-stage-final-transition-outcome-dialog"]',
        closeFailureBtn: '[data-testid="crm-stage-final-transition-failure"]',
        modalForm: 'form[name*="partial_editor_form"]',
        dateInput: 'input[name="UF_CRM_1782717007483"]',
        categorySelect: '[data-name="UF_CRM_1782717199942"]',
        clientTypeSelect: '[data-name="UF_CRM_1782716466581"], [data-name="UF_CRM_1782799322263"]',
        sourceBlock: '[data-cid="SOURCE_ID"]',
        sourceSelect: '[data-cid="SOURCE_ID"] .ui-ctl-dropdown',
        messengerOpened: '[data-testid="im-message-list"], .bx-im-content-chat__dialog_container',
        chatBtn: 'a.crm-entity-widget-client-action-im.crm-entity-widget-client-action-available',
        messengerAnswerBtn: 'button[data-testid="openlines-chat-control-panel-answer-btn"]',
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
    touch1TargetStage: 'touch3', // 'touch2' | 'touch3' | 'close'
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
const MESSENGER_WAIT_MS = 20000;
const MESSENGER_ESC_GAP_MS = 900;
const CHAT_BTN_WAIT_MS = 10000;
const MESSENGER_ANSWER_GRACE_MS = 2500;
const UNKNOWN_SOURCE_TEXT = 'Неизвестный источник';

let currentCardId = null;
let cardAttempts = {};
let columnPreloaded = false;

const SEARCH_RESULT_ITEM_SELECTOR = '[data-testid="cell-frame-container"], [role="listitem"], [role="option"]';
const WA_NEW_CHAT_MENU_RE = /(новая группа|новый контакт|новое сообщество|new group|new contact|new community)/i;
const lastVariantIndex = {};
const MSG_SELECTOR = '[data-id^="true_"], [data-id^="false_"]';

const BITRIX_CHAT_SELECTORS = {
    textarea: 'textarea[data-testid="im-textarea-input"]',
    sendBtn: 'button[data-testid="im-textarea-send-btn"]',
    attachBtn: 'button[data-testid="im-upload-menu-attach-btn"]',
    previewSendBtn: 'button[data-testid="im-upload-preview-send-btn"]'
};

const BITRIX_CHAT_DELAYS = { betweenMessages: [1500, 3500] };
const BITRIX_FILE_UPLOAD_WAIT_MS = 20000;
let bitrixChatSending = false;