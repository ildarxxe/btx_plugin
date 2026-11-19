// =====================================================================================
// МОДУЛЬ 22_wa_send.js
// WHATSAPP: ОТПРАВКА (текст и PDF-файл)
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: clickSendButton, typeAndSendMessage, findDocumentInput, clickAttachMenuItem, sendFileToChat
// =====================================================================================

function clickSendButton(sendEl) {
    const target = sendEl.closest('button') || sendEl.closest('[role="button"]') || sendEl;
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    target.click();
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
