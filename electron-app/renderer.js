'use strict';

/* =======================================================
   DIB HAMICHE — NOVA PRO (renderer.js)
   Multi-tab browser shell with Algiers clock, omnibox,
   bookmarks, history, shortcuts (GLM 5.1, YouTube, Google).
   ======================================================= */

const UA = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'AppleWebKit/537.36 (KHTML, like Gecko)',
    'Chrome/124.0.0.0 Safari/537.36',
].join(' ');

const SEARCH_ENGINES = {
    google:     { name: 'Google',     url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
    bing:       { name: 'Bing',       url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
    duckduckgo: { name: 'DuckDuckGo', url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
    brave:      { name: 'Brave',      url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
    yandex:     { name: 'Yandex',     url: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}` },
    startpage:  { name: 'Startpage',  url: (q) => `https://www.startpage.com/do/search?q=${encodeURIComponent(q)}` },
    ecosia:     { name: 'Ecosia',     url: (q) => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}` },
};

const DEFAULT_HOME = 'dib://newtab';
const INTERNAL_PAGES = new Set([
    'dib://newtab', 'dib://settings', 'dib://downloads', 'dib://history',
    'dib://bookmarks', 'dib://updates', 'dib://passwords',
    'dib://languages', 'dib://about',
]);

const state = {
    tabs: [],      // { id, wv, btn, url, title }
    activeId: null,
    settings: { searchEngine: 'google', language: 'fr', homepage: DEFAULT_HOME },
};

let tabSeq = 0;
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', init);

async function init() {
    const store = await window.dib.store.get();
    state.settings = { ...state.settings, ...(store.settings || {}) };
    $('#searchEngine').value = state.settings.searchEngine;
    $('#verLabel').textContent = await window.dib.app.version();

    wireToolbar();
    wireWindowControls();
    wireMenu();
    wireGlobalEvents();
    startClocks();

    createTab(state.settings.homepage || DEFAULT_HOME);

    window.dib.events.onOpenNewTab((url) => createTab(url));
}

// ---------- CLOCK ----------
function startClocks() {
    const clock = $('#liveClock');
    const dateEl = $('#liveDate');
    const statusClock = $('#statusClock');
    const opts = { timeZone: 'Africa/Algiers', hour12: false };
    const dateFmt = new Intl.DateTimeFormat('fr-DZ', {
        ...opts, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
    const timeFmt = new Intl.DateTimeFormat('fr-DZ', {
        ...opts, hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    const tick = () => {
        const now = new Date();
        clock.textContent = timeFmt.format(now);
        dateEl.textContent = dateFmt.format(now);
        statusClock.textContent = `Algiers · ${timeFmt.format(now)}`;
    };
    tick();
    setInterval(tick, 1000);
}

// ---------- TOOLBAR ----------
function wireToolbar() {
    $('#btnBack').onclick     = () => safeWV((wv) => wv.canGoBack() && wv.goBack());
    $('#btnForward').onclick  = () => safeWV((wv) => wv.canGoForward() && wv.goForward());
    $('#btnReload').onclick   = () => safeWV((wv) => wv.reload());
    $('#btnHome').onclick     = () => navigate(state.settings.homepage || DEFAULT_HOME);
    $('#btnAddTab').onclick   = () => createTab(state.settings.homepage || DEFAULT_HOME);
    $('#btnGo').onclick       = () => navigate($('#urlInput').value);
    $('#urlInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate($('#urlInput').value);
    });
    $('#urlInput').addEventListener('focus', (e) => e.target.select());

    $('#searchEngine').onchange = async (e) => {
        state.settings.searchEngine = e.target.value;
        await window.dib.store.patch({ settings: state.settings });
    };

    $('#btnBookmark').onclick = async () => {
        const t = currentTab();
        if (!t || !t.url) return;
        await window.dib.bookmarks.add({ title: t.title || t.url, url: t.url });
        flashToast('Bookmarked ★');
    };

    $('#btnGLM').onclick     = () => createTab('https://chat.z.ai/');
    $('#btnYouTube').onclick = () => createTab('https://www.youtube.com/');
    // With Client-Hint spoofing and navigator spoofing applied by preload-webview.js,
    // Google sign-in now works inline inside DIB HAMICHE.
    $('#btnGoogleLogin').onclick = () =>
        createTab('https://accounts.google.com/ServiceLogin?hl=en&continue=https://myaccount.google.com');
    $('#btnOpenExternal').onclick = () => {
        const t = currentTab();
        if (t && t.url && /^https?:/i.test(t.url)) window.dib.app.openExternal(t.url);
    };
}

function wireWindowControls() {
    $('#btnMin').onclick   = () => window.dib.win.minimize();
    $('#btnMax').onclick   = () => window.dib.win.toggleMaximize();
    $('#btnFull').onclick  = () => window.dib.win.toggleFullscreen();
    $('#btnClose').onclick = () => window.dib.win.close();
}

function wireMenu() {
    const menu = $('#menuPopup');
    $('#btnMenu').onclick = (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
    };
    document.addEventListener('click', () => (menu.hidden = true));
    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.querySelectorAll('button[data-goto]').forEach((b) => {
        b.onclick = () => {
            navigate(b.dataset.goto);
            menu.hidden = true;
        };
    });
}

function wireGlobalEvents() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 't') { e.preventDefault(); createTab(DEFAULT_HOME); }
        else if (e.ctrlKey && e.key.toLowerCase() === 'w') { e.preventDefault(); closeTab(state.activeId); }
        else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); $('#urlInput').focus(); }
        else if (e.ctrlKey && e.key.toLowerCase() === 'r') { e.preventDefault(); safeWV((wv) => wv.reload()); }
        else if (e.key === 'F11') { e.preventDefault(); window.dib.win.toggleFullscreen(); }
        else if (e.ctrlKey && e.key === 'Tab') { e.preventDefault(); cycleTabs(1); }
    });
}

// ---------- TABS ----------
function currentTab() { return state.tabs.find((t) => t.id === state.activeId); }
function safeWV(fn) { const t = currentTab(); if (t && t.wv) fn(t.wv); }

function createTab(url) {
    tabSeq++;
    const id = `tab-${tabSeq}`;

    const btn = document.createElement('div');
    btn.className = 'tab';
    btn.id = `btn-${id}`;
    btn.innerHTML = `
        <div class="fav"></div>
        <span class="title">Loading…</span>
        <span class="x" title="Close">✕</span>
    `;
    btn.onclick = (e) => {
        if (e.target.classList.contains('x')) { closeTab(id); return; }
        switchTab(id);
    };
    $('#tabsStrip').appendChild(btn);

    const wv = document.createElement('webview');
    wv.id = id;
    wv.setAttribute('useragent', UA);
    wv.setAttribute('allowpopups', '');
    wv.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no');
    if (window.dibPreloadPath) wv.setAttribute('preload', window.dibPreloadPath);
    wv.src = resolveUrl(url);
    $('#viewport').appendChild(wv);

    const tab = { id, wv, btn, url: wv.src, title: 'Loading…' };
    state.tabs.push(tab);

    wv.addEventListener('dom-ready', () => {
        try { wv.setZoomFactor(1); } catch (_) { /* noop */ }
    });
    wv.addEventListener('did-start-loading', () => updateTabLabel(tab, 'Loading…'));
    wv.addEventListener('page-title-updated', (e) => updateTabLabel(tab, e.title));
    wv.addEventListener('did-navigate', (e) => onNavigate(tab, e.url));
    wv.addEventListener('did-navigate-in-page', (e) => onNavigate(tab, e.url));
    wv.addEventListener('did-finish-load', () => {
        if (tab === currentTab()) setUrlInput(tab.url);
    });
    wv.addEventListener('new-window', (e) => createTab(e.url));

    switchTab(id);
}

function onNavigate(tab, url) {
    tab.url = url;
    if (tab === currentTab()) {
        setUrlInput(url);
        $('#statusUrl').textContent = url;
    }
    if (!url.startsWith('dib://')) {
        window.dib.history.push({ url, title: tab.title || url });
    }
}

function updateTabLabel(tab, title) {
    tab.title = title;
    const span = tab.btn.querySelector('.title');
    span.textContent = (title || 'Untitled').substring(0, 30);
    span.title = title || '';
}

function switchTab(id) {
    const t = state.tabs.find((x) => x.id === id);
    if (!t) return;
    state.tabs.forEach((x) => {
        x.wv.classList.remove('active');
        x.btn.classList.remove('active');
    });
    t.wv.classList.add('active');
    t.btn.classList.add('active');
    state.activeId = id;
    setUrlInput(t.url);
    $('#statusUrl').textContent = t.url;
}

function closeTab(id) {
    const i = state.tabs.findIndex((t) => t.id === id);
    if (i === -1) return;
    const t = state.tabs[i];
    t.wv.remove();
    t.btn.remove();
    state.tabs.splice(i, 1);
    if (state.tabs.length === 0) {
        createTab(state.settings.homepage || DEFAULT_HOME);
    } else if (state.activeId === id) {
        const next = state.tabs[Math.max(0, i - 1)];
        switchTab(next.id);
    }
}

function cycleTabs(dir) {
    if (state.tabs.length < 2) return;
    const i = state.tabs.findIndex((t) => t.id === state.activeId);
    const n = (i + dir + state.tabs.length) % state.tabs.length;
    switchTab(state.tabs[n].id);
}

// ---------- NAVIGATION / OMNIBOX ----------
function navigate(raw) {
    if (!raw) return;
    const url = resolveUrl(raw);
    const t = currentTab();
    if (!t) { createTab(url); return; }
    t.wv.src = url;
}

function resolveUrl(raw) {
    const v = (raw || '').trim();
    if (!v) return DEFAULT_HOME;
    if (v.startsWith('dib://')) return v;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^file:\/\//i.test(v)) return v;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(v)) return 'https://' + v;
    const engine = SEARCH_ENGINES[state.settings.searchEngine] || SEARCH_ENGINES.google;
    return engine.url(v);
}

function setUrlInput(url) {
    const el = $('#urlInput');
    if (document.activeElement !== el) el.value = url || '';
}

// ---------- TOAST ----------
let toastTimer = null;
function flashToast(msg) {
    let t = $('#toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.style.cssText = `
            position: fixed; bottom: 38px; left: 50%; transform: translateX(-50%);
            background: #0c0c17; color: #00d4ff; border: 1px solid #00d4ff55;
            padding: 10px 18px; border-radius: 22px; font-size: 13px; z-index: 9999;
            box-shadow: 0 8px 22px rgba(0, 0, 0, .4);`;
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.display = 'none'), 1800);
}
