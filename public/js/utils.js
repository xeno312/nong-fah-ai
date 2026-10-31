window.Utils = (function () {
    function esc(s) {
        return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function renderMarkdown(text) {
        let s = esc(text);
        const blocks = [];
        // Fenced code
        s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            const i = blocks.length;
            blocks.push({ lang, code });
            return '\u0000CB' + i + '\u0000';
        });
        // Inline code
        s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        // Bold / Italic
        s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
        // Links
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

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
        s = s.replace(/<br>(<\/(ul|h1|h2|h3)>)/g, '$1').replace(/(<(ul|h1|h2|h3)>)<br>/g, '$1');

        s = s.replace(/\u0000CB(\d+)\u0000/g, (_, i) => {
            const { lang, code } = blocks[Number(i)];
            const id = 'cb-' + Math.random().toString(36).slice(2, 9);
            return `<div class="code-block"><div class="code-head"><span class="code-lang">${esc(lang || 'code')}</span><button class="code-copy" data-code-target="${id}" aria-label="คัดลอกโค้ด"><i data-lucide="copy"></i></button></div><pre><code id="${id}">${code}</code></pre></div>`;
        });
        return s;
    }

    function timeString(ts) {
        return new Date(ts || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }

    return { esc, renderMarkdown, timeString };
})();