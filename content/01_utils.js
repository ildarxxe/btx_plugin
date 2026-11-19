// =====================================================================================
// МОДУЛЬ 01_utils.js
// ОБЩИЕ УТИЛИТЫ: паузы, поиск элементов (в т.ч. в iframe), Escape, клики, уведомления, варианты текстов, дневной лимит, даты
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: isStaleInstance, stopBot, pressEscapeEverywhere, clickLikeUser, waitForEnabledAnyDoc, waitForElementWithDebug, normalizePhone, isVisible, getAllDocuments, findInAnyDocument, findAllInAnyDocument, waitForElementAnyDoc, waitForSelectorPoll, getFormattedTodayDate, simulateKeyCombo, sleep, waitForElement, triggerPause, showAlert, rand, humanPause, interruptibleSleep, pickVariant, pickFileName, todayKey, getTodaySendCount, incrementSendCount, checkDailyLimit, startOfDay, sameDay, isTodayDate, showBotToast, sendRuntimeMessage
// =====================================================================================

function isStaleInstance() {
    return document.documentElement.getAttribute('data-elki-bot-instance') !== INSTANCE_ID;
}

function stopBot(reason) {
    isScriptRunning = false;
    BOT_CONFIG.isPaused = true;
    clearTimeout(idleTimer);
    console.log(`[Бот] Остановлен (${reason}).`);
}

function pressEscapeEverywhere() {
    const makeEvent = (type) => new KeyboardEvent(type, {
        key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true
    });
    for (const d of getAllDocuments()) {
        const targets = [d, d.body, d.activeElement].filter(Boolean);
        for (const t of targets) {
            t.dispatchEvent(makeEvent('keydown'));
            t.dispatchEvent(makeEvent('keyup'));
        }
    }
}

function clickLikeUser(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    el.click();
}

// Ждём элемент (во всех документах), который не заблокирован. Прерывается по STOP.
async function waitForEnabledAnyDoc(selector, timeout, interval = 500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return null;
        const el = findAllInAnyDocument(selector).find(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true');
        if (el) return el;
        await sleep(interval);
    }
    return null;
}

function waitForElementWithDebug(selector, timeout = 15000, cardIndex) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const findEl = () => {
            let el = document.querySelector(selector);
            if (el && el.innerText.trim().length > 0) return el;

            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc) {
                        el = iframeDoc.querySelector(selector);
                        if (el && el.innerText.trim().length > 0) return el;
                    }
                } catch (e) {}
            }
            return null;
        };

        const immediate = findEl();
        if (immediate) return resolve(immediate);

        const interval = setInterval(() => {
            const found = findEl();
            if (found) {
                clearInterval(interval);
                resolve(found);
                return;
            }

            if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                reject(new Error(`Элемент ${selector} не дождался загрузки.`));
            }
        }, 1000);
    });
}

function normalizePhone(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
    else if (digits.length === 10) digits = '7' + digits;
    return digits;
}

function isVisible(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
}

function getAllDocuments(rootDoc = document, depth = 0) {
    const docs = [rootDoc];
    if (depth > 3) return docs;
    rootDoc.querySelectorAll('iframe').forEach(iframe => {
        try {
            const d = iframe.contentDocument;
            if (d) docs.push(...getAllDocuments(d, depth + 1));
        } catch (e) {
        }
    });
    return docs;
}

function findInAnyDocument(selector) {
    for (const d of getAllDocuments()) {
        const el = d.querySelector(selector);
        if (el) return el;
    }
    return null;
}

function findAllInAnyDocument(selector) {
    const result = [];
    for (const d of getAllDocuments()) {
        result.push(...d.querySelectorAll(selector));
    }
    return result;
}

async function waitForElementAnyDoc(selector, timeout = 8000, interval = 300) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = findInAnyDocument(selector);
        if (el) return el;
        await sleep(interval);
    }
    return null;
}

async function waitForSelectorPoll(selector, timeout = 8000, interval = 300) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el) return el;
        await sleep(interval);
    }
    return null;
}

function getFormattedTodayDate() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:00`;
}

function simulateKeyCombo(code, modifiers) {
    document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...modifiers }));
    document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, ...modifiers }));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);

        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Элемент ${selector} не дождался загрузки.`));
        }, timeout);
    });
}

function triggerPause(reason) {
    isScriptRunning = false;
    BOT_CONFIG.isPaused = true;
    alert(`⏸ ПЛАГИН НА ПАУЗЕ!\nПричина: ${reason}\n\nЧтобы продолжить, вернитесь в CRM и нажмите [Ctrl + Shift + X].`);
}

function showAlert(message) {
    isScriptRunning = false;
    alert(`[ОШИБКА ПЛАГИНА]:\n${message}\n\nУстраните проблему и нажмите [Ctrl + Shift + X] для продолжения.`);
}

function rand(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

async function humanPause([min, max]) {
    await sleep(rand(min, max));
}

async function interruptibleSleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (BOT_CONFIG.isPaused || !isScriptRunning) return;
        await sleep(Math.min(1000, Math.max(0, end - Date.now())));
    }
}

function pickVariant(key) {
    const list = MESSAGE_VARIANTS[key];
    let idx = rand(0, list.length - 1);
    if (list.length > 1 && idx === lastVariantIndex[key]) idx = (idx + 1) % list.length;
    lastVariantIndex[key] = idx;
    return list[idx];
}

function pickFileName() {
    return PRICE_FILE_NAMES[rand(0, PRICE_FILE_NAMES.length - 1)];
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getTodaySendCount() {
    const st = await chrome.storage.local.get(['sendStats']);
    return (st.sendStats && st.sendStats.date === todayKey()) ? st.sendStats.count : 0;
}

async function incrementSendCount() {
    const count = await getTodaySendCount();
    await chrome.storage.local.set({ sendStats: { date: todayKey(), count: count + 1 } });
    console.log(`[Бот WA] Отправок сегодня: ${count + 1} из ${MAX_SENDS_PER_DAY}`);
}

async function checkDailyLimit() {
    if (BOT_CONFIG.useTestPhone) return true;
    const count = await getTodaySendCount();
    if (count >= MAX_SENDS_PER_DAY) {
        console.warn(`[Бот WA] Дневной лимит отправок исчерпан (${count}/${MAX_SENDS_PER_DAY}).`);
        chrome.runtime.sendMessage({ action: "returnToBitrix", stageType: 'stop' });
        return false;
    }
    return true;
}

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function sameDay(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isTodayDate(d) {
    return sameDay(d, new Date());
}

// Небольшое уведомление в углу страницы (не блокирует работу, в отличие от alert)
function showBotToast(text, isError = false) {
    try {
        let box = document.getElementById('elki-bot-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'elki-bot-toast';
            box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;max-width:380px;' +
                'padding:10px 14px;border-radius:8px;font:13px/1.4 sans-serif;color:#fff;' +
                'box-shadow:0 2px 10px rgba(0,0,0,.3);';
            document.body.appendChild(box);
        }
        box.style.background = isError ? '#d9363e' : '#1f8f4d';
        box.textContent = text;
        box.style.display = 'block';
        clearTimeout(box._hideTimer);
        box._hideTimer = setTimeout(() => { box.style.display = 'none'; }, isError ? 9000 : 4000);
    } catch (e) {}
}

// Запрос к background-скрипту (через callback — так надёжно и в Firefox, и в Chrome)
function sendRuntimeMessage(message) {
    return new Promise(resolve => {
        try {
            chrome.runtime.sendMessage(message, response => {
                void chrome.runtime.lastError; // гасим "Receiving end does not exist"
                resolve(response);
            });
        } catch (e) {
            resolve(undefined);
        }
    });
}
