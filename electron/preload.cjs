const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('htmDesktop', {
  platform: process.platform,
  version: process.versions.electron,
});
