window.ChatUI = (function () {
    const messagesEl = document.getElementById('messages');
    const chatScroll = document.getElementById('chatScroll');

    function icons() {
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    function scrollBottom() {
        requestAnimationFrame(() => { chatScroll.scrollTop = chatScroll.scrollHeight; });
    }

    function getAvatarHTML() {
        if (window.Settings) {
            const av = window.Settings.get().avatar;
            if (av === 'logo') return `<img src="/logo.png" alt="Logo">`;
            const map = { letter: 'ฟ้า', sparkle: '✨', moon: '🌙', heart: '💙' };
            return map[av] || 'ฟ้า';
        }
        return `<img src="/logo.png" alt="Logo">`;
    }

    function renderBot(content, ts) {
        const row = document.createElement('div'); row.className = 'row bot'; row.dataset.ts = ts || Date.now();
        const avatar = document.createElement('div'); avatar.className = 'row-avatar avatar';
        const avatarContent = getAvatarHTML();

        if (avatarContent.includes('<img')) {
            avatar.innerHTML = avatarContent;
        } else {
            avatar.textContent = avatarContent;
            avatar.classList.add('text-avatar');
            avatar.style.background = 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)';
            avatar.style.border = 'none';
        }

        const wrap = document.createElement('div'); wrap.className = 'bubble-wrap';
        const bubble = document.createElement('div'); bubble.className = 'bubble';
        bubble.innerHTML = window.Utils.renderMarkdown(content);

        const actions = document.createElement('div'); actions.className = 'msg-actions';
        actions.innerHTML = `<button data-action="copy" title="คัดลอก"><i data-lucide="copy"></i></button><button data-action="regenerate" title="สร้างใหม่"><i data-lucide="refresh-cw"></i></button><button data-action="delete" title="ลบ"><i data-lucide="trash-2"></i></button>`;
        const time = document.createElement('div'); time.className = 'msg-time'; time.textContent = window.Utils.timeString(ts);

        wrap.appendChild(bubble); wrap.appendChild(actions); wrap.appendChild(time);
        row.appendChild(avatar); row.appendChild(wrap);
        messagesEl.appendChild(row);

        icons(); scrollBottom();
        return row;
    }

    function renderUser(content, ts) {
        const row = document.createElement('div'); row.className = 'row user'; row.dataset.ts = ts || Date.now();
        const wrap = document.createElement('div'); wrap.className = 'bubble-wrap';
        const bubble = document.createElement('div'); bubble.className = 'bubble';
        bubble.textContent = content; // User messages don't need markdown, and textContent prevents XSS

        const actions = document.createElement('div'); actions.className = 'msg-actions';
        actions.innerHTML = `<button data-action="copy" title="คัดลอก"><i data-lucide="copy"></i></button><button data-action="edit" title="แก้ไข"><i data-lucide="pencil"></i></button><button data-action="delete" title="ลบ"><i data-lucide="trash-2"></i></button>`;
        const time = document.createElement('div'); time.className = 'msg-time'; time.textContent = window.Utils.timeString(ts);

        wrap.appendChild(bubble); wrap.appendChild(actions); wrap.appendChild(time);
        row.appendChild(wrap);
        messagesEl.appendChild(row);

        icons(); scrollBottom();
        return row;
    }

    function renderResources(list) {
        if (!list || !list.length) return;
        const wrap = document.createElement('div'); wrap.className = 'resources';
        let html = '<h3>ถ้าต้องการคนคุยตอนนี้</h3>';
        for (const r of list) {
            const tel = String(r.phone || '').replace(/[^0-9+]/g, '');
            html += `<div class="resource"><div class="rname">${window.Utils.esc(r.name || '')}</div><a class="rphone" href="tel:${tel}">${window.Utils.esc(r.phone || '')}</a><div class="rwhat">${window.Utils.esc(r.what || '')}</div><div class="rhours">${window.Utils.esc(r.hours || '')}</div></div>`;
        }
        wrap.innerHTML = html;
        messagesEl.appendChild(wrap);
        scrollBottom();
    }

    function renderTyping() {
        const row = document.createElement('div'); row.className = 'row bot'; row.id = 'typingRow';
        const avatar = document.createElement('div'); avatar.className = 'row-avatar avatar';
        const avatarContent = getAvatarHTML();

        if (avatarContent.includes('<img')) {
            avatar.innerHTML = avatarContent;
        } else {
            avatar.textContent = avatarContent;
            avatar.classList.add('text-avatar');
            avatar.style.background = 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)';
            avatar.style.border = 'none';
        }

        const wrap = document.createElement('div'); wrap.className = 'bubble-wrap';
        const bubble = document.createElement('div'); bubble.className = 'bubble typing-bubble';
        for (let i = 0; i < 3; i++) {
            const d = document.createElement('span'); d.className = 'typing-dot'; bubble.appendChild(d);
        }
        wrap.appendChild(bubble); row.appendChild(avatar); row.appendChild(wrap);
        messagesEl.appendChild(row);
        scrollBottom();
        return row;
    }

    function removeTyping() {
        const t = document.getElementById('typingRow');
        if (t) t.remove();
    }

    function clear() {
        messagesEl.innerHTML = '';
    }

    let toastTimer = null;
    function toast(msg) {
        const el = document.getElementById('toast'); if (!el) return;
        el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
    }

    // Event delegation for Code Copy
    messagesEl.addEventListener('click', async (e) => {
        const codeBtn = e.target.closest('[data-code-target]');
        if (codeBtn) {
            const target = document.getElementById(codeBtn.dataset.codeTarget);
            if (target) {
                try { await navigator.clipboard.writeText(target.textContent); toast('คัดลอกโค้ดแล้ว'); }
                catch { toast('คัดลอกไม่สำเร็จ'); }
            }
        }
    });

    return { renderBot, renderUser, renderResources, renderTyping, removeTyping, clear, toast, scrollBottom };
})();