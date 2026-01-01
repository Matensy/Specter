import { ipcMain, BrowserWindow } from 'electron';
import { Client, ConnectConfig } from 'ssh2';
import fs from 'fs';
import { SpecterConfig, VMConfig } from '../config';

interface VMStatus {
  connected: boolean;
  connecting: boolean;
  host?: string;
  username?: string;
  lastError?: string;
  uptime?: number;
}

let sshClient: Client | null = null;
let vmStatus: VMStatus = {
  connected: false,
  connecting: false,
};
let connectionStartTime: number | null = null;

function broadcastStatus(): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send('vm:status-changed', getStatus());
  }
}

function getStatus(): VMStatus {
  return {
    ...vmStatus,
    uptime: connectionStartTime ? Date.now() - connectionStartTime : undefined,
  };
}

export function setupVMHandlers(): void {
  // Get VM status
  ipcMain.handle('vm:status', async () => {
    return getStatus();
  });

  // Connect to VM
  ipcMain.handle('vm:connect', async (_, config?: Partial<VMConfig>) => {
    if (sshClient && vmStatus.connected) {
      return { success: true, message: 'Already connected' };
    }

    const vmConfig = { ...SpecterConfig.get('vm'), ...config };

    vmStatus = {
      connected: false,
      connecting: true,
      host: vmConfig.host,
      username: vmConfig.username,
    };
    broadcastStatus();

    return new Promise((resolve) => {
      sshClient = new Client();

      const connectConfig: ConnectConfig = {
        host: vmConfig.host,
        port: vmConfig.port,
        username: vmConfig.username,
        readyTimeout: 30000,
      };

      // Use private key or password
      if (vmConfig.privateKeyPath && fs.existsSync(vmConfig.privateKeyPath)) {
        connectConfig.privateKey = fs.readFileSync(vmConfig.privateKeyPath);
      } else if (vmConfig.password) {
        connectConfig.password = vmConfig.password;
      }

      sshClient.on('ready', () => {
        vmStatus = {
          connected: true,
          connecting: false,
          host: vmConfig.host,
          username: vmConfig.username,
        };
        connectionStartTime = Date.now();
        broadcastStatus();
        resolve({ success: true, message: 'Connected successfully' });
      });

      sshClient.on('error', (err) => {
        vmStatus = {
          connected: false,
          connecting: false,
          lastError: err.message,
        };
        broadcastStatus();
        resolve({ success: false, error: err.message });
      });

      sshClient.on('close', () => {
        vmStatus = {
          connected: false,
          connecting: false,
        };
        connectionStartTime = null;
        broadcastStatus();
      });

      sshClient.connect(connectConfig);
    });
  });

  // Disconnect from VM
  ipcMain.handle('vm:disconnect', async () => {
    if (sshClient) {
      sshClient.end();
      sshClient = null;
    }

    vmStatus = {
      connected: false,
      connecting: false,
    };
    connectionStartTime = null;
    broadcastStatus();

    return { success: true };
  });

  // Test connection
  ipcMain.handle('vm:test', async (_, config: Partial<VMConfig>) => {
    const testClient = new Client();
    const vmConfig = { ...SpecterConfig.get('vm'), ...config };

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        testClient.end();
        resolve({ success: false, error: 'Connection timeout' });
      }, 10000);

      const connectConfig: ConnectConfig = {
        host: vmConfig.host,
        port: vmConfig.port,
        username: vmConfig.username,
        readyTimeout: 10000,
      };

      if (vmConfig.privateKeyPath && fs.existsSync(vmConfig.privateKeyPath)) {
        connectConfig.privateKey = fs.readFileSync(vmConfig.privateKeyPath);
      } else if (vmConfig.password) {
        connectConfig.password = vmConfig.password;
      }

      testClient.on('ready', () => {
        clearTimeout(timeout);
        testClient.end();
        resolve({ success: true, message: 'Connection successful' });
      });

      testClient.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      });

      testClient.connect(connectConfig);
    });
  });

  // Configure VM settings
  ipcMain.handle('vm:configure', async (_, config: Partial<VMConfig>) => {
    const currentConfig = SpecterConfig.get('vm');
    SpecterConfig.set('vm', { ...currentConfig, ...config });
    return { success: true };
  });

  // Get SSH client for terminal use
  ipcMain.handle('vm:getClient', async () => {
    if (sshClient && vmStatus.connected) {
      return { success: true };
    }
    return { success: false, error: 'Not connected' };
  });
}

// Export for terminal handler
export function getSSHClient(): Client | null {
  return sshClient && vmStatus.connected ? sshClient : null;
}

export function isVMConnected(): boolean {
  return vmStatus.connected;
}
