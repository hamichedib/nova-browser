# Nova

A modern, sleek, lightning-fast browser for Windows (and Linux/macOS), built with [Tauri 2](https://tauri.app). 2026-inspired glassmorphism UI, native multi-webview tabs, keyboard-first navigation.

> Tiny footprint (~10 MB installer). Uses the system's native webview (WebView2 on Windows) for blazing-fast page rendering.

## Features

- Native multi-tab browsing (each tab is a real webview — no iframes)
- Frosted-glass, 2026-inspired UI with light/dark themes
- Smart address bar (URL or Google search)
- Familiar keyboard shortcuts: `Ctrl+T`, `Ctrl+W`, `Ctrl+R`, `Ctrl+L`, `Ctrl+Tab`, `Alt+Left/Right`
- Custom window controls with drag region
- Instant tab switching (inactive tabs stay alive in memory)

## Download

Every push to the repo builds a fresh Windows installer via GitHub Actions. Grab the latest `.exe` from the most recent run:

**[Actions → latest Build Nova (Windows) run → `nova-windows-nsis-exe`](../../actions/workflows/build-windows.yml)**

## Development

### Prerequisites
- [Rust](https://rustup.rs/) (stable, 1.85+)
- [Node.js](https://nodejs.org/) (20+)
- On Linux: `libwebkit2gtk-4.1-dev librsvg2-dev libsoup-3.0-dev`
- On Windows: WebView2 (pre-installed on Windows 11; Win10 installer auto-fetches)

### Run
```bash
npm install
npm run dev
```

### Build installers
```bash
npm run build          # produces platform-appropriate bundles
```

Windows output lands in `src-tauri/target/release/bundle/nsis/*.exe`.

## Architecture

```
┌──────────────────────────────────────────────────┐
│ main Window  (tauri::Window, no embedded webview)│
│ ┌──────────────────────────────────────────────┐ │
│ │ chrome  webview — index.html / chrome.{css,js}│ │ ← 96px tall
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ tab-0 / tab-1 / ... webviews (active shown,   │ │
│ │ inactive parked off-screen)                   │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

The Rust backend owns tab lifecycle (`new_tab`, `close_tab`, `switch_tab`, `navigate`, etc.). The chrome UI talks to it via `invoke()`, and subscribes to `nova://tabs-changed` events.

## License

MIT
