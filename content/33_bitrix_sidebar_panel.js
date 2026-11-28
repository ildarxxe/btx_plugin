// =====================================================================================
// МОДУЛЬ 33_bitrix_sidebar_panel.js
// БОКОВАЯ ПАНЕЛЬ НА СТРАНИЦЕ BITRIX24 (режимы рассылки + редактирование сообщений для 3-го касания)
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
    const EDITOR_ID = 'elki-touch3-editor-box';
    const RUN_MODE_KEY = 'btx_run_mode';
    const TOUCH1_TARGET_KEY = 'btx_touch1_target_stage';
    const VALID_RUN_MODES = new Set(['new', 'touch1', 'touch2', 'touch3']);

    let isOpen = false;
    let isTouch3EditorOpen = false;

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
        const sel = document.getElementById('elki-sidebar-run-mode');
        if (sel && sel.value !== mode) {
            sel.value = mode;
        }
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

    function ensureTouch3FlowArray() {
        if (typeof customFlowState === 'undefined' || !customFlowState.flows) {
            return [];
        }
        if (!customFlowState.flows.touch3 || !Array.isArray(customFlowState.flows.touch3.items)) {
            customFlowState.flows.touch3 = { items: [] };
        }
        return customFlowState.flows.touch3.items;
    }

    function renderTouch3Editor() {
        const box = document.getElementById(EDITOR_ID);
        if (!box) return;

        if (!isTouch3EditorOpen) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }

        const items = ensureTouch3FlowArray();
        box.style.display = 'flex';
        box.innerHTML = '';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px;';

        const title = document.createElement('div');
        title.textContent = 'Сообщения сценария «3 касание»';
        title.style.cssText = 'font-weight:700;font-size:12px;color:#111827;';

        const addTextBtn = document.createElement('button');
        addTextBtn.type = 'button';
        addTextBtn.textContent = '+ Текст';
        addTextBtn.style.cssText = 'padding:3px 8px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#111827;font-size:11px;font-weight:600;cursor:pointer;';
        addTextBtn.addEventListener('click', () => {
            items.push({
                id: 't3_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                type: 'text',
                text: ''
            });
            renderTouch3Editor();
        });

        header.append(title, addTextBtn);
        box.append(header);

        const listWrap = document.createElement('div');
        listWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;padding-right:2px;';

        if (!items.length) {
            const emptyNote = document.createElement('div');
            emptyNote.textContent = 'Пока нет шагов. Нажмите «+ Текст», чтобы добавить сообщение для 3-го касания.';
            emptyNote.style.cssText = 'font-size:11px;color:#64748b;padding:8px;background:#fff;border:1px dashed #cbd5e1;border-radius:6px;';
            listWrap.append(emptyNote);
        } else {
            items.forEach((item, idx) => {
                const row = document.createElement('div');
                row.style.cssText = 'background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:6px;';

                const topRow = document.createElement('div');
                topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;';

                const badge = document.createElement('span');
                const kindLabel = item.type === 'file'
                    ? `Файл (${item.fileName || 'price.pdf'})`
                    : (item.type === 'images_with_text'
                        ? `Фото (${Array.isArray(item.images) ? item.images.length : 0} шт.) + текст`
                        : 'Текст');
                badge.textContent = `Шаг ${idx + 1}: ${kindLabel}`;
                badge.style.cssText = 'font-size:11px;font-weight:700;color:#334155;';

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.textContent = 'Удалить';
                delBtn.style.cssText = 'padding:2px 6px;border:1px solid #fecaca;border-radius:4px;background:#fef2f2;color:#b91c1c;font-size:10px;cursor:pointer;';
                delBtn.addEventListener('click', () => {
                    items.splice(idx, 1);
                    renderTouch3Editor();
                });

                topRow.append(badge, delBtn);
                row.append(topRow);

                if (item.type === 'text' || item.type === 'images_with_text') {
                    const ta = document.createElement('textarea');
                    ta.rows = 3;
                    ta.value = item.text || '';
                    ta.placeholder = 'Введите текст сообщения для 3 касания...';
                    ta.style.cssText = 'width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px;font:12px/1.35 sans-serif;color:#111827;resize:vertical;';
                    ta.addEventListener('input', () => {
                        item.text = ta.value;
                    });
                    row.append(ta);
                }

                listWrap.append(row);
            });
        }

        box.append(listWrap);

        const footer = document.createElement('div');
        footer.style.cssText = 'display:flex;gap:6px;margin-top:8px;';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = 'Сохранить 3 касание';
        saveBtn.style.cssText = 'flex:1;padding:6px 8px;border:none;border-radius:5px;background:#16a34a;color:#fff;font-size:11px;font-weight:700;cursor:pointer;';
        saveBtn.addEventListener('click', async () => {
            if (typeof customFlowState !== 'undefined') {
                if (typeof saveFlowToTmStorage === 'function') {
                    saveFlowToTmStorage(customFlowState);
                }
                try {
                    if (typeof CUSTOM_FLOW_STORAGE_KEY !== 'undefined') {
                        await chrome.storage.local.set({ [CUSTOM_FLOW_STORAGE_KEY]: customFlowState });
                    }
                } catch (e) {}
                if (typeof loadCustomFlowState === 'function') {
                    await loadCustomFlowState();
                }
            }
            if (typeof showBotToast === 'function') {
                showBotToast('Сообщения для 3-го касания сохранены ✅');
            }
            await sendStateToDrawerFrame();
        });

        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.textContent = 'Скрыть';
        hideBtn.style.cssText = 'padding:6px 8px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;color:#334155;font-size:11px;font-weight:600;cursor:pointer;';
        hideBtn.addEventListener('click', () => {
            isTouch3EditorOpen = false;
            renderTouch3Editor();
        });

        footer.append(saveBtn, hideBtn);
        box.append(footer);
    }

    async function toggleTouch3Editor() {
        if (!isTouch3EditorOpen && typeof loadCustomFlowState === 'function') {
            await loadCustomFlowState();
        }
        isTouch3EditorOpen = !isTouch3EditorOpen;
        renderTouch3Editor();
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
            'gap:6px',
            'padding:6px 10px',
            'background:#1f242d',
            'color:#fff',
            'font:600 12px/1.2 sans-serif'
        ].join(';');

        const titleSpan = document.createElement('span');
        titleSpan.textContent = 'Панель рассылки';

        const controlsWrap = document.createElement('div');
        controlsWrap.style.cssText = 'display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end;';

        const runModeSelect = document.createElement('select');
        runModeSelect.id = 'elki-sidebar-run-mode';
        runModeSelect.title = 'Режим рассылки по колонкам';
        runModeSelect.style.cssText = [
            'padding:3px 6px',
            'border:1px solid #4a5568',
            'border-radius:4px',
            'background:#111827',
            'color:#fff',
            'font-size:11px',
            'cursor:pointer'
        ].join(';');
        runModeSelect.innerHTML = `
            <option value="new">Режим: Новые</option>
            <option value="touch1">Режим: 1 касание</option>
            <option value="touch2">Режим: 2 касание</option>
            <option value="touch3">Режим: 3 касание</option>
        `;
        runModeSelect.value = readSavedRunMode();
        runModeSelect.addEventListener('change', async () => {
            writeSavedRunMode(runModeSelect.value);
            await sendStateToDrawerFrame();
        });

        const touch1TargetSelect = document.createElement('select');
        touch1TargetSelect.id = 'elki-sidebar-touch1-target';
        touch1TargetSelect.title = 'Куда переводить заявку после 1 касания';
        touch1TargetSelect.style.cssText = [
            'padding:3px 6px',
            'border:1px solid #4a5568',
            'border-radius:4px',
            'background:#111827',
            'color:#fff',
            'font-size:11px',
            'cursor:pointer'
        ].join(';');
        touch1TargetSelect.innerHTML = `
            <option value="touch2">→ 2 касание</option>
            <option value="touch3">→ 3 касание</option>
            <option value="close">→ Закрыть</option>
        `;
        touch1TargetSelect.value = readSavedTouch1Target();
        touch1TargetSelect.addEventListener('change', async () => {
            await writeSavedTouch1Target(touch1TargetSelect.value);
            if (typeof showBotToast === 'function') {
                const labels = { touch2: '2 касание', touch3: '3 касание', close: 'Закрыть' };
                showBotToast(`После 1 касания → ${labels[touch1TargetSelect.value] || touch1TargetSelect.value}`);
            }
        });

        const editTouch3Btn = document.createElement('button');
        editTouch3Btn.type = 'button';
        editTouch3Btn.textContent = 'Текст 3 касания';
        editTouch3Btn.title = 'Редактировать сообщения сценария «3 касание»';
        editTouch3Btn.style.cssText = [
            'padding:3px 7px',
            'border:1px solid #3b82f6',
            'border-radius:4px',
            'background:#1d4ed8',
            'color:#fff',
            'font-size:11px',
            'cursor:pointer'
        ].join(';');
        editTouch3Btn.addEventListener('click', toggleTouch3Editor);

        const resetQueueBtn = document.createElement('button');
        resetQueueBtn.type = 'button';
        resetQueueBtn.textContent = 'Сбросить очередь';
        resetQueueBtn.title = 'Очистить список уже обработанных заявок и счётчик попыток';
        resetQueueBtn.style.cssText = [
            'padding:3px 7px',
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
            'padding:3px 8px',
            'border:none',
            'border-radius:4px',
            'background:#e53e3e',
            'color:#fff',
            'font-size:12px',
            'cursor:pointer'
        ].join(';');
        closeBtn.addEventListener('click', () => setDrawerOpen(false));

        controlsWrap.append(runModeSelect, touch1TargetSelect, editTouch3Btn, resetQueueBtn, closeBtn);
        topBar.append(titleSpan, controlsWrap);

        const editorBox = document.createElement('div');
        editorBox.id = EDITOR_ID;
        editorBox.style.cssText = [
            'display:none',
            'flex-direction:column',
            'padding:8px 10px',
            'background:#eef2ff',
            'border-bottom:1px solid #c7d2fe'
        ].join(';');

        const iframe = document.createElement('iframe');
        iframe.id = FRAME_ID;
        iframe.style.cssText = 'width:100%;flex:1;border:none;background:#f9f9fb;';

        drawer.append(topBar, editorBox, iframe);
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

        const modeSel = document.getElementById('elki-sidebar-run-mode');
        if (modeSel) modeSel.value = savedMode;

        const targetSel = document.getElementById('elki-sidebar-touch1-target');
        if (targetSel) targetSel.value = savedTouch1Target;

        if (isTouch3EditorOpen) {
            renderTouch3Editor();
        }

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
                const norm = await writeSavedTouch1Target(payload.config.touch1TargetStage);
                const sel = document.getElementById('elki-sidebar-touch1-target');
                if (sel) sel.value = norm;
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
            if (isTouch3EditorOpen) {
                renderTouch3Editor();
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
                const norm = await writeSavedTouch1Target(payload.config.touch1TargetStage);
                const sel = document.getElementById('elki-sidebar-touch1-target');
                if (sel) sel.value = norm;
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