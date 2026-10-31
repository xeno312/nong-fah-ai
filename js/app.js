// js/app.js
(function () {
    const CONV_KEY = 'nf.conversations';
    const CURRENT_KEY = 'nf.current';

    const chatScroll = document.getElementById('chatScroll');
    const messagesEl = document.getElementById('messages');
    const welcomeEl = document.getElementById('welcome');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const chatListEl = document.getElementById('chatList');
    const searchEl = document.getElementById('searchInput');

    let sessionId = null;
    let conversations = [];
    let currentId = null;
    let busy = false;

    /* ── storage ── */
    function loadConversations() {
        try {
            const raw = localStorage.getItem(CONV_KEY);
            conversations = raw ? JSON.parse(raw) : [];
        } catch { conversations = []; }
        try { currentId = localStorage.getItem(CURRENT_KEY) || null; } catch { currentId = null; }
    }

    function saveConversations() {
        try { localStorage.setItem(CONV_KEY, JSON.stringify(conversations)); } catch { }
        try {
            if (currentId) localStorage.setItem(CURRENT_KEY, currentId);
            else localStorage.removeItem(CURRENT_KEY);
        } catch { }
    }

    function newConversation() {
        const id = 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const conv = {
            id,
            sessionId: null,
            title: 'บทสนทนาใหม่',
            messages: [],
            updated: Date.now(),
        };
        conversations.unshift(conv);
        conversations = conversations.slice(0, 60);
        currentId = id;
        saveConversations();
        return conv;
    }

    function currentConv() {
        return conversations.find((c) => c.id === currentId) || null;
    }

    /* ── server ── */
    async function ensureSession(conv) {
        if (conv.sessionId) return conv.sessionId;
        try {
            const r = await fetch('/api/new-session', { method: 'POST' });
            if (!r.ok) throw new Error('status ' + r.status);
            const d = await r.json();
            conv.sessionId = d.session_id;
            saveConversations();
            return conv.sessionId;
        } catch (e) {
            // Offline / no backend — fall back to a local id so the UI still works
            conv.sessionId = 'local-' + Math.random().toString(36).slice(2, 10);
            saveConversations();
            return conv.sessionId;
        }
    }

    async function sendToServer(conv, message) {
        const sid = await ensureSession(conv);
        const r = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sid, message }),
        });
        if (r.status === 429) return { rateLimited: true };
        if (!r.ok) throw new Error('status ' + r.status);
        return r.json();
    }

    /* ── rendering ── */
    function showWelcome(show) {
        welcomeEl.style.display = show ? '' : 'none';
    }

    function renderMessages() {
        const conv = currentConv();
        ChatUI.clear();
        if (!conv || !conv.messages.length) {
            showWelcome(true);
            return;
        }
        showWelcome(false);
        for (const m of conv.messages) {
            if (m.role === 'user') ChatUI.renderUser(m.content, m.ts);
            else ChatUI.renderBot(m.content, m.ts);
            if (m.resources && m.resources.length) ChatUI.renderResources(m.resources);
        }
        ChatUI.scrollBottom();
    }

    function renderChatList() {
        const q = searchEl.value.trim().toLowerCase();
        chatListEl.innerHTML = '';
        const list = conversations.filter((c) =>
            !q || c.title.toLowerCase().includes(q));
        if (!list.length) {
            const empty = document.createElement('div');
            empty.className = 'chat-list-empty';
            empty.textContent = q ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีบทสนทนา';
            chatListEl.appendChild(empty);
            return;
        }
        for (const conv of list) {
            const item = document.createElement('div');
            item.className = 'chat-item' + (conv.id === currentId ? ' active' : '');
            item.setAttribute('role', 'button');
            item.tabIndex = 0;
            item.dataset.id = conv.id;
            item.innerHTML = `
        <i data-lucide="message-square"></i>
        <span class="chat-item-title"></span>
        <button class="chat-item-del" aria-label="ลบบทสนทนา"><i data-lucide="x"></i></button>
      `;
            item.querySelector('.chat-item-title').textContent = conv.title;
            chatListEl.appendChild(item);
        }
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    function renderAll() {
        renderChatList();
        renderMessages();
    }

    /* ── actions ── */
    function startNewChat() {
        if (busy) return;
        const conv = newConversation();
        renderAll();
        inputEl.focus();
        closeDrawerIfMobile();
    }

    async function sendMessage() {
        if (busy) return;
        const text = inputEl.value.trim();
        if (!text) return;

        let conv = currentConv();
        if (!conv) conv = newConversation();

        if (conv.messages.length === 0) {
            conv.title = text.slice(0, 34) + (text.length > 34 ? '…' : '');
        }

        const userTs = Date.now();
        conv.messages.push({ role: 'user', content: text, ts: userTs });
        conv.updated = Date.now();
        saveConversations();

        ChatUI.renderUser(text, userTs);
        showWelcome(false);
        inputEl.value = '';
        autoResize();

        busy = true;
        sendBtn.disabled = true;
        ChatUI.renderTyping();

        try {
            const data = await sendToServer(conv, text);
            ChatUI.removeTyping();

            if (data.rateLimited) {
                const botTs = Date.now();
                const reply = 'ใจเย็น ๆ นะ ฟ้าขอหายใจก่อน พิมพ์ช้า ๆ ก็ได้';
                conv.messages.push({ role: 'assistant', content: reply, ts: botTs });
                saveConversations();
                ChatUI.renderBot(reply, botTs);
                return;
            }

            const reply = data.reply || '...';
            const botTs = Date.now();
            const resources = data.resources || [];

            conv.messages.push({ role: 'assistant', content: reply, ts: botTs, resources });
            conv.updated = Date.now();
            saveConversations();

            ChatUI.renderBot(reply, botTs);
            if (resources.length) ChatUI.renderResources(resources);
            renderChatList();
        } catch (e) {
            ChatUI.removeTyping();
            const fallback = 'ฟ้าขอโทษ ระบบมีปัญหานิดหน่อย ลองพิมพ์อีกครั้งได้ไหม';
            const botTs = Date.now();
            conv.messages.push({ role: 'assistant', content: fallback, ts: botTs });
            saveConversations();
            ChatUI.renderBot(fallback, botTs);
        } finally {
            busy = false;
            sendBtn.disabled = !inputEl.value.trim();
            inputEl.focus();
        }
    }

    /* ── message actions ── */
    messagesEl.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const row = btn.closest('.row');
        if (!row) return;

        const conv = currentConv();
        if (!conv) return;

        // find index by matching timestamp
        const ts = Number(row.dataset.ts);
        const idx = conv.messages.findIndex((m) => m.ts === ts);
        if (idx < 0) return;
        const msg = conv.messages[idx];

        const action = btn.dataset.action;

        if (action === 'copy') {
            try {
                await navigator.clipboard.writeText(msg.content);
                ChatUI.toast('คัดลอกแล้ว');
            } catch { ChatUI.toast('คัดลอกไม่สำเร็จ'); }
            return;
        }

        if (action === 'delete') {
            conv.messages.splice(idx, 1);
            conv.updated = Date.now();
            saveConversations();
            renderMessages();
            return;
        }

        if (action === 'edit' && msg.role === 'user') {
            const next = prompt('แก้ไขข้อความ:', msg.content);
            if (next === null) return;
            const trimmed = next.trim();
            if (!trimmed || trimmed === msg.content) return;
            conv.messages = conv.messages.slice(0, idx);
            conv.messages.push({ role: 'user', content: trimmed, ts: Date.now() });
            conv.updated = Date.now();
            saveConversations();
            renderMessages();
            inputEl.value = trimmed;
            autoResize();
            sendMessage();
            return;
        }

        if (action === 'regenerate' && msg.role === 'assistant') {
            // find the user message just before this assistant turn
            let u = idx - 1;
            while (u >= 0 && conv.messages[u].role !== 'user') u--;
            if (u < 0) return;
            const originalText = conv.messages[u].content;
            conv.messages = conv.messages.slice(0, u);
            conv.updated = Date.now();
            saveConversations();
            renderMessages();
            inputEl.value = originalText;
            autoResize();
            sendMessage();
            return;
        }
    });

    /* ── chat list ── */
    chatListEl.addEventListener('click', (e) => {
        const del = e.target.closest('.chat-item-del');
        if (del) {
            e.stopPropagation();
            const item = del.closest('.chat-item');
            const id = item.dataset.id;
            if (!confirm('ลบบทสนทนานี้?')) return;
            conversations = conversations.filter((c) => c.id !== id);
            if (currentId === id) currentId = conversations[0]?.id || null;
            saveConversations();
            renderAll();
            return;
        }
        const item = e.target.closest('.chat-item');
        if (!item) return;
        currentId = item.dataset.id;
        saveConversations();
        renderAll();
        closeDrawerIfMobile();
    });

    chatListEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const item = e.target.closest('.chat-item');
        if (!item) return;
        e.preventDefault();
        currentId = item.dataset.id;
        saveConversations();
        renderAll();
    });

    searchEl.addEventListener('input', renderChatList);

    /* ── composer ── */
    function autoResize() {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(180, inputEl.scrollHeight) + 'px';
    }

    inputEl.addEventListener('input', () => {
        autoResize();
        sendBtn.disabled = busy || !inputEl.value.trim();
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    /* ── preview-only buttons ── */
    document.querySelectorAll('[data-preview]').forEach((btn) => {
        btn.addEventListener('click', () => {
            ChatUI.toast(`ฟีเจอร์ "${btn.dataset.preview}" ยังไม่พร้อมใช้งาน`);
        });
    });

    /* ── new chat + quick cards ── */
    document.getElementById('newChatBtn').addEventListener('click', startNewChat);

    document.getElementById('quickCards').addEventListener('click', (e) => {
        const card = e.target.closest('.quick-card');
        if (!card) return;
        inputEl.value = card.dataset.prompt;
        autoResize();
        sendMessage();
    });

    /* ── drawer (mobile) ── */
    const overlay = document.getElementById('sidebarOverlay');
    function openDrawer() { document.body.classList.add('drawer-open'); }
    function closeDrawerIfMobile() {
        if (window.matchMedia('(max-width: 768px)').matches) {
            document.body.classList.remove('drawer-open');
        }
    }
    document.getElementById('mobileMenu').addEventListener('click', openDrawer);
    overlay.addEventListener('click', closeDrawerIfMobile);

    /* ── sidebar collapse (desktop) ── */
    document.getElementById('sidebarCollapse').addEventListener('click', () => {
        const s = window.Settings.get();
        window.Settings.set('sidebar', s.sidebar === 'collapsed' ? 'expanded' : 'collapsed');
    });

    /* ── modals ── */
    const settingsModal = document.getElementById('settingsModal');
    const aboutModal = document.getElementById('aboutModal');

    function openModal(m) { m.hidden = false; document.body.style.overflow = 'hidden'; }
    function closeModal(m) { m.hidden = true; document.body.style.overflow = ''; }

    document.getElementById('settingsBtn').addEventListener('click', () => { openModal(settingsModal); closeDrawerIfMobile(); });
    document.getElementById('settingsBtnTop').addEventListener('click', () => openModal(settingsModal));
    document.getElementById('aboutBtn').addEventListener('click', () => { openModal(aboutModal); closeDrawerIfMobile(); });

    document.querySelectorAll('[data-close]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.close;
            const m = document.getElementById(id);
            if (m) closeModal(m);
        });
    });

    [settingsModal, aboutModal].forEach((m) => {
        m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!settingsModal.hidden) closeModal(settingsModal);
            if (!aboutModal.hidden) closeModal(aboutModal);
            document.body.classList.remove('drawer-open');
        }
    });

    // settings tabs
    document.querySelectorAll('.settings-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach((t) => t.classList.remove('active'));
            document.querySelectorAll('.settings-pane').forEach((p) => p.classList.remove('active'));
            tab.classList.add('active');
            const pane = document.querySelector(`.settings-pane[data-pane="${tab.dataset.tab}"]`);
            if (pane) pane.classList.add('active');
        });
    });

    document.getElementById('resetSettings').addEventListener('click', () => {
        if (!confirm('คืนค่าการตั้งค่าทั้งหมด?')) return;
        window.Settings.reset();
        ChatUI.toast('คืนค่าเริ่มต้นแล้ว');
    });

    /* ── theme quick buttons ── */
    function bindThemeButtons() {
        const quick = document.getElementById('themeQuickBtn');
        const top = document.getElementById('themeBtn');
        const label = document.getElementById('themeQuickLabel');

        function cycle() {
            const cur = window.Settings.get().theme;
            const next = cur === 'light' ? 'dark' : cur === 'dark' ? 'system' : 'light';
            window.Settings.set('theme', next);
            updateLabels();
            ChatUI.toast(next === 'light' ? 'โหมดสว่าง' : next === 'dark' ? 'โหมดมืด' : 'ตามระบบ');
        }

        function updateLabels() {
            const cur = window.Settings.get().theme;
            if (label) label.textContent = cur === 'light' ? 'โหมดมืด' : cur === 'dark' ? 'ตามระบบ' : 'โหมดสว่าง';
        }

        quick.addEventListener('click', cycle);
        top.addEventListener('click', cycle);
        updateLabels();
        document.addEventListener('nf:theme', updateLabels);
    }

    /* ── boot ── */
    function boot() {
        window.Settings.load();
        window.Settings.applyAll();
        window.Settings.bind();
        window.Settings.syncUI();
        bindThemeButtons();

        loadConversations();

        if (!conversations.length) {
            newConversation();
        } else if (!currentId || !conversations.find((c) => c.id === currentId)) {
            currentId = conversations[0].id;
        }

        renderAll();
        autoResize();
        sendBtn.disabled = true;

        inputEl.focus();

        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

        // reload icons after theme swap (icon sets change)
        document.addEventListener('nf:theme', () => {
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();