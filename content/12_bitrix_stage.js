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

async function moveCardToStage(stageKey) {
    await sleep(800);

    let stageSelector = SELECTORS.bitrix.stageTouch1;
    let stageName = '1 касание';

    if (stageKey === 'touch3') {
        stageSelector = SELECTORS.bitrix.stageTouch3;
        stageName = '3 касание';
    } else if (stageKey === 'touch2') {
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

    // Если модалка не открылась с первого клика — пробуем ещё раз нажать на кнопку стадии
    if (!modalForm) {
        const freshBtn = findStageButton(stageSelector) || stageBtn;
        console.log(`[Бот CRM] Повторный клик по стадии '${stageName}'...`);
        triggerRealClick(freshBtn);
        modalForm = await waitForElementAnyDoc(modalSelector, 4000);
    }

    if (modalForm) {
        await fillAndSubmitModalForm({ skipNextStep: true, stageKey });
    } else {
        await sleep(1500);
    }

    return true;
}

async function finishCardAndMoveNext() {
    try {
        const isNewMode = BOT_CONFIG.runMode === 'new';
        const ok = await moveCardToStage(isNewMode ? 'touch1' : 'touch3');
        if (!ok) return;

        await addHandledCardId(await getCurrentCardId());
        await returnToCRMAndEscape();
        processNextCard();
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