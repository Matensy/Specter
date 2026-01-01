import { ipcMain, dialog, shell, app, BrowserWindow, desktopCapturer } from 'electron';
import fs from 'fs';
import path from 'path';

export function setupFileHandlers(): void {
  // Select directory
  ipcMain.handle('file:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
  });

  // Select file
  ipcMain.handle('file:selectFile', async (_, filters?: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
  });

  // Save file dialog
  ipcMain.handle('file:saveFile', async (_, data: { content: string; defaultName?: string }, defaultPath?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultPath || data.defaultName,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(result.filePath, data.content);
    return { success: true, path: result.filePath };
  });

  // Read file
  ipcMain.handle('file:readFile', async (_, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);

      return {
        success: true,
        content,
        stats: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Write file
  ipcMain.handle('file:writeFile', async (_, filePath: string, content: string) => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Open in file explorer
  ipcMain.handle('file:openInExplorer', async (_, filePath: string) => {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { success: true };
    }
    return { success: false, error: 'Path not found' };
  });

  // Capture screenshot
  ipcMain.handle('file:captureScreenshot', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });

      if (sources.length === 0) {
        return { success: false, error: 'No screen sources available' };
      }

      const screenshot = sources[0].thumbnail.toPNG();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `screenshot_${timestamp}.png`;

      return {
        success: true,
        data: screenshot.toString('base64'),
        fileName,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Get app version
  ipcMain.handle('app:version', async () => {
    return app.getVersion();
  });

  // Get app config
  ipcMain.handle('app:config', async () => {
    const { SpecterConfig } = await import('../config');
    return SpecterConfig.getAll();
  });

  // Set app config
  ipcMain.handle('app:setConfig', async (_, config) => {
    const { SpecterConfig } = await import('../config');
    SpecterConfig.setAll(config);
    return { success: true };
  });
}
