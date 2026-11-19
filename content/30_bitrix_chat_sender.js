// =====================================================================================
// МОДУЛЬ 30_bitrix_chat_sender.js
// BITRIX-ЧАТ: ОТПРАВКА ПЕРВЫХ СООБЩЕНИЙ И ФАЙЛА ПО КЛАВИШЕ Ctrl+Alt+Enter (для клиентов из Instagram)
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: waitEnabledInBitrix, sendBitrixChatText, findBitrixChatFileInput, loadPriceFileDataTransfer, sendBitrixChatFile, sendFirstMessagesToBitrixChat, onBitrixChatHotkey, attachBitrixChatHotkey
// =====================================================================================

// Ждём активный (не заблокированный) элемент. Не зависит от состояния плагина (старт/пауза)
async function waitEnabledInBitrix(selector, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = findAllInAnyDocument(selector).find(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true');
        if (el) return el;
        await sleep(300);
    }
    return null;
}

// Отправка одного текстового сообщения
async function sendBitrixChatText(text) {
    const B = BITRIX_CHAT_SELECTORS;
    const ta = findInAnyDocument(B.textarea);
    if (!ta || ta.disabled) throw new Error("поле ввода недоступно (нажмите «Ответить» в чате)");

    ta.focus();
    ta.value = text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(rand(600, 1400));

    // кнопка отправки становится активной только после ввода текста
    const btn = await waitEnabledInBitrix(B.sendBtn, 3000);
    if (btn) {
        clickLikeUser(btn);
    } else {
        console.warn("[Бот Bitrix] Кнопка отправки не активна — жмём Enter в поле ввода.");
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }

    // ждём, пока поле очистится (значит, сообщение ушло)
    for (let i = 0; i < 12; i++) {
        await sleep(300);
        const cur = findInAnyDocument(B.textarea);
        if (!cur || !(cur.value || '').trim()) return;
    }
    throw new Error("сообщение не отправилось (поле ввода не очистилось)");
}

// Скрытый input[type=file] для вложений чата (не аватар чата в шапке и не только-для-картинок)
function findBitrixChatFileInput() {
    return findAllInAnyDocument('input[type="file"]').find(i =>
        !i.classList.contains('bx-im-chat-header__avatar_input') &&
        !/^\s*image\//i.test(i.accept || '')
    ) || null;
}

// Читает price.pdf. Во вкладке Bitrix прямой fetch файла расширения запрещён (Firefox: "Security Error ...
// may not load moz-extension://"), пока домен Bitrix не добавлен в web_accessible_resources. Поэтому файл
// сначала просим у background.js (у него доступ к файлам расширения есть всегда), а прямой fetch — запасной вариант.
async function loadPriceFileDataTransfer() {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: PRICE_FILE_PATH,
            responseType: "blob",
            onload: (res) => {
                if (res.status >= 200 && res.status < 300 && res.response) {
                    const dt = new DataTransfer();
                    dt.items.add(new File([res.response], pickFileName(), { type: "application/pdf" }));
                    resolve(dt);
                } else {
                    reject(new Error(`Не удалось загрузить price.pdf (статус ${res.status})`));
                }
            },
            onerror: () => reject(new Error("Ошибка сети при загрузке price.pdf"))
        });
    });
}


async function sendBitrixChatFile(preloadedDt) {
    const B = BITRIX_CHAT_SELECTORS;
    const dt = preloadedDt || await loadPriceFileDataTransfer();

    const ta = findInAnyDocument(B.textarea);
    let attached = false;

    // Способ 1: input[type=file] (при необходимости открываем меню «Прикрепить»)
    let input = findBitrixChatFileInput();
    if (!input) {
        const attachBtn = findInAnyDocument(B.attachBtn);
        if (attachBtn) {
            clickLikeUser(attachBtn);
            await sleep(900);
            input = findBitrixChatFileInput();
            if (!input) {
                const items = findAllInAnyDocument('.menu-popup-item, [role="menuitem"]').filter(isVisible);
                console.log("[Бот Bitrix] Пункты меню 'Прикрепить':", items.map(i => (i.innerText || '').trim().slice(0, 40)));
                const pick = items.find(i => /(файл|компьютер|устройств|загруз|upload|device|file)/i.test(i.innerText || ''));
                if (pick) {
                    clickLikeUser(pick);
                    await sleep(900);
                    input = findBitrixChatFileInput();
                }
            }
        }
    }
    if (input) {
        console.log(`[Бот Bitrix] Найден input для файла, accept="${input.accept}"`);
        input.files = dt.files;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        attached = true;
    }

    // Способ 2: вставка из буфера обмена в поле ввода
    if (!attached && ta) {
        console.warn("[Бот Bitrix] input для файла не найден — пробуем paste.");
        ta.focus();
        ta.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
        attached = true;
    }

    // Нажимаем отправку, когда файл загрузился.
    // После прикрепления Bitrix показывает окно предпросмотра с кнопкой отправки (иконка без текста,
    // data-testid="im-upload-preview-send-btn"). Пока файл грузится, кнопка заблокирована.
    const isEnabled = b => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !b.classList.contains('--disabled');
    const findPreviewBtn = () => findAllInAnyDocument(B.previewSendBtn).find(isVisible) || null;

    const deadline = Date.now() + BITRIX_FILE_UPLOAD_WAIT_MS;
    while (Date.now() < deadline) {
        // а) кнопка отправки в окне предпросмотра файла
        const previewBtn = findPreviewBtn();
        if (previewBtn && isEnabled(previewBtn)) {
            await sleep(600); // небольшая пауза, чтобы предпросмотр дорисовался
            console.log("[Бот Bitrix] Нажимаем кнопку отправки в окне предпросмотра файла.");
            clickLikeUser(previewBtn);

            // убеждаемся, что окно предпросмотра закрылось (значит, файл ушёл); если нет — нажимаем ещё раз
            for (let attempt = 0; attempt < 2; attempt++) {
                for (let i = 0; i < 16; i++) {
                    await sleep(500);
                    if (!findPreviewBtn()) { await sleep(800); return; }
                }
                if (attempt === 0) {              // повторно нажимаем только один раз, чтобы не отправить файл дважды
                    const again = findPreviewBtn();
                    if (again && isEnabled(again)) clickLikeUser(again);
                }
            }
            throw new Error("файл прикреплён, но окно предпросмотра не закрылось после нажатия «Отправить»");
        }

        // б) отдельное окно с текстовой кнопкой «Отправить» (запасной вариант)
        const popupBtn = findAllInAnyDocument('button, .ui-btn, [role="button"]').find(b =>
            isVisible(b) && isEnabled(b) && /^(отправить|send)$/i.test((b.innerText || '').trim()) && !b.matches(B.sendBtn)
        );
        if (popupBtn) { clickLikeUser(popupBtn); await sleep(1500); return; }

        // в) основная кнопка отправки, если файл прикреплён прямо к сообщению (запасной вариант)
        if (!previewBtn) {
            const mainBtn = findAllInAnyDocument(B.sendBtn).find(isEnabled);
            if (mainBtn) { clickLikeUser(mainBtn); await sleep(1500); return; }
        }

        await sleep(500);
    }
    throw new Error("файл не прикрепился или кнопка отправки не стала активной за " + Math.round(BITRIX_FILE_UPLOAD_WAIT_MS / 1000) + " сек.");
}

// 1-е сообщение, 2-е сообщение, файл
async function sendFirstMessagesToBitrixChat() {
    if (bitrixChatSending) {
        showBotToast("Отправка уже идёт, подождите…");
        return;
    }

    const ta = findInAnyDocument(BITRIX_CHAT_SELECTORS.textarea);
    if (!ta) {
        showBotToast("Не вижу поля ввода в чате Bitrix. Откройте диалог и нажмите «Ответить».", true);
        return;
    }
    if (ta.disabled) {
        showBotToast("Поле ввода заблокировано. Нажмите «Ответить» в диалоге.", true);
        return;
    }
    if ((ta.value || '').trim()) {
        showBotToast("В поле ввода уже есть текст — очистите его и повторите.", true);
        return;
    }

    bitrixChatSending = true;
    try {
        // сначала убеждаемся, что файл доступен, чтобы не отправить тексты без файла
        const priceDt = await loadPriceFileDataTransfer();

        showBotToast("Отправляю 1-е сообщение…");
        await sendBitrixChatText(pickVariant('msg1'));
        await humanPause(BITRIX_CHAT_DELAYS.betweenMessages);

        showBotToast("Отправляю 2-е сообщение…");
        await sendBitrixChatText(pickVariant('msg2'));
        await humanPause(BITRIX_CHAT_DELAYS.betweenMessages);

        showBotToast("Отправляю файл…");
        await sendBitrixChatFile(priceDt);

        showBotToast("Готово: 2 сообщения и файл отправлены ✅");
        console.log("[Бот Bitrix] Первые сообщения и файл отправлены в чат Bitrix.");
    } catch (e) {
        console.error("[Бот Bitrix] Ошибка отправки в чат:", e);
        showBotToast("Ошибка: " + (e && e.message ? e.message : e), true);
    } finally {
        bitrixChatSending = false;
    }
}

// Горячая клавиша Ctrl+Alt+Enter (по физической клавише — работает при любой раскладке)
function onBitrixChatHotkey(e) {
    if (!(e.ctrlKey && e.altKey && !e.shiftKey && (e.code === 'Enter' || e.code === 'NumpadEnter'))) return;
    if (!location.hostname.includes('bitrix24')) return; // только на вкладке Bitrix
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    sendFirstMessagesToBitrixChat();
}

// Слушаем клавиши и в основной странице, и в iframe (если мессенджер открыт внутри карточки)
function attachBitrixChatHotkey(doc) {
    if (doc.__elkiChatHotkey) return;
    doc.__elkiChatHotkey = true;
    doc.addEventListener('keydown', onBitrixChatHotkey, true);
}

attachBitrixChatHotkey(document);

setInterval(() => {
    try { getAllDocuments().forEach(attachBitrixChatHotkey); } catch (e) {}
}, 3000);