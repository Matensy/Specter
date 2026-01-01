import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { setupVaultHandlers } from './handlers/vault.handler';
import { setupVMHandlers } from './handlers/vm.handler';
import { setupTerminalHandlers } from './handlers/terminal.handler';
import { setupDatabaseHandlers } from './handlers/database.handler';
import { setupFileHandlers } from './handlers/file.handler';
import { initializeDatabase } from './database/init';
import { SpecterConfig } from './config';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    title: 'Specter',
    icon: path.join(__dirname, '../../assets/icon.png'),
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // DevTools: Press F12 or Ctrl+Shift+I to open manually
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Add keyboard shortcut for DevTools (F12)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools();
    }
  });

  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize app
app.whenReady().then(async () => {
  // Initialize configuration
  SpecterConfig.initialize();

  // Initialize database
  await initializeDatabase();

  // Setup IPC handlers
  setupVaultHandlers();
  setupVMHandlers();
  setupTerminalHandlers();
  setupDatabaseHandlers();
  setupFileHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:5173') {
      event.preventDefault();
    }
  });
});
