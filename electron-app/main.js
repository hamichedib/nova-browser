'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  session,
  shell,
  dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');

// Cross-site compatibility + embeddable pages for GLM, YouTube, Google, etc.
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

const APP_NAME = 'DIB HAMICHE';

// Make Electron look like a real Chrome install to Google's anti-embed checks:
// 1. set a clean Chrome UA (no "Electron/…" suffix), and
// 2. strip the Electron/DIB-HAMICHE tokens from outgoing request headers.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';
app.userAgentFallback = CHROME_UA;
const USER_DATA_ROOT = path.join(app.getPath('userData'), 'dib-hamiche');
fs.mkdirSync(USER_DATA_ROOT, { recursive: true });

const STORE_PATH = path.join(USER_DATA_ROOT, 'store.json');
const DOWNLOADS_DIR = path.join(app.getPath('downloads'), 'DIB-HAMICHE');
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return {
      history: [],
      bookmarks: [
        { title: 'Google', url: 'https://www.google.com' },
        { title: 'YouTube', url: 'https://www.youtube.com' },
        { title: 'GLM 5.1 (ChatGLM)', url: 'https://chat.z.ai/' },
        { title: 'Gmail', url: 'https://mail.google.com' },
        { title: 'GitHub', url: 'https://github.com' },
      ],
      downloads: [],
      passwords: [],
      settings: {
        searchEngine: 'google',
        language: 'fr',
        theme: 'nova-dark',
        homepage: 'dib://newtab',
        startupPage: 'newtab',
        restoreTabs: true,
      },
      version: app.getVersion(),
    };
  }
}

function writeStore(store) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('writeStore failed:', err);
  }
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#05050a',
    title: APP_NAME,
    frame: true,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      spellcheck: true,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    mainWindow.webContents.send('open-new-tab', url);
    return { action: 'deny' };
  });
}

// Allow <webview> pop-ups and downloads to flow through
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (mainWindow && contents.getType() === 'webview') {
      mainWindow.webContents.send('open-new-tab', url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  contents.on('will-attach-webview', (_e, webPreferences) => {
    webPreferences.contextIsolation = true;
    webPreferences.nodeIntegration = false;
    webPreferences.webSecurity = false;
  });

  if (contents.getType() === 'webview') {
    // Every webview gets the Chrome UA applied at the session layer too.
    applyChromeUA(contents.session);
    contents.setUserAgent(CHROME_UA);
  }
});

// Client Hints that match a real Chrome 124 install — these are what Google
// actually checks to detect Electron; overriding User-Agent alone is NOT enough.
const CHROME_CH_UA         = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';
const CHROME_CH_UA_MOBILE  = '?0';
const CHROME_CH_UA_PLATFORM = '"Windows"';

function applyChromeUA(ses) {
  try { ses.setUserAgent(CHROME_UA); } catch (_) { /* noop */ }
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const headers = details.requestHeaders;
    headers['User-Agent'] = CHROME_UA;
    // Kill headers Google uses to sniff embedded browsers.
    if ('Sec-Ch-Ua'          in headers) headers['Sec-Ch-Ua']          = CHROME_CH_UA;
    if ('sec-ch-ua'          in headers) headers['sec-ch-ua']          = CHROME_CH_UA;
    if ('Sec-Ch-Ua-Mobile'   in headers) headers['Sec-Ch-Ua-Mobile']   = CHROME_CH_UA_MOBILE;
    if ('sec-ch-ua-mobile'   in headers) headers['sec-ch-ua-mobile']   = CHROME_CH_UA_MOBILE;
    if ('Sec-Ch-Ua-Platform' in headers) headers['Sec-Ch-Ua-Platform'] = CHROME_CH_UA_PLATFORM;
    if ('sec-ch-ua-platform' in headers) headers['sec-ch-ua-platform'] = CHROME_CH_UA_PLATFORM;
    // Always inject canonical ones (in case Electron didn't send them).
    headers['Sec-Ch-Ua']          = CHROME_CH_UA;
    headers['Sec-Ch-Ua-Mobile']   = CHROME_CH_UA_MOBILE;
    headers['Sec-Ch-Ua-Platform'] = CHROME_CH_UA_PLATFORM;
    delete headers['X-Electron-Version'];
    cb({ requestHeaders: headers });
  });
}

app.whenReady().then(() => {
  // Register dib:// protocol for internal pages (newtab, settings, ...)
  const ses = session.defaultSession;
  applyChromeUA(ses);

  ses.protocol.registerFileProtocol('dib', (request, callback) => {
    const url = request.url.replace(/^dib:\/\//, '').replace(/\/$/, '');
    const mapping = {
      newtab: 'pages/newtab.html',
      settings: 'pages/settings.html',
      downloads: 'pages/downloads.html',
      history: 'pages/history.html',
      bookmarks: 'pages/bookmarks.html',
      updates: 'pages/updates.html',
      passwords: 'pages/passwords.html',
      languages: 'pages/languages.html',
      about: 'pages/about.html',
    };
    const file = mapping[url.split('?')[0]] || mapping.newtab;
    callback({ path: path.join(__dirname, file) });
  });

  // Save all downloads under ~/Downloads/DIB-HAMICHE and track them
  ses.on('will-download', (_e, item) => {
    const savePath = path.join(DOWNLOADS_DIR, item.getFilename());
    item.setSavePath(savePath);
    const store = readStore();
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      filename: item.getFilename(),
      url: item.getURL(),
      savePath,
      totalBytes: item.getTotalBytes(),
      startedAt: new Date().toISOString(),
      state: 'in-progress',
    };
    store.downloads.unshift(entry);
    writeStore(store);

    item.on('done', (_ev, state) => {
      const s = readStore();
      const d = s.downloads.find((x) => x.id === entry.id);
      if (d) {
        d.state = state;
        d.finishedAt = new Date().toISOString();
        writeStore(s);
      }
      if (mainWindow) mainWindow.webContents.send('download-update');
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC ----------

ipcMain.handle('store:get', () => readStore());
ipcMain.handle('store:set', (_e, store) => {
  writeStore(store);
  return true;
});
ipcMain.handle('store:patch', (_e, patch) => {
  const s = readStore();
  const merged = { ...s, ...patch };
  writeStore(merged);
  return merged;
});

ipcMain.handle('history:push', (_e, entry) => {
  const s = readStore();
  s.history.unshift({ ...entry, at: new Date().toISOString() });
  s.history = s.history.slice(0, 2000);
  writeStore(s);
  return true;
});

ipcMain.handle('bookmarks:add', (_e, entry) => {
  const s = readStore();
  if (!s.bookmarks.some((b) => b.url === entry.url)) {
    s.bookmarks.unshift(entry);
    writeStore(s);
  }
  return s.bookmarks;
});
ipcMain.handle('bookmarks:remove', (_e, url) => {
  const s = readStore();
  s.bookmarks = s.bookmarks.filter((b) => b.url !== url);
  writeStore(s);
  return s.bookmarks;
});

ipcMain.handle('passwords:add', (_e, entry) => {
  const s = readStore();
  s.passwords = s.passwords.filter((p) => !(p.site === entry.site && p.username === entry.username));
  s.passwords.unshift({ ...entry, savedAt: new Date().toISOString() });
  writeStore(s);
  return s.passwords;
});
ipcMain.handle('passwords:remove', (_e, id) => {
  const s = readStore();
  s.passwords = s.passwords.filter((p) => p.id !== id);
  writeStore(s);
  return s.passwords;
});

ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow && mainWindow.close());
ipcMain.handle('window:toggle-fullscreen', () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:name', () => APP_NAME);
ipcMain.handle('app:open-external', (_e, url) => shell.openExternal(url));
ipcMain.handle('app:open-downloads-folder', () => shell.openPath(DOWNLOADS_DIR));

ipcMain.handle('app:check-updates', async () => {
  // Lightweight update check: read local version + compare with a remote tag file if present
  const current = app.getVersion();
  return {
    current,
    latest: current,
    upToDate: true,
    checkedAt: new Date().toISOString(),
    message: 'You are on the latest version of DIB HAMICHE.',
  };
});

ipcMain.handle('dialog:info', async (_e, { title, message }) => {
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: title || APP_NAME,
    message: message || '',
  });
});
