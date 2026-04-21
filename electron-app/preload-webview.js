'use strict';

/* Preload injected INTO every <webview>.
   - For internal dib:// pages: exposes the privileged `window.dib` API.
   - For third-party sites (Google, YouTube, …): spoofs the JS-level fingerprint
     that Google uses to detect embedded browsers (navigator.webdriver,
     navigator.userAgentData, window.chrome), so sign-in is not blocked. */

const { contextBridge, ipcRenderer, webFrame } = require('electron');

/* === anti-detection (runs everywhere, incl. http/https pages) ===
   Make Chromium-on-Electron look like real Chrome. Google mainly checks
   navigator.webdriver; the rest are defence-in-depth. */
(function spoofChrome() {
    const script = `(function() {
        try {
            Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });

            const brands = [
                { brand: 'Chromium',      version: '124' },
                { brand: 'Google Chrome', version: '124' },
                { brand: 'Not-A.Brand',   version: '99'  },
            ];
            const uaData = {
                brands,
                mobile: false,
                platform: 'Windows',
                getHighEntropyValues: () => Promise.resolve({
                    brands,
                    mobile: false,
                    platform: 'Windows',
                    platformVersion: '10.0.0',
                    architecture: 'x86',
                    bitness: '64',
                    model: '',
                    uaFullVersion: '124.0.0.0',
                    fullVersionList: brands.map(b => ({ ...b, version: b.brand === 'Not-A.Brand' ? '99.0.0.0' : '124.0.0.0' })),
                    wow64: false,
                }),
                toJSON: () => ({ brands, mobile: false, platform: 'Windows' }),
            };
            try {
                Object.defineProperty(navigator, 'userAgentData', {
                    get: () => uaData, configurable: true,
                });
            } catch (_) {}

            if (!window.chrome) window.chrome = {};
            if (!window.chrome.runtime) window.chrome.runtime = {};
            if (!window.chrome.loadTimes) window.chrome.loadTimes = () =>
                ({ requestTime: Date.now() / 1000, startLoadTime: Date.now() / 1000 });
            if (!window.chrome.csi) window.chrome.csi = () =>
                ({ startE: Date.now(), onloadT: Date.now(), pageT: 0, tran: 15 });

            try {
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5].map(i => ({ name: 'Plugin ' + i })),
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
