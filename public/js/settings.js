window.Settings = (function () {
    const THEME_KEY = 'nf.theme';
    const SETTINGS_KEY = 'nf.settings';
    const defaults = { theme: 'light', language: 'th', fontSize: 'medium', density: 'comfortable', animation: 'on', sidebar: 'expanded', avatar: 'logo', bubble: 'rounded', accent: '#5B7CFA' };
    let current = { ...defaults };

    function systemPref() { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }

    function applyTheme(pref) {
        const resolved = pref === 'system' ? systemPref() : pref;
        document.documentElement.setAttribute('data-theme', resolved);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', resolved === 'dark' ? '#111318' : '#F7F5F0');
        document.dispatchEvent(new CustomEvent('nf:theme', { detail: { pref, resolved } }));
    }

    function load() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) current = { ...defaults, ...JSON.parse(raw) };
        } catch { }
        return current;
    }

    function save() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(current)); } catch { }
    }

    const AVATAR_MAP = { logo: '/logo.png', letter: 'ฟ้า', sparkle: '✨', moon: '🌙', heart: '💙' };

    function applyAll() {
        const body = document.body;
        body.setAttribute('data-density', current.density);
        body.setAttribute('data-bubble', current.bubble);
        body.setAttribute('data-anim', current.animation);
        body.setAttribute('data-font', current.fontSize);
        body.setAttribute('data-sidebar', current.sidebar);
        document.documentElement.style.setProperty('--accent', current.accent);

        const avatarVal = AVATAR_MAP[current.avatar];
        document.querySelectorAll('.brand-avatar, .ai-avatar-sm').forEach((el) => {
            if (current.avatar === 'logo') {
                el.innerHTML = `<img src="${avatarVal}" alt="Logo">`;
                el.classList.remove('text-avatar');
            } else {
                el.textContent = avatarVal;
                el.classList.add('text-avatar');
            }
        });

        applyTheme(current.theme);
    }

    function set(key, value) {
        if (current[key] === value) return;
        current[key] = value;
        save();
        applyAll();
        syncUI();
    }

    function syncUI() {
        document.querySelectorAll('[data-setting]').forEach((group) => {
            const setting = group.dataset.setting; const value = current[setting];
            group.querySelectorAll('button').forEach((btn) => { btn.classList.toggle('active', btn.dataset.value === value); });
        });
    }

    function bind() {
        document.querySelectorAll('[data-setting]').forEach((group) => {
            const setting = group.dataset.setting;
            group.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-value]'); if (!btn) return;
                set(setting, btn.dataset.value);
            });
        });
    }

    function reset() {
        current = { ...defaults };
        save();
        applyAll();
        syncUI();
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (current.theme === 'system') applyTheme('system');
    });

    return { load, save, set, applyAll, syncUI, bind, reset, get: () => ({ ...current }) };
})();