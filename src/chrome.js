// Nova browser — chrome UI logic.
// Communicates with the Rust backend via Tauri `invoke`.

(function () {
  "use strict";

  // --- Diagnostics: surface bootstrap errors in the UI itself, since opening
  // --- devtools in a Tauri release build isn't trivial.
  function showError(msg) {
    let box = document.getElementById("nova-error");
    if (!box) {
      box = document.createElement("pre");
      box.id = "nova-error";
      box.style.cssText = [
        "position:fixed",
        "left:12px",
        "right:12px",
        "bottom:12px",
        "max-height:40vh",
        "overflow:auto",
        "padding:12px 14px",
        "background:#2b0f14",
        "color:#ffb4be",
        "border:1px solid #ff5c7a",
        "border-radius:12px",
        "font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
        "white-space:pre-wrap",
        "z-index:9999",
        "box-shadow:0 20px 40px -12px rgba(0,0,0,.6)",
      ].join(";");
      document.body.appendChild(box);
    }
    box.textContent = (box.textContent ? box.textContent + "\n" : "") + String(msg);
  }
  window.addEventListener("error", (e) =>
    showError("JS error: " + (e.error?.stack || e.message || e))
  );
  window.addEventListener("unhandledrejection", (e) =>
    showError("Unhandled rejection: " + (e.reason?.stack || e.reason || e))
  );

  // --- Resolve Tauri globals defensively ---
  const T = window.__TAURI__;
  if (!T) {
    showError(
      "window.__TAURI__ is undefined. The Tauri runtime did not initialize." +
        " Is the app running outside of Tauri?"
    );
    return;
  }

  const invoke =
    T.core?.invoke || T.invoke || T.tauri?.invoke || null;
  const listen = T.event?.listen || null;
  if (!invoke) {
    showError(
      "No invoke() API found on window.__TAURI__. Keys: " +
        Object.keys(T).join(", ")
    );
    return;
  }
  if (!listen) {
    showError(
      "No event.listen() API found on window.__TAURI__. Keys: " +
        Object.keys(T).join(", ")
    );
  }

  const state = {
    tabs: [], // array of { id, title, url }
    activeId: null,
  };

  const $ = (id) => document.getElementById(id);

  function getTab(id) {
    return state.tabs.find((t) => t.id === id);
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
    const tabsEl = $("tabs");
    if (!tabsEl) return;
    tabsEl.innerHTML = "";
    for (const t of state.tabs) {
      const el = document.createElement("div");
      el.className = "tab" + (t.id === state.activeId ? " active" : "");
      el.dataset.id = t.id;
      el.innerHTML =
        '<div class="favicon"></div>' +
        '<div class="title"></div>' +
        '<div class="close" role="button" aria-label="Close tab">' +
        '<svg viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
        "</div>";
      el.querySelector(".title").textContent = t.title || prettyTitle(t.url);
      el.addEventListener("mousedown", (e) => {
        if (e.target.closest(".close")) return;
        if (e.button === 1) {
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

  function setActive(id) {
    state.activeId = id;
    renderTabs();
    const t = getTab(id);
    const addr = $("addr");
    if (t && addr) addr.value = t.url;
  }

  async function newTab(url) {
    try {
      const info = await invoke("new_tab", { url: url ?? null });
      if (!getTab(info.id)) {
        state.tabs.push({
          id: info.id,
          url: info.url,
          title: prettyTitle(info.url),
        });
      }
      setActive(info.id);
    } catch (e) {
      showError("new_tab failed: " + e);
    }
  }

  async function closeTab(id) {
    try {
      await invoke("close_tab", { tabId: id });
      state.tabs = state.tabs.filter((t) => t.id !== id);
      if (state.activeId === id) {
        state.activeId = state.tabs.length
          ? state.tabs[state.tabs.length - 1].id
          : null;
      }
      renderTabs();
      const t = getTab(state.activeId);
      const addr = $("addr");
      if (t && addr) addr.value = t.url;
    } catch (e) {
      showError("close_tab failed: " + e);
    }
  }

  async function switchTab(id) {
    if (id === state.activeId) return;
    try {
      await invoke("switch_tab", { tabId: id });
      setActive(id);
    } catch (e) {
      showError("switch_tab failed: " + e);
    }
  }

  async function navigateCurrent(url) {
    if (!state.activeId) {
      await newTab(url);
      return;
    }
    try {
      const resolved = await invoke("navigate", {
        tabId: state.activeId,
        url,
      });
      const t = getTab(state.activeId);
      if (t) {
        t.url = resolved;
        t.title = prettyTitle(resolved);
      }
      renderTabs();
      const addr = $("addr");
      if (addr) addr.value = resolved;
    } catch (e) {
      showError("navigate failed: " + e);
    }
  }

  function wire() {
    const addrInput = $("addr");
    const addrForm = $("addr-form");
    const menu = $("menu-panel");

    if (addrForm && addrInput) {
      addrForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const v = addrInput.value.trim();
        if (!v) return;
        navigateCurrent(v);
        addrInput.blur();
      });
      addrInput.addEventListener("focus", () => addrInput.select());
    }

    $("new-tab")?.addEventListener("click", () => newTab());
    $("back")?.addEventListener("click", () => {
      if (state.activeId) invoke("go_back", { tabId: state.activeId });
    });
    $("forward")?.addEventListener("click", () => {
      if (state.activeId) invoke("go_forward", { tabId: state.activeId });
    });
    $("reload")?.addEventListener("click", () => {
      if (state.activeId) invoke("reload", { tabId: state.activeId });
    });
    $("home")?.addEventListener("click", () => {
      if (state.activeId) navigateCurrent("https://www.google.com/");
    });

    // Window controls: use backend commands so we don't depend on the
    // global window JS API (whose path can vary).
    $("win-min")?.addEventListener("click", () => invoke("win_minimize"));
    $("win-max")?.addEventListener("click", () => invoke("win_toggle_maximize"));
    $("win-close")?.addEventListener("click", () => invoke("win_close"));

    if (menu) {
      $("menu")?.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("hidden");
      });
      document.addEventListener("click", (e) => {
        if (
          !menu.classList.contains("hidden") &&
          !menu.contains(e.target)
        ) {
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
                  "<!doctype html><meta charset=utf-8><title>About Nova</title>" +
                    "<style>html,body{height:100%}body{margin:0;display:grid;place-items:center;font:16px system-ui;background:linear-gradient(135deg,#0b0d12,#1a1030);color:#e7ecf4}" +
                    ".card{padding:48px 56px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);text-align:center;backdrop-filter:blur(18px)}" +
                    "h1{margin:0 0 8px;font-size:38px;background:linear-gradient(135deg,#7c5cff,#2cd4ff);-webkit-background-clip:text;background-clip:text;color:transparent}" +
                    "p{margin:6px 0;color:#9aa3b2}</style>" +
                    "<div class=card><h1>Nova</h1><p>A modern, sleek, lightning-fast browser.</p><p>v0.1.0 · Built with Tauri</p></div>"
                )
            );
            break;
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (ctrl && k === "t") {
        e.preventDefault();
        newTab();
      } else if (ctrl && k === "w") {
        e.preventDefault();
        if (state.activeId) closeTab(state.activeId);
      } else if (ctrl && k === "r") {
        e.preventDefault();
        if (state.activeId) invoke("reload", { tabId: state.activeId });
      } else if (ctrl && k === "l") {
        e.preventDefault();
        $("addr")?.focus();
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
  }

  function onTabsChanged(payload) {
    const p = payload || {};
    const ids = p.tabs || [];
    state.tabs = ids.map((id) => {
      const existing = getTab(id);
      return existing || { id, url: "about:blank", title: "New tab" };
    });
    state.activeId = p.active || null;
    renderTabs();
    const t = getTab(state.activeId);
    const addr = $("addr");
    if (t && addr && document.activeElement !== addr) addr.value = t.url;
  }

  function boot() {
    try {
      wire();
    } catch (e) {
      showError("wire() failed: " + (e?.stack || e));
    }

    // Restore theme preference
    try {
      const savedTheme = localStorage.getItem("nova:theme");
      if (savedTheme) document.documentElement.dataset.theme = savedTheme;
    } catch {}

    if (listen) {
      listen("nova://tabs-changed", (event) => onTabsChanged(event.payload)).catch(
        (e) => showError("listen() failed: " + e)
      );
    }

    // Tell the backend we're ready — it will create the initial tab.
    invoke("chrome_ready").catch((e) =>
      showError("chrome_ready invoke failed: " + e)
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
