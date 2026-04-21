'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Expose path to the webview preload as a file:// URL so renderer can attach it
contextBridge.exposeInMainWorld(
    'dibPreloadPath',
    pathToFileURL(path.join(__dirname, 'preload-webview.js')).toString(),
);

contextBridge.exposeInMainWorld('dib', {
  store: {
    get: () => ipcRenderer.invoke('store:get'),
    set: (store) => ipcRenderer.invoke('store:set', store),
    patch: (patch) => ipcRenderer.invoke('store:patch', patch),
  },
  history: {
    push: (entry) => ipcRenderer.invoke('history:push', entry),
  },
  bookmarks: {
    add: (entry) => ipcRenderer.invoke('bookmarks:add', entry),
    remove: (url) => ipcRenderer.invoke('bookmarks:remove', url),
  },
  passwords: {
    add: (entry) => ipcRenderer.invoke('passwords:add', entry),
    remove: (id) => ipcRenderer.invoke('passwords:remove', id),
  },
  win: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  },
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    name: () => ipcRenderer.invoke('app:name'),
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
    openDownloadsFolder: () => ipcRenderer.invoke('app:open-downloads-folder'),
    checkUpdates: () => ipcRenderer.invoke('app:check-updates'),
    info: (title, message) => ipcRenderer.invoke('dialog:info', { title, message }),
  },
  events: {
    onOpenNewTab: (cb) => ipcRenderer.on('open-new-tab', (_e, url) => cb(url)),
    onDownloadUpdate: (cb) => ipcRenderer.on('download-update', () => cb()),
  },
});
