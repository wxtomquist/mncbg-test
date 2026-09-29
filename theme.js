(() => {
  const STORAGE_KEY = 'mncbg-theme';
  const root = document.documentElement;

  function getStoredTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (_) {
      return null;
    }
  }

  function themeColor(theme) {
    if (location.pathname.startsWith('/mbc/')) {
      return theme === 'dark' ? '#081418' : '#f6f4ef';
    }
    return theme === 'dark' ? '#0b0c10' : '#f4f7fa';
  }

  function setMetaThemeColor(theme) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = themeColor(theme);
  }

  function applyTheme(theme, persist = false) {
    const next = theme === 'light' ? 'light' : 'dark';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    setMetaThemeColor(next);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    }
    updateToggle(next);
    window.dispatchEvent(new CustomEvent('mncbg-theme-change', { detail: { theme: next } }));
  }

  function iconMarkup(theme) {
    if (theme === 'dark') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"></path></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  }

  function updateToggle(theme) {
    const button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    const target = theme === 'dark' ? 'light' : 'dark';
    button.innerHTML = iconMarkup(theme);
    button.setAttribute('aria-label', `Switch to ${target} mode`);
    button.setAttribute('title', `Switch to ${target} mode`);
  }

  function mountToggle() {
    if (document.querySelector('[data-theme-toggle]')) return;

    let target = null;
    let before = null;
    if (document.body.classList.contains('mbc-page')) {
      target = document.querySelector('.topbar-actions');
    } else if (document.body.classList.contains('guild-page')) {
      target = document.querySelector('.events-hero-inner');
    } else if (document.body.classList.contains('privacy-page')) {
      target = document.querySelector('.header-inner');
    } else if (document.body.classList.contains('festival-page')) {
      const appbar = document.querySelector('.appbar-inner');
      const navToggle = appbar?.querySelector('.nav-toggle') || null;
      if (appbar && navToggle) {
        let controls = appbar.querySelector('.festival-header-controls');
        if (!controls) {
          controls = document.createElement('div');
          controls.className = 'festival-header-controls';
          appbar.insertBefore(controls, navToggle);
          controls.appendChild(navToggle);
        }
        target = controls;
        before = navToggle;
      } else {
        target = appbar;
        before = appbar?.querySelector('.topnav') || null;
      }
    }
    if (!target) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = document.body.classList.contains('guild-page') ? 'theme-toggle guild-hero-theme-toggle' : (document.body.classList.contains('privacy-page') ? 'theme-toggle privacy-theme-toggle' : 'theme-toggle');
    button.dataset.themeToggle = '';
    button.addEventListener('click', () => {
      const current = root.dataset.theme === 'light' ? 'light' : 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark', true);
    });

    if (before) target.insertBefore(button, before);
    else target.appendChild(button);
    updateToggle(root.dataset.theme || 'dark');
  }

  // Dark is the product default. A user's explicit choice persists across all event sections.
  applyTheme(getStoredTheme() || 'dark');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountToggle, { once: true });
  } else {
    mountToggle();
  }

  window.MNCBGTheme = { apply: (theme) => applyTheme(theme, true) };
})();
