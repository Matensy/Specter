import Store from 'electron-store';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

interface VMConfig {
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  password?: string;
  autoStart: boolean;
  vmPath?: string;
}

interface AppConfig {
  vaultsDirectory: string;
  vm: VMConfig;
  theme: 'dark' | 'darker';
  language: 'en' | 'pt-BR';
  autoSaveInterval: number;
  maxLogSize: number;
  screenshotFormat: 'png' | 'jpg';
}

const defaultConfig: AppConfig = {
  vaultsDirectory: path.join(app.getPath('documents'), 'Specter', 'Vaults'),
  vm: {
    host: '127.0.0.1',
    port: 22,
    username: 'kali',
    autoStart: false,
  },
  theme: 'darker',
  language: 'pt-BR',
  autoSaveInterval: 30000,
  maxLogSize: 10 * 1024 * 1024, // 10MB
  screenshotFormat: 'png',
};

class SpecterConfigManager {
  private store: Store<AppConfig> | null = null;

  initialize(): void {
    this.store = new Store<AppConfig>({
      name: 'specter-config',
      defaults: defaultConfig,
    });

    // Ensure vaults directory exists
    const vaultsDir = this.get('vaultsDirectory');
    if (!fs.existsSync(vaultsDir)) {
      fs.mkdirSync(vaultsDir, { recursive: true });
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    if (!this.store) throw new Error('Config not initialized');
    return this.store.get(key);
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    if (!this.store) throw new Error('Config not initialized');
    this.store.set(key, value);
  }

  getAll(): AppConfig {
    if (!this.store) throw new Error('Config not initialized');
    return this.store.store;
  }

  setAll(config: Partial<AppConfig>): void {
    if (!this.store) throw new Error('Config not initialized');
    Object.entries(config).forEach(([key, value]) => {
      this.store!.set(key as keyof AppConfig, value);
    });
  }

  reset(): void {
    if (!this.store) throw new Error('Config not initialized');
    this.store.clear();
    this.store.set(defaultConfig);
  }
}

export const SpecterConfig = new SpecterConfigManager();
export type { AppConfig, VMConfig };
