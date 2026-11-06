(function () {
    const CONV_KEY = 'nf.conversations', CURRENT_KEY = 'nf.current', PERSIST_KEY = 'nf.persist';
    const chatScroll = document.getElementById('chatScroll');
    const welcomeEl = document.getElementById('welcome');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const chatListEl = document.getElementById('chatList');
    const searchEl = document.getElementById('searchInput');
    const crisisOverlay = document.getElementById('crisisOverlay');
    const exportModal = document.getElementById('exportModal');

    let conversations = [], currentId = null, busy = false;

    // ── PWA & Auto Lock ──
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));
    }

    (function autoLock() {
        let idleTimer;
        const lockScreen = document.getElementById('lockScreen');
        const unlockBtn = document.getElementById('unlockBtn');
        function reset() {
            if (lockScreen.classList.contains('show')) return;
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => lockScreen.classList.add('show'), 15 * 60 * 1000);
        }
        unlockBtn.addEventListener('click', () => { lockScreen.classList.remove('show'); reset(); });
        ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => window.addEventListener(evt, reset, { passive: true }));
        reset();
    })();

    // ── Storage & Init ──
    function loadConversations() {
        try { const raw = localStorage.getItem(CONV_KEY); conversations = raw ? JSON.parse(raw) : []; } catch { conversations = []; }
        try { currentId = localStorage.getItem(CURRENT_KEY) || null; } catch { currentId = null; }
    }

    function saveConversations() {
        try {
            localStorage.setItem(CONV_KEY, JSON.stringify(conversations));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                ChatUI.toast('พื้นที่จัดเก็บเต็ม กำลังลบประวัติเก่า...');
                conversations = conversations.slice(0, 20);
                try { localStorage.setItem(CONV_KEY, JSON.stringify(conversations)); } catch { }
            }
        }
        try { if (currentId) localStorage.setItem(CURRENT_KEY, currentId); else localStorage.removeItem(CURRENT_KEY); } catch { }
    }

    function newConversation() {
        const id = 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const conv = { id, sessionId: null, title: 'บทสนทนาใหม่', messages: [], updated: Date.now() };
        conversations.unshift(conv); conversations = conversations.slice(0, 60); currentId = id; saveConversations(); return conv;
    }
    function currentConv() { return conversations.find((c) => c.id === currentId) || null; }

    // ── Render Functions ──
    function showWelcome(show) { welcomeEl.style.display = show ? '' : 'none'; }
    function renderMessages() {
        const conv = currentConv(); ChatUI.clear();
        if (!conv || !conv.messages.length) { showWelcome(true); return; }
        showWelcome(false);
        for (const m of conv.messages) {
            if (m.role === 'user') ChatUI.renderUser(m.content, m.ts);
            else ChatUI.renderBot(m.content, m.ts);
            if (m.resources && m.resources.length) ChatUI.renderResources(m.resources);
        }
        ChatUI.scrollBottom();
    }
    function renderChatList() {
        const q = searchEl.value.trim().toLowerCase(); chatListEl.innerHTML = '';
        const list = conversations.filter((c) => {
            if (!q) return true;
            if (c.title && c.title.toLowerCase().includes(q)) return true;
            if (Array.isArray(c.messages) && c.messages.some((m) => m.content && m.content.toLowerCase().includes(q))) return true;
            return false;
        });
        if (!list.length) {
            const empty = document.createElement('div'); empty.className = 'chat-list-empty'; empty.textContent = q ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีบทสนทนา'; chatListEl.appendChild(empty); return;
        }
        for (const conv of list) {
            const item = document.createElement('div');
            item.className = 'chat-item' + (conv.id === currentId ? ' active' : '');
            item.setAttribute('role', 'button'); item.tabIndex = 0; item.dataset.id = conv.id;
            item.innerHTML = `<i data-lucide="message-square"></i><span class="chat-item-title"></span><button class="chat-item-del" aria-label="ลบบทสนทนา"><i data-lucide="x"></i></button>`;
            item.querySelector('.chat-item-title').textContent = conv.title; chatListEl.appendChild(item);
        }
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }
    function renderAll() { renderChatList(); renderMessages(); }

    // ── API Integration ──
    async function ensureSession(conv) {
        if (conv.sessionId && !conv.sessionId.startsWith('local-')) return conv.sessionId;
        const r = await fetch('/api/new-session', { method: 'POST' });
        if (!r.ok) throw new Error('Cannot create session');
        const d = await r.json();
        conv.sessionId = d.session_id; saveConversations(); return conv.sessionId;
    }

    async function sendToServer(conv, message) {
        const sid = await ensureSession(conv);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const r = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sid, message }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (r.status === 429) return { rateLimited: true };
            if (!r.ok) throw new Error('API Error ' + r.status);
            return r.json();
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') throw new Error('Request timeout');
            throw e;
        }
    }

    // ── Send Message Logic ──
    async function sendMessage() {
        if (busy) return;
        const text = inputEl.value.trim();
        if (!text) return;

        let conv = currentConv();
        if (!conv) conv = newConversation();
        if (conv.messages.length === 0) conv.title = text.slice(0, 34) + (text.length > 34 ? '…' : '');

        const userTs = Date.now();
        conv.messages.push({ role: 'user', content: text, ts: userTs });

        if (conv.messages.length > 100) conv.messages = conv.messages.slice(-100);

        conv.updated = Date.now(); saveConversations();

        ChatUI.renderUser(text, userTs);
        showWelcome(false);
        inputEl.value = ''; autoResize();

        busy = true;
        sendBtn.disabled = true;
        inputEl.disabled = true;
        ChatUI.renderTyping();

        const activeConv = conv;

        try {
            const data = await sendToServer(activeConv, text);

            if (data.rateLimited) {
                const botTs = Date.now(); const reply = 'ใจเย็น ๆ นะ ฟ้าขอหายใจก่อน พิมพ์ช้า ๆ ก็ได้';
                activeConv.messages.push({ role: 'assistant', content: reply, ts: botTs });
                saveConversations();

                if (activeConv.id === currentId) {
                    ChatUI.removeTyping();
                    ChatUI.renderBot(reply, botTs);
                }
                return;
            }

            const reply = data.reply || '...';
            const botTs = Date.now();
            const resources = data.resources || [];

            activeConv.messages.push({ role: 'assistant', content: reply, ts: botTs, resources });
            activeConv.updated = Date.now();
            saveConversations();

            if (activeConv.id === currentId) {
                ChatUI.removeTyping();
                if (data.crisis_tier >= 3) crisisOverlay.hidden = false;
                ChatUI.renderBot(reply, botTs);
                if (resources.length) ChatUI.renderResources(resources);
            }
            renderChatList();

        } catch (e) {
            console.error(e);
            const fallback = e.message === 'Request timeout'
                ? 'ฟ้ารอนานเกินไปแล้ว แต่ยังอยู่นี่นะ ลองพิมพ์อีกครั้งได้ไหม'
                : 'ฟ้ายังอยู่นี่ แต่ตอนนี้เชื่อมต่อไม่ได้ ถ้าเร่งด่วนโทร 1323 ได้เลย';

            const botTs = Date.now();
            activeConv.messages.push({ role: 'assistant', content: fallback, ts: botTs });
            saveConversations();

            if (activeConv.id === currentId) {
                ChatUI.removeTyping();
                ChatUI.renderBot(fallback, botTs);
            }
        } finally {
            busy = false;
            sendBtn.disabled = !inputEl.value.trim();
            inputEl.disabled = false;
            inputEl.focus();
        }
    }

    // ── Event Listeners (Message Actions) ──
    document.getElementById('messages').addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (busy) {
            ChatUI.toast('กรุณารอน้องฟ้าตอบสักครู่');
            return;
        }
        const row = btn.closest('.row');
        if (!row) return;
        const conv = currentConv();
        if (!conv) return;
        const ts = Number(row.dataset.ts);
        const idx = conv.messages.findIndex((m) => m.ts === ts);
        if (idx < 0) return;
        const msg = conv.messages[idx];
        const action = btn.dataset.action;

        if (action === 'copy') {
            try { await navigator.clipboard.writeText(msg.content); ChatUI.toast('คัดลอกแล้ว'); }
            catch { ChatUI.toast('คัดลอกไม่สำเร็จ'); }
            return;
        }
        if (action === 'delete') {
            conv.messages.splice(idx, 1); conv.updated = Date.now(); saveConversations(); renderMessages(); return;
        }
        if (action === 'edit' && msg.role === 'user') {
            const next = prompt('แก้ไขข้อความ:', msg.content); if (next === null) return;
            const trimmed = next.trim(); if (!trimmed || trimmed === msg.content) return;
            // Truncate from this message onwards, let sendMessage push and render cleanly
            conv.messages = conv.messages.slice(0, idx);
            conv.updated = Date.now(); saveConversations(); renderMessages();
            inputEl.value = trimmed; autoResize(); sendMessage(); return;
        }
        if (action === 'regenerate' && msg.role === 'assistant') {
            let u = idx - 1; while (u >= 0 && conv.messages[u].role !== 'user') u--;
            if (u < 0) return; const originalText = conv.messages[u].content;
            conv.messages = conv.messages.slice(0, u); conv.updated = Date.now(); saveConversations(); renderMessages();
            inputEl.value = originalText; autoResize(); sendMessage(); return;
        }
    });

    // ── Chat List ──
    chatListEl.addEventListener('click', (e) => {
        const del = e.target.closest('.chat-item-del');
        if (del) {
            e.stopPropagation(); const item = del.closest('.chat-item'); const id = item.dataset.id;
            if (!confirm('ลบบทสนทนานี้?')) return;
            conversations = conversations.filter((c) => c.id !== id); if (currentId === id) currentId = conversations[0]?.id || null;
            saveConversations(); renderAll(); return;
        }
        const item = e.target.closest('.chat-item'); if (!item) return;
        currentId = item.dataset.id; saveConversations(); renderAll(); closeDrawerIfMobile();
    });
    chatListEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const item = e.target.closest('.chat-item'); if (!item) return;
        e.preventDefault(); currentId = item.dataset.id; saveConversations(); renderAll();
    });
    searchEl.addEventListener('input', renderChatList);

    // ── Input Events ──
    function autoResize() { inputEl.style.height = 'auto'; inputEl.style.height = Math.min(180, inputEl.scrollHeight) + 'px'; }
    inputEl.addEventListener('input', () => { autoResize(); sendBtn.disabled = busy || !inputEl.value.trim(); });
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (busy) return;
            if (!sendBtn.disabled) sendMessage();
        }
    });
    inputEl.addEventListener('focus', () => { setTimeout(() => ChatUI.scrollBottom(), 300); });
    sendBtn.addEventListener('click', sendMessage);

    // ── Quick Exit & Actions ──
    function quickExit() {
        try {
            const keys = ['nf.theme', 'nf.settings', 'nf.conversations', 'nf.current', 'nf.visited', 'nf.pin', PERSIST_KEY];
            keys.forEach(k => localStorage.removeItem(k));
            sessionStorage.removeItem(PERSIST_KEY);

            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                });
            }
        } catch (e) { }
        window.location.replace('https://www.google.com');
    }
    document.getElementById('quickExitBtn').addEventListener('click', quickExit);

    document.getElementById('saveChatBtn').addEventListener('click', () => {
        try {
            localStorage.setItem(PERSIST_KEY, '1');
            ChatUI.toast('บันทึกประวัติลงเครื่องแล้ว (ไม่ล้างเมื่อปิดแท็บ)');
        } catch (e) {
            ChatUI.toast('บันทึกไม่สำเร็จ');
        }
    });

    let lastEsc = 0;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const now = Date.now(); if (now - lastEsc < 600) { quickExit(); } lastEsc = now;
        }
    });

    function clearOnExit() {
        if (!localStorage.getItem(PERSIST_KEY)) {
            localStorage.removeItem(CONV_KEY);
            localStorage.removeItem(CURRENT_KEY);
        }
    }
    window.addEventListener('pagehide', clearOnExit);
    window.addEventListener('beforeunload', clearOnExit);

    // ── Export Features ──
    document.getElementById('exportBtn').addEventListener('click', () => {
        const conv = currentConv();
        if (!conv || !conv.messages.length) { ChatUI.toast('ยังไม่มีบทสนทนาให้ส่งออก'); return; }
        exportModal.hidden = false; closeDrawerIfMobile();
    });

    document.getElementById('exportTxtBtn').addEventListener('click', () => {
        const conv = currentConv();
        let text = `บันทึกการสนทนากับน้องฟ้า (Nong Fah AI)\nวันที่ส่งออก: ${new Date().toLocaleString('th-TH')}\n========================================\n\n`;
        conv.messages.forEach(m => {
            const time = new Date(m.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            const role = m.role === 'user' ? 'ฉัน' : 'น้องฟ้า';
            text += `[${time}] ${role}:\n${m.content}\n\n`;
        });
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `nongfah-chat-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click(); URL.revokeObjectURL(url); exportModal.hidden = true;
    });

    document.getElementById('exportPdfBtn').addEventListener('click', () => {
        const conv = currentConv();
        const printWindow = window.open('', '_blank');

        if (!printWindow) {
            ChatUI.toast('กรุณาอนุญาต Pop-up เพื่อพิมพ์ PDF');
            return;
        }

        let html = `
      <html><head><title>Nong Fah AI - Chat Export</title>
      <style>
        body { font-family: "Sarabun", sans-serif; padding: 40px; line-height: 1.6; color: #1A1D23; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 24px; border-bottom: 2px solid #E8E3D8; padding-bottom: 10px; }
        .meta { color: #6B7280; font-size: 14px; margin-bottom: 30px; }
        .msg { margin-bottom: 20px; page-break-inside: avoid; }
        .user { color: #5B7CFA; font-weight: bold; }
        .bot { color: #8B5CF6; font-weight: bold; }
        .time { font-size: 12px; color: #9CA3AF; margin-left: 10px; font-weight: normal; }
        .text { margin-top: 5px; white-space: pre-wrap; }
        .resources { background: #FEF2F2; border: 1px solid #FECACA; padding: 10px; border-radius: 8px; margin-top: 10px; color: #B91C1C; font-size: 14px; }
      </style></head><body>
      <h1>บันทึกการสนทนากับน้องฟ้า (Nong Fah AI)</h1>
      <div class="meta">วันที่ส่งออก: ${new Date().toLocaleString('th-TH')}</div>
    `;

        conv.messages.forEach(m => {
            const time = new Date(m.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            const role = m.role === 'user' ? 'ฉัน' : 'น้องฟ้า';
            const cls = m.role;
            const content = window.Utils.esc(m.content).replace(/\n/g, '<br>');

            html += `<div class="msg"><span class="${cls}">${role}</span><span class="time">${time}</span><div class="text">${content}</div>`;

            if (m.resources && m.resources.length) {
                html += `<div class="resources"><strong>สายด่วนที่แนบมา:</strong><br>`;
                m.resources.forEach(r => {
                    html += `${window.Utils.esc(r.name)} (${window.Utils.esc(r.phone)})<br>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
        });

        html += `</body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
        exportModal.hidden = true;
    });

    // ── Crisis Overlay Safe Button ──
    const crisisSafeBtn = document.getElementById('crisisSafeBtn');
    if (crisisSafeBtn) {
        crisisSafeBtn.addEventListener('click', () => {
            crisisOverlay.hidden = true;
        });
    }

    // ── Theme Quick Toggle ──
    function updateThemeUI(resolvedTheme) {
        const isDark = resolvedTheme === 'dark';
        const label = document.getElementById('themeQuickLabel');
        if (label) label.textContent = isDark ? 'โหมดสว่าง' : 'โหมดมืด';
        document.querySelectorAll('#themeBtn i, #themeQuickBtn i').forEach((el) => {
            el.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        });
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    function toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        window.Settings.set('theme', next);
    }

    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    const themeQuickBtn = document.getElementById('themeQuickBtn');
    if (themeQuickBtn) themeQuickBtn.addEventListener('click', toggleTheme);

    // ── First Visit Modal ──
    const firstVisitModal = document.getElementById('firstVisitModal');
    const firstVisitClose = document.getElementById('firstVisitClose');
    if (firstVisitClose) {
        firstVisitClose.addEventListener('click', () => {
            localStorage.setItem('nf.visited', '1');
            if (firstVisitModal) firstVisitModal.hidden = true;
        });
    }

    // ── UI Controls ──
    document.querySelectorAll('[data-close]').forEach((btn) => {
        btn.addEventListener('click', () => { const id = btn.dataset.close; const m = document.getElementById(id); if (m) m.hidden = true; });
    });
    document.querySelectorAll('.modal-backdrop').forEach((m) => {
        m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; });
    });

    document.getElementById('newChatBtn').addEventListener('click', () => {
        newConversation();
        renderAll();
        inputEl.focus();
        closeDrawerIfMobile();
    });

    document.getElementById('quickCards').addEventListener('click', (e) => {
        const card = e.target.closest('.quick-card'); if (!card) return;
        inputEl.value = card.dataset.prompt; autoResize(); sendMessage();
    });
    document.querySelectorAll('[data-preview]').forEach((btn) => {
        btn.addEventListener('click', () => { ChatUI.toast(`ฟีเจอร์ "${btn.dataset.preview}" ยังไม่พร้อมใช้งาน`); });
    });

    const overlay = document.getElementById('sidebarOverlay');
    function closeDrawerIfMobile() { if (window.matchMedia('(max-width: 768px)').matches) document.body.classList.remove('drawer-open'); }
    document.getElementById('mobileMenu').addEventListener('click', () => document.body.classList.add('drawer-open'));
    overlay.addEventListener('click', closeDrawerIfMobile);
    // ── Sidebar Collapse & Icon ──
    function updateSidebarCollapseIcon(sidebarState) {
        const btn = document.getElementById('sidebarCollapse');
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', sidebarState === 'collapsed' ? 'panel-left-open' : 'panel-left-close');
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        }
    }

    document.getElementById('sidebarCollapse').addEventListener('click', () => {
        const s = window.Settings.get();
        const nextState = s.sidebar === 'collapsed' ? 'expanded' : 'collapsed';
        window.Settings.set('sidebar', nextState);
        updateSidebarCollapseIcon(nextState);
    });

    // ── Voice Input (Speech to Text) ──
    const micBtn = document.getElementById('micBtn');
    let recognition = null;
    let isRecording = false;

    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRec();
        recognition.lang = 'th-TH';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecording = true;
            if (micBtn) {
                micBtn.classList.add('recording');
                micBtn.style.color = 'var(--danger)';
            }
            ChatUI.toast('กำลังฟังเสียง... พูดได้เลย');
        };

        recognition.onresult = (evt) => {
            const transcript = evt.results?.[0]?.[0]?.transcript;
            if (transcript) {
                inputEl.value = (inputEl.value ? inputEl.value + ' ' : '') + transcript;
                autoResize();
                sendBtn.disabled = !inputEl.value.trim();
                inputEl.focus();
            }
        };

        recognition.onerror = () => {
            isRecording = false;
            if (micBtn) {
                micBtn.classList.remove('recording');
                micBtn.style.color = '';
            }
            ChatUI.toast('ไม่สามารถรับเสียงได้ กรุณาลองใหม่');
        };

        recognition.onend = () => {
            isRecording = false;
            if (micBtn) {
                micBtn.classList.remove('recording');
                micBtn.style.color = '';
            }
        };

        if (micBtn) {
            micBtn.addEventListener('click', () => {
                if (isRecording) {
                    recognition.stop();
                } else {
                    try { recognition.start(); }
                    catch { recognition.stop(); }
                }
            });
        }
    } else if (micBtn) {
        micBtn.addEventListener('click', () => {
            ChatUI.toast('เบราว์เซอร์นี้ไม่รองรับการพิมพ์ด้วยเสียง (แนะนำ Chrome หรือ Edge)');
        });
    }

    const settingsModal = document.getElementById('settingsModal');
    const aboutModal = document.getElementById('aboutModal');
    function openModal(m) { m.hidden = false; document.body.style.overflow = 'hidden'; }
    function closeModal(m) { m.hidden = true; document.body.style.overflow = ''; }

    document.getElementById('settingsBtn').addEventListener('click', () => { openModal(settingsModal); closeDrawerIfMobile(); });
    document.getElementById('settingsBtnTop').addEventListener('click', () => openModal(settingsModal));
    document.getElementById('aboutBtn').addEventListener('click', () => { openModal(aboutModal); closeDrawerIfMobile(); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!settingsModal.hidden) closeModal(settingsModal);
            if (!aboutModal.hidden) closeModal(aboutModal);
            if (!crisisOverlay.hidden) crisisOverlay.hidden = true;
            document.body.classList.remove('drawer-open');
        }
    });

    document.querySelectorAll('.settings-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach((t) => t.classList.remove('active'));
            document.querySelectorAll('.settings-pane').forEach((p) => p.classList.remove('active'));
            tab.classList.add('active'); const pane = document.querySelector(`.settings-pane[data-pane="${tab.dataset.tab}"]`); if (pane) pane.classList.add('active');
        });
    });

    document.getElementById('resetSettings').addEventListener('click', () => {
        if (!confirm('คืนค่าการตั้งค่าทั้งหมด?')) return;
        window.Settings.reset(); ChatUI.toast('คืนค่าเริ่มต้นแล้ว');
    });

    // ── Boot ──
    function boot() {
        window.Settings.load(); window.Settings.applyAll(); window.Settings.bind(); window.Settings.syncUI();
        loadConversations();
        if (!conversations.length) { newConversation(); }
        else if (!currentId || !conversations.find((c) => c.id === currentId)) { currentId = conversations[0].id; }

        renderAll(); autoResize(); sendBtn.disabled = true; inputEl.focus();

        // Check first visit
        if (!localStorage.getItem('nf.visited') && firstVisitModal) {
            firstVisitModal.hidden = false;
        }

        const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
        updateThemeUI(initialTheme);
        updateSidebarCollapseIcon(window.Settings.get().sidebar);

        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        document.addEventListener('nf:theme', (e) => {
            const resolved = e.detail?.resolved || document.documentElement.getAttribute('data-theme');
            updateThemeUI(resolved);
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
