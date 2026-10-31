// js/settings.js
(function () {
    const KEY = 'nf.settings';

    const defaults = {
        theme: 'light',
        language: 'th',
        fontSize: 'medium',
        density: 'comfortable',
        animation: 'on',
        sidebar: 'expanded',
        avatar: 'letter',
        bubble: 'rounded',
        accent: '#5B7CFA',
    };

    let current = { ...defaults };

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) current = { ...defaults, ...JSON.parse(raw) };
        } catch { }
        return current;
    }

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { }
    }

    const AVATAR_MAP = {
        letter: 'ฟ้า',
        sparkle: '✨',
        moon: '🌙',
        heart: '💙',
    };

    function applyAll() {
        const body = document.body;

        body.setAttribute('data-density', current.density);
        body.setAttribute('data-bubble', current.bubble);
        body.setAttribute('data-anim', current.animation);
        body.setAttribute('data-font', current.fontSize);
        body.setAttribute('data-sidebar', current.sidebar);

        document.documentElement.style.setProperty('--accent', current.accent);

        // avatar everywhere
        const label = AVATAR_MAP[current.avatar] || 'ฟ้า';
        document.querySelectorAll('.brand-avatar, .ai-avatar-sm, .welcome-avatar, .row-avatar').forEach((el) => {
            el.textContent = label;
        });
        document.querySelectorAll('[data-avatar-label]').forEach((el) => {
            el.textContent = label;
        });

        // theme is handled by theme.js but mirror it
        if (window.Theme) window.Theme.set(current.theme);
    }

    function set(key, value) {
        if (current[key] === value) return;
        current[key] = value;
        save();
        applyAll();
        syncUI();
    }

    function syncUI() {
        // segmented controls
        document.querySelectorAll('[data-setting]').forEach((group) => {
            const setting = group.dataset.setting;
            const value = current[setting];
            group.querySelectorAll('button').forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.value === value);
            });
        });
        // also sync theme buttons that live in the toolbar via data-setting="theme"
        document.querySelectorAll('[data-theme-btn]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.themeBtn === current.theme);
        });
    }

    function bind() {
        document.querySelectorAll('[data-setting]').forEach((group) => {
            const setting = group.dataset.setting;
            group.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-value]');
                if (!btn) return;
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

    window.Settings = {
        load, save, set, applyAll, syncUI, bind, reset,
        get: () => ({ ...current }),
    };
})();