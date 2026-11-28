// =====================================================================================
// МОДУЛЬ 33_bitrix_sidebar_panel.js
// БОКОВАЯ ПАНЕЛЬ НА СТРАНИЦЕ BITRIX24 (не закрывается при потере фокуса и выборе файлов)
// Работает одинаково в Firefox и Chrome.
// =====================================================================================

(function () {
    if (!location.hostname.includes('bitrix24')) return;
    if (window.__elkiSidebarPanelInitialized) return;
    window.__elkiSidebarPanelInitialized = true;

    const PANEL_URL = 'https://ildarxxe.github.io/btx_plugin/popup_remote.html';
    const TOGGLE_ID = 'elki-sidebar-toggle-btn';
    const DRAWER_ID = 'elki-sidebar-drawer';
    const FRAME_ID = 'elki-sidebar-frame';
    const RUN_MODE_KEY = 'btx_run_mode';
    const TOUCH1_TARGET_KEY = 'btx_touch1_target_stage';
    const VALID_RUN_MODES = new Set(['new', 'touch1', 'touch2', 'touch3']);

    let isOpen = false;

    function readSavedRunMode() {
        try {
            if (typeof GM_getValue === 'function') {
                const v = GM_getValue(RUN_MODE_KEY);
                if (VALID_RUN_MODES.has(v)) return v;
            }
        } catch (e) {}
        return VALID_RUN_MODES.has(BOT_CONFIG.runMode) ? BOT_CONFIG.runMode : 'new';
    }

    function writeSavedRunMode(mode) {
        if (!VALID_RUN_MODES.has(mode)) return;
        BOT_CONFIG.runMode = mode;
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(RUN_MODE_KEY, mode);
            }
        } catch (e) {}
        try {
            chrome.storage.local.set({ runMode: mode });
        } catch (e) {}
    }

    function readSavedTouch1Target() {
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
        return BOT_CONFIG.touch1TargetStage || 'touch3';
    }

    async function writeSavedTouch1Target(target) {
        const normalized = (target === 'touch2' || target === 'close') ? target : 'touch3';
        BOT_CONFIG.touch1TargetStage = normalized;
        try {
            if (typeof setTouch1TargetStage === 'function') {
                await setTouch1TargetStage(normalized);
                return normalized;
            }
        } catch (e) {}
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(TOUCH1_TARGET_KEY, normalized);
            }
        } catch (e) {}
        try {
            chrome.storage.local.set({ touch1TargetStage: normalized });
        } catch (e) {}
        return normalized;
    }

    function createSidebarUI() {
        if (document.getElementById(TOGGLE_ID)) return;

        const oldBar = document.getElementById('elki-touch1-target-bar');
        if (oldBar) oldBar.remove();

        const toggleBtn = document.createElement('button');
        toggleBtn.id = TOGGLE_ID;
        toggleBtn.type = 'button';
        toggleBtn.textContent = 'BTX';
        toggleBtn.title = 'Открыть / скрыть панель рассылки (не закрывается при выборе файлов)';
        toggleBtn.style.cssText = [
            'position:fixed',
            'right:0',
            'top:45%',
            'transform:translateY(-50%)',
            'z-index:2147483646',
            'padding:10px 8px',
            'border:1px solid #1ebe5d',
            'border-right:none',
            'border-radius:8px 0 0 8px',
            'background:#25D366',
            'color:#fff',
            'font:700 12px/1 sans-serif',
            'cursor:pointer',
            'box-shadow:-2px 2px 10px rgba(0,0,0,0.2)'
        ].join(';');

        const drawer = document.createElement('div');
        drawer.id = DRAWER_ID;
        drawer.style.cssText = [
            'position:fixed',
            'top:0',
            'right:0',
            'width:360px',
            'max-width:95vw',
            'height:100vh',
            'z-index:2147483647',
            'background:#f9f9fb',
            'border-left:1px solid #d4d8df',
            'box-shadow:-4px 0 20px rgba(0,0,0,0.18)',
            'display:none',
            'flex-direction:column'
        ].join(';');

        const topBar = document.createElement('div');
        topBar.style.cssText = [
            'display:flex',
            'align-items:center',
            'justify-content:space-between',
            'gap:8px',
            'padding:8px 12px',
            'background:#1f242d',
            'color:#fff',
            'font:600 13px/1.2 sans-serif'
        ].join(';');

        const titleSpan = document.createElement('span');
        titleSpan.textContent = 'Панель рассылки';

        const controlsWrap = document.createElement('div');
        controlsWrap.style.cssText = 'display:flex;gap:6px;align-items:center;';

        const resetQueueBtn = document.createElement('button');
        resetQueueBtn.type = 'button';
        resetQueueBtn.textContent = 'Сбросить очередь';
        resetQueueBtn.title = 'Очистить список уже обработанных заявок и счётчик попыток';
        resetQueueBtn.style.cssText = [
            'padding:4px 8px',
            'border:1px solid #d69e2e',
            'border-radius:4px',
            'background:#b7791f',
            'color:#fff',
            'font-size:11px',
            'cursor:pointer'
        ].join(';');
        resetQueueBtn.addEventListener('click', async () => {
            if (typeof resetQueue === 'function') {
                await resetQueue();
            }
        });

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Скрыть панель';
        closeBtn.style.cssText = [
            'padding:4px 8px',
            'border:none',
            'border-radius:4px',
            'background:#e53e3e',
            'color:#fff',
            'font-size:12px',
            'cursor:pointer'
        ].join(';');
        closeBtn.addEventListener('click', () => setDrawerOpen(false));

        controlsWrap.append(resetQueueBtn, closeBtn);
        topBar.append(titleSpan, controlsWrap);

        const iframe = document.createElement('iframe');
        iframe.id = FRAME_ID;
        iframe.style.cssText = 'width:100%;flex:1;border:none;background:#f9f9fb;';

        drawer.append(topBar, iframe);
        document.body.append(toggleBtn, drawer);

        toggleBtn.addEventListener('click', () => setDrawerOpen(!isOpen));
    }

    async function sendStateToDrawerFrame() {
        const iframe = document.getElementById(FRAME_ID);
        if (!iframe || !iframe.contentWindow) return;

        if (typeof loadCustomFlowState === 'function') {
            await loadCustomFlowState();
        }
        const savedMode = readSavedRunMode();
        const savedTouch1Target = readSavedTouch1Target();
        BOT_CONFIG.runMode = savedMode;
        BOT_CONFIG.touch1TargetStage = savedTouch1Target;

        const statePayload = {
            runMode: savedMode,
            touch1TargetStage: savedTouch1Target,
            useTestPhone: Boolean(BOT_CONFIG.useTestPhone),
            testPhone: BOT_CONFIG.testPhone || '87781193946',
            customFlow: typeof customFlowState !== 'undefined' ? customFlowState : null
        };

        iframe.contentWindow.postMessage({
            source: 'BTX_POPUP_HOST',
            action: 'POPUP_STATE_LOADED',
            payload: statePayload
        }, '*');
    }

    function setDrawerOpen(open) {
        createSidebarUI();
        isOpen = Boolean(open);
        const drawer = document.getElementById(DRAWER_ID);
        const toggleBtn = document.getElementById(TOGGLE_ID);
        const iframe = document.getElementById(FRAME_ID);

        if (drawer) {
            if (isOpen) {
                drawer.style.display = 'flex';
                drawer.style.visibility = 'visible';
                drawer.style.pointerEvents = 'auto';
            } else {
                drawer.style.pointerEvents = 'none';
                drawer.style.visibility = 'hidden';
                drawer.style.display = 'none';
                void drawer.offsetHeight;
            }
        }

        if (toggleBtn) {
            toggleBtn.style.display = isOpen ? 'none' : 'block';
        }

        if (isOpen && iframe) {
            if (!iframe.src) {
                iframe.addEventListener('load', () => {
                    sendStateToDrawerFrame();
                }, { once: true });
                iframe.src = PANEL_URL + '?t=' + Date.now();
            } else {
                sendStateToDrawerFrame();
            }
        }
    }

    window.addEventListener('message', async (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object' || data.source !== 'BTX_REMOTE_POPUP' || !data.payload) return;

        const payload = data.payload;

        if (payload.action === 'LOAD_POPUP_STATE') {
            await sendStateToDrawerFrame();
            return;
        }

        if (payload.action === 'RESET_QUEUE') {
            if (typeof resetQueue === 'function') {
                await resetQueue();
            }
            return;
        }

        if (payload.action === 'SAVE_RUN_CONFIG' && payload.config) {
            if (payload.config.runMode) {
                writeSavedRunMode(payload.config.runMode);
            }
            if (payload.config.touch1TargetStage) {
                await writeSavedTouch1Target(payload.config.touch1TargetStage);
            }
            BOT_CONFIG = { ...BOT_CONFIG, ...payload.config };
            return;
        }

        if (payload.action === 'SAVE_CUSTOM_FLOW' && payload.payload) {
            if (typeof saveFlowToTmStorage === 'function') {
                saveFlowToTmStorage(payload.payload);
            }
            if (typeof loadCustomFlowState === 'function') {
                await loadCustomFlowState();
            }
            try {
                chrome.runtime.sendMessage({ action: 'SAVE_CUSTOM_FLOW', payload: payload.payload }, () => {
                    void chrome.runtime.lastError;
                });
            } catch (e) {}
            showBotToast('Сценарий и файлы сохранены ✅');
            return;
        }

        if (payload.action === 'SAVE_RUN_CONFIG_AND_START' && payload.config) {
            if (payload.config.runMode) {
                writeSavedRunMode(payload.config.runMode);
            }
            if (payload.config.touch1TargetStage) {
                await writeSavedTouch1Target(payload.config.touch1TargetStage);
            }
            BOT_CONFIG = { ...BOT_CONFIG, ...payload.config, isPaused: false };
            cardAttempts = {};
            startAutomation();
            return;
        }

        if (payload.action === 'STOP_BOT_FROM_POPUP') {
            if (typeof forceStopAutomation === 'function') {
                forceStopAutomation('кнопка СТОП в панели');
            } else {
                stopBot('кнопка СТОП в панели');
            }
        }
    });

    BOT_CONFIG.runMode = readSavedRunMode();
    BOT_CONFIG.touch1TargetStage = readSavedTouch1Target();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createSidebarUI, { once: true });
    } else {
        createSidebarUI();
    }
})();