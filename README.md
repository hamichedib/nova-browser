# Nova

**Nova** is a modern, sleek browser with two editions:

| Edition | Engine | Technology | Size |
|---------|--------|-----------|------|
| **Nova Launcher** | Firefox (Gecko) | Rust | ~400 KB |
| **Nova Browser** | Chromium (CEF) | WPF / .NET 8 / CefSharp | Full app |

Both editions share the same stunning **glassmorphism UI** with aurora
gradients and the branded new-tab page.

---

## Nova Browser (WPF + CefSharp)

A full-featured desktop browser built with **WPF** and **CefSharp** targeting
**.NET 8.0 for Windows**. Features:

- **Tabbed browsing** with keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab).
- **Smart address bar** — detects URLs vs search queries automatically.
- **Navigation controls** — back, forward, reload, home.
- **Bookmarks** — saved locally as JSON.
- **Downloads** — with progress in the status bar.
- **Aurora-themed new-tab page** with live clock, greeting, and quick-access
  tiles (Arabic-friendly).
- **Keyboard shortcuts** — F5 reload, F11 fullscreen, Alt+← / Alt+→ nav,
  Ctrl+L focus address bar.

### Install

1. Download the **`nova-wpf-browser`** artifact from the latest
   [GitHub Actions build](https://github.com/hamichedib/nova-browser/actions).
2. Extract the folder and run **`NovaBrowser.exe`**.

### Build from source

```powershell
cd NovaBrowser
dotnet restore -r win-x64
dotnet publish -c Release -r win-x64 --self-contained true -o ../dist/NovaBrowser
```

The output at `dist/NovaBrowser/NovaBrowser.exe` is a standalone Windows
desktop app — no .NET runtime install required.

---

## Nova Launcher (Rust + Firefox)

The original lightweight launcher. On first run it locates Firefox on your
system — or downloads the official Mozilla Firefox installer and installs a
private copy to `%LOCALAPPDATA%\Nova\firefox` — then launches it with a
pre-configured Nova profile that gives you:

- A glassmorphism theme (aurora gradients, translucent toolbars) applied via
  `userChrome.css`.
- A branded new-tab / home page with a live clock, quick-access tiles, and a
  smart URL / search bar.
- Quiet defaults (no onboarding tabs, no default-browser prompts, no
  telemetry popups).

### Install

1. Download **`Nova-Setup-0.1.0.exe`** from the latest
   [GitHub Actions build](https://github.com/hamichedib/nova-browser/actions).
2. Run it. Windows SmartScreen may warn because the exe isn't code-signed —
   click **More info → Run anyway**.
3. Launch **Nova** from the Start menu or the desktop shortcut. On first run
   Nova will download Firefox (~60 MB) and install it privately — this only
   happens once.

### Develop locally (Linux / macOS)

```bash
cd launcher
cargo run --release
```

On Linux / macOS, Nova launches your system Firefox against the Nova profile
— no download step needed. Great for iterating on the theme.

---

## Repo layout

- `NovaBrowser/` — WPF + CefSharp browser (Chromium-based):
  - `NovaBrowser.csproj` — .NET 8 project file.
  - `App.xaml(.cs)` — Application entry with CefSharp init.
  - `MainWindow.xaml(.cs)` — Main browser window (tabs, nav, status).
  - `Resources/newtab.html` — Aurora-themed new-tab page.
  - `AppIcon.ico` — Application icon.
- `launcher/` — Rust source for `Nova.exe` (the native launcher).
- `launcher/profile/` — Files copied into the Nova Firefox profile:
  - `chrome/userChrome.css` — Firefox UI theme.
  - `chrome/userContent.css` — Tweaks for `about:*` pages.
  - `user.js` — Locked preferences (homepage, telemetry off, …).
  - `newtab.html` — Nova's branded home / new-tab page.
- `installer/Nova.nsi` — NSIS installer script that wraps `Nova.exe`.
- `.github/workflows/build-windows.yml` — CI that builds both editions on
  every push.
