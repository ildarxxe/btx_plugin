// =====================================================================================
// МОДУЛЬ 10_bitrix_queue.js
// BITRIX: ОЧЕРЕДЬ ЗАЯВОК (обход колонки, выбор следующей карточки, пропущенные заявки, пауза между клиентами)
//
// Все модули — один общий контекст расширения: функции и константы из других модулей доступны напрямую.
// Содержит: getCardId, getHandledCardIds, addHandledCardId, getCurrentCardId, startAutomation, processNextCard, proceedToNextCardFromStorage, isCardDateToday, isScrollableEl, getKanbanScrollers, isColumnLoading, loadAllColumnCards
// =====================================================================================

function getCardId(card) {
    const direct = card.getAttribute('data-id');
    if (direct) return direct;
    const link = card.querySelector('.crm-kanban-item-title');
    const fromLink = link && ((link.getAttribute('href') || link.innerText || '').trim());
    return fromLink || (card.innerText || '').trim().slice(0, 80) || 'unknown';
}

async function getHandledCardIds() {
    const st = await chrome.storage.local.get(['handledCardIds']);
    return Array.isArray(st.handledCardIds) ? st.handledCardIds : [];
}

async function addHandledCardId(id) {
    if (!id) return;
    const list = await getHandledCardIds();
    if (!list.includes(id)) {
        list.push(id);
        await chrome.storage.local.set({ handledCardIds: list });
    }
    console.log(`[Бот] Заявка ${id} помечена как обработанная/пропущенная.`);
}

async function getCurrentCardId() {
    if (currentCardId) return currentCardId;
    const st = await chrome.storage.local.get(['botState']);
    return (st.botState && st.botState.cardId) || null;
}

function startAutomation() {
    clearTimeout(idleTimer);
    isScriptRunning = true;
    columnPreloaded = false;
    console.log(`[Бот ДЕБАГ] Запуск автоматизации. Режим: ${BOT_CONFIG.runMode}. Конфиг:`, JSON.stringify(BOT_CONFIG));
    if (BOT_CONFIG.useTestPhone) {
        console.warn(`[Бот] ВНИМАНИЕ: включён ТЕСТОВЫЙ режим, все сообщения пойдут на номер ${BOT_CONFIG.testPhone}!`);
    }
    processNextCard();
}

async function processNextCard() {
    if (isStaleInstance()) {
        isScriptRunning = false;
        clearTimeout(idleTimer);
        console.warn("[Бот] Устаревший экземпляр скрипта остановлен. Обновите страницу (F5), если бот не запускается.");
        return;
    }
    if (BOT_CONFIG.isPaused || !isScriptRunning) return;

    const targetColumnSelector = BOT_CONFIG.runMode === 'new' ? SELECTORS.bitrix.newColumn : SELECTORS.bitrix.touchColumn;
    const column = document.querySelector(targetColumnSelector);

    if (!column) {
        showAlert(`Не найдена колонка для режима '${BOT_CONFIG.runMode}'. Откройте страницу со всеми заявками (канбан).`);
        return;
    }

    if (BOT_CONFIG.runMode === 'touch1' && !columnPreloaded) {
        await loadAllColumnCards(column);
        columnPreloaded = true;
        if (BOT_CONFIG.isPaused || !isScriptRunning) return;
    }

    const handled = await getHandledCardIds();
    if (BOT_CONFIG.isPaused || !isScriptRunning) return;
    const allCards = Array.from(column.querySelectorAll(SELECTORS.bitrix.cards));
    let cards = allCards.filter(c => !handled.includes(getCardId(c)));
    let todayCount = 0;

    if (BOT_CONFIG.runMode === 'touch1') {
        const notToday = cards.filter(c => !isCardDateToday(c));
        todayCount = cards.length - notToday.length;
        cards = notToday;
        cards.reverse();
    }

    console.log(`[Бот ДЕБАГ] В колонке: ${allCards.length}, пропущено/обработано: ${allCards.length - cards.length - todayCount}` +
        (BOT_CONFIG.runMode === 'touch1' ? `, сегодняшних (не трогаем): ${todayCount}` : '') +
        `, к обработке: ${cards.length}`);

    if (cards.length === 0) {
        if (BOT_CONFIG.runMode === 'new') {
            console.log(`[Бот ДЕБАГ] Новых заявок пока нет. Проверим снова через ${IDLE_POLL_MS / 1000} сек. (остановить — кнопка STOP в плагине)`);
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => processNextCard(), IDLE_POLL_MS);
            return;
        }
        if (allCards.length === 0) {
            alert("В выбранной колонке нет заявок для обработки!");
        } else {
            console.log("[Бот ДЕБАГ] Все заявки в этой колонке обработаны или пропущены.");
            alert("Очередь заявок завершена!\n(Оставшиеся в колонке заявки были пропущены: нет номера или нет WhatsApp.)");
        }
        isScriptRunning = false;
        return;
    }

    const card = cards[0];
    const cardId = getCardId(card);
    currentCardId = cardId;

    cardAttempts[cardId] = (cardAttempts[cardId] || 0) + 1;
    if (cardAttempts[cardId] > 3) {
        console.warn(`[Бот ДЕБАГ] [Заявка ${cardId}] Открывалась уже ${cardAttempts[cardId] - 1} раза — похоже на зацикливание, пропускаем её.`);
        await addHandledCardId(cardId);
        await returnToCRMAndEscape();
        processNextCard();
        return;
    }

    const cardTitleLink = card.querySelector('.crm-kanban-item-title');

    if (!cardTitleLink) {
        await addHandledCardId(cardId);
        processNextCard();
        return;
    }

    console.log(`[Бот ДЕБАГ] [Заявка ${cardId}] Открываем: ${cardTitleLink.innerText}`);
    cardTitleLink.click();

    waitForElementWithDebug(SELECTORS.bitrix.phoneWidget, PHONE_WAIT_MS, cardId)
        .then(async phoneElement => {
            let phoneNumber = phoneElement ? phoneElement.innerText.trim() : "";

            if (BOT_CONFIG.useTestPhone) {
                phoneNumber = BOT_CONFIG.testPhone;
                console.log(`[Бот ДЕБАГ] [Заявка ${cardId}] [ТЕСТ РЕЖИМ] Используем тестовый номер: ${phoneNumber}`);
            }

            if (!phoneNumber) {
                console.warn(`[Бот ДЕБАГ] [Заявка ${cardId}] Номер пустой. Пропускаем.`);
                await addHandledCardId(cardId);
                await returnToCRMAndEscape();
                processNextCard();
                return;
            }

            // Мессенджер Bitrix — только в боевом режиме "Новые" (в тестовом не трогаем реальный диалог)
            if (BOT_CONFIG.runMode === 'new' && !BOT_CONFIG.useTestPhone) {
                const messengerOk = await openMessengerAndAnswer(cardId);
                if (BOT_CONFIG.isPaused || !isScriptRunning || isStaleInstance()) return;
                if (!messengerOk) return; // пауза и алерт уже показаны внутри
            }

            const stateData = { phone: phoneNumber, cardId: cardId, config: BOT_CONFIG };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateData));
            await chrome.storage.local.set({ lastSent: false });

            chrome.runtime.sendMessage({
                action: "openWhatsAppAndSearch",
                data: stateData
            });
        })
        .catch(async err => {
            console.warn(`[Бот ДЕБАГ] [Заявка ${cardId}] Номера телефона нет — пропускаем без смены статуса.`);
            await addHandledCardId(cardId);
            await returnToCRMAndEscape();
            processNextCard();
        });
}

function proceedToNextCardFromStorage() {
    setTimeout(async () => {
        const st = await chrome.storage.local.get(['lastSent']);
        if (st.lastSent) {
            await chrome.storage.local.set({ lastSent: false });
            const ms = rand(...(BOT_CONFIG.useTestPhone ? DELAYS.testBetweenClients : DELAYS.betweenClients));
            console.log(`[Бот] Пауза ${Math.round(ms / 1000)} сек. перед следующим клиентом (чтобы WhatsApp не принял за спам). STOP прерывает паузу.`);
            await interruptibleSleep(ms);
        }
        processNextCard();
    }, 1000);
}

function isCardDateToday(card) {
    const el = card.querySelector(SELECTORS.bitrix.cardDate);
    const t = ((el && el.innerText) || '').trim().toLowerCase();
    if (!t) return false;
    const now = new Date();

    if (t.includes('сегодня')) return true;
    if (t.includes('вчера')) return false;

    if (t.includes('назад')) {
        const m = t.match(/(\d+)\s*(секунд|минут|час)/);
        if (!m) return true;
        const n = parseInt(m[1], 10);
        const ms = m[2] === 'час' ? n * 3600e3 : (m[2] === 'минут' ? n * 60e3 : n * 1e3);
        return sameDay(new Date(now.getTime() - ms), now);
    }

    let m = t.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return sameDay(new Date(+m[3], +m[2] - 1, +m[1]), now);

    m = t.match(/(\d{1,2})\s+([а-яё]+)/);
    if (m && RU_MONTHS[m[2]] !== undefined) {
        return sameDay(new Date(now.getFullYear(), RU_MONTHS[m[2]], +m[1]), now);
    }
    return false;
}

function isScrollableEl(el) {
    if (!el || el.scrollHeight <= el.clientHeight + 5) return false;
    const oy = getComputedStyle(el).overflowY;
    return oy === 'auto' || oy === 'scroll' || oy === 'overlay';
}

// Прокручиваемые контейнеры колонки: сама колонка, её потомки и предки (где именно скроллится канбан — зависит от версии Bitrix)
function getKanbanScrollers(column) {
    const found = new Set();
    const add = el => { if (isScrollableEl(el)) found.add(el); };
    add(column);
    column.querySelectorAll('*').forEach(add);
    let n = column.parentElement;
    while (n && n !== document.documentElement) { add(n); n = n.parentElement; }
    return Array.from(found);
}

function isColumnLoading(column) {
    return Array.from(column.querySelectorAll('[class*="loader"], [class*="preloader"], [class*="spinner"]')).some(isVisible);
}

async function loadAllColumnCards(column) {
    // Число в шапке колонки может быть суммой в тенге, а не количеством — используем, только если это чистое целое число
    const totalEl = column.querySelector('.main-kanban-column-total-item');
    const totalText = totalEl ? (totalEl.innerText || '').trim() : '';
    const total = /^\d+$/.test(totalText) ? parseInt(totalText, 10) : NaN;

    let prev = -1;
    let stable = 0;
    for (let i = 0; i < 60; i++) {
        if (BOT_CONFIG.isPaused || !isScriptRunning) return;
        const items = column.querySelectorAll(SELECTORS.bitrix.cards);
        const count = items.length;
        if (!isNaN(total) && count >= total) break;

        if (count === prev && !isColumnLoading(column)) {
            stable++;
            if (stable >= 5) break;
        } else {
            if (count !== prev) stable = 0;
            prev = count;
        }

        const scrollers = getKanbanScrollers(column);
        if (i === 0 || i % 10 === 0) {
            console.log(`[Бот ДЕБАГ] Прокрутка колонки: контейнеров ${scrollers.length}, карточек ${count}`,
                scrollers.map(sc => `${sc.tagName}.${String(sc.className).split(' ').slice(0, 2).join('.')} ${sc.scrollHeight}/${sc.clientHeight}`));
        }
        for (const sc of scrollers) {
            sc.scrollTop = sc.scrollHeight;
            sc.dispatchEvent(new Event('scroll', { bubbles: true }));
            sc.dispatchEvent(new WheelEvent('wheel', { deltaY: 400, bubbles: true }));
        }
        if (items.length) items[items.length - 1].scrollIntoView({ block: 'end' });
        await sleep(1200);
    }
    console.log(`[Бот ДЕБАГ] Колонка догружена: карточек ${column.querySelectorAll(SELECTORS.bitrix.cards).length}` + (isNaN(total) ? '' : ` из ${total}`));
}
