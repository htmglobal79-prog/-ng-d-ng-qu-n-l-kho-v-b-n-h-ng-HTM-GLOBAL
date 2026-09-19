const { app, BrowserWindow, shell, session } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;
const hostedOrigin = process.env.HTM_APP_ORIGIN || 'https://retailpos-49gzn5gs.manus.space';

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f6f8f5',
    title: 'HTM GLOBAL — Quản lý kho & bán hàng',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    window.loadURL('http://localhost:3000');
  } else {
    window.loadURL(hostedOrigin);
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
