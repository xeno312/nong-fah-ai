// js/chat-ui.js
(function () {
    const messagesEl = document.getElementById('messages');
    const chatScroll = document.getElementById('chatScroll');

    /* ── markdown (safe, no deps) ── */
    function esc(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    function renderMarkdown(text) {
        let s = esc(text);
        const blocks = [];

        // fenced code
        s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            const i = blocks.length;
            blocks.push({ lang, code });
            return '\u0000CB' + i + '\u0000';
        });

        // inline code
        s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

        // bold / italic
        s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

        // links
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // per-line block formatting
        const lines = s.split('\n');
        const out = [];
        let inList = false;
        for (const line of lines) {
            if (/^### (.*)$/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h3>' + line.slice(4) + '</h3>'); continue; }
            if (/^## (.*)$/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h2>' + line.slice(3) + '</h2>'); continue; }
            if (/^# (.*)$/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h1>' + line.slice(2) + '</h1>'); continue; }
            if (/^[-*] (.*)$/.test(line)) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + line.slice(2) + '</li>'); continue; }
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(line);
        }
        if (inList) out.push('</ul>');
        s = out.join('<br>');
        // remove <br> immediately before/after block tags
        s = s.replace(/<br>(<\/(ul|h1|h2|h3)>)/g, '$1');
        s = s.replace(/(<(ul|h1|h2|h3)>)<br>/g, '$1');

        // restore code blocks with copy button
        s = s.replace(/\u0000CB(\d+)\u0000/g, (_, i) => {
            const { lang, code } = blocks[Number(i)];
            const id = 'cb-' + Math.random().toString(36).slice(2, 9);
            const langLabel = esc(lang || 'code');
            return `<div class="code-block">
        <div class="code-head">
          <span class="code-lang">${langLabel}</span>
          <button class="code-copy" data-code-target="${id}" aria-label="คัดลอกโค้ด">
            <i data-lucide="copy"></i>
          </button>
        </div>
        <pre><code id="${id}">${code}</code></pre>
      </div>`;
        });

        return s;
    }

    /* ── helpers ── */
    function timeString(ts) {
        const d = new Date(ts || Date.now());
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }

    function scrollBottom() {
        requestAnimationFrame(() => { chatScroll.scrollTop = chatScroll.scrollHeight; });
    }

    function icons() {
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    /* ── rendering ── */
    function renderBot(content, ts, opts) {
        const row = document.createElement('div');
        row.className = 'row bot';
        row.dataset.ts = ts || Date.now();

        const avatar = document.createElement('div');
        avatar.className = 'row-avatar';
        avatar.textContent = (window.Settings && window.Settings.get().avatar === 'sparkle') ? '✨' : 'ฟ้า';
        // actually use theme-aware label
        if (window.Settings) {
            const a = window.Settings.get().avatar;
            const map = { letter: 'ฟ้า', sparkle: '✨', moon: '🌙', heart: '💙' };
            avatar.textContent = map[a] || 'ฟ้า';
        }

        const wrap = document.createElement('div');
        wrap.className = 'bubble-wrap';

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerHTML = renderMarkdown(content);

        const actions = document.createElement('div');
        actions.className = 'msg-actions';
        actions.innerHTML = `
      <button data-action="copy" title="คัดลอก"><i data-lucide="copy"></i></button>
      <button data-action="regenerate" title="สร้างใหม่"><i data-lucide="refresh-cw"></i></button>
      <button data-action="delete" title="ลบ"><i data-lucide="trash-2"></i></button>
    `;

        const time = document.createElement('div');
        time.className = 'msg-time';
        time.textContent = timeString(ts);

        wrap.appendChild(bubble);
        wrap.appendChild(actions);
        wrap.appendChild(time);
        row.appendChild(avatar);
        row.appendChild(wrap);
        messagesEl.appendChild(row);

        icons();
        scrollBottom();
        return row;
    }

    function renderUser(content, ts) {
        const row = document.createElement('div');
        row.className = 'row user';
        row.dataset.ts = ts || Date.now();

        const wrap = document.createElement('div');
        wrap.className = 'bubble-wrap';

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = content;

        const actions = document.createElement('div');
        actions.className = 'msg-actions';
        actions.innerHTML = `
      <button data-action="copy" title="คัดลอก"><i data-lucide="copy"></i></button>
      <button data-action="edit" title="แก้ไข"><i data-lucide="pencil"></i></button>
      <button data-action="delete" title="ลบ"><i data-lucide="trash-2"></i></button>
    `;

        const time = document.createElement('div');
        time.className = 'msg-time';
        time.textContent = timeString(ts);

        wrap.appendChild(bubble);
        wrap.appendChild(actions);
        wrap.appendChild(time);
        row.appendChild(wrap);
        messagesEl.appendChild(row);

        icons();
        scrollBottom();
        return row;
    }

    function renderResources(list) {
        if (!list || !list.length) return;
        const wrap = document.createElement('div');
        wrap.className = 'resources';
        let html = '<h3>ถ้าต้องการคนคุยตอนนี้</h3>';
        for (const r of list) {
            const tel = String(r.phone || '').replace(/[^0-9+]/g, '');
            html += `<div class="resource">
        <div class="rname">${esc(r.name || '')}</div>
        <a class="rphone" href="tel:${tel}">${esc(r.phone || '')}</a>
        <div class="rwhat">${esc(r.what || '')}</div>
        <div class="rhours">${esc(r.hours || '')}</div>
      </div>`;
        }
        wrap.innerHTML = html;
        messagesEl.appendChild(wrap);
        scrollBottom();
    }

    function renderTyping() {
        const row = document.createElement('div');
        row.className = 'row bot';
        row.id = 'typingRow';

        const avatar = document.createElement('div');
        avatar.className = 'row-avatar';
        avatar.textContent = 'ฟ้า';
        if (window.Settings) {
            const map = { letter: 'ฟ้า', sparkle: '✨', moon: '🌙', heart: '💙' };
            avatar.textContent = map[window.Settings.get().avatar] || 'ฟ้า';
        }

        const wrap = document.createElement('div');
        wrap.className = 'bubble-wrap';

        const bubble = document.createElement('div');
        bubble.className = 'bubble typing-bubble';
        for (let i = 0; i < 3; i++) {
            const d = document.createElement('span');
            d.className = 'typing-dot';
            bubble.appendChild(d);
        }

        wrap.appendChild(bubble);
        row.appendChild(avatar);
        row.appendChild(wrap);
        messagesEl.appendChild(row);
        scrollBottom();
        return row;
    }

    function removeTyping() {
        const t = document.getElementById('typingRow');
        if (t) t.remove();
    }

    /* ── toast ── */
    let toastTimer = null;
    function toast(msg) {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
    }

    /* ── copy code block ── */
    messagesEl.addEventListener('click', async (e) => {
        const codeBtn = e.target.closest('[data-code-target]');
        if (codeBtn) {
            const target = document.getElementById(codeBtn.dataset.codeTarget);
            if (target) {
                try {
                    await navigator.clipboard.writeText(target.textContent);
                    toast('คัดลอกโค้ดแล้ว');
                } catch { toast('คัดลอกไม่สำเร็จ'); }
            }
        }
    });

    function clear() {
        messagesEl.innerHTML = '';
    }

    window.ChatUI = {
        renderMarkdown,
        renderBot, renderUser, renderResources, renderTyping, removeTyping,
        clear, toast, scrollBottom, esc,
    };
})();