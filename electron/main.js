// Ventana de escritorio de starseeked (Windows). Carga los mismos
// index.html/app.js/styles.css que la web y el APK de Android: no hay
// ningún código específico de escritorio en la propia app, solo esta
// ventana que la envuelve.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#dff2ff',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));

  // Los enlaces que abran una pestaña nueva (por ejemplo "arriba a la
  // derecha" en algún panel) se abren en el navegador del sistema, no
  // dentro de la propia app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
