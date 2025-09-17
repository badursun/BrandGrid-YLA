const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let progressWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  mainWindow.loadFile('views/control.html');

  mainWindow.on('closed', () => {
    if (progressWindow) {
      progressWindow.close();
    }
    app.quit();
  });
}

function createProgressWindow() {
  progressWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  progressWindow.loadFile('views/progress.html');

  progressWindow.on('closed', () => {
    progressWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Events
ipcMain.on('open-progress', () => {
  if (!progressWindow) {
    createProgressWindow();
  } else {
    progressWindow.focus();
  }
});

ipcMain.on('close-progress', () => {
  if (progressWindow) {
    progressWindow.close();
  }
});