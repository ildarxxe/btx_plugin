// =====================================================================================
// МОДУЛЬ 12_bitrix_stage.js
// BITRIX: СМЕНА СТАДИИ (1 касание / 2 касание / 3 касание / Закрыть), модальное окно, «Сохранить»
// =====================================================================================

function ensureStageActive(gen) {
    if (typeof isRunActive === 'function' && !isRunActive(gen)) {
        throw new Error('BOT_ABORTED');
    }
    if (typeof isScriptRunning !== 'undefined' && !isScriptRunning) {
        throw new Error('BOT_ABORTED');
    }
    if (typeof BOT_CONFIG !== 'undefined' && BOT_CONFIG.isPaused) {
        throw new Error('BOT_ABORTED');
    }
}

async function stageSleep(ms, gen) {
    const step = 100;
    let left = Math.max(0, Number(ms) || 0);
    while (left > 0) {
        ensureStageActive(gen);
        const chunk = Math.min(step, left);
        await sleep(chunk);
        left -= chunk;
    }
}

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
        view: (el.ownerDocument && el.ownerDocument.defaultView) || window,
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

async function waitForStageButton(stageSelector, timeout = 8000, gen = null) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (gen !== null) ensureStageActive(gen);
        const btn = findStageButton(stageSelector);
        if (btn) return btn;
        await sleep(200);
    }
    return null;
}

async function waitForVisibleDocElement(selector, timeout = 8000, gen = null) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (gen !== null) ensureStageActive(gen);
        const el = findInAnyDocument(selector);
        if (el && isVisible(el)) return el;
        await sleep(200);
    }
    return findInAnyDocument(selector);
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
    if (typeof BOT_CONFIG !== 'undefined') {
        BOT_CONFIG.touch1TargetStage = normalized;
    }
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

async function handleCloseDealStageFlow(gen) {
    ensureStageActive(gen);
    const closeBtn = await waitForStageButton(SELECTORS.bitrix.stageClose, 8000, gen);
    if (!closeBtn) {
        console.warn('[Бот CRM] Не найдена кнопка завершения сделки [data-id="C13:WON"]');
        showAlert('Не найдена кнопка «Завершить сделку» ([data-id="C13:WON"]).');
        return false;
    }

    ensureStageActive(gen);
    console.log('[Бот CRM] Нажимаем «Завершить сделку» (C13:WON)...');
    triggerRealClick(closeBtn);

    const outcomeDialog = await waitForVisibleDocElement(SELECTORS.bitrix.closeOutcomeDialog, 5000, gen);
    if (outcomeDialog) {
        let failureBtn = null;
        for (let i = 0; i < 12; i++) {
            ensureStageActive(gen);
            const candidates = findAllInAnyDocument(SELECTORS.bitrix.closeFailureBtn);
            failureBtn = candidates.find(b => isVisible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true') || null;
            if (failureBtn) break;
            await stageSleep(300, gen);
        }

        if (!failureBtn) {
            console.warn('[Бот CRM] Не найдена кнопка «Закрыто и не реализовано» в диалоге завершения.');
            showAlert('Не найдена кнопка «Закрыто и не реализовано».');
            return false;
        }

        ensureStageActive(gen);
        console.log('[Бот CRM] Нажимаем «Закрыто и не реализовано»...');
        triggerRealClick(failureBtn);
    }

    const modalSelector = '#progressbar-entity-editor, ' + SELECTORS.bitrix.modalForm;
    const modalForm = await waitForVisibleDocElement(modalSelector, 8000, gen);
    if (modalForm) {
        await fillAndSubmitModalForm({ skipNextStep: true, stageKey: 'close', gen });
    } else {
        await stageSleep(1500, gen);
    }

    ensureStageActive(gen);
    return true;
}

async function moveCardToStage(stageKey, gen = (typeof runGeneration !== 'undefined' ? runGeneration : 0)) {
    ensureStageActive(gen);
    await stageSleep(800, gen);

    const resolvedKey = stageKey === 'touch1_target' ? getTouch1TargetStage() : stageKey;

    if (resolvedKey === 'close') {
        return await handleCloseDealStageFlow(gen);
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

    const stageBtn = await waitForStageButton(stageSelector, 8000, gen);
    if (!stageBtn) {
        console.warn(`[Бот CRM] Не найдена кнопка статуса '${stageName}' (${stageSelector})`);
        showAlert(`Не найдена кнопка статуса '${stageName}' (селектор: ${stageSelector}).`);
        return false;
    }

    ensureStageActive(gen);
    console.log(`[Бот CRM] Нажимаем кнопку стадии '${stageName}'...`);
    triggerRealClick(stageBtn);

    const modalSelector = '#progressbar-entity-editor, ' + SELECTORS.bitrix.modalForm;
    let modalForm = await waitForVisibleDocElement(modalSelector, 3000, gen);

    if (!modalForm) {
        ensureStageActive(gen);
        const freshBtn = findStageButton(stageSelector) || stageBtn;
        console.log(`[Бот CRM] Повторный клик по стадии '${stageName}'...`);
        triggerRealClick(freshBtn);
        modalForm = await waitForVisibleDocElement(modalSelector, 4000, gen);
    }

    if (modalForm) {
        await fillAndSubmitModalForm({ skipNextStep: true, stageKey: resolvedKey, gen });
    } else {
        await stageSleep(1500, gen);
    }

    ensureStageActive(gen);
    return true;
}

async function waitForModalField(selector, timeout = 12000, interval = 300, gen = null) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (gen !== null) ensureStageActive(gen);
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

async function fillSourceFieldIfPresent(gen = null) {
    let field = null;
    for (let i = 0; i < 3 && !field; i++) {
        if (gen !== null) ensureStageActive(gen);
        field = findSourceField(findInAnyDocument(SELECTORS.bitrix.modalForm));
        if (!field) await stageSleep(400, gen);
    }
    if (!field) return;

    const wanted = UNKNOWN_SOURCE_TEXT.toLowerCase();
    if ((field.tagName || '').toLowerCase() === 'select') {
        const opt = Array.from(field.options).find(o => (o.text || '').toLowerCase().includes(wanted));
        if (opt && field.value !== opt.value) {
            if (gen !== null) ensureStageActive(gen);
            field.value = opt.value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
    }

    const readValue = () => ((field.innerText || field.textContent || '') + '').toLowerCase();
    if (readValue().includes(wanted)) return;
    await selectDropdownOption(field, UNKNOWN_SOURCE_TEXT, gen);
}

async function fillAndSubmitModalForm(opts = {}) {
    const gen = (opts && typeof opts.gen === 'number')
        ? opts.gen
        : (typeof runGeneration !== 'undefined' ? runGeneration : 0);

    ensureStageActive(gen);

    const form0 = await waitForVisibleDocElement('#progressbar-entity-editor, ' + SELECTORS.bitrix.modalForm, 12000, gen);
    if (!form0) {
        showAlert("Модальное окно смены статуса не появилось вовремя.");
        return;
    }

    const isClose = opts && opts.stageKey === 'close';
    await stageSleep(isClose ? 900 : 600, gen);

    // 1. Дата взятия заявки
    ensureStageActive(gen);
    const dateInput = await waitForModalField(SELECTORS.bitrix.dateInput, isClose ? 2500 : 1500, 300, gen);
    if (dateInput) {
        ensureStageActive(gen);
        dateInput.value = getFormattedTodayDate();
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 2. Тип товара / категория («Уличные елки»)
    ensureStageActive(gen);
    const categoryFresh = await waitForModalField(SELECTORS.bitrix.categorySelect, isClose ? 2000 : 1000, 300, gen);
    if (categoryFresh) {
        ensureStageActive(gen);
        await selectDropdownOption(categoryFresh, "Уличные елки", gen);
    }

    // 3. Квалификация («CCC»)
    ensureStageActive(gen);
    const qualEl = await waitForModalField('[data-name="UF_CRM_1782716466581"]', isClose ? 2500 : 2000, 300, gen);
    if (qualEl) {
        ensureStageActive(gen);
        await selectDropdownOption(qualEl, "CCC", gen);
    }

    // 4. Тип клиента («B2C»)
    ensureStageActive(gen);
    const clientTypeEl = await waitForModalField('[data-name="UF_CRM_1782799322263"]', isClose ? 2000 : 1000, 300, gen);
    if (clientTypeEl) {
        ensureStageActive(gen);
        await selectDropdownOption(clientTypeEl, "B2C", gen);
    }

    // 5. Источник («Неизвестный источник»)
    ensureStageActive(gen);
    await fillSourceFieldIfPresent(gen);
    await stageSleep(600, gen);

    ensureStageActive(gen);
    const form = findInAnyDocument(SELECTORS.bitrix.modalForm) || form0;
    const saveBtn = findSaveButton(form);
    if (!saveBtn) {
        showAlert("Не найдена кнопка 'Сохранить' в модалке Битрикса.");
        return;
    }

    ensureStageActive(gen);
    triggerRealClick(saveBtn);
    await stageSleep(1800, gen);

    if (!opts.skipNextStep) {
        ensureStageActive(gen);
        await addHandledCardId(await getCurrentCardId());
        await returnToCRMAndEscape();
        processNextCard(gen);
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

async function selectDropdownOption(container, optionText, gen = null) {
    if (!container) return;
    if (gen !== null) ensureStageActive(gen);
    const wanted = (optionText || '').trim().toLowerCase();

    const currentLabel = container.querySelector('.main-ui-select-name');
    if (currentLabel && (currentLabel.innerText || '').trim().toLowerCase() === wanted) {
        return;
    }

    triggerRealClick(container);
    await stageSleep(500, gen);

    const items = findAllInAnyDocument('.main-ui-select-item, .menu-popup-item, .popup-window-item');
    const target = items.find(item => isVisible(item) && (item.innerText || '').trim().toLowerCase() === wanted)
        || items.find(item => isVisible(item) && (item.innerText || '').toLowerCase().includes(wanted));

    if (target) {
        if (gen !== null) ensureStageActive(gen);
        triggerRealClick(target);
        await stageSleep(400, gen);
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
                if (gen !== null) ensureStageActive(gen);
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
                await stageSleep(300, gen);
            }
        }
    } catch (e) {
        console.warn('[Бот CRM] Не удалось обновить data-items вручную:', e);
    }
}