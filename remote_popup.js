window.addEventListener('error', (event) => {
    console.error('[Popup Error]', event.message, event.filename, event.lineno);
    const st = document.getElementById('statusText');
    if (st) {
        st.textContent = 'Ошибка попапа: ' + event.message;
        st.style.color = '#d9363e';
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('[Popup Promise Rejection]', event.reason);
});

document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_HOTKEYS = {
        firstTouch: { ctrlKey: true, altKey: true, shiftKey: false, code: 'Enter', label: 'Ctrl+Alt+Enter' },
        touch1: { ctrlKey: true, altKey: true, shiftKey: true, code: 'Enter', label: 'Ctrl+Alt+Shift+Enter' },
        touch2: { ctrlKey: true, altKey: true, shiftKey: false, code: 'Digit2', label: 'Ctrl+Alt+2' }
    };

    const DEFAULT_ITEMS = {
        firstTouch: [
            { id: 'ft_1', type: 'text', text: 'Здравствуйте! Меня зовут Алина, менеджер компании Elki.kz 🎄 Отправляю Вам наш прайс-лист с нашими вариантами' },
            { id: 'ft_2', type: 'text', text: 'Ознакомьтесь, как будут вопросы - я на связи \nЕсть видео и фото почти на все модели, если нужны будут - напишите название - я отправлю' },
            { id: 'ft_3', type: 'file', fileId: '__DEFAULT_PRICE__', fileName: 'price.pdf', mimeType: 'application/pdf', base64: null }
        ],
        touch1: [
            { id: 't1_1', type: 'text', text: 'Здравствуйте! Хотела узнать, удалось ли Вам посмотреть наш прайс-лист? Может, уже присмотрели себе ёлочку? Если есть вопросы или нужна помощь с выбором, я с удовольствием подскажу и помогу найти ту самую ёлочку для Вашего дома 🎄🤗' }
        ],
        touch2: [
            { id: 't2_1', type: 'text', text: 'Здравствуйте! Напоминаю о себе — остались ли вопросы по прайсу и моделям ёлочек? 🎄' }
        ]
    };

    const EDITOR_TITLES = {
        firstTouch: 'Новым: сценарий',
        touch1: '1-му касанию: сценарий',
        touch2: '2-му касанию: сценарий'
    };

    const MODE_LABELS = {
        new: 'Новая',
        touch1: '1 касание',
        touch2: '2 касание'
    };

    const views = {
        home: document.getElementById('view-home'),
        choose: document.getElementById('view-choose-type'),
        editor: document.getElementById('view-editor')
    };

    const modeSelect = document.getElementById('modeSelect');
    const testModeCheck = document.getElementById('testModeCheck');
    const testPhoneInput = document.getElementById('testPhoneInput');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusText = document.getElementById('statusText');

    const openEditMenuBtn = document.getElementById('openEditMenuBtn');
    const backToHomeBtn = document.getElementById('backToHomeBtn');
    const pickFirstTouchBtn = document.getElementById('pickFirstTouchBtn');
    const pickTouch1Btn = document.getElementById('pickTouch1Btn');
    const pickTouch2Btn = document.getElementById('pickTouch2Btn');
    const backToChooseBtn = document.getElementById('backToChooseBtn');

    const editorTitle = document.getElementById('editorTitle');
    const hotkeyInput = document.getElementById('hotkeyInput');
    const recordHotkeyBtn = document.getElementById('recordHotkeyBtn');
    const hotkeyHint = document.getElementById('hotkeyHint');
    const addTextBtn = document.getElementById('addTextBtn');
    const addFileBtn = document.getElementById('addFileBtn');
    const addAlbumBtn = document.getElementById('addAlbumBtn');
    const editorFileInput = document.getElementById('editorFileInput');
    const stepsList = document.getElementById('stepsList');
    const saveFlowBtn = document.getElementById('saveFlowBtn');
    const resetFlowBtn = document.getElementById('resetFlowBtn');
    const editorStatus = document.getElementById('editorStatus');

    let currentFlowKey = 'firstTouch';
    let isRecordingHotkey = false;
    let pendingFileTargetIndex = null;
    let pendingAlbumTargetIndex = null;
    let textSaveTimer = null;

    let flowConfig = {
        hotkeys: {
            firstTouch: { ...DEFAULT_HOTKEYS.firstTouch },
            touch1: { ...DEFAULT_HOTKEYS.touch1 },
            touch2: { ...DEFAULT_HOTKEYS.touch2 }
        },
        flows: {
            firstTouch: { items: DEFAULT_ITEMS.firstTouch.map(x => ({ ...x })) },
            touch1: { items: DEFAULT_ITEMS.touch1.map(x => ({ ...x })) },
            touch2: { items: DEFAULT_ITEMS.touch2.map(x => ({ ...x })) }
        }
    };

    function showView(name) {
        isRecordingHotkey = false;
        if (recordHotkeyBtn) recordHotkeyBtn.textContent = 'Записать';
        Object.values(views).forEach(v => {
            if (v) v.classList.remove('active');
        });
        if (views[name]) views[name].classList.add('active');
    }

    function postToParent(payload) {
        try {
            window.parent.postMessage({ source: 'BTX_REMOTE_POPUP', payload }, '*');
        } catch (e) {
            console.error('[Popup] Ошибка postMessage:', e);
        }
    }

    function persistFlowConfig(statusMsg = '') {
        const payload = {
            hotkeys: flowConfig.hotkeys,
            flows: flowConfig.flows,
            updatedAt: Date.now()
        };
        postToParent({
            action: 'SAVE_CUSTOM_FLOW',
            payload
        });
        if (statusMsg && editorStatus) {
            editorStatus.textContent = statusMsg;
            setTimeout(() => {
                if (editorStatus.textContent === statusMsg) editorStatus.textContent = '';
            }, 2500);
        }
    }

    function scheduleTextPersist() {
        clearTimeout(textSaveTimer);
        textSaveTimer = setTimeout(() => {
            persistFlowConfig();
        }, 300);
    }

    function mergeFlowConfig(incoming) {
        if (!incoming || typeof incoming !== 'object') return;
        flowConfig = {
            hotkeys: {
                firstTouch: { ...DEFAULT_HOTKEYS.firstTouch, ...(incoming.hotkeys && incoming.hotkeys.firstTouch) },
                touch1: { ...DEFAULT_HOTKEYS.touch1, ...(incoming.hotkeys && incoming.hotkeys.touch1) },
                touch2: { ...DEFAULT_HOTKEYS.touch2, ...(incoming.hotkeys && incoming.hotkeys.touch2) }
            },
            flows: {
                firstTouch: {
                    items: Array.isArray(incoming.flows && incoming.flows.firstTouch && incoming.flows.firstTouch.items)
                        ? incoming.flows.firstTouch.items.map(x => ({ ...x }))
                        : DEFAULT_ITEMS.firstTouch.map(x => ({ ...x }))
                },
                touch1: {
                    items: Array.isArray(incoming.flows && incoming.flows.touch1 && incoming.flows.touch1.items)
                        ? incoming.flows.touch1.items.map(x => ({ ...x }))
                        : DEFAULT_ITEMS.touch1.map(x => ({ ...x }))
                },
                touch2: {
                    items: Array.isArray(incoming.flows && incoming.flows.touch2 && incoming.flows.touch2.items)
                        ? incoming.flows.touch2.items.map(x => ({ ...x }))
                        : DEFAULT_ITEMS.touch2.map(x => ({ ...x }))
                }
            }
        };
    }

    function applyLoadedState(state) {
        if (!state || typeof state !== 'object') return;
        if (state.runMode && modeSelect) modeSelect.value = state.runMode;
        if (typeof state.useTestPhone === 'boolean' && testModeCheck) testModeCheck.checked = state.useTestPhone;
        if (state.testPhone && testPhoneInput) testPhoneInput.value = state.testPhone;
        if (state.customFlow) {
            mergeFlowConfig(state.customFlow);
            if (views.editor && views.editor.classList.contains('active')) {
                const hk = flowConfig.hotkeys[currentFlowKey] || DEFAULT_HOTKEYS[currentFlowKey];
                hotkeyInput.value = hk.label || '';
                renderSteps();
            }
        }
    }

    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object' || msg.source !== 'BTX_POPUP_HOST') return;
        if (msg.action === 'POPUP_STATE_LOADED') {
            applyLoadedState(msg.payload);
        }
    });

    function formatHotkeyEvent(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');

        const ignoredCodes = new Set([
            'ControlLeft', 'ControlRight',
            'AltLeft', 'AltRight',
            'ShiftLeft', 'ShiftRight',
            'MetaLeft', 'MetaRight'
        ]);
        if (ignoredCodes.has(e.code)) return null;

        let keyName = e.code || e.key;
        if (keyName.startsWith('Key')) keyName = keyName.slice(3);
        else if (keyName.startsWith('Digit')) keyName = keyName.slice(5);
        else if (keyName === 'NumpadEnter') keyName = 'Enter';

        parts.push(keyName);
        return {
            ctrlKey: Boolean(e.ctrlKey),
            altKey: Boolean(e.altKey),
            shiftKey: Boolean(e.shiftKey),
            metaKey: Boolean(e.metaKey),
            code: e.code,
            label: parts.join('+')
        };
    }

    function getActiveItems() {
        return flowConfig.flows[currentFlowKey].items;
    }

    function renderSteps() {
        const items = getActiveItems();
        stepsList.innerHTML = '';

        if (!items.length) {
            stepsList.innerHTML = '<div class="hint" style="text-align:center;">Список пуст. Нажмите «+ Текст», «+ Файл» или «+ Фото с текстом».</div>';
            return;
        }

        items.forEach((item, idx) => {
            const card = document.createElement('div');
            card.className = 'step-card';

            const head = document.createElement('div');
            head.className = 'step-head';

            const title = document.createElement('span');
            const typeLabel = item.type === 'file'
                ? 'Файл'
                : (item.type === 'images_with_text' ? 'Фото с текстом' : 'Текст');
            title.textContent = `#${idx + 1} · ${typeLabel}`;

            const actions = document.createElement('div');
            actions.className = 'step-actions';

            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.className = 'icon-btn';
            upBtn.textContent = '▲';
            upBtn.disabled = idx === 0;
            upBtn.addEventListener('click', () => {
                if (idx === 0) return;
                const tmp = items[idx - 1];
                items[idx - 1] = items[idx];
                items[idx] = tmp;
                renderSteps();
                persistFlowConfig('Порядок сохранён ✅');
            });

            const downBtn = document.createElement('button');
            downBtn.type = 'button';
            downBtn.className = 'icon-btn';
            downBtn.textContent = '▼';
            downBtn.disabled = idx === items.length - 1;
            downBtn.addEventListener('click', () => {
                if (idx >= items.length - 1) return;
                const tmp = items[idx + 1];
                items[idx + 1] = items[idx];
                items[idx] = tmp;
                renderSteps();
                persistFlowConfig('Порядок сохранён ✅');
            });

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'icon-btn danger';
            delBtn.textContent = '✕';
            delBtn.addEventListener('click', () => {
                items.splice(idx, 1);
                renderSteps();
                persistFlowConfig('Элемент удалён ✅');
            });

            actions.append(upBtn, downBtn, delBtn);
            head.append(title, actions);
            card.appendChild(head);

            if (item.type === 'text') {
                const ta = document.createElement('textarea');
                ta.value = item.text || '';
                ta.placeholder = 'Введите текст сообщения...';
                ta.addEventListener('input', (e) => {
                    item.text = e.target.value;
                    scheduleTextPersist();
                });
                card.appendChild(ta);
            } else if (item.type === 'images_with_text') {
                const imgs = Array.isArray(item.images) ? item.images : [];
                const meta = document.createElement('div');
                meta.className = 'file-meta';
                meta.textContent = imgs.length
                    ? `Фото (${imgs.length}): ${imgs.map(f => f.name).join(', ')}`
                    : 'Фото не выбраны (нажмите «Выбрать фото»)';

                const chooseBtn = document.createElement('button');
                chooseBtn.type = 'button';
                chooseBtn.className = 'btn-secondary btn-small';
                chooseBtn.style.marginTop = '6px';
                chooseBtn.textContent = 'Выбрать фото';
                chooseBtn.addEventListener('click', () => {
                    pendingFileTargetIndex = null;
                    pendingAlbumTargetIndex = idx;
                    editorFileInput.accept = 'image/*';
                    editorFileInput.value = '';
                    editorFileInput.click();
                });

                const captionTa = document.createElement('textarea');
                captionTa.style.marginTop = '6px';
                captionTa.value = item.text || '';
                captionTa.placeholder = 'Текст к фотографиям (необязательно)...';
                captionTa.addEventListener('input', (e) => {
                    item.text = e.target.value;
                    scheduleTextPersist();
                });

                card.append(meta, chooseBtn, captionTa);
            } else {
                const meta = document.createElement('div');
                meta.className = 'file-meta';
                meta.textContent = item.fileName
                    ? `Файл: ${item.fileName}`
                    : 'Файл не выбран (будет использован price.pdf по умолчанию)';

                const chooseBtn = document.createElement('button');
                chooseBtn.type = 'button';
                chooseBtn.className = 'btn-secondary btn-small';
                chooseBtn.style.marginTop = '6px';
                chooseBtn.textContent = 'Выбрать файл';
                chooseBtn.addEventListener('click', () => {
                    pendingAlbumTargetIndex = null;
                    pendingFileTargetIndex = idx;
                    editorFileInput.accept = '';
                    editorFileInput.value = '';
                    editorFileInput.click();
                });

                card.append(meta, chooseBtn);
            }

            stepsList.appendChild(card);
        });
    }

    function openEditor(flowKey) {
        currentFlowKey = flowKey;
        editorStatus.textContent = '';
        editorTitle.textContent = EDITOR_TITLES[flowKey] || 'Редактор';
        const hk = flowConfig.hotkeys[flowKey] || DEFAULT_HOTKEYS[flowKey];
        hotkeyInput.value = hk.label || '';
        renderSteps();
        showView('editor');
    }

    if (openEditMenuBtn) openEditMenuBtn.addEventListener('click', () => showView('choose'));
    if (backToHomeBtn) backToHomeBtn.addEventListener('click', () => showView('home'));
    if (pickFirstTouchBtn) pickFirstTouchBtn.addEventListener('click', () => openEditor('firstTouch'));
    if (pickTouch1Btn) pickTouch1Btn.addEventListener('click', () => openEditor('touch1'));
    if (pickTouch2Btn) pickTouch2Btn.addEventListener('click', () => openEditor('touch2'));
    if (backToChooseBtn) backToChooseBtn.addEventListener('click', () => showView('choose'));

    if (recordHotkeyBtn) {
        recordHotkeyBtn.addEventListener('click', () => {
            isRecordingHotkey = !isRecordingHotkey;
            recordHotkeyBtn.textContent = isRecordingHotkey ? 'Нажмите...' : 'Записать';
            hotkeyHint.textContent = isRecordingHotkey
                ? 'Нажмите комбинацию клавиш (например, Ctrl+Alt+2)...'
                : 'Нажмите «Записать», затем нужную комбинацию.';
        });
    }

    window.addEventListener('keydown', (e) => {
        if (!isRecordingHotkey) return;
        e.preventDefault();
        e.stopPropagation();
        const parsed = formatHotkeyEvent(e);
        if (!parsed) return;
        flowConfig.hotkeys[currentFlowKey] = parsed;
        hotkeyInput.value = parsed.label;
        isRecordingHotkey = false;
        recordHotkeyBtn.textContent = 'Записать';
        hotkeyHint.textContent = `Сохранена клавиша: ${parsed.label}`;
        persistFlowConfig(`Клавиша ${parsed.label} сохранена ✅`);
    }, true);

    if (addTextBtn) {
        addTextBtn.addEventListener('click', () => {
            getActiveItems().push({
                id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                type: 'text',
                text: ''
            });
            renderSteps();
            persistFlowConfig('Блок текста добавлен ✅');
        });
    }

    if (addFileBtn) {
        addFileBtn.addEventListener('click', () => {
            getActiveItems().push({
                id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                type: 'file',
                fileId: null,
                fileName: null,
                mimeType: null,
                base64: null
            });
            renderSteps();
            persistFlowConfig('Блок файла добавлен ✅');
        });
    }

    if (addAlbumBtn) {
        addAlbumBtn.addEventListener('click', () => {
            getActiveItems().push({
                id: 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                type: 'images_with_text',
                images: [],
                text: ''
            });
            renderSteps();
            persistFlowConfig('Блок «Фото с текстом» добавлен ✅');
        });
    }

    if (editorFileInput) {
        editorFileInput.addEventListener('change', async () => {
            const files = Array.from(editorFileInput.files || []);
            if (!files.length) return;

            if (pendingAlbumTargetIndex !== null) {
                const targetIdx = pendingAlbumTargetIndex;
                pendingAlbumTargetIndex = null;
                editorStatus.textContent = `Читаю фото (${files.length} шт.)...`;

                const readOne = (f) => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        name: f.name,
                        mimeType: f.type || 'image/jpeg',
                        base64: reader.result
                    });
                    reader.onerror = () => reject(new Error(`Ошибка чтения ${f.name}`));
                    reader.readAsDataURL(f);
                });

                try {
                    const loadedImages = await Promise.all(files.map(readOne));
                    const items = getActiveItems();
                    if (items[targetIdx]) {
                        items[targetIdx] = {
                            ...items[targetIdx],
                            type: 'images_with_text',
                            images: loadedImages
                        };
                        renderSteps();
                        persistFlowConfig(`Фото (${loadedImages.length} шт.) сохранены ✅`);
                    }
                } catch (e) {
                    editorStatus.textContent = 'Ошибка при чтении фотографий.';
                }
                return;
            }

            if (pendingFileTargetIndex === null) return;
            const file = files[0];
            const targetIdx = pendingFileTargetIndex;
            pendingFileTargetIndex = null;
            editorStatus.textContent = `Читаю файл ${file.name}...`;

            const reader = new FileReader();
            reader.onload = () => {
                const items = getActiveItems();
                if (items[targetIdx]) {
                    items[targetIdx] = {
                        ...items[targetIdx],
                        type: 'file',
                        fileId: 'custom_' + Date.now(),
                        fileName: file.name,
                        mimeType: file.type || 'application/octet-stream',
                        base64: reader.result
                    };
                    renderSteps();
                    persistFlowConfig(`Файл «${file.name}» сохранён ✅`);
                }
            };
            reader.onerror = () => {
                editorStatus.textContent = 'Ошибка при чтении файла.';
            };
            reader.readAsDataURL(file);
        });
    }

    if (saveFlowBtn) {
        saveFlowBtn.addEventListener('click', () => {
            persistFlowConfig('Сценарий сохранён ✅');
        });
    }

    if (resetFlowBtn) {
        resetFlowBtn.addEventListener('click', () => {
            flowConfig.hotkeys[currentFlowKey] = { ...DEFAULT_HOTKEYS[currentFlowKey] };
            flowConfig.flows[currentFlowKey] = {
                items: DEFAULT_ITEMS[currentFlowKey].map(x => ({ ...x }))
            };
            hotkeyInput.value = flowConfig.hotkeys[currentFlowKey].label;
            renderSteps();
            persistFlowConfig('Сброшено к стандартному и сохранено ✅');
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            statusText.innerText = 'Остановлено пользователем.';
            statusText.style.color = '#ff4d4f';

            postToParent({
                action: 'STOP_BOT_FROM_POPUP'
            });
        });
    }

    function persistRunConfig(extra = {}) {
        const config = {
            runMode: modeSelect ? modeSelect.value : 'new',
            useTestPhone: testModeCheck ? Boolean(testModeCheck.checked) : false,
            testPhone: testPhoneInput ? testPhoneInput.value.trim() : '87781193946',
            ...extra
        };
        postToParent({
            action: 'SAVE_RUN_CONFIG',
            config
        });
        return config;
    }

    if (modeSelect) {
        modeSelect.addEventListener('change', () => {
            persistRunConfig();
            if (statusText) {
                statusText.textContent = `Выбрана колонка: ${MODE_LABELS[modeSelect.value] || modeSelect.value}`;
                statusText.style.color = '#1ebe5d';
            }
        });
    }

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const config = persistRunConfig({ isPaused: false });

            statusText.innerText = 'Запуск скрипта в Битриксе...';
            statusText.style.color = '#1ebe5d';

            postToParent({
                action: 'SAVE_RUN_CONFIG_AND_START',
                config
            });

            statusText.innerText = 'Команда отправлена. Не закрывайте вкладки.';
        });
    }

    postToParent({ action: 'LOAD_POPUP_STATE' });
});