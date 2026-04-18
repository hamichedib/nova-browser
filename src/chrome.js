// Nova browser — chrome UI logic.
// Communicates with the Rust backend via Tauri `invoke`.

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;

const state = {
  tabs: [],          // array of { id, title, url }
  activeId: null,
};

const $ = (id) => document.getElementById(id);
const tabsEl = $("tabs");
const addrInput = $("addr");
const addrForm = $("addr-form");
const menu = $("menu-panel");

function getTab(id) {
  return state.tabs.find((t) => t.id === id);
}

function setActive(id) {
  state.activeId = id;
  renderTabs();
  const t = getTab(id);
  if (t) addrInput.value = t.url;
}

function prettyTitle(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") || url;
  } catch {
    return url || "New tab";
  }
}

function renderTabs() {
  tabsEl.innerHTML = "";
  for (const t of state.tabs) {
    const el = document.createElement("div");
    el.className = "tab" + (t.id === state.activeId ? " active" : "");
    el.dataset.id = t.id;
    el.innerHTML = `
      <div class="favicon"></div>
      <div class="title"></div>
      <div class="close" role="button" aria-label="Close tab">
        <svg viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </div>
    `;
    el.querySelector(".title").textContent = t.title || prettyTitle(t.url);
    el.addEventListener("mousedown", (e) => {
      if (e.target.closest(".close")) return;
      if (e.button === 1) {
        // middle-click closes the tab
        e.preventDefault();
        closeTab(t.id);
      } else if (e.button === 0) {
        switchTab(t.id);
      }
    });
    el.querySelector(".close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(t.id);
    });
    tabsEl.appendChild(el);
  }
}

async function newTab(url) {
  const info = await invoke("new_tab", { url: url ?? null });
  // Backend will emit tabs-changed; but update locally for instant feedback.
  if (!getTab(info.id)) {
    state.tabs.push({ id: info.id, url: info.url, title: prettyTitle(info.url) });
  }
  setActive(info.id);
}

async function closeTab(id) {
  await invoke("close_tab", { tabId: id });
  state.tabs = state.tabs.filter((t) => t.id !== id);
  if (state.activeId === id) {
    state.activeId = state.tabs.length ? state.tabs[state.tabs.length - 1].id : null;
  }
  renderTabs();
  const t = getTab(state.activeId);
  if (t) addrInput.value = t.url;
}

async function switchTab(id) {
  if (id === state.activeId) return;
  await invoke("switch_tab", { tabId: id });
  setActive(id);
}

async function navigateCurrent(url) {
  if (!state.activeId) {
    await newTab(url);
    return;
  }
  const resolved = await invoke("navigate", { tabId: state.activeId, url });
  const t = getTab(state.activeId);
  if (t) {
    t.url = resolved;
    t.title = prettyTitle(resolved);
  }
  renderTabs();
  addrInput.value = resolved;
}

// Wire UI
addrForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = addrInput.value.trim();
  if (!v) return;
  navigateCurrent(v);
  addrInput.blur();
});

addrInput.addEventListener("focus", () => addrInput.select());

$("new-tab").addEventListener("click", () => newTab());
$("back").addEventListener("click", () => {
  if (state.activeId) invoke("go_back", { tabId: state.activeId });
});
$("forward").addEventListener("click", () => {
  if (state.activeId) invoke("go_forward", { tabId: state.activeId });
});
$("reload").addEventListener("click", () => {
  if (state.activeId) invoke("reload", { tabId: state.activeId });
});
$("home").addEventListener("click", () => {
  if (state.activeId) navigateCurrent("https://www.google.com/");
});

// Window controls
const win = getCurrentWindow();
$("win-min").addEventListener("click", () => win.minimize());
$("win-max").addEventListener("click", () => win.toggleMaximize());
$("win-close").addEventListener("click", () => win.close());

// Menu
$("menu").addEventListener("click", (e) => {
  e.stopPropagation();
  menu.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!menu.classList.contains("hidden") && !menu.contains(e.target)) {
    menu.classList.add("hidden");
  }
});
menu.addEventListener("click", (e) => {
  const btn = e.target.closest(".menu-item");
  if (!btn) return;
  menu.classList.add("hidden");
  const action = btn.dataset.action;
  switch (action) {
    case "new-tab":
      newTab();
      break;
    case "reload":
      if (state.activeId) invoke("reload", { tabId: state.activeId });
      break;
    case "home":
      if (state.activeId) navigateCurrent("https://www.google.com/");
      break;
    case "toggle-theme": {
      const root = document.documentElement;
      const next = root.dataset.theme === "light" ? "dark" : "light";
      root.dataset.theme = next;
      localStorage.setItem("nova:theme", next);
      break;
    }
    case "about":
      navigateCurrent(
        "data:text/html," +
          encodeURIComponent(
            `<!doctype html><meta charset=utf-8><title>About Nova</title>
<style>html,body{height:100%}body{margin:0;display:grid;place-items:center;font:16px system-ui;background:linear-gradient(135deg,#0b0d12,#1a1030);color:#e7ecf4}
.card{padding:48px 56px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);text-align:center;backdrop-filter:blur(18px)}
h1{margin:0 0 8px;font-size:38px;background:linear-gradient(135deg,#7c5cff,#2cd4ff);-webkit-background-clip:text;background-clip:text;color:transparent}
p{margin:6px 0;color:#9aa3b2}</style>
<div class=card><h1>Nova</h1><p>A modern, sleek, lightning-fast browser.</p><p>v0.1.0 · Built with Tauri</p></div>`
          )
      );
      break;
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === "t") {
    e.preventDefault();
    newTab();
  } else if (ctrl && e.key.toLowerCase() === "w") {
    e.preventDefault();
    if (state.activeId) closeTab(state.activeId);
  } else if (ctrl && e.key.toLowerCase() === "r") {
    e.preventDefault();
    if (state.activeId) invoke("reload", { tabId: state.activeId });
  } else if (ctrl && e.key.toLowerCase() === "l") {
    e.preventDefault();
    addrInput.focus();
  } else if (ctrl && e.key === "Tab") {
    e.preventDefault();
    if (state.tabs.length < 2) return;
    const idx = state.tabs.findIndex((t) => t.id === state.activeId);
    const next = state.tabs[(idx + 1) % state.tabs.length];
    switchTab(next.id);
  } else if (e.altKey && e.key === "ArrowLeft") {
    e.preventDefault();
    if (state.activeId) invoke("go_back", { tabId: state.activeId });
  } else if (e.altKey && e.key === "ArrowRight") {
    e.preventDefault();
    if (state.activeId) invoke("go_forward", { tabId: state.activeId });
  }
});

// Sync from backend events
listen("nova://tabs-changed", (event) => {
  const payload = event.payload || {};
  const ids = payload.tabs || [];
  // Add any tabs we don't know about yet; drop any we no longer have.
  state.tabs = ids.map((id) => {
    const existing = getTab(id);
    return existing || { id, url: "about:blank", title: "New tab" };
  });
  state.activeId = payload.active || null;
  renderTabs();
  const t = getTab(state.activeId);
  if (t && document.activeElement !== addrInput) addrInput.value = t.url;
});

// Restore theme preference
const savedTheme = localStorage.getItem("nova:theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

// Tell the backend we're ready — it will create the initial tab.
invoke("chrome_ready");
