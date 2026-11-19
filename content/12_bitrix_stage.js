// =====================================================================================
// МОДУЛЬ 12_bitrix_stage.js
// BITRIX: СМЕНА СТАДИИ (кнопка стадии, модальное окно, поле «Источник», «Сохранить», выпадающие списки)
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: finishCardAndMoveNext, waitForModalField, dumpModalDebug, findSourceField, fillSourceFieldIfPresent, fillAndSubmitModalForm, findSaveButton, selectDropdownOption
// =====================================================================================

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
