// =====================================================================================
// МОДУЛЬ 32_bitrix_custom_flow.js
// BITRIX-ЧАТ: НАСТРАИВАЕМЫЕ СЦЕНАРИИ (1-е сообщения / 1-е / 2-е / 3-е касание), ФАЙЛЫ, АЛЬБОМЫ ФОТО И ГОРЯЧИЕ КЛАВИШИ
// =====================================================================================

let customFlowState = {
    hotkeys: {
        firstTouch: { ...DEFAULT_HOTKEYS.firstTouch },
        touch1: { ...DEFAULT_HOTKEYS.touch1 },
        touch2: { ...(DEFAULT_HOTKEYS.touch2 || { ctrlKey: true, altKey: true, shiftKey: false, code: 'Digit2', label: 'Ctrl+Alt+2' }) },
        touch3: { ...(DEFAULT_HOTKEYS.touch3 || { ctrlKey: true, altKey: true, shiftKey: false, code: 'Digit3', label: 'Ctrl+Alt+3' }) }
    },
    flows: {
        firstTouch: { items: DEFAULT_CUSTOM_FLOWS.firstTouch.items.map(x => ({ ...x })) },
        touch1: { items: DEFAULT_CUSTOM_FLOWS.touch1.items.map(x => ({ ...x })) },
        touch2: {
            items: (DEFAULT_CUSTOM_FLOWS.touch2 && Array.isArray(DEFAULT_CUSTOM_FLOWS.touch2.items))
                ? DEFAULT_CUSTOM_FLOWS.touch2.items.map(x => ({ ...x }))
                : [{ id: 't2_1', type: 'text', text: '' }]
        },
        touch3: {
            items: (DEFAULT_CUSTOM_FLOWS.touch3 && Array.isArray(DEFAULT_CUSTOM_FLOWS.touch3.items))
                ? DEFAULT_CUSTOM_FLOWS.touch3.items.map(x => ({ ...x }))
                : [{ id: 't3_1', type: 'text', text: '' }]
        }
    }
};

let customFlowBusy = false;

function saveFlowToTmStorage(payload) {
    try {
        if (typeof GM_setValue === 'function') {
            GM_setValue(CUSTOM_FLOW_STORAGE_KEY, JSON.stringify(payload));
        }
    } catch (e) {
        console.warn('[Бот Bitrix] Ошибка GM_setValue:', e);
    }
}

function readFlowFromTmStorage() {
    try {
        if (typeof GM_getValue === 'function') {
            const raw = GM_getValue(CUSTOM_FLOW_STORAGE_KEY);
            if (!raw) return null;
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
    } catch (e) {
        console.warn('[Бот Bitrix] Ошибка GM_getValue:', e);
    }
    return null;
}

function applySavedFlowObject(saved) {
    if (!saved || typeof saved !== 'object') return;
    customFlowState = {
        hotkeys: {
            firstTouch: { ...DEFAULT_HOTKEYS.firstTouch, ...(saved.hotkeys && saved.hotkeys.firstTouch) },
            touch1: { ...DEFAULT_HOTKEYS.touch1, ...(saved.hotkeys && saved.hotkeys.touch1) },
            touch2: {
                ...(DEFAULT_HOTKEYS.touch2 || { ctrlKey: true, altKey: true, shiftKey: false, code: 'Digit2', label: 'Ctrl+Alt+2' }),
                ...(saved.hotkeys && saved.hotkeys.touch2)
            },
            touch3: {
                ...(DEFAULT_HOTKEYS.touch3 || { ctrlKey: true, altKey: true, shiftKey: false, code: 'Digit3', label: 'Ctrl+Alt+3' }),
                ...(saved.hotkeys && saved.hotkeys.touch3)
            }
        },
        flows: {
            firstTouch: {
                items: Array.isArray(saved.flows && saved.flows.firstTouch && saved.flows.firstTouch.items)
                    ? saved.flows.firstTouch.items.map(x => ({ ...x }))
                    : DEFAULT_CUSTOM_FLOWS.firstTouch.items.map(x => ({ ...x }))
            },
            touch1: {
                items: Array.isArray(saved.flows && saved.flows.touch1 && saved.flows.touch1.items)
                    ? saved.flows.touch1.items.map(x => ({ ...x }))
                    : DEFAULT_CUSTOM_FLOWS.touch1.items.map(x => ({ ...x }))
            },
            touch2: {
                items: Array.isArray(saved.flows && saved.flows.touch2 && saved.flows.touch2.items)
                    ? saved.flows.touch2.items.map(x => ({ ...x }))
                    : (DEFAULT_CUSTOM_FLOWS.touch2 ? DEFAULT_CUSTOM_FLOWS.touch2.items.map(x => ({ ...x })) : [])
            },
            touch3: {
                items: Array.isArray(saved.flows && saved.flows.touch3 && saved.flows.touch3.items)
                    ? saved.flows.touch3.items.map(x => ({ ...x }))
                    : (DEFAULT_CUSTOM_FLOWS.touch3 ? DEFAULT_CUSTOM_FLOWS.touch3.items.map(x => ({ ...x })) : [{ id: 't3_1', type: 'text', text: '' }])
            }
        }
    };
}

async function loadCustomFlowState() {
    const tmSaved = readFlowFromTmStorage();
    if (tmSaved) {
        applySavedFlowObject(tmSaved);
        return customFlowState;
    }

    try {
        const res = await chrome.storage.local.get([CUSTOM_FLOW_STORAGE_KEY]);
        const extSaved = res && res[CUSTOM_FLOW_STORAGE_KEY];
        if (extSaved) {
            applySavedFlowObject(extSaved);
        }
    } catch (e) {
        console.warn('[Бот Bitrix] Не удалось загрузить кастомный сценарий из chrome.storage.local:', e);
    }

    return customFlowState;
}

function buildFilePayloadFromStep(step) {
    if (step && step.base64) {
        return {
            name: step.fileName || pickFileName(),
            mimeType: step.mimeType || 'application/pdf',
            base64: step.base64
        };
    }
    return null;
}

function ensureBitrixChatReadyForFlow() {
    if (customFlowBusy || bitrixChatSending) {
        console.warn('[DBG Flow] ensureBitrixChatReadyForFlow: занято (customFlowBusy=%s, bitrixChatSending=%s)', customFlowBusy, bitrixChatSending);
        if (typeof showBotToast === 'function') showBotToast("Отправка уже идёт, подождите…");
        return false;
    }
    const ta = findAllInAnyDocument(BITRIX_CHAT_SELECTORS.textarea).find(isVisible) || null;
    if (!ta) {
        console.warn('[DBG Flow] ensureBitrixChatReadyForFlow: видимое поле ввода чата не найдено');
        if (typeof showBotToast === 'function') showBotToast("Не вижу поля ввода в чате Bitrix. Откройте диалог и нажмите «Ответить».", true);
        return false;
    }
    if (ta.disabled) {
        console.warn('[DBG Flow] ensureBitrixChatReadyForFlow: поле ввода disabled');
        if (typeof showBotToast === 'function') showBotToast("Поле ввода заблокировано. Нажмите «Ответить» в диалоге.", true);
        return false;
    }
    if ((ta.value || '').trim()) {
        console.warn('[DBG Flow] ensureBitrixChatReadyForFlow: в поле ввода уже есть текст');
        if (typeof showBotToast === 'function') showBotToast("В поле ввода уже есть текст — очистите его и повторите.", true);
        return false;
    }
    return true;
}

async function flowPauseBetweenSteps(msRange) {
    if (typeof humanPause === 'function') {
        await humanPause(msRange);
        return;
    }
    const [minMs, maxMs] = Array.isArray(msRange) ? msRange : [1500, 3500];
    const delay = minMs + Math.floor(Math.random() * Math.max(100, maxMs - minMs + 1));
    await sleep(delay);
}

function getFlowDisplayTitle(flowKey) {
    if (flowKey === 'touch1') return '1-е касание';
    if (flowKey === 'touch2') return '2-е касание';
    if (flowKey === 'touch3') return '3-е касание';
    return '1-е сообщения';
}

async function runBitrixFlow(flowKey, expectedGen = null, options = {}) {
    const isAutoRun = expectedGen !== null;
    console.log(`[DBG Flow] runBitrixFlow старт: flowKey=${flowKey}, isAutoRun=${isAutoRun}, expectedGen=${expectedGen}, options=`, options);

    const stillAllowed = () => {
        if (!isAutoRun) return (typeof isStaleInstance === 'function') ? !isStaleInstance() : true;
        if (typeof isRunActive === 'function') {
            return isRunActive(expectedGen);
        }
        const stale = (typeof isStaleInstance === 'function') ? Boolean(isStaleInstance()) : false;
        return Boolean(isScriptRunning) && !BOT_CONFIG.isPaused && !stale;
    };

    const assertFlowAllowed = () => {
        if (!stillAllowed()) {
            console.warn(`[DBG Flow] assertFlowAllowed сработал запрет для flowKey=${flowKey}, isAutoRun=${isAutoRun}`);
            throw new Error(isAutoRun ? 'BOT_ABORTED' : 'FLOW_STOPPED');
        }
    };

    assertFlowAllowed();
    if (!ensureBitrixChatReadyForFlow()) return false;

    await loadCustomFlowState();
    assertFlowAllowed();

    const flow = customFlowState.flows[flowKey];
    let items = (flow && Array.isArray(flow.items)) ? flow.items.slice() : [];
    console.log(`[DBG Flow] Загружено элементов сценария ${flowKey}:`, items.length);

    if (options && options.skipFirstText) {
        const firstTextIdx = items.findIndex(it => it && it.type === 'text' && String(it.text || '').trim());
        if (firstTextIdx >= 0) {
            items.splice(firstTextIdx, 1);
            console.log('[DBG Flow] Пропущен первый текстовый шаг (skipFirstText=true). Осталось шагов:', items.length);
        }
    }

    if (!items.length) {
        console.warn('[DBG Flow] В выбранном сценарии нет элементов для отправки.');
        if (typeof showBotToast === 'function') showBotToast("В выбранном сценарии нет элементов для отправки.", true);
        return false;
    }

    customFlowBusy = true;
    bitrixChatSending = true;

    try {
        const preparedFiles = [];
        for (let i = 0; i < items.length; i++) {
            assertFlowAllowed();
            const item = items[i];
            if (item && item.type === 'file') {
                console.log(`[DBG Flow] Подготовка файла на шаге ${i + 1}:`, item.fileName || '__DEFAULT_PRICE__');
                preparedFiles[i] = await loadPriceFileDataTransfer(buildFilePayloadFromStep(item));
            }
        }

        for (let i = 0; i < items.length; i++) {
            assertFlowAllowed();
            const item = items[i];
            if (!item || !item.type) continue;

            if (i > 0) {
                console.log(`[DBG Flow] Пауза между шагами перед шагом ${i + 1}/${items.length}...`);
                await flowPauseBetweenSteps(BITRIX_CHAT_DELAYS.betweenMessages);
                assertFlowAllowed();
            }

            if (item.type === 'text') {
                const txt = (item.text || '').trim();
                if (!txt) {
                    console.log(`[DBG Flow] Шаг ${i + 1}/${items.length}: пустой текст — пропуск.`);
                    continue;
                }
                console.log(`[DBG Flow] Шаг ${i + 1}/${items.length}: отправляю текст...`);
                if (typeof showBotToast === 'function') showBotToast(`Шаг ${i + 1}/${items.length}: отправляю текст…`);
                await sendBitrixChatText(txt);
                console.log(`[DBG Flow] Шаг ${i + 1}/${items.length}: текст отправлен.`);
            } else if (item.type === 'file') {
                const labelName = item.fileName || 'price.pdf';
                console.log(`[DBG Flow] Шаг ${i + 1}/${items.length}: отправляю файл ${labelName}...`);
                if (typeof showBotToast === 'function') showBotToast(`Шаг ${i + 1}/${items.length}: отправляю файл ${labelName}…`);
                await sendBitrixChatFile(preparedFiles[i]);
                console.log(`[DBG Flow] Шаг ${i + 1}/${items.length}: файл отправлен.`);
            } else if (item.type === 'images_with_text') {
                const imgs = Array.isArray(item.images) ? item.images : [];
                console.log(`[DBG Flow] Шаг ${i + 1}/${items.length}: отправляю фото (${imgs.length} шт.)...`);
                if (typeof showBotToast === 'function') showBotToast(`Шаг ${i + 1}/${items.length}: отправляю фото (${imgs.length} шт.) с текстом…`);
                await sendBitrixChatImagesWithText(imgs, item.text || '');
                console.log(`[DBG Flow] Шаг ${i + 1}/${items.length}: фото отправлены.`);
            }
        }

        assertFlowAllowed();
        console.log(`[DBG Flow] Сценарий ${flowKey} успешно завершён.`);
        if (typeof showBotToast === 'function') {
            showBotToast(`Готово: сценарий (${getFlowDisplayTitle(flowKey)}) отправлен ✅`);
        }
        return true;
    } catch (e) {
        if (e && (e.message === 'BOT_ABORTED' || e.message === 'FLOW_STOPPED')) {
            if (isAutoRun) throw new Error('BOT_ABORTED');
            return false;
        }
        if (!stillAllowed()) {
            if (isAutoRun) throw new Error('BOT_ABORTED');
            return false;
        }
        console.error("[Бот Bitrix] Ошибка выполнения сценария:", e);
        throw e;
    } finally {
        bitrixChatSending = false;
        customFlowBusy = false;
    }
}

function matchesHotkey(event, cfg) {
    if (!cfg || !cfg.code) return false;
    return (
        Boolean(event.ctrlKey) === Boolean(cfg.ctrlKey) &&
        Boolean(event.altKey) === Boolean(cfg.altKey) &&
        Boolean(event.shiftKey) === Boolean(cfg.shiftKey) &&
        event.code === cfg.code
    );
}

function onCustomBitrixHotkey(e) {
    if (!location.hostname.includes('bitrix24')) return;
    const hkFirst = customFlowState.hotkeys.firstTouch;
    const hkTouch1 = customFlowState.hotkeys.touch1;
    const hkTouch2 = customFlowState.hotkeys.touch2;
    const hkTouch3 = customFlowState.hotkeys.touch3;

    if (matchesHotkey(e, hkTouch1)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        runBitrixFlow('touch1');
        return;
    }

    if (matchesHotkey(e, hkTouch2)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        runBitrixFlow('touch2');
        return;
    }

    if (matchesHotkey(e, hkTouch3)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        runBitrixFlow('touch3');
        return;
    }

    if (matchesHotkey(e, hkFirst)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        runBitrixFlow('firstTouch');
    }
}

function attachCustomBitrixHotkeys(doc) {
    if (!doc || doc.__elkiCustomFlowHotkey) return;
    doc.__elkiCustomFlowHotkey = true;
    doc.addEventListener('keydown', onCustomBitrixHotkey, true);
}

loadCustomFlowState().then(() => {
    attachCustomBitrixHotkeys(document);
    try { getAllDocuments().forEach(attachCustomBitrixHotkeys); } catch (e) {}
});

setInterval(() => {
    try { getAllDocuments().forEach(attachCustomBitrixHotkeys); } catch (e) {}
}, 3000);

window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'BTX_EXT_BG') return;

    if (event.data.action === 'SAVE_CUSTOM_FLOW_TO_TM' && event.data.payload) {
        saveFlowToTmStorage(event.data.payload);
        await loadCustomFlowState();
        showBotToast('Сценарий и файлы сохранены ✅');
        return;
    }

    if (event.data.action === 'CUSTOM_FLOW_UPDATED' && event.data.payload) {
        if (typeof GM_setValue === 'function') {
            saveFlowToTmStorage(event.data.payload);
        }
        await loadCustomFlowState();
    }
});