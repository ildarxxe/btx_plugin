// =====================================================================================
// МОДУЛЬ 12_bitrix_stage.js
// BITRIX: СМЕНА СТАДИИ (1 касание / 3 касание), модальное окно, «Сохранить»
// =====================================================================================

async function moveCardToStage(stageKey) {
    await sleep(1200);

    let stageSelector = SELECTORS.bitrix.stageTouch1;
    let stageName = '1 касание';
    let needsModal = true;

    if (stageKey === 'touch3') {
        stageSelector = SELECTORS.bitrix.stageTouch3;
        stageName = '3 касание';
        needsModal = false;
    } else if (stageKey === 'touch2') {
        stageSelector = SELECTORS.bitrix.stageTouch2;
        stageName = '2 касание';
        needsModal = false;
    }

    const stageBtn = await waitForElementAnyDoc(stageSelector, 8000);
    if (!stageBtn) {
        showAlert(`Не найдена кнопка статуса '${stageName}' (селектор: ${stageSelector}).`);
        return false;
    }

    console.log(`[Бот CRM] Нажимаем кнопку стадии '${stageName}'...`);
    clickLikeUser(stageBtn);

    if (needsModal) {
        await fillAndSubmitModalForm({ skipNextStep: true });
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
    const form0 = await waitForElementAnyDoc(SELECTORS.bitrix.modalForm, 12000);
    if (!form0) {
        showAlert("Модальное окно смены статуса не появилось вовремя.");
        return;
    }

    const anyFieldSelector = [
        SELECTORS.bitrix.dateInput,
        SELECTORS.bitrix.categorySelect,
        SELECTORS.bitrix.clientTypeSelect,
        SELECTORS.bitrix.sourceBlock
    ].join(', ');
    const anyField = await waitForModalField(anyFieldSelector, 12000);
    if (!anyField) {
        showAlert("Модалка появилась, но поля в ней не загрузились.");
        return;
    }
    await sleep(800);

    const dateInput = await waitForModalField(SELECTORS.bitrix.dateInput, 3000);
    if (dateInput) {
        dateInput.value = getFormattedTodayDate();
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const categoryFresh = await waitForModalField(SELECTORS.bitrix.categorySelect, 1500);
    if (categoryFresh) {
        await selectDropdownOption(categoryFresh, "Уличные елки");
    }

    const clientTypeEl = await waitForModalField(SELECTORS.bitrix.clientTypeSelect, 1500);
    if (clientTypeEl) {
        await selectDropdownOption(clientTypeEl, "B2C");
    }

    await fillSourceFieldIfPresent();
    await sleep(700);

    const form = findInAnyDocument(SELECTORS.bitrix.modalForm) || form0;
    const saveBtn = findSaveButton(form);
    if (!saveBtn) {
        showAlert("Не найдена кнопка 'Сохранить' в модалке Битрикса.");
        return;
    }

    clickLikeUser(saveBtn);
    await sleep(1800);

    if (!opts.skipNextStep) {
        await addHandledCardId(await getCurrentCardId());
        await returnToCRMAndEscape();
        processNextCard();
    }
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

async function selectDropdownOption(container, optionText) {
    if (!container) return;
    clickLikeUser(container);
    await sleep(600);

    const items = findAllInAnyDocument('.main-ui-select-item, .menu-popup-item');
    const wanted = optionText.toLowerCase();
    const target = items.find(item => (item.innerText || '').toLowerCase().includes(wanted));
    if (target) {
        clickLikeUser(target);
    }
    await sleep(400);
}