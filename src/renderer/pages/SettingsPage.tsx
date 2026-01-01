import React, { useEffect, useState } from 'react';
import { useVM } from '../contexts/VMContext';

interface VMConfig {
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  password: string;
  autoStart: boolean;
}

interface AppConfig {
  vaultsDirectory: string;
  vm: VMConfig;
  theme: string;
  language: string;
  autoSaveInterval: number;
}

export default function SettingsPage() {
  const { status: vmStatus, connect, disconnect, testConnection, configure } = useVM();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [vmConfig, setVmConfig] = useState<VMConfig>({
    host: '127.0.0.1',
    port: 22,
    username: 'kali',
    privateKeyPath: '',
    password: '',
    autoStart: false,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const appConfig = await window.specter.app.getConfig();
    setConfig(appConfig as AppConfig);
    if (appConfig?.vm) {
      setVmConfig({ ...vmConfig, ...appConfig.vm, password: '' });
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(vmConfig);
      setTestResult({
        success: result.success,
        message: result.success ? 'Connection successful!' : result.error || 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveVM = async () => {
    setSaving(true);
    try {
      await configure(vmConfig);
      setTestResult({ success: true, message: 'Configuration saved!' });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectKeyFile = async () => {
    const result = await window.specter.file.selectFile([
      { name: 'SSH Keys', extensions: ['pem', 'key', 'pub', ''] },
    ]);
    if (result.success && result.path) {
      setVmConfig({ ...vmConfig, privateKeyPath: result.path });
    }
  };

  const handleSelectVaultsDir = async () => {
    const result = await window.specter.file.selectDirectory();
    if (result.success && result.path && config) {
      await window.specter.app.setConfig({ vaultsDirectory: result.path });
      loadConfig();
    }
  };

  return (
    <div className="p-6 animate-fadeIn max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure Specter to match your workflow</p>
      </div>

      {/* VM Configuration */}
      <section className="bg-specter-medium rounded-xl border border-specter-light p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Linux VM Connection</h2>
            <p className="text-sm text-gray-400">Configure SSH connection to your Kali/Parrot VM</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            vmStatus.connected
              ? 'bg-green-900/30 text-green-400'
              : 'bg-red-900/30 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${vmStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
            {vmStatus.connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Host / IP</label>
            <input
              type="text"
              value={vmConfig.host}
              onChange={(e) => setVmConfig({ ...vmConfig, host: e.target.value })}
              className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
              placeholder="127.0.0.1"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Port</label>
            <input
              type="number"
              value={vmConfig.port}
              onChange={(e) => setVmConfig({ ...vmConfig, port: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
              placeholder="22"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Username</label>
            <input
              type="text"
              value={vmConfig.username}
              onChange={(e) => setVmConfig({ ...vmConfig, username: e.target.value })}
              className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
              placeholder="kali"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Password</label>
            <input
              type="password"
              value={vmConfig.password}
              onChange={(e) => setVmConfig({ ...vmConfig, password: e.target.value })}
              className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
              placeholder="Leave empty to use key"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-2">Private Key Path (optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={vmConfig.privateKeyPath}
                onChange={(e) => setVmConfig({ ...vmConfig, privateKeyPath: e.target.value })}
                className="flex-1 px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white font-mono text-sm"
                placeholder="~/.ssh/id_rsa"
              />
              <button
                onClick={handleSelectKeyFile}
                className="px-4 py-2 bg-specter-light hover:bg-specter-accent/50 text-white rounded-lg transition-colors"
              >
                Browse
              </button>
            </div>
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`mb-4 p-3 rounded-lg ${
            testResult.success
              ? 'bg-green-900/20 border border-green-700 text-green-400'
              : 'bg-red-900/20 border border-red-700 text-red-400'
          }`}>
            {testResult.message}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-specter-light hover:bg-specter-accent/50 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={handleSaveVM}
            disabled={saving}
            className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          {vmStatus.connected ? (
            <button
              onClick={() => disconnect()}
              className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => connect(vmConfig)}
              className="px-4 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg transition-colors"
            >
              Connect
            </button>
          )}
        </div>
      </section>

      {/* Storage Configuration */}
      <section className="bg-specter-medium rounded-xl border border-specter-light p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Storage</h2>
        <p className="text-sm text-gray-400 mb-6">Configure where Specter stores your vaults</p>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Vaults Directory</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={config?.vaultsDirectory || ''}
              readOnly
              className="flex-1 px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white font-mono text-sm"
            />
            <button
              onClick={handleSelectVaultsDir}
              className="px-4 py-2 bg-specter-light hover:bg-specter-accent/50 text-white rounded-lg transition-colors"
            >
              Change
            </button>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="bg-specter-medium rounded-xl border border-specter-light p-6">
        <h2 className="text-lg font-semibold text-white mb-4">About Specter</h2>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 12a1 1 0 112 0v2a1 1 0 11-2 0v-2zm1-8a1 1 0 00-1 1v4a1 1 0 002 0V5a1 1 0 00-1-1z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Project Specter</h3>
            <p className="text-gray-400">Pentest, Red Team & CTF Platform</p>
            <p className="text-sm text-gray-500">Version 1.0.0</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Specter transforms you from a scanner executor into an offensive analyst with structured reasoning,
          proper documentation, and real exploitation capabilities.
        </p>

        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-specter-dark rounded-full text-sm text-gray-400">Electron</span>
          <span className="px-3 py-1 bg-specter-dark rounded-full text-sm text-gray-400">React</span>
          <span className="px-3 py-1 bg-specter-dark rounded-full text-sm text-gray-400">TypeScript</span>
          <span className="px-3 py-1 bg-specter-dark rounded-full text-sm text-gray-400">SQLite</span>
          <span className="px-3 py-1 bg-specter-dark rounded-full text-sm text-gray-400">SSH2</span>
        </div>
      </section>
    </div>
  );
}
