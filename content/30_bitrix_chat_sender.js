// =====================================================================================
// МОДУЛЬ 30_bitrix_chat_sender.js
// ОТПРАВКА СООБЩЕНИЙ И ФАЙЛОВ В ЧАТ BITRIX24
// =====================================================================================

function findAllInAnyDocument(selector) {
    const out = [];
    const seen = new Set();
    const scan = (doc) => {
        if (!doc || seen.has(doc)) return;
        seen.add(doc);
        try {
            doc.querySelectorAll(selector).forEach(el => out.push(el));
        } catch (e) {}
        try {
            doc.querySelectorAll('iframe').forEach(ifr => {
                try {
                    if (ifr.contentDocument) scan(ifr.contentDocument);
                } catch (e) {}
            });
        } catch (e) {}
    };
    scan(document);
    return out;
}

function findInAnyDocument(selector) {
    const all = findAllInAnyDocument(selector);
    return all.find(isVisible) || all[0] || null;
}

function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return false;
    const st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity) > 0;
}

function findAnyBitrixChatInput() {
    const direct = findAllInAnyDocument(BITRIX_CHAT_SELECTORS.textarea)
        .find(el => isVisible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
    if (direct) return direct;

    const containers = findAllInAnyDocument('.bx-im-messenger, .bx-im-content-chat, .bx-im-textarea').filter(isVisible);
    for (const box of containers) {
        const candidate = Array.from(box.querySelectorAll('textarea, [contenteditable="true"]'))
            .find(el => isVisible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
        if (candidate) return candidate;
    }

    return null;
}

function setTextareaValueLikeUser(inputEl, text) {
    inputEl.focus();

    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
        const proto = inputEl.tagName === 'TEXTAREA'
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && typeof desc.set === 'function') {
            desc.set.call(inputEl, text);
        } else {
            inputEl.value = text;
        }
        inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        return;
    }

    try {
        inputEl.textContent = '';
        document.execCommand('insertText', false, text);
    } catch (e) {
        inputEl.textContent = text;
    }
    inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

async function sendBitrixChatText(text) {
    const cleanText = String(text ?? '');
    if (!cleanText.trim()) return;

    const B = BITRIX_CHAT_SELECTORS;
    const inputEl = findAnyBitrixChatInput();
    if (!inputEl) {
        throw new Error("Не найдено поле ввода в открытом чате Bitrix.");
    }

    setTextareaValueLikeUser(inputEl, cleanText);
    await sleep(350);

    const sendBtn = findInAnyDocument(B.sendBtn);
    const isBtnEnabled = sendBtn &&
        !sendBtn.disabled &&
        sendBtn.getAttribute('aria-disabled') !== 'true' &&
        !sendBtn.classList.contains('--disabled');

    if (sendBtn && isBtnEnabled) {
        clickLikeUser(sendBtn);
    } else {
        inputEl.focus();
        inputEl.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        }));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        }));
    }

    await sleep(600);
}

function base64ToFile(dataUrlOrBase64, fileName, mimeType) {
    const raw = String(dataUrlOrBase64 || '');
    const commaIdx = raw.indexOf(',');
    const b64 = commaIdx >= 0 ? raw.slice(commaIdx + 1) : raw;
    const detectedMime = mimeType || (commaIdx >= 0 ? (raw.slice(5, commaIdx).split(';')[0] || 'application/octet-stream') : 'application/octet-stream');

    const byteChars = atob(b64);
    const byteArrays = [];
    for (let offset = 0; offset < byteChars.length; offset += 512) {
        const slice = byteChars.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
    }

    const blob = new Blob(byteArrays, { type: detectedMime });
    return new File([blob], fileName || 'file', { type: detectedMime, lastModified: Date.now() });
}

async function fetchDefaultPriceFile() {
    const resp = await fetch(PRICE_FILE_PATH + '?t=' + Date.now(), { cache: 'no-store' });
    if (!resp.ok) {
        throw new Error(`Не удалось скачать дефолтный файл (${resp.status})`);
    }
    const blob = await resp.blob();
    const randomName = PRICE_FILE_NAMES[Math.floor(Math.random() * PRICE_FILE_NAMES.length)] || 'price.pdf';
    return new File([blob], randomName, { type: blob.type || 'application/pdf', lastModified: Date.now() });
}

function findBitrixFileInputs() {
    const inputs = findAllInAnyDocument('input[type="file"]');
    return inputs.filter(inp => inp && inp.isConnected);
}

async function attachFilesToBitrixChat(files) {
    const fileList = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!fileList.length) {
        throw new Error("Нет файлов для прикрепления в чат Bitrix.");
    }

    const dt = new DataTransfer();
    fileList.forEach(f => dt.items.add(f));

    let inputs = findBitrixFileInputs();
    if (!inputs.length) {
        const attachBtn = findInAnyDocument(BITRIX_CHAT_SELECTORS.attachBtn);
        if (attachBtn) {
            clickLikeUser(attachBtn);
            await sleep(600);
            inputs = findBitrixFileInputs();
        }
    }

    if (!inputs.length) {
        throw new Error("Не найден input[type=\"file\"] в чате Bitrix.");
    }

    const targetInput = inputs[inputs.length - 1];
    try {
        targetInput.files = dt.files;
    } catch (e) {
        const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
        if (desc && typeof desc.set === 'function') {
            desc.set.call(targetInput, dt.files);
        }
    }

    targetInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    targetInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

async function waitAndClickAttachmentSend(captionText = '') {
    const B = BITRIX_CHAT_SELECTORS;
    const isEnabled = b => b && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !b.classList.contains('--disabled');
    const findPreviewBtn = () => findAllInAnyDocument(B.previewSendBtn).find(isVisible) || null;

    const deadline = Date.now() + BITRIX_FILE_UPLOAD_WAIT_MS;
    while (Date.now() < deadline) {
        const previewBtn = findPreviewBtn();
        if (previewBtn && isEnabled(previewBtn)) {
            await sleep(600);

            if (captionText) {
                const modalRoot = previewBtn.closest('.popup-window, .bx-core-popup-container, .ui-sidepanel-layout, [role="dialog"]') || document;
                const captionField = modalRoot.querySelector('textarea, input[type="text"], div[contenteditable="true"]');
                if (captionField) {
                    captionField.focus();
                    if (captionField.tagName === 'TEXTAREA' || captionField.tagName === 'INPUT') {
                        captionField.value = captionText;
                        captionField.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        document.execCommand('insertText', false, captionText);
                    }
                    await sleep(400);
                }
            }

            clickLikeUser(previewBtn);

            for (let attempt = 0; attempt < 2; attempt++) {
                for (let i = 0; i < 16; i++) {
                    await sleep(500);
                    if (!findPreviewBtn()) {
                        await sleep(800);
                        return;
                    }
                }
                if (attempt === 0) {
                    const again = findPreviewBtn();
                    if (again && isEnabled(again)) clickLikeUser(again);
                }
            }
            throw new Error("вложение прикреплено, но окно предпросмотра не закрылось после нажатия «Отправить»");
        }

        const popupBtn = findAllInAnyDocument('button, .ui-btn, [role="button"]').find(b =>
            isVisible(b) && isEnabled(b) && /^(отправить|send)$/i.test((b.innerText || '').trim()) && !b.matches(B.sendBtn)
        );
        if (popupBtn) {
            clickLikeUser(popupBtn);
            await sleep(1500);
            return;
        }

        if (!previewBtn) {
            const mainBtn = findAllInAnyDocument(B.sendBtn).find(isEnabled);
            if (mainBtn) {
                clickLikeUser(mainBtn);
                await sleep(1500);
                return;
            }
        }

        await sleep(500);
    }
    throw new Error("файл/картинки не прикрепились или кнопка отправки не стала активной за " + Math.round(BITRIX_FILE_UPLOAD_WAIT_MS / 1000) + " сек.");
}

async function sendBitrixChatFileStep(stepItem) {
    let fileObj = null;
    if (stepItem && stepItem.base64) {
        fileObj = base64ToFile(stepItem.base64, stepItem.fileName || 'attachment', stepItem.mimeType);
    } else {
        fileObj = await fetchDefaultPriceFile();
    }

    await attachFilesToBitrixChat([fileObj]);
    await waitAndClickAttachmentSend('');
}

async function sendBitrixChatAlbumStep(stepItem) {
    const rawImages = Array.isArray(stepItem && stepItem.images) ? stepItem.images : [];
    const files = rawImages
        .filter(img => img && img.base64)
        .map((img, idx) => base64ToFile(
            img.base64,
            img.name || `photo_${idx + 1}.jpg`,
            img.mimeType || 'image/jpeg'
        ));

    if (!files.length) {
        throw new Error("В блоке «Фото с текстом» не выбраны фотографии.");
    }

    const caption = String((stepItem && stepItem.text) || '').trim();
    await attachFilesToBitrixChat(files);
    await waitAndClickAttachmentSend(caption);
}