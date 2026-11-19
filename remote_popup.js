document.addEventListener('DOMContentLoaded', async () => {
    const modeSelect = document.getElementById('modeSelect');
    const testModeCheck = document.getElementById('testModeCheck');
    const testPhoneInput = document.getElementById('testPhoneInput');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusText = document.getElementById('statusText');

    // Загружаем сохраненные ранее настройки из памяти
    const saved = await chrome.storage.local.get(['runMode', 'useTestPhone', 'testPhone']);
    if (saved.runMode) modeSelect.value = saved.runMode;
    if (typeof saved.useTestPhone === 'boolean') testModeCheck.checked = saved.useTestPhone;
    if (saved.testPhone) testPhoneInput.value = saved.testPhone;

    // Кнопка СТАРТ
    startBtn.addEventListener('click', async () => {
        const config = {
            runMode: modeSelect.value,
            useTestPhone: testModeCheck.checked,
            testPhone: testPhoneInput.value.trim(),
            isPaused: false
        };

        await chrome.storage.local.set(config);
        statusText.innerText = "Запуск скрипта в Битриксе...";
        statusText.style.color = "#1ebe5d";

        // Ищем активную вкладку Битрикса
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        if (!currentTab || !currentTab.url || !currentTab.url.includes("bitrix24")) {
            statusText.innerText = "Ошибка: откройте вкладку с Битриксом!";
            statusText.style.color = "#ff4d4f";
            return;
        }

        // Отправляем сигнал запуска в content.js на вкладке Битрикса
        chrome.tabs.sendMessage(currentTab.id, { action: "START_BOT", config: config }, (response) => {
            if (chrome.runtime.lastError) {
                statusText.innerText = "Обновите страницу Битрикса (F5) и попробуйте снова.";
                statusText.style.color = "#ff4d4f";
            } else {
                statusText.innerText = "Работает! Не закрывайте вкладки.";
            }
        });
    });

    // Кнопка СТОП
    stopBtn.addEventListener('click', async () => {
        await chrome.storage.local.set({ isPaused: true, botState: null });
        statusText.innerText = "Остановлено пользователем.";
        statusText.style.color = "#ff4d4f";

        // ВАЖНО: шаблон "*://*.bitrix24.*/*" недопустим (звёздочка в конце домена не разрешена),
        // из-за чего tabs.query падал с ошибкой и сообщение STOP_BOT никуда не уходило.
        // Поэтому берём все вкладки и фильтруем по адресу сами.
        let tabs = [];
        try {
            const allTabs = await chrome.tabs.query({});
            tabs = allTabs.filter(tab => tab.url && tab.url.includes("bitrix24"));
        } catch (e) {
            console.error("[Popup] Не удалось получить список вкладок:", e);
        }

        if (tabs.length === 0) {
            statusText.innerText = "Остановлено, но вкладка Битрикса не найдена.";
            return;
        }

        tabs.forEach(tab => {
            // .catch — чтобы не было ошибки на вкладках, где скрипт не загружен
            const p = chrome.tabs.sendMessage(tab.id, { action: "STOP_BOT" });
            if (p && p.catch) p.catch(() => {});
        });
    });
});