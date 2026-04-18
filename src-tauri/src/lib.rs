//! Nova Browser — Tauri backend.
//!
//! Architecture:
//! - A single native `Window` labelled `main`.
//! - A fixed-height "chrome" `Webview` (tabs, address bar, buttons) pinned at the top.
//! - One `Webview` per browser tab, stacked below the chrome. The active tab fills
//!   the content area; inactive tabs are moved off-screen so their DOM stays alive
//!   and tab switching is instant (no reload).

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{
    webview::WebviewBuilder, AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url,
    WebviewUrl, WindowEvent,
};

const CHROME_HEIGHT: f64 = 96.0;
const DEFAULT_HOME: &str = "https://www.google.com/";

static NEXT_TAB_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Default)]
struct AppState {
    active_tab: Mutex<Option<String>>,
    tabs: Mutex<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct TabInfo {
    id: String,
    url: String,
}

fn new_tab_label() -> String {
    let n = NEXT_TAB_ID.fetch_add(1, Ordering::Relaxed);
    format!("tab-{}", n)
}

/// Normalize a user-entered address-bar value into a URL.
/// Falls back to a Google search for anything that isn't a plausible URL.
fn resolve_input(input: &str) -> Url {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Url::parse(DEFAULT_HOME).expect("valid");
    }
    if let Ok(url) = Url::parse(trimmed) {
        if url.scheme() == "http" || url.scheme() == "https" || url.scheme() == "about" {
            return url;
        }
    }
    // Looks like a bare domain (e.g. "example.com/path")?
    let looks_like_domain = !trimmed.contains(' ')
        && trimmed.contains('.')
        && trimmed
            .chars()
            .next()
            .map(|c| c.is_ascii_alphanumeric())
            .unwrap_or(false);
    if looks_like_domain {
        if let Ok(url) = Url::parse(&format!("https://{}", trimmed)) {
            return url;
        }
    }
    // Fallback: search Google.
    let encoded = urlencode(trimmed);
    Url::parse(&format!("https://www.google.com/search?q={}", encoded))
        .expect("valid search url")
}

fn urlencode(input: &str) -> String {
    // Minimal URL-encoder for query strings (space -> '+').
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b' ' => out.push('+'),
            b if b.is_ascii_alphanumeric()
                || b == b'-'
                || b == b'_'
                || b == b'.'
                || b == b'~' =>
            {
                out.push(b as char)
            }
            b => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn window_inner_logical(window: &tauri::Window) -> (f64, f64) {
    let scale = window.scale_factor().unwrap_or(1.0);
    let size = window.inner_size().unwrap_or_default();
    let w = (size.width as f64 / scale).max(1.0);
    let h = (size.height as f64 / scale).max(1.0);
    (w, h)
}

fn apply_layout(app: &AppHandle) {
    let Some(window) = app.get_window("main") else {
        return;
    };
    let (w, h) = window_inner_logical(&window);
    let state = app.state::<AppState>();

    // Chrome stays pinned at the top full-width.
    if let Some(chrome) = app.get_webview("chrome") {
        let _ = chrome.set_position(LogicalPosition::new(0.0, 0.0));
        let _ = chrome.set_size(LogicalSize::new(w, CHROME_HEIGHT));
    }

    let content_h = (h - CHROME_HEIGHT).max(1.0);
    let tabs = state.tabs.lock().clone();
    let active = state.active_tab.lock().clone();

    for tab_id in tabs.iter() {
        if let Some(wv) = app.get_webview(tab_id) {
            if Some(tab_id) == active.as_ref() {
                let _ = wv.set_position(LogicalPosition::new(0.0, CHROME_HEIGHT));
                let _ = wv.set_size(LogicalSize::new(w, content_h));
            } else {
                // Park inactive tabs off-screen; keeps their DOM/JS state alive.
                let _ = wv.set_position(LogicalPosition::new(-20000.0, -20000.0));
                let _ = wv.set_size(LogicalSize::new(1.0, 1.0));
            }
        }
    }
}

fn emit_tabs_changed(app: &AppHandle) {
    let state = app.state::<AppState>();
    let tabs = state.tabs.lock().clone();
    let active = state.active_tab.lock().clone();
    let payload = serde_json::json!({
        "tabs": tabs,
        "active": active,
    });
    let _ = app.emit("nova://tabs-changed", payload);
}

// ----- Tauri commands -----

#[tauri::command]
fn new_tab(app: AppHandle, url: Option<String>) -> Result<TabInfo, String> {
    let window = app
        .get_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let label = new_tab_label();
    let target = match url {
        Some(u) if !u.is_empty() => resolve_input(&u),
        _ => Url::parse(DEFAULT_HOME).expect("valid"),
    };

    let builder = WebviewBuilder::new(&label, WebviewUrl::External(target.clone()));
    window
        .add_child(
            builder,
            LogicalPosition::new(0.0, CHROME_HEIGHT),
            LogicalSize::new(100.0, 100.0),
        )
        .map_err(|e| format!("add_child failed: {e}"))?;

    {
        let state = app.state::<AppState>();
        state.tabs.lock().push(label.clone());
        *state.active_tab.lock() = Some(label.clone());
    }

    apply_layout(&app);
    emit_tabs_changed(&app);

    Ok(TabInfo {
        id: label,
        url: target.to_string(),
    })
}

#[tauri::command]
fn close_tab(app: AppHandle, tab_id: String) -> Result<(), String> {
    // Remove from state first, then destroy the webview.
    let (remaining, was_active) = {
        let state = app.state::<AppState>();
        let mut tabs = state.tabs.lock();
        tabs.retain(|t| t != &tab_id);
        let remaining = tabs.clone();
        drop(tabs);
        let mut active = state.active_tab.lock();
        let was_active = active.as_deref() == Some(&tab_id);
        if was_active {
            *active = remaining.last().cloned();
        }
        (remaining, was_active)
    };

    if let Some(wv) = app.get_webview(&tab_id) {
        let _ = wv.close();
    }

    apply_layout(&app);
    emit_tabs_changed(&app);

    // If the user closed the last tab, open a fresh one so the window isn't empty.
    if remaining.is_empty() && was_active {
        let _ = new_tab(app, None);
    }
    Ok(())
}

#[tauri::command]
fn switch_tab(app: AppHandle, tab_id: String) -> Result<(), String> {
    {
        let state = app.state::<AppState>();
        if !state.tabs.lock().contains(&tab_id) {
            return Err("unknown tab".into());
        }
        *state.active_tab.lock() = Some(tab_id);
    }
    apply_layout(&app);
    emit_tabs_changed(&app);
    Ok(())
}

#[tauri::command]
fn navigate(app: AppHandle, tab_id: String, url: String) -> Result<String, String> {
    let wv = app
        .get_webview(&tab_id)
        .ok_or_else(|| "unknown tab".to_string())?;
    let target = resolve_input(&url);
    wv.navigate(target.clone()).map_err(|e| e.to_string())?;
    Ok(target.to_string())
}

#[tauri::command]
fn go_back(app: AppHandle, tab_id: String) -> Result<(), String> {
    let wv = app
        .get_webview(&tab_id)
        .ok_or_else(|| "unknown tab".to_string())?;
    wv.eval("history.back()").map_err(|e| e.to_string())
}

#[tauri::command]
fn go_forward(app: AppHandle, tab_id: String) -> Result<(), String> {
    let wv = app
        .get_webview(&tab_id)
        .ok_or_else(|| "unknown tab".to_string())?;
    wv.eval("history.forward()").map_err(|e| e.to_string())
}

#[tauri::command]
fn reload(app: AppHandle, tab_id: String) -> Result<(), String> {
    let wv = app
        .get_webview(&tab_id)
        .ok_or_else(|| "unknown tab".to_string())?;
    wv.eval("location.reload()").map_err(|e| e.to_string())
}

#[tauri::command]
fn list_tabs(app: AppHandle) -> (Vec<String>, Option<String>) {
    let state = app.state::<AppState>();
    let tabs = state.tabs.lock().clone();
    let active = state.active_tab.lock().clone();
    (tabs, active)
}

/// Called by the chrome UI once it has finished booting. Ensures there's at
/// least one tab open and triggers a layout pass.
#[tauri::command]
fn chrome_ready(app: AppHandle) -> Result<(), String> {
    let empty = app.state::<AppState>().tabs.lock().is_empty();
    if empty {
        new_tab(app.clone(), None)?;
    } else {
        apply_layout(&app);
        emit_tabs_changed(&app);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            new_tab,
            close_tab,
            switch_tab,
            navigate,
            go_back,
            go_forward,
            reload,
            list_tabs,
            chrome_ready,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Create the main native window (no embedded webview — we add children).
            let window = tauri::window::WindowBuilder::new(&handle, "main")
                .title("Nova")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 560.0)
                .resizable(true)
                .build()?;

            // Add the chrome (UI) webview pinned to the top.
            let chrome_builder =
                WebviewBuilder::new("chrome", WebviewUrl::App("index.html".into()));
            window.add_child(
                chrome_builder,
                LogicalPosition::new(0.0, 0.0),
                LogicalSize::new(1280.0, CHROME_HEIGHT),
            )?;

            // Re-layout child webviews whenever the window changes size.
            let resize_handle = handle.clone();
            window.on_window_event(move |event| {
                if matches!(
                    event,
                    WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. }
                ) {
                    apply_layout(&resize_handle);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Nova");
}
