// =====================================================================================
// МОДУЛЬ 33_bitrix_sidebar_panel.js
// БОКОВАЯ ПАНЕЛЬ BTX НА СТРАНИЦЕ BITRIX24: РЕЖИМ, СТАДИЯ ПОСЛЕ 1 КАСАНИЯ, СТАРТ/СТОП, СБРОС ОЧЕРЕДИ И СЦЕНАРИИ
// =====================================================================================

(function initBitrixSidebarPanel() {
    if (!location.hostname.includes('bitrix24')) return;
    if (window.top !== window.self) return;

    const PANEL_HOST_ID = 'btx-sidebar-host';
    const SIDEBAR_OPEN_STORAGE_KEY = 'btx_sidebar_open_v1';
    const TOUCH1_TARGET_KEY = 'btx_touch1_target_stage';

    function getSavedTouch1Target() {
        try {
            if (typeof getTouch1TargetStage === 'function') {
                return getTouch1TargetStage();
            }
        } catch (e) {}
        try {
            if (typeof GM_getValue === 'function') {
                const v = GM_getValue(TOUCH1_TARGET_KEY);
                if (v === 'touch2' || v === 'touch3' || v === 'close') return v;
            }
        } catch (e) {}
        return (typeof BOT_CONFIG !== 'undefined' && BOT_CONFIG.touch1TargetStage) || 'touch3';
    }

    async function applyTouch1Target(val) {
        const normalized = (val === 'touch2' || val === 'close') ? val : 'touch3';
        if (typeof BOT_CONFIG !== 'undefined') {
            BOT_CONFIG.touch1TargetStage = normalized;
        }
        try {
            if (typeof setTouch1TargetStage === 'function') {
                await setTouch1TargetStage(normalized);
            } else {
                if (typeof GM_setValue === 'function') {
                    GM_setValue(TOUCH1_TARGET_KEY, normalized);
                }
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    const st = await chrome.storage.local.get([STORAGE_KEY]);
                    const prev = (st && st[STORAGE_KEY] && typeof st[STORAGE_KEY] === 'object') ? st[STORAGE_KEY] : {};
                    await chrome.storage.local.set({ [STORAGE_KEY]: { ...prev, touch1TargetStage: normalized } });
                }
            }
        } catch (e) {}
        window.postMessage({ source: 'BTX_SIDEBAR', action: 'SET_TOUCH1_TARGET_STAGE', value: normalized }, '*');
    }

    function applyRunMode(mode) {
        const m = mode === 'touch1' ? 'touch1' : 'new';
        if (typeof BOT_CONFIG !== 'undefined') {
            BOT_CONFIG.runMode = m;
        }
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue('btx_run_mode', m);
            }
        } catch (e) {}
        if (typeof showBotToast === 'function') {
            showBotToast(`Режим: ${m === 'new' ? 'Новые заявки' : '1 касание'}`);
        }
    }

    function getInitialRunMode() {
        try {
            if (typeof GM_getValue === 'function') {
                const saved = GM_getValue('btx_run_mode');
                if (saved === 'touch1' || saved === 'new') {
                    if (typeof BOT_CONFIG !== 'undefined') BOT_CONFIG.runMode = saved;
                    return saved;
                }
            }
        } catch (e) {}
        return (typeof BOT_CONFIG !== 'undefined' && BOT_CONFIG.runMode) || 'new';
    }

    function mountSidebar() {
        if (!document.body) return;
        if (document.getElementById(PANEL_HOST_ID)) return;

        // Удаляем старую плавающую плашку, если она осталась от предыдущей версии
        const oldBar = document.getElementById('elki-touch1-target-bar');
        if (oldBar) oldBar.remove();

        const host = document.createElement('div');
        host.id = PANEL_HOST_ID;
        host.style.cssText = 'position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147483645;';
        const shadow = host.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
            <style>
                * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                .wrap { display: flex; align-items: center; }
                .tab-btn {
                    background: #16a34a;
                    color: #fff;
                    border: none;
                    border-radius: 8px 0 0 8px;
                    padding: 10px 7px;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    cursor: pointer;
                    box-shadow: -2px 2px 10px rgba(0,0,0,0.25);
                    writing-mode: horizontal-tb;
                }
                .tab-btn:hover { background: #15803d; }
                .drawer {
                    width: 250px;
                    background: #181d26;
                    color: #f8fafc;
                    border: 1px solid #334155;
                    border-right: none;
                    border-radius: 12px 0 0 12px;
                    padding: 12px;
                    box-shadow: -6px 6px 24px rgba(0,0,0,0.4);
                    display: none;
                    flex-direction: column;
                    gap: 10px;
                }
                .drawer.open { display: flex; }
                .header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid #2d3748;
                    padding-bottom: 7px;
                }
                .title { font-size: 13px; font-weight: 700; color: #fff; }
                .close-btn {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 0 4px;
                }
                .close-btn:hover { color: #fff; }
                .field { display: flex; flex-direction: column; gap: 4px; }
                .label { font-size: 11px; color: #94a3b8; font-weight: 600; }
                select {
                    width: 100%;
                    background: #0f172a;
                    color: #f8fafc;
                    border: 1px solid #334155;
                    border-radius: 7px;
                    padding: 6px 8px;
                    font-size: 12px;
                    outline: none;
                    cursor: pointer;
                }
                select:focus { border-color: #22c55e; }
                .row-btns { display: flex; gap: 6px; }
                .btn {
                    flex: 1;
                    border: none;
                    border-radius: 7px;
                    padding: 8px 6px;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    color: #fff;
                }
                .btn-start { background: #16a34a; }
                .btn-start:hover { background: #15803d; }
                .btn-stop { background: #dc2626; }
                .btn-stop:hover { background: #b91c1c; }
                .btn-sec {
                    width: 100%;
                    background: #27303f;
                    color: #e2e8f0;
                    border: 1px solid #3b4659;
                    border-radius: 7px;
                    padding: 7px 8px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-sec:hover { background: #323d50; }
                .hint {
                    font-size: 10px;
                    color: #64748b;
                    line-height: 1.35;
                    border-top: 1px solid #2d3748;
                    padding-top: 6px;
                }
            </style>
            <div class="wrap">
                <button class="tab-btn" id="btx-tab-toggle" title="Открыть панель BTX">BTX</button>
                <div class="drawer" id="btx-drawer">
                    <div class="header">
                        <span class="title">BTX Рассылка</span>
                        <button class="close-btn" id="btx-drawer-close" title="Свернуть">✕</button>
                    </div>

                    <div class="field">
                        <span class="label">Режим очереди</span>
                        <select id="btx-run-mode">
                            <option value="new">Новые заявки</option>
                            <option value="touch1">1 касание</option>
                        </select>
                    </div>

                    <div class="field">
                        <span class="label">После 1 касания переводить в</span>
                        <select id="btx-touch1-target">
                            <option value="touch2">2 касание</option>
                            <option value="touch3">3 касание</option>
                            <option value="close">Закрыть</option>
                        </select>
                    </div>

                    <div class="row-btns">
                        <button class="btn btn-start" id="btx-btn-start">▶ Старт</button>
                        <button class="btn btn-stop" id="btx-btn-stop">⏹ Стоп</button>
                    </div>

                    <button class="btn-sec" id="btx-btn-reset">🔄 Сбросить очередь</button>

                    <div class="hint">
                        Старт: Ctrl+Shift+= · Стоп: Ctrl+Shift+-<br>
                        Инстаграм без номера в «Новых» закрывается автоматически.
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(host);

        const toggleBtn = shadow.getElementById('btx-tab-toggle');
        const closeBtn = shadow.getElementById('btx-drawer-close');
        const drawer = shadow.getElementById('btx-drawer');
        const modeSelect = shadow.getElementById('btx-run-mode');
        const targetSelect = shadow.getElementById('btx-touch1-target');
        const startBtn = shadow.getElementById('btx-btn-start');
        const stopBtn = shadow.getElementById('btx-btn-stop');
        const resetBtn = shadow.getElementById('btx-btn-reset');

        const setDrawerOpen = (isOpen) => {
            drawer.classList.toggle('open', Boolean(isOpen));
            toggleBtn.style.display = isOpen ? 'none' : 'block';
            try {
                if (typeof GM_setValue === 'function') {
                    GM_setValue(SIDEBAR_OPEN_STORAGE_KEY, Boolean(isOpen));
                }
            } catch (e) {}
        };

        let initialOpen = false;
        try {
            if (typeof GM_getValue === 'function') {
                initialOpen = Boolean(GM_getValue(SIDEBAR_OPEN_STORAGE_KEY));
            }
        } catch (e) {}
        setDrawerOpen(initialOpen);

        modeSelect.value = getInitialRunMode();
        targetSelect.value = getSavedTouch1Target();

        toggleBtn.addEventListener('click', () => setDrawerOpen(true));
        closeBtn.addEventListener('click', () => setDrawerOpen(false));

        modeSelect.addEventListener('change', () => applyRunMode(modeSelect.value));
        targetSelect.addEventListener('change', () => applyTouch1Target(targetSelect.value));

        startBtn.addEventListener('click', () => {
            applyRunMode(modeSelect.value);
            if (typeof startAutomation === 'function') {
                startAutomation();
            }
        });

        stopBtn.addEventListener('click', () => {
            if (typeof forceStopAutomation === 'function') {
                forceStopAutomation('кнопка Стоп в панели BTX');
            }
        });

        resetBtn.addEventListener('click', () => {
            if (typeof resetQueue === 'function') {
                resetQueue();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountSidebar);
    } else {
        mountSidebar();
    }
    setInterval(mountSidebar, 3000);
})();