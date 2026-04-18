# Nova

**Nova** is a modern, sleek browser powered by the **Firefox (Gecko)** engine.

Nova itself is a tiny (~400 KB) native launcher. On first run it locates
Firefox on your system — or downloads the official Mozilla Firefox installer
and installs a private copy to `%LOCALAPPDATA%\Nova\firefox` — then launches
it with a pre-configured Nova profile that gives you:

- A glassmorphism theme (aurora gradients, translucent toolbars) applied via
  `userChrome.css`.
- A branded new-tab / home page with a live clock, quick-access tiles, and a
  smart URL / search bar.
- Quiet defaults (no onboarding tabs, no default-browser prompts, no
  telemetry popups).

## Install on Windows

1. Download **`Nova-Setup-0.1.0.exe`** from the latest
   [GitHub Actions build](https://github.com/hamichedib/nova-browser/actions).
2. Run it. Windows SmartScreen may warn because the exe isn't code-signed —
   click **More info → Run anyway**.
3. Launch **Nova** from the Start menu or the desktop shortcut. On first run
   Nova will download Firefox (~60 MB) and install it privately — this only
   happens once.

## Repo layout

- `launcher/` — Rust source for `Nova.exe` (the native launcher).
- `launcher/profile/` — Files copied into the Nova Firefox profile:
  - `chrome/userChrome.css` — Firefox UI theme.
  - `chrome/userContent.css` — Tweaks for `about:*` pages.
  - `user.js` — Locked preferences (homepage, telemetry off, …).
  - `newtab.html` — Nova's branded home / new-tab page.
- `installer/Nova.nsi` — NSIS installer script that wraps `Nova.exe`.
- `.github/workflows/build-windows.yml` — CI that builds the Windows exe +
  installer on every push.

## Develop locally (Linux / macOS)

```bash
cd launcher
cargo run --release
```

On Linux / macOS, Nova launches your system Firefox against the Nova profile
— no download step needed. Great for iterating on the theme.
