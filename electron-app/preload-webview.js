'use strict';

/* Preload that is injected INTO every <webview>.
   We only expose the dib API when the webview is actually serving an internal
   dib:// page. For third-party sites (Google, YouTube, …) no privileged APIs
   are exposed. */

const { contextBridge, ipcRenderer } = require('electron');

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
