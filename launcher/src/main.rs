//! Nova — modern, sleek browser powered by the Firefox (Gecko) engine.
//!
//! `Nova.exe` is a small native launcher. On first run it:
//!   1. Locates the Firefox engine (a private copy under %LOCALAPPDATA%\Nova\firefox,
//!      otherwise falls back to a system install).
//!   2. If no engine is found, downloads the official Mozilla Firefox stub installer
//!      and silently installs it into %LOCALAPPDATA%\Nova\firefox.
//!   3. Writes / refreshes the Nova browser profile (custom `userChrome.css`
//!      theme, preferences, and the bundled `newtab.html` home page) under
//!      %LOCALAPPDATA%\Nova\profile.
//!   4. Launches `firefox.exe -profile <dir> -no-remote` so the user sees a
//!      Nova-branded Firefox window.
//!
//! On macOS / Linux we still launch the system `firefox` binary with the Nova
//! profile, so the same launcher works everywhere.

#![cfg_attr(windows, windows_subsystem = "windows")]

use std::fs;
#[cfg(windows)]
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

// ---------- bundled profile assets ----------

const USER_CHROME_CSS: &str = include_str!("../profile/chrome/userChrome.css");
const USER_CONTENT_CSS: &str = include_str!("../profile/chrome/userContent.css");
const USER_JS: &str = include_str!("../profile/user.js");
const NEWTAB_HTML: &str = include_str!("../profile/newtab.html");

// ---------- platform helpers ----------

fn app_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local).join("Nova");
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join("Library/Application Support/Nova");
        }
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
            return PathBuf::from(xdg).join("Nova");
        }
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join(".local/share/Nova");
        }
    }
    PathBuf::from(".nova")
}

fn firefox_dir() -> PathBuf {
    app_dir().join("firefox")
}

fn profile_dir() -> PathBuf {
    app_dir().join("profile")
}

/// Turn a local path into a `file:///` URL suitable for browsers.
fn file_url(p: &Path) -> String {
    let s = p.to_string_lossy().replace('\\', "/");
    let s = s.replace(' ', "%20");
    if s.starts_with('/') {
        format!("file://{s}")
    } else {
        format!("file:///{s}")
    }
}

// ---------- find / install Firefox ----------

/// Return the path to a working `firefox` executable, or `None` if we couldn't
/// find one (and couldn't install one either).
fn find_or_install_firefox() -> Option<PathBuf> {
    // 1. Private Nova-managed copy.
    let private = firefox_dir().join(FIREFOX_BIN);
    if private.is_file() {
        return Some(private);
    }

    // 2. System install in common locations.
    if let Some(p) = find_system_firefox() {
        return Some(p);
    }

    // 3. Download & install our private copy.
    if install_firefox(&firefox_dir()).is_ok() {
        if private.is_file() {
            return Some(private);
        }
    }

    None
}

#[cfg(windows)]
const FIREFOX_BIN: &str = "firefox.exe";
#[cfg(not(windows))]
const FIREFOX_BIN: &str = "firefox";

#[cfg(windows)]
fn find_system_firefox() -> Option<PathBuf> {
    use winreg::enums::*;
    use winreg::RegKey;

    let subkeys = [
        r"SOFTWARE\Mozilla\Mozilla Firefox",
        r"SOFTWARE\WOW6432Node\Mozilla\Mozilla Firefox",
    ];
    for hive in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
        for subkey in &subkeys {
            let root = RegKey::predef(hive);
            if let Ok(ff) = root.open_subkey(subkey) {
                if let Ok(current) = ff.get_value::<String, _>("CurrentVersion") {
                    if let Ok(ver) = ff.open_subkey(format!("{current}\\Main")) {
                        if let Ok(path) = ver.get_value::<String, _>("PathToExe") {
                            let p = PathBuf::from(path);
                            if p.is_file() {
                                return Some(p);
                            }
                        }
                    }
                }
            }
        }
    }

    let candidates = [
        r"C:\Program Files\Mozilla Firefox\firefox.exe",
        r"C:\Program Files (x86)\Mozilla Firefox\firefox.exe",
    ];
    for c in candidates {
        let p = PathBuf::from(c);
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn find_system_firefox() -> Option<PathBuf> {
    let candidates = [
        "/Applications/Firefox.app/Contents/MacOS/firefox",
        "/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox",
    ];
    for c in candidates {
        let p = PathBuf::from(c);
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

#[cfg(all(unix, not(target_os = "macos")))]
fn find_system_firefox() -> Option<PathBuf> {
    for candidate in [
        "/usr/bin/firefox",
        "/usr/bin/firefox-esr",
        "/snap/bin/firefox",
        "/usr/local/bin/firefox",
    ] {
        let p = PathBuf::from(candidate);
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

// ---------- install Firefox (Windows only) ----------

#[cfg(windows)]
fn install_firefox(dest: &Path) -> std::io::Result<()> {
    show_status("Nova", "Downloading the Firefox engine (~60 MB, one-time)...");

    let temp = std::env::temp_dir().join("nova-firefox-setup.exe");
    download_file(
        "https://download.mozilla.org/?product=firefox-latest-ssl&os=win64&lang=en-US",
        &temp,
    )?;

    fs::create_dir_all(dest)?;
    // Firefox's full installer supports silent install via /S /InstallDirectoryPath.
    let status = Command::new(&temp)
        .arg("/S")
        .arg(format!("/InstallDirectoryPath={}", dest.display()))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()?;

    let _ = fs::remove_file(&temp);

    if !status.success() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Firefox setup exited with {status:?}"),
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
fn install_firefox(_dest: &Path) -> std::io::Result<()> {
    // On non-Windows we just expect the user to have Firefox installed via the
    // usual OS package manager; no auto-install.
    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "Firefox is not installed. Install it via your system package manager.",
    ))
}

#[cfg(windows)]
fn download_file(url: &str, dest: &Path) -> std::io::Result<()> {
    let agent = ureq::AgentBuilder::new()
        .redirects(10)
        .timeout(std::time::Duration::from_secs(120))
        .build();
    let resp = agent
        .get(url)
        .call()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, format!("GET {url}: {e}")))?;
    let mut reader = resp.into_reader();
    let mut file = fs::File::create(dest)?;
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n])?;
    }
    Ok(())
}

// ---------- profile ----------

fn write_profile() -> std::io::Result<PathBuf> {
    let profile = profile_dir();
    fs::create_dir_all(profile.join("chrome"))?;

    fs::write(
        profile.join("chrome").join("userChrome.css"),
        USER_CHROME_CSS,
    )?;
    fs::write(
        profile.join("chrome").join("userContent.css"),
        USER_CONTENT_CSS,
    )?;
    // The bundled Nova new-tab / home page. Firefox can load local files
    // directly via file:/// — much simpler than a chrome:// override.
    let newtab_path = profile.join("newtab.html");
    fs::write(&newtab_path, NEWTAB_HTML)?;

    // user.js contains a `%PROFILE_PATH%` placeholder we have to resolve to
    // the profile's absolute path before Firefox reads the prefs.
    let newtab_url = file_url(&newtab_path);
    let user_js = USER_JS.replace("%NEWTAB_URL%", &newtab_url);
    fs::write(profile.join("user.js"), user_js)?;

    // Tag the profile so subsequent Firefox upgrades don't complain.
    let compat = profile.join("compatibility.ini");
    if !compat.exists() {
        fs::write(&compat, b"[Compatibility]\nLastVersion=120.0_20231107145218/20231107145218\nLastOSABI=WINNT_x86_64-msvc\n")?;
    }
    Ok(profile)
}

// ---------- native message box (Windows) ----------

#[cfg(windows)]
#[allow(dead_code)]
fn show_status(title: &str, body: &str) {
    // Non-blocking status hint via a short taskbar notification would be
    // nicer, but a simple console print is enough for now — MessageBox would
    // block the install flow.
    eprintln!("[{title}] {body}");
}

#[cfg(windows)]
fn show_error(title: &str, body: &str) {
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};

    let wide = |s: &str| -> Vec<u16> {
        std::ffi::OsStr::new(s).encode_wide().chain(once(0)).collect()
    };
    let t = wide(title);
    let b = wide(body);
    unsafe {
        MessageBoxW(std::ptr::null_mut(), b.as_ptr(), t.as_ptr(), MB_OK | MB_ICONERROR);
    }
}

#[cfg(not(windows))]
fn show_error(title: &str, body: &str) {
    eprintln!("[{title}] ERROR: {body}");
}

// ---------- main ----------

fn main() {
    let firefox = match find_or_install_firefox() {
        Some(p) => p,
        None => {
            show_error(
                "Nova",
                "Nova couldn't find or install the Firefox engine.\n\n\
                 Please install Firefox from https://www.mozilla.org/firefox/ and then launch Nova again.",
            );
            return;
        }
    };

    let profile = match write_profile() {
        Ok(p) => p,
        Err(e) => {
            show_error(
                "Nova",
                &format!("Nova couldn't create its profile:\n\n{e}"),
            );
            return;
        }
    };

    // Launch Firefox with the Nova profile. `-no-remote` ensures this Nova
    // window is independent from any already-running Firefox window.
    let mut cmd = Command::new(&firefox);
    cmd.arg("-profile")
        .arg(&profile)
        .arg("-no-remote")
        .arg("-new-instance")
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    match cmd.spawn() {
        Ok(_) => {}
        Err(e) => show_error(
            "Nova",
            &format!("Failed to launch the Firefox engine at:\n{}\n\n{e}", firefox.display()),
        ),
    }
}
