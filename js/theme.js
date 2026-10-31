// js/theme.js
(function () {
    const KEY = 'nf.theme';
    const root = document.documentElement;

    function systemPref() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function apply(pref) {
        const resolved = pref === 'system' ? systemPref() : pref;
        root.setAttribute('data-theme', resolved);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', resolved === 'dark' ? '#111318' : '#F7F5F0');
        document.querySelectorAll('[data-icon-theme]').forEach((el) => {
            const icon = resolved === 'dark' ? 'sun' : 'moon';
            el.setAttribute('data-lucide', icon);
        });
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        document.dispatchEvent(new CustomEvent('nf:theme', { detail: { pref, resolved } }));
    }

    function get() { return localStorage.getItem(KEY) || 'light'; }
    function set(pref) {
        localStorage.setItem(KEY, pref);
        apply(pref);
    }

    window.Theme = { get, set, apply, systemPref };

    // react to system changes when in system mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (get() === 'system') apply('system');
    });

    // apply on load before paint where possible
    apply(get());
})();