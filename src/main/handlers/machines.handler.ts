import { ipcMain, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { Client, ConnectConfig } from 'ssh2';
import fs from 'fs';
import { getDatabase } from '../database/init';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'specter-machine-key-v1'; // In production, use a secure key from keychain

interface Machine {
  id: string;
  name: string;
  type: 'ssh' | 'local' | 'docker';
  host?: string;
  port: number;
  username?: string;
  password_encrypted?: string;
  private_key_path?: string;
  is_default: number;
  status: 'online' | 'offline' | 'connecting';
  last_connected?: string;
  created_at: string;
  updated_at: string;
  metadata?: string;
}

interface MachineConnection {
  id: string;
  client: Client;
  status: 'connected' | 'disconnected';
}

// Active connections
const connections: Map<string, MachineConnection> = new Map();

function encryptPassword(password: string): string {
  return CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
}

function decryptPassword(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

function broadcastMachineStatus(machineId: string, status: string): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send('machine:status-changed', machineId, status);
  }
}

export function setupMachinesHandlers(): void {
  const db = getDatabase();

  // List all machines
  ipcMain.handle('machines:list', async () => {
    const stmt = db.prepare('SELECT * FROM machines ORDER BY is_default DESC, name ASC');
    const machines = stmt.all() as Machine[];

    // Add connection status
    return machines.map(m => ({
      ...m,
      status: connections.has(m.id) ? 'online' : 'offline',
      password_encrypted: undefined // Don't send encrypted password to renderer
    }));
  });

  // Get single machine
  ipcMain.handle('machines:get', async (_, id: string) => {
    const stmt = db.prepare('SELECT * FROM machines WHERE id = ?');
    const machine = stmt.get(id) as Machine | undefined;
    if (machine) {
      return {
        ...machine,
        status: connections.has(machine.id) ? 'online' : 'offline',
        password_encrypted: undefined
      };
    }
    return null;
  });

  // Create machine
  ipcMain.handle('machines:create', async (_, data: {
    name: string;
    type: 'ssh' | 'local' | 'docker';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    privateKeyPath?: string;
    isDefault?: boolean;
  }) => {
    const id = uuidv4();

    // If setting as default, unset other defaults
    if (data.isDefault) {
      db.prepare('UPDATE machines SET is_default = 0').run();
    }

    const stmt = db.prepare(`
      INSERT INTO machines (id, name, type, host, port, username, password_encrypted, private_key_path, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.type,
      data.host || null,
      data.port || 22,
      data.username || null,
      data.password ? encryptPassword(data.password) : null,
      data.privateKeyPath || null,
      data.isDefault ? 1 : 0
    );

    return { success: true, id };
  });

  // Update machine
  ipcMain.handle('machines:update', async (_, id: string, data: {
    name?: string;
    type?: 'ssh' | 'local' | 'docker';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    privateKeyPath?: string;
    isDefault?: boolean;
  }) => {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      values.push(data.type);
    }
    if (data.host !== undefined) {
      updates.push('host = ?');
      values.push(data.host);
    }
    if (data.port !== undefined) {
      updates.push('port = ?');
      values.push(data.port);
    }
    if (data.username !== undefined) {
      updates.push('username = ?');
      values.push(data.username);
    }
    if (data.password !== undefined) {
      updates.push('password_encrypted = ?');
      values.push(data.password ? encryptPassword(data.password) : null);
    }
    if (data.privateKeyPath !== undefined) {
      updates.push('private_key_path = ?');
      values.push(data.privateKeyPath);
    }
    if (data.isDefault !== undefined) {
      if (data.isDefault) {
        db.prepare('UPDATE machines SET is_default = 0').run();
      }
      updates.push('is_default = ?');
      values.push(data.isDefault ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE machines SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return { success: true };
  });

  // Delete machine
  ipcMain.handle('machines:delete', async (_, id: string) => {
    // Disconnect if connected
    const conn = connections.get(id);
    if (conn) {
      conn.client.end();
      connections.delete(id);
    }

    db.prepare('DELETE FROM machines WHERE id = ?').run(id);
    return { success: true };
  });

  // Connect to machine
  ipcMain.handle('machines:connect', async (_, id: string) => {
    const stmt = db.prepare('SELECT * FROM machines WHERE id = ?');
    const machine = stmt.get(id) as Machine | undefined;

    if (!machine) {
      return { success: false, error: 'Machine not found' };
    }

    if (connections.has(id)) {
      return { success: true, message: 'Already connected' };
    }

    if (machine.type === 'local') {
      // Local machine - just mark as connected
      connections.set(id, { id, client: new Client(), status: 'connected' });
      broadcastMachineStatus(id, 'online');
      return { success: true };
    }

    // SSH connection
    return new Promise((resolve) => {
      const client = new Client();

      const connectConfig: ConnectConfig = {
        host: machine.host || 'localhost',
        port: machine.port || 22,
        username: machine.username || 'root',
        readyTimeout: 30000,
      };

      // Use private key or password
      if (machine.private_key_path && fs.existsSync(machine.private_key_path)) {
        connectConfig.privateKey = fs.readFileSync(machine.private_key_path);
      } else if (machine.password_encrypted) {
        connectConfig.password = decryptPassword(machine.password_encrypted);
      }

      client.on('ready', () => {
        connections.set(id, { id, client, status: 'connected' });

        // Update last_connected
        db.prepare('UPDATE machines SET status = ?, last_connected = CURRENT_TIMESTAMP WHERE id = ?')
          .run('online', id);

        broadcastMachineStatus(id, 'online');
        resolve({ success: true });
      });

      client.on('error', (err) => {
        broadcastMachineStatus(id, 'offline');
        resolve({ success: false, error: err.message });
      });

      client.on('close', () => {
        connections.delete(id);
        db.prepare('UPDATE machines SET status = ? WHERE id = ?').run('offline', id);
        broadcastMachineStatus(id, 'offline');
      });

      broadcastMachineStatus(id, 'connecting');
      client.connect(connectConfig);
    });
  });

  // Disconnect from machine
  ipcMain.handle('machines:disconnect', async (_, id: string) => {
    const conn = connections.get(id);
    if (conn) {
      conn.client.end();
      connections.delete(id);
      db.prepare('UPDATE machines SET status = ? WHERE id = ?').run('offline', id);
      broadcastMachineStatus(id, 'offline');
    }
    return { success: true };
  });

  // Test connection
  ipcMain.handle('machines:test', async (_, data: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKeyPath?: string;
  }) => {
    return new Promise((resolve) => {
      const testClient = new Client();

      const timeout = setTimeout(() => {
        testClient.end();
        resolve({ success: false, error: 'Connection timeout' });
      }, 10000);

      const connectConfig: ConnectConfig = {
        host: data.host,
        port: data.port,
        username: data.username,
        readyTimeout: 10000,
      };

      if (data.privateKeyPath && fs.existsSync(data.privateKeyPath)) {
        connectConfig.privateKey = fs.readFileSync(data.privateKeyPath);
      } else if (data.password) {
        connectConfig.password = data.password;
      }

      testClient.on('ready', () => {
        clearTimeout(timeout);
        testClient.end();
        resolve({ success: true });
      });

      testClient.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      });

      testClient.connect(connectConfig);
    });
  });

  // Get default machine
  ipcMain.handle('machines:getDefault', async () => {
    const stmt = db.prepare('SELECT * FROM machines WHERE is_default = 1');
    const machine = stmt.get() as Machine | undefined;
    if (machine) {
      return {
        ...machine,
        status: connections.has(machine.id) ? 'online' : 'offline',
        password_encrypted: undefined
      };
    }
    return null;
  });

  // Set default machine
  ipcMain.handle('machines:setDefault', async (_, id: string) => {
    db.prepare('UPDATE machines SET is_default = 0').run();
    db.prepare('UPDATE machines SET is_default = 1 WHERE id = ?').run(id);
    return { success: true };
  });
}

// Export for terminal handler to use
export function getMachineConnection(id: string): Client | null {
  const conn = connections.get(id);
  return conn?.client || null;
}

export function getDefaultMachineConnection(): { id: string; client: Client } | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT id FROM machines WHERE is_default = 1');
  const machine = stmt.get() as { id: string } | undefined;

  if (machine && connections.has(machine.id)) {
    const conn = connections.get(machine.id)!;
    return { id: machine.id, client: conn.client };
  }
  return null;
}

export function getAllConnectedMachines(): Map<string, MachineConnection> {
  return connections;
}
