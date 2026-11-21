// =====================================================================================
// МОДУЛЬ 12_bitrix_stage.js
// BITRIX: СМЕНА СТАДИИ (1 касание / 2 касание / 3 касание), модальное окно, «Сохранить»
// =====================================================================================

function triggerRealClick(el) {
    if (!el) return;
    try {
        el.scrollIntoView({ block: 'center', inline: 'center' });
    } catch (e) {}

    try {
        if (typeof clickLikeUser === 'function') {
            clickLikeUser(el);
        }
    } catch (e) {}

    const rect = el.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const opts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: el.ownerDocument.defaultView || window,
        clientX,
        clientY
    };

    try {
        el.dispatchEvent(new PointerEvent('pointerdown', opts));
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new PointerEvent('pointerup', opts));
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
    } catch (e) {}

    try {
        if (typeof el.click === 'function') {
            el.click();
        }
    } catch (e) {}
}

function findStageButton(stageSelector) {
    const all = findAllInAnyDocument(stageSelector);
    if (!all.length) return null;
    const visible = all.filter(isVisible);
    return visible[0] || all[0];
}

async function waitForStageButton(stageSelector, timeout = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const btn = findStageButton(stageSelector);
        if (btn) return btn;
        await sleep(250);
    }
    return null;
}

function normalizeTouch1TargetStage(val) {
    if (val === 'touch2' || val === 'C13:UC_LOXVY8') return 'touch2';
    if (val === 'close' || val === 'won' || val === 'lose' || val === 'C13:WON' || val === 'C13:LOSE') return 'close';
    return 'touch3';
}

function getTouch1TargetStage() {
    const raw = (typeof BOT_CONFIG !== 'undefined' && BOT_CONFIG.touch1TargetStage) || 'touch3';
    return normalizeTouch1TargetStage(raw);
}

async function setTouch1TargetStage(stageVal) {
    const normalized = normalizeTouch1TargetStage(stageVal);
    BOT_CONFIG.touch1TargetStage = normalized;
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const st = await chrome.storage.local.get([STORAGE_KEY]);
            const prev = (st && st[STORAGE_KEY] && typeof st[STORAGE_KEY] === 'object') ? st[STORAGE_KEY] : {};
            await chrome.storage.local.set({ [STORAGE_KEY]: { ...prev, touch1TargetStage: normalized } });
        }
    } catch (e) {}
    try {
        if (typeof GM_setValue === 'function') {
            GM_setValue('btx_touch1_target_stage', normalized);
        }
    } catch (e) {}
    console.log(`[Бот CRM] Выбрана стадия после «1 касания»: ${normalized}`);
    if (typeof showBotToast === 'function') {
        const labels = { touch2: '2 касание', touch3: '3 касание', close: 'Закрыть' };
        showBotToast(`После «1 касания» → ${labels[normalized] || normalized}`);
    }
    return normalized;
}
window.setTouch1TargetStage = setTouch1TargetStage;
window.getTouch1TargetStage = getTouch1TargetStage;

async function handleCloseDealStageFlow() {
    const closeBtn = await waitForStageButton(SELECTORS.bitrix.stageClose, 8000);
    if (!closeBtn) {
        console.warn('[Бот CRM] Не найдена кнопка завершения сделки [data-id="C13:WON"]');
        showAlert('Не найдена кнопка «Завершить сделку» ([data-id="C13:WON"]).');
        return false;
    }

    console.log('[Бот CRM] Нажимаем «Завершить сделку» (C13:WON)...');
    triggerRealClick(closeBtn);

    const outcomeDialog = await waitForElementAnyDoc(SELECTORS.bitrix.closeOutcomeDialog, 5000);
    if (outcomeDialog) {
        let failureBtn = null;
        for (let i = 0; i < 12; i++) {
            const candidates = findAllInAnyDocument(SELECTORS.bitrix.closeFailureBtn);
            failureBtn = candidates.find(b => isVisible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true') || null;
            if (failureBtn) break;
            await sleep(300);
        }

        if (!failureBtn) {
            console.warn('[Бот CRM] Не найдена кнопка «Закрыто и не реализовано» в диалоге завершения.');
            showAlert('Не найдена кнопка «Закрыто и не реализовано».');
            return false;
        }

        console.log('[Бот CRM] Нажимаем «Закрыто и не реализовано»...');
        triggerRealClick(failureBtn);
    }

    const modalSelector = '#progressbar-entity-editor, ' + SELECTORS.bitrix.modalForm;
    const modalForm = await waitForElementAnyDoc(modalSelector, 8000);
    if (modalForm) {
        await fillAndSubmitModalForm({ skipNextStep: true, stageKey: 'close' });
    } else {
        await sleep(1500);
    }

    return true;
}

async function moveCardToStage(stageKey) {
    await sleep(800);

    const resolvedKey = stageKey === 'touch1_target' ? getTouch1TargetStage() : stageKey;

    if (resolvedKey === 'close') {
        return await handleCloseDealStageFlow();
    }

    let stageSelector = SELECTORS.bitrix.stageTouch1;
    let stageName = '1 касание';

    if (resolvedKey === 'touch3') {
        stageSelector = SELECTORS.bitrix.stageTouch3;
        stageName = '3 касание';
    } else if (resolvedKey === 'touch2') {
        stageSelector = SELECTORS.bitrix.stageTouch2;
        stageName = '2 касание';
    }

    const stageBtn = await waitForStageButton(stageSelector, 8000);
    if (!stageBtn) {
        console.warn(`[Бот CRM] Не найдена кнопка статуса '${stageName}' (${stageSelector})`);
        showAlert(`Не найдена кнопка статуса '${stageName}' (селектор: ${stageSelector}).`);
        return false;
    }

    console.log(`[Бот CRM] Нажимаем кнопку стадии '${stageName}'...`);
    triggerRealClick(stageBtn);

    const modalSelector = '#progressbar-entity-editor, ' + SELECTORS.bitrix.modalForm;
    let modalForm = await waitForElementAnyDoc(modalSelector, 3000);

    if (!modalForm) {
        const freshBtn = findStageButton(stageSelector) || stageBtn;
        console.log(`[Бот CRM] Повторный клик по стадии '${stageName}'...`);
        triggerRealClick(freshBtn);
        modalForm = await waitForElementAnyDoc(modalSelector, 4000);
    }

    if (modalForm) {
        await fillAndSubmitModalForm({ skipNextStep: true, stageKey: resolvedKey });
    } else {
        await sleep(1500);
    }

    return true;
}

function normalizeTouch1TargetStage(val) {
    if (val === 'touch2' || val === 'C13:UC_LOXVY8') return 'touch2';
    if (val === 'close' || val === 'won' || val === 'lose' || val === 'C13:WON' || val === 'C13:LOSE') return 'close';
    return 'touch3';
}

function getTouch1TargetStage() {
    const raw = (typeof BOT_CONFIG !== 'undefined' && BOT_CONFIG.touch1TargetStage) || 'touch3';
    return normalizeTouch1TargetStage(raw);
}

async function setTouch1TargetStage(stageVal) {
    const normalized = normalizeTouch1TargetStage(stageVal);
    BOT_CONFIG.touch1TargetStage = normalized;
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const st = await chrome.storage.local.get([STORAGE_KEY]);
            const prev = (st && st[STORAGE_KEY] && typeof st[STORAGE_KEY] === 'object') ? st[STORAGE_KEY] : {};
            await chrome.storage.local.set({ [STORAGE_KEY]: { ...prev, touch1TargetStage: normalized } });
        }
    } catch (e) {}
    try {
        if (typeof GM_setValue === 'function') {
            GM_setValue('btx_touch1_target_stage', normalized);
        }
    } catch (e) {}
    console.log(`[Бот CRM] Выбрана стадия после «1 касания»: ${normalized}`);
    if (typeof showBotToast === 'function') {
        const labels = { touch2: '2 касание', touch3: '3 касание', close: 'Закрыть' };
        showBotToast(`После «1 касания» → ${labels[normalized] || normalized}`);
    }
    return normalized;
}
window.setTouch1TargetStage = setTouch1TargetStage;
window.getTouch1TargetStage = getTouch1TargetStage;

async function handleCloseDealStageFlow() {
    const closeBtn = await waitForStageButton(SELECTORS.bitrix.stageClose, 8000);
    if (!closeBtn) {
        console.warn('[Бот CRM] Не найдена кнопка завершения сделки [data-id="C13:WON"]');
        showAlert('Не найдена кнопка «Завершить сделку» ([data-id="C13:WON"]).');
        return false;
    }

    console.log('[Бот CRM] Нажимаем «Завершить сделку» (C13:WON)...');
    triggerRealClick(closeBtn);

    const outcomeDialog = await waitForElementAnyDoc(SELECTORS.bitrix.closeOutcomeDialog, 5000);
    if (outcomeDialog) {
        let failureBtn = null;
        for (let i = 0; i < 12; i++) {
            const candidates = findAllInAnyDocument(SELECTORS.bitrix.closeFailureBtn);
            failureBtn = candidates.find(b => isVisible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true') || null;
            if (failureBtn) break;
            await sleep(300);
        }

        if (!failureBtn) {
            console.warn('[Бот CRM] Не найдена кнопка «Закрыто и не реализовано» в диалоге завершения.');
            showAlert('Не найдена кнопка «Закрыто и не реализовано».');
            return false;
        }

        console.log('[Бот CRM] Нажимаем «Закрыто и не реализовано»...');
        triggerRealClick(failureBtn);
    }

    const modalSelector = '#progressbar-entity-editor, ' + SELECTORS.bitrix.modalForm;
    const modalForm = await waitForElementAnyDoc(modalSelector, 8000);
    if (modalForm) {
        await fillAndSubmitModalForm({ skipNextStep: true, stageKey: 'close' });
    } else {
        await sleep(1500);
    }

    return true;
}

async function moveCardToStage(stageKey) {
    await sleep(800);

    const resolvedKey = stageKey === 'touch1_target' ? getTouch1TargetStage() : stageKey;

    if (resolvedKey === 'close') {
        return await handleCloseDealStageFlow();
    }

    let stageSelector = SELECTORS.bitrix.stageTouch1;
    let stageName = '1 касание';

    if (resolvedKey === 'touch3') {
        stageSelector = SELECTORS.bitrix.stageTouch3;
        stageName = '3 касание';
    } else if (resolvedKey === 'touch2') {
        stageSelector = SELECTORS.bitrix.stageTouch2;
        stageName = '2 касание';
    }

    const stageBtn = await waitForStageButton(stageSelector, 8000);
    if (!stageBtn) {
        console.warn(`[Бот CRM] Не найдена кнопка статуса '${stageName}' (${stageSelector})`);
        showAlert(`Не найдена кнопка статуса '${stageName}' (селектор: ${stageSelector}).`);
        return false;
    }

    console.log(`[Бот CRM] Нажимаем кнопку стадии '${stageName}'...`);
    triggerRealClick(stageBtn);

    const modalSelector = '#progressbar-entity-editor, ' + SELECTORS.bitrix.modalForm;
    let modalForm = await waitForElementAnyDoc(modalSelector, 3000);

    if (!modalForm) {
        const freshBtn = findStageButton(stageSelector) || stageBtn;
        console.log(`[Бот CRM] Повторный клик по стадии '${stageName}'...`);
        triggerRealClick(freshBtn);
        modalForm = await waitForElementAnyDoc(modalSelector, 4000);
    }

    if (modalForm) {
        await fillAndSubmitModalForm({ skipNextStep: true, stageKey: resolvedKey });
    } else {
        await sleep(1500);
    }

    return true;
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

function findSourceField(form) {
    let el = (form && form.querySelector(SELECTORS.bitrix.sourceSelect)) || findInAnyDocument(SELECTORS.bitrix.sourceSelect);
    if (el) return el;
    if (!form) return null;

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

async function fillSourceFieldIfPresent() {
    let field = null;
    for (let i = 0; i < 3 && !field; i++) {
        field = findSourceField(findInAnyDocument(SELECTORS.bitrix.modalForm));
        if (!field) await sleep(400);
    }
    if (!field) return;

    const wanted = UNKNOWN_SOURCE_TEXT.toLowerCase();
    if ((field.tagName || '').toLowerCase() === 'select') {
        const opt = Array.from(field.options).find(o => (o.text || '').toLowerCase().includes(wanted));
        if (opt && field.value !== opt.value) {
            field.value = opt.value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
    }

    const readValue = () => ((field.innerText || field.textContent || '') + '').toLowerCase();
    if (readValue().includes(wanted)) return;
    await selectDropdownOption(field, UNKNOWN_SOURCE_TEXT);
}

async function fillAndSubmitModalForm(opts = {}) {
    const form0 = await waitForElementAnyDoc('#progressbar-entity-editor, ' + SELECTORS.bitrix.modalForm, 12000);
    if (!form0) {
        showAlert("Модальное окно смены статуса не появилось вовремя.");
        return;
    }

    await sleep(600);

    const dateInput = await waitForModalField(SELECTORS.bitrix.dateInput, 1500);
    if (dateInput) {
        dateInput.value = getFormattedTodayDate();
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const categoryFresh = await waitForModalField(SELECTORS.bitrix.categorySelect, 1000);
    if (categoryFresh) {
        await selectDropdownOption(categoryFresh, "Уличные елки");
    }

    const qualEl = await waitForModalField('[data-name="UF_CRM_1782716466581"]', 2000);
    if (qualEl) {
        await selectDropdownOption(qualEl, "CCC");
    }

    const clientTypeEl = await waitForModalField('[data-name="UF_CRM_1782799322263"]', 1000);
    if (clientTypeEl) {
        await selectDropdownOption(clientTypeEl, "B2C");
    }

    await fillSourceFieldIfPresent();
    await sleep(600);

    const form = findInAnyDocument(SELECTORS.bitrix.modalForm) || form0;
    const saveBtn = findSaveButton(form);
    if (!saveBtn) {
        showAlert("Не найдена кнопка 'Сохранить' в модалке Битрикса.");
        return;
    }

    triggerRealClick(saveBtn);
    await sleep(1800);

    if (!opts.skipNextStep) {
        await addHandledCardId(await getCurrentCardId());
        await returnToCRMAndEscape();
        processNextCard();
    }
}

function findSaveButton(form) {
    const popup = (form && form.closest('#progressbar-entity-editor, .popup-window, .bx-core-popup-container, .ui-sidepanel-layout, .main-ui-popup'))
        || findInAnyDocument('#progressbar-entity-editor');

    if (popup) {
        const popupSave = popup.querySelector('.crm-entity-popup-fill-required-fields-btns .ui-btn.ui-btn-primary, .ui-btn.ui-btn-primary');
        if (popupSave) return popupSave;
    }

    if (form) {
        const btn = form.querySelector(SELECTORS.bitrix.saveButton);
        if (btn) return btn;
    }

    const doc = (form && form.ownerDocument) || document;
    const candidates = Array.from(doc.querySelectorAll('button, a.ui-btn, span.ui-btn, .ui-btn'));
    return candidates.find(b => /^(сохранить|save)$/i.test((b.innerText || '').trim())) || null;
}

async function selectDropdownOption(container, optionText) {
    if (!container) return;
    const wanted = (optionText || '').trim().toLowerCase();

    const currentLabel = container.querySelector('.main-ui-select-name');
    if (currentLabel && (currentLabel.innerText || '').trim().toLowerCase() === wanted) {
        return;
    }

    triggerRealClick(container);
    await sleep(500);

    const items = findAllInAnyDocument('.main-ui-select-item, .menu-popup-item, .popup-window-item');
    const target = items.find(item => isVisible(item) && (item.innerText || '').trim().toLowerCase() === wanted)
        || items.find(item => isVisible(item) && (item.innerText || '').toLowerCase().includes(wanted));

    if (target) {
        triggerRealClick(target);
        await sleep(400);
        return;
    }

    try {
        const rawItems = container.getAttribute('data-items');
        if (rawItems) {
            const parsed = JSON.parse(rawItems.replace(/&quot;/g, '"'));
            const matched = Array.isArray(parsed)
                ? parsed.find(x => String(x.NAME || '').trim().toLowerCase() === wanted || String(x.NAME || '').toLowerCase().includes(wanted))
                : null;
            if (matched) {
                parsed.forEach(x => { x.IS_SELECTED = (x === matched); });
                container.setAttribute('data-items', JSON.stringify(parsed));
                container.setAttribute('data-value', JSON.stringify({ NAME: matched.NAME, VALUE: matched.VALUE }));
                if (currentLabel) currentLabel.textContent = matched.NAME;

                const fieldName = container.getAttribute('data-name');
                const hiddenInput = fieldName
                    ? findInAnyDocument(`input[type="hidden"][name="${fieldName}"]`)
                    : null;
                if (hiddenInput) {
                    hiddenInput.value = matched.VALUE;
                    hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
                    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                container.dispatchEvent(new Event('change', { bubbles: true }));
                await sleep(300);
            }
        }
    } catch (e) {
        console.warn('[Бот CRM] Не удалось обновить data-items вручную:', e);
    }
}