'use strict';

/* Preload injected INTO every <webview>.
   - For internal dib:// pages: exposes the privileged `window.dib` API.
   - For third-party sites (Google, YouTube, …): spoofs the JS-level fingerprint
     that Google uses to detect embedded browsers (navigator.webdriver,
     navigator.userAgentData, window.chrome), so sign-in is not blocked. */

const { contextBridge, ipcRenderer, webFrame } = require('electron');

/* === anti-detection (runs everywhere, incl. http/https pages) ===
   We claim to be Firefox, so remove every Chromium-specific fingerprint:
   - delete window.chrome (Firefox doesn't have it)
   - delete navigator.userAgentData (Firefox doesn't have it)
   - force navigator.webdriver = false
   - hide any Electron trace on navigator */
(function spoofFirefox() {
    const script = `(function() {
        try {
            Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
            try { delete window.chrome; } catch (_) {
                try { window.chrome = undefined; } catch (__) {}
            }
            try { delete Navigator.prototype.userAgentData; } catch (_) {}
            try {
                Object.defineProperty(navigator, 'userAgentData', {
                    get: () => undefined, configurable: true,
                });
            } catch (_) {}
            // Firefox exposes navigator.oscpu on Windows.
            try {
                Object.defineProperty(navigator, 'oscpu', {
                    get: () => 'Windows NT 10.0; Win64; x64', configurable: true,
                });
            } catch (_) {}
            // navigator.buildID is a well-known Firefox-only property.
            try {
                Object.defineProperty(navigator, 'buildID', {
                    get: () => '20181001000000', configurable: true,
                });
            } catch (_) {}
            try {
                Object.defineProperty(navigator, 'productSub', {
                    get: () => '20100101', configurable: true,
                });
            } catch (_) {}
            try {
                Object.defineProperty(navigator, 'vendor', {
                    get: () => '', configurable: true,
                });
            } catch (_) {}
        } catch (e) { /* swallow */ }
    })();`;

    try { webFrame.executeJavaScript(script); } catch (_) { /* noop */ }
})();

if (location.protocol === 'dib:') {
    contextBridge.exposeInMainWorld('dib', {
        store: {
            get:   ()       => ipcRenderer.invoke('store:get'),
            set:   (store)  => ipcRenderer.invoke('store:set', store),
            patch: (patch)  => ipcRenderer.invoke('store:patch', patch),
        },
        history:   { push:   (entry) => ipcRenderer.invoke('history:push', entry) },
        bookmarks: {
            add:    (entry) => ipcRenderer.invoke('bookmarks:add', entry),
            remove: (url)   => ipcRenderer.invoke('bookmarks:remove', url),
        },
        passwords: {
            add:    (entry) => ipcRenderer.invoke('passwords:add', entry),
            remove: (id)    => ipcRenderer.invoke('passwords:remove', id),
        },
        app: {
            version:             ()    => ipcRenderer.invoke('app:version'),
            name:                ()    => ipcRenderer.invoke('app:name'),
            openExternal:        (url) => ipcRenderer.invoke('app:open-external', url),
            openDownloadsFolder: ()    => ipcRenderer.invoke('app:open-downloads-folder'),
            checkUpdates:        ()    => ipcRenderer.invoke('app:check-updates'),
            info: (title, message)     => ipcRenderer.invoke('dialog:info', { title, message }),
        },
        events: {
            onDownloadUpdate: (cb) => ipcRenderer.on('download-update', () => cb()),
        },
    });
}
