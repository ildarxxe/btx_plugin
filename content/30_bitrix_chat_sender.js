// =====================================================================================
// МОДУЛЬ 30_bitrix_chat_sender.js
// BITRIX-ЧАТ: ОТПРАВКА ТЕКСТА, ФАЙЛОВ И НЕСКОЛЬКИХ КАРТИНОК В ОДНОМ СООБЩЕНИИ
// =====================================================================================

async function waitEnabledInBitrix(selector, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = findAllInAnyDocument(selector).find(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true');
        if (el) return el;
        await sleep(300);
    }
    return null;
}

async function sendBitrixChatText(text) {
    const B = BITRIX_CHAT_SELECTORS;
    const ta = findInAnyDocument(B.textarea);
    if (!ta || ta.disabled) throw new Error("поле ввода недоступно (нажмите «Ответить» в чате)");

    ta.focus();
    ta.value = text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(rand(600, 1400));

    const btn = await waitEnabledInBitrix(B.sendBtn, 3000);
    if (btn) {
        clickLikeUser(btn);
    } else {
        console.warn("[Бот Bitrix] Кнопка отправки не активна — жмём Enter в поле ввода.");
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }

    for (let i = 0; i < 12; i++) {
        await sleep(300);
        const cur = findInAnyDocument(B.textarea);
        if (!cur || !(cur.value || '').trim()) return;
    }
    throw new Error("сообщение не отправилось (поле ввода не очистилось)");
}

function findBitrixChatFileInput(preferImages = false) {
    const allInputs = findAllInAnyDocument('input[type="file"]').filter(i =>
        !i.classList.contains('bx-im-chat-header__avatar_input')
    );
    if (preferImages) {
        const imgInput = allInputs.find(i => /image\//i.test(i.accept || ''));
        if (imgInput) return imgInput;
    }
    return allInputs.find(i => !/^\s*image\//i.test(i.accept || '')) || allInputs[0] || null;
}

function base64ToFile(base64OrDataUrl, fileName, mimeType = 'application/pdf') {
    const cleanBase64 = base64OrDataUrl.includes(',')
        ? base64OrDataUrl.split(',')[1]
        : base64OrDataUrl;
    const binary = atob(cleanBase64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });
    return new File([blob], fileName || pickFileName(), { type: mimeType });
}

function buildDataTransferFromFiles(fileObjects) {
    const dt = new DataTransfer();
    for (const f of fileObjects) {
        if (f && f.base64) {
            dt.items.add(base64ToFile(f.base64, f.name || 'image.png', f.mimeType || 'image/png'));
        }
    }
    return dt;
}

async function loadPriceFileDataTransfer(customFile = null) {
    const dt = new DataTransfer();
    if (customFile && customFile.base64) {
        dt.items.add(base64ToFile(
            customFile.base64,
            customFile.name || pickFileName(),
            customFile.mimeType || 'application/pdf'
        ));
        return dt;
    }

    const response = await fetch(PRICE_FILE_PATH);
    if (!response.ok) {
        throw new Error(`Не удалось загрузить price.pdf (статус ${response.status})`);
    }
    const blob = await response.blob();
    dt.items.add(new File([blob], pickFileName(), { type: 'application/pdf' }));
    return dt;
}

async function attachDataTransferToBitrix(dt, preferImages = false) {
    const B = BITRIX_CHAT_SELECTORS;
    const ta = findInAnyDocument(B.textarea);
    let attached = false;

    let input = findBitrixChatFileInput(preferImages);
    if (!input) {
        const attachBtn = findInAnyDocument(B.attachBtn);
        if (attachBtn) {
            clickLikeUser(attachBtn);
            await sleep(900);
            input = findBitrixChatFileInput(preferImages);
            if (!input) {
                const items = findAllInAnyDocument('.menu-popup-item, [role="menuitem"]').filter(isVisible);
                const pick = items.find(i => /(файл|фото|изображен|компьютер|устройств|загруз|upload|device|file|photo|image)/i.test(i.innerText || ''));
                if (pick) {
                    clickLikeUser(pick);
                    await sleep(900);
                    input = findBitrixChatFileInput(preferImages);
                }
            }
        }
    }

    if (input) {
        input.files = dt.files;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        attached = true;
    }

    if (!attached && ta) {
        ta.focus();
        ta.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
        attached = true;
    }

    return attached;
}

async function waitAndClickAttachmentSend(captionText = '') {
    const B = BITRIX_CHAT_SELECTORS;
    const isEnabled = b => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !b.classList.contains('--disabled');
    const findPreviewBtn = () => findAllInAnyDocument(B.previewSendBtn).find(isVisible) || null;

    const deadline = Date.now() + BITRIX_FILE_UPLOAD_WAIT_MS;
    while (Date.now() < deadline) {
        const previewBtn = findPreviewBtn();
        if (previewBtn && isEnabled(previewBtn)) {
            await sleep(600);

            // Если в окне предпросмотра есть поле подписи/текста — заполняем его
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
                        // Если подпись не влезла в поле предпросмотра и поле чата свободно — отправим отдельным текстом
                        const ta = findInAnyDocument(B.textarea);
                        if (captionText && ta && !(ta.value || '').trim()) {
                            await humanPause(BITRIX_CHAT_DELAYS.betweenMessages);
                            await sendBitrixChatText(captionText);
                        }
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
            if (captionText) {
                await humanPause(BITRIX_CHAT_DELAYS.betweenMessages);
                await sendBitrixChatText(captionText);
            }
            return;
        }

        if (!previewBtn) {
            const mainBtn = findAllInAnyDocument(B.sendBtn).find(isEnabled);
            if (mainBtn) {
                clickLikeUser(mainBtn);
                await sleep(1500);
                if (captionText) {
                    await humanPause(BITRIX_CHAT_DELAYS.betweenMessages);
                    await sendBitrixChatText(captionText);
                }
                return;
            }
        }

        await sleep(500);
    }
    throw new Error("файл/картинки не прикрепились или кнопка отправки не стала активной за " + Math.round(BITRIX_FILE_UPLOAD_WAIT_MS / 1000) + " сек.");
}

async function sendBitrixChatFile(preloadedDt) {
    const dt = preloadedDt || await loadPriceFileDataTransfer();
    await attachDataTransferToBitrix(dt, false);
    await waitAndClickAttachmentSend('');
}

// Отправка нескольких картинок (например, 3 фото) одним заходом вместе с текстом
async function sendBitrixChatImagesWithText(imageFileObjects, captionText = '') {
    const validImages = (Array.isArray(imageFileObjects) ? imageFileObjects : []).filter(f => f && f.base64);
    if (!validImages.length) {
        if (captionText && captionText.trim()) {
            await sendBitrixChatText(captionText.trim());
        }
        return;
    }

    const dt = buildDataTransferFromFiles(validImages);
    const attached = await attachDataTransferToBitrix(dt, true);
    if (!attached) {
        throw new Error("не удалось прикрепить картинки в чат Bitrix");
    }
    await waitAndClickAttachmentSend((captionText || '').trim());
}