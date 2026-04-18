// Nova new-tab page — live clock, greeting, and search.
(function () {
  "use strict";

  // Theme: honor the setting the chrome UI stored.
  try {
    const saved = localStorage.getItem("nova:theme");
    if (saved) document.documentElement.dataset.theme = saved;
  } catch {}

  function pad(n) { return String(n).padStart(2, "0"); }

  function tickClock() {
    const el = document.getElementById("clock");
    if (!el) return;
    const d = new Date();
    el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function setGreeting() {
    const el = document.getElementById("greeting");
    if (!el) return;
    const h = new Date().getHours();
    let text = "Welcome back";
    if (h < 5) text = "Good night";
    else if (h < 12) text = "Good morning";
    else if (h < 18) text = "Good afternoon";
    else text = "Good evening";
    el.textContent = text;
  }

  function resolveQuery(v) {
    const s = v.trim();
    if (!s) return null;
    // Already a URL?
    try {
      const u = new URL(s);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch {}
    // Looks like a bare domain?
    const looksDomain = !s.includes(" ") && s.includes(".") && /^[a-z0-9]/i.test(s);
    if (looksDomain) return "https://" + s;
    return "https://www.google.com/search?q=" + encodeURIComponent(s);
  }

  function wire() {
    const form = document.getElementById("search");
    const input = document.getElementById("q");
    if (form && input) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const target = resolveQuery(input.value);
        if (target) window.location.href = target;
      });
    }
  }

  tickClock();
  setGreeting();
  setInterval(tickClock, 15000);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
