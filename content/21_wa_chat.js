// =====================================================================================
// МОДУЛЬ 21_wa_chat.js
// WHATSAPP: АНАЛИЗ ПЕРЕПИСКИ (что делать с чатом) и разбор сообщений/дат
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: analyzeChatAndExecute, decideTouch1, isFirstScriptMessage, sendNewClientMessages, sendThirdMessage,
//           returnToCRMAndReturn, parseWhatsAppDateLabel, parsePrePlainText, extractTimeMinutes, inferMissingDates,
//           getChatScope, collectChatMessages, chatHasMessageEvidence, waitForChatMessages, chatPeerMismatch, describeMessages
// =====================================================================================

// Сколько ждать, прежде чем признать чат ПУСТЫМ. История сообщений подгружается не мгновенно, и если
// проверить слишком рано, чат с перепиской выглядит пустым (и плагин напишет человеку второй раз).
const EMPTY_CHAT_CONFIRM_MS = 8000;
// Сообщения одного «захода» (текст, файл с подписью) уходят с разницей в секунды. Если у сообщения нет даты,
// но его время отличается от соседнего сообщения с известной датой не больше чем на столько минут — берём ту же дату.
const SAME_DAY_MAX_GAP_MIN = 10;

// Главная логика после открытия чата: читаем переписку и решаем, что делать
async function analyzeChatAndExecute(phone) {
    const test = BOT_CONFIG.useTestPhone;
    const chat = await waitForChatMessages();
    const messages = chat.messages;

    console.log(`[Бот WA] Анализ чата: распознано сообщений ${messages.length}; сообщения видны в чате: ${chat.hasEvidence}; ` +
        `пустой чат подтверждён: ${chat.confirmedEmpty}`, describeMessages(messages));

    // Защита: убеждаемся, что открыт чат именно этого номера (в id сообщений зашит номер собеседника)
    if (chatPeerMismatch(messages, phone)) {
        await skipCurrentCardFromWA("открыт чат с другим номером (в WhatsApp не тот чат)");
        return;
    }

    if (BOT_CONFIG.runMode === 'new') {
        // Тестовый режим: пишем всегда.
        // Обычный режим: пишем ТОЛЬКО если пустота чата подтверждена. Если переписка есть (писали вручную)
        // или сообщения видны, но не распознаны — ничего не отправляем, просто меняем статус на "1 касание".
        if (test || chat.confirmedEmpty) {
            console.log("[Бот WA] Режим 'new': отправляем 1-е, 2-е сообщения и файл...");
            await sendNewClientMessages();
        } else {
            if (messages.length === 0) {
                console.warn("[Бот WA] Режим 'new': в чате видны сообщения, но плагин их не распознал — на всякий случай ничего не пишем.");
            }
            console.log("[Бот WA] Режим 'new': в чате уже есть сообщения — ничего не пишем, меняем статус на '1 касание'.");
            returnToCRMAndReturn();
        }
        return;
    }

    if (BOT_CONFIG.runMode === 'touch1') {
        const decision = decideTouch1(messages, chat);
        if (!decision.send) {
            await skipCurrentCardFromWA(decision.reason);
            return;
        }
        console.log("[Бот WA] Режим 'touch1': условия выполнены, отправляем 3-е сообщение...");
        await sendThirdMessage();
    }
}

// Наше «первое сообщение»: текст с Elki.kz / про прайс, либо файл (при ручной отправке файл идёт вместе с подписью)
function isFirstScriptMessage(m) {
    return m.dir === 'out' && (!!m.isFile || /elki|прайс|ознакомьтесь/i.test(m.text));
}

// Можно ли отправлять 3-е сообщение
function decideTouch1(messages, chat) {
    const test = BOT_CONFIG.useTestPhone;
    const skip = (reason) => ({ send: false, reason });

    if (messages.length === 0) {
        if (chat && chat.hasEvidence) {
            return skip("в чате есть сообщения, но плагин не смог их распознать (пришлите строки 'Анализ чата' из консоли)");
        }
        return skip("чата нет или он пустой");
    }
    if (messages.some(m => m.dir === 'in')) return skip("в чате есть ответ от клиента");
    if (!messages.some(isFirstScriptMessage)) {
        return skip("в чате нет нашего первого сообщения (текста с Elki.kz / про прайс или файла)");
    }

    // Эти проверки отключены в тестовом режиме, чтобы не ждать следующего дня
    if (!test) {
        if (messages.length > TOUCH1_MAX_MESSAGES) {
            return skip(`в чате ${messages.length} сообщений (ожидалось не больше ${TOUCH1_MAX_MESSAGES}: два текста и файл, либо файл с подписью)`);
        }
        const undated = messages.filter(m => !m.date);
        if (undated.length > 0) {
            return skip(`не удалось определить дату у ${undated.length} из ${messages.length} сообщений: ` +
                undated.map(m => `«${m.text.slice(0, 30)}»`).join(', '));
        }
        if (messages.some(m => isTodayDate(m.date))) return skip("в чате есть сообщения за сегодня");
    }
    return { send: true };
}

async function sendNewClientMessages() {
    try {
        if (!(await checkDailyLimit())) return;

        // Последняя проверка перед отправкой: вдруг история чата догрузилась уже после анализа
        if (!BOT_CONFIG.useTestPhone && (collectChatMessages().length > 0 || chatHasMessageEvidence())) {
            console.warn("[Бот WA] Перед отправкой в чате обнаружены сообщения — ничего не пишем, меняем статус на '1 касание'.");
            returnToCRMAndReturn();
            return;
        }

        await humanPause(DELAYS.beforeFirstMessage);
        await typeAndSendMessage(pickVariant('msg1'));
        await humanPause(DELAYS.betweenMessages);
        await typeAndSendMessage(pickVariant('msg2'));
        await humanPause(DELAYS.betweenMessages);
        await sendFileToChat();
        await incrementSendCount();
        await chrome.storage.local.set({ lastSent: true });
        await sleep(4000);
    } catch (e) {
        console.error("[Бот WA] Ошибка при отправке сообщений клиенту:", e);
        showAlert("Ошибка при отправке сообщений в WhatsApp. Проверьте консоль.");
        return;
    }
    returnToCRMAndReturn();
}

async function sendThirdMessage() {
    try {
        if (!(await checkDailyLimit())) return;
        await humanPause(DELAYS.beforeFirstMessage);
        await typeAndSendMessage(pickVariant('msg3'));
        await incrementSendCount();
        await chrome.storage.local.set({ lastSent: true });
        await sleep(3000);
    } catch (e) {
        console.error("[Бот WA] Ошибка при отправке 3-го сообщения:", e);
        showAlert("Ошибка при отправке сообщения в WhatsApp. Проверьте консоль.");
        return;
    }
    returnToCRMAndReturn();
}

function returnToCRMAndReturn() {
    const stageType = BOT_CONFIG.runMode === 'new' ? 'touch1' : 'touch2_simple';
    console.log(`[Бот WA] Возвращаемся в Bitrix, stageType: ${stageType}`);
    try {
        chrome.runtime.sendMessage({ action: "returnToBitrix", stageType: stageType }, () => {
            if (chrome.runtime.lastError) {
                console.error("[Бот WA] Ошибка связи с background:", chrome.runtime.lastError.message);
            }
        });
    } catch (e) {
        console.error("[Бот WA] sendMessage упал:", e);
        showAlert("Потеряна связь с расширением. Перезагрузите вкладку WhatsApp (F5) и запустите заново.");
    }
}

// Подпись даты в WhatsApp: "Сегодня", "Вчера", "четверг", "13.11.2026", "13 ноября 2026"
function parseWhatsAppDateLabel(text) {
    const t = (text || '').trim().toLowerCase();
    if (!t || t.length > 40) return null;
    const now = new Date();

    if (t === 'сегодня' || t === 'today') return startOfDay(now);
    if (t === 'вчера' || t === 'yesterday') {
        const d = startOfDay(now);
        d.setDate(d.getDate() - 1);
        return d;
    }

    if (RU_WEEKDAYS[t] !== undefined) {
        let diff = (now.getDay() - RU_WEEKDAYS[t] + 7) % 7;
        if (diff === 0) diff = 7;
        const d = startOfDay(now);
        d.setDate(d.getDate() - diff);
        return d;
    }

    let m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (m) {
        const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
        return new Date(y, +m[2] - 1, +m[1]);
    }

    m = t.match(/^(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?(?:\s*г\.?)?$/);
    if (m && RU_MONTHS[m[2]] !== undefined) {
        return new Date(m[3] ? +m[3] : now.getFullYear(), RU_MONTHS[m[2]], +m[1]);
    }
    return null;
}

// data-pre-plain-text у текстовых сообщений: "[14:32, 13.11.2026] Имя: "
function parsePrePlainText(s) {
    const m = (s || '').match(/\[[^\]]*?,\s*(\d{1,2})([./])(\d{1,2})[./](\d{4})\]/);
    if (!m) return null;
    let day = +m[1];
    let month = +m[3];
    if (m[2] === '/') { month = +m[1]; day = +m[3]; }
    return new Date(+m[4], month - 1, day);
}

// Время сообщения в минутах от начала суток. Из data-pre-plain-text "[21:47, 12.11.2026]" или из текста (последнее "ЧЧ:ММ")
function extractTimeMinutes(preText, text) {
    let m = (preText || '').match(/\[\s*(\d{1,2}):(\d{2})/);
    if (!m) {
        const all = Array.from((text || '').matchAll(/(?:^|\D)(\d{1,2}):(\d{2})(?!\d)/g));
        m = all.length ? all[all.length - 1] : null;
    }
    if (!m) return null;
    const h = +m[1], min = +m[2];
    return (h < 24 && min < 60) ? h * 60 + min : null;
}

// Если у сообщения нет даты (например, файл с подписью, у которого нет data-pre-plain-text), а соседнее сообщение
// с известной датой отправлено в пределах нескольких минут — считаем, что дата та же.
function inferMissingDates(messages) {
    for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        if (m.date) continue;

        // ближайшее предыдущее сообщение с датой
        for (let j = i - 1; j >= 0; j--) {
            const p = messages[j];
            if (!p.date) continue;
            if (m.time != null && p.time != null) {
                const diff = m.time - p.time;
                if (diff >= 0 && diff <= SAME_DAY_MAX_GAP_MIN) { m.date = p.date; m.dateInferred = true; }
            }
            break;
        }
        if (m.date) continue;

        // ближайшее следующее сообщение с датой
        for (let j = i + 1; j < messages.length; j++) {
            const n = messages[j];
            if (!n.date) continue;
            if (m.time != null && n.time != null) {
                const diff = n.time - m.time;
                if (diff >= 0 && diff <= SAME_DAY_MAX_GAP_MIN) { m.date = n.date; m.dateInferred = true; }
            }
            break;
        }
    }
}

function getChatScope() {
    return document.querySelector('#main') ||
        document.querySelector('[data-testid="conversation-panel-messages"]') ||
        document.querySelector('[data-testid="conversation-panel-body"]') ||
        document;
}

// Все сообщения открытого чата по порядку: направление (out — моё, in — от собеседника), дата, время, текст
function collectChatMessages() {
    const scope = getChatScope();
    // Сообщения и все короткие блоки (среди них — подпись даты "четверг" / "Вчера" / "13 ноября").
    // Порядок элементов — как в документе, поэтому подпись даты идёт перед сообщениями этого дня.
    const els = scope.querySelectorAll(MSG_SELECTOR + ', span, div');
    const result = [];
    const seen = new Set();
    let currentDate = null;

    for (const el of els) {
        if (el.matches(MSG_SELECTOR)) {
            const id = el.getAttribute('data-id');
            if (seen.has(id)) continue;
            seen.add(id);

            const pre = el.hasAttribute('data-pre-plain-text') ? el : el.querySelector('[data-pre-plain-text]');
            const preText = pre ? pre.getAttribute('data-pre-plain-text') : '';
            const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

            let date = preText ? parsePrePlainText(preText) : null;
            if (!date) date = currentDate;

            result.push({
                id: id,
                dir: id.startsWith('true_') ? 'out' : 'in',
                date: date,
                time: extractTimeMinutes(preText, text),
                isFile: !!el.querySelector('[data-icon*="document"], [data-icon*="pdf"]') ||
                    /\.(pdf|docx?|xlsx?|pptx?|zip|rar)\b/i.test(text) || /\bPDF\b/.test(text),
                text: text
            });
        } else {
            if (el.closest(MSG_SELECTOR)) continue;      // внутри сообщения
            if (el.childElementCount > 3) continue;      // крупные контейнеры не смотрим
            const tc = el.textContent || '';
            if (tc.length > 40) continue;
            const label = parseWhatsAppDateLabel(tc);
            if (label) currentDate = label;
        }
    }

    inferMissingDates(result);
    return result;
}

// Признаки того, что в чате есть сообщения, даже если collectChatMessages их не распознал
function chatHasMessageEvidence() {
    const scope = getChatScope();
    if (scope.querySelector(MSG_SELECTOR)) return true;
    if (scope.querySelector('[data-pre-plain-text]')) return true;
    if (scope.querySelector('.message-in, .message-out, [class*="message-in"], [class*="message-out"]')) return true;
    if (scope.querySelector('[data-icon^="msg-"]')) return true; // значки времени/галочек у сообщений

    return Array.from(scope.querySelectorAll('[role="row"]')).some(r =>
        !r.closest('header') && /(^|\D)\d{1,2}:\d{2}(\D|$)/.test(r.textContent || ''));
}

// Ждём, пока чат прогрузится. Возвращает { messages, hasEvidence, confirmedEmpty }:
// confirmedEmpty = true только если сообщений нет, на экране их тоже не видно, и мы ждали достаточно долго.
async function waitForChatMessages(minEmptyWaitMs = EMPTY_CHAT_CONFIRM_MS, timeout = 20000) {
    const start = Date.now();
    let last = -1;
    let stable = 0;

    while (Date.now() - start < timeout) {
        const n = collectChatMessages().length;
        if (n === last) stable++;
        else { stable = 0; last = n; }

        if (n > 0 && stable >= 2) break; // сообщения есть, список перестал меняться
        if (n === 0) {
            const elapsed = Date.now() - start;
            if (chatHasMessageEvidence()) {
                if (elapsed >= 3000) break;           // что-то видно, но не распознаётся — дольше не ждём
            } else if (elapsed >= minEmptyWaitMs) {
                break;                                 // долго ждали и ничего нет — чат пуст
            }
        }
        await sleep(500);
    }

    const messages = collectChatMessages();
    const hasEvidence = messages.length > 0 || chatHasMessageEvidence();
    return { messages, hasEvidence, confirmedEmpty: messages.length === 0 && !hasEvidence };
}

// В id сообщений зашит номер собеседника ("false_77781193946@c.us_3EB0..."). Если он не совпадает
// с нужным номером — открыт не тот чат. Если номера в id нет (группы, @lid) — не проверяем.
function chatPeerMismatch(messages, phone) {
    const last10 = phone.slice(-10);
    for (const m of messages) {
        const found = (m.id || '').match(/_(\d+)@(?:c\.us|s\.whatsapp\.net)/);
        if (found) return !found[1].endsWith(last10);
    }
    return false;
}

// Краткое описание сообщений для лога
function describeMessages(messages) {
    return messages.map(m => {
        const d = m.date ? m.date.toLocaleDateString('ru-RU') + (m.dateInferred ? '*' : '') : '??.??';
        const t = m.time != null ? `${String(Math.floor(m.time / 60)).padStart(2, '0')}:${String(m.time % 60).padStart(2, '0')}` : '--:--';
        return `${m.dir === 'out' ? '→' : '←'} ${d} ${t}${m.isFile ? ' [файл]' : ''} | ${m.text.slice(0, 40)}`;
    });
}