import React, { useEffect, useState, useCallback } from 'react';
import { Machine, MachineCreate } from '../types/specter';

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [formData, setFormData] = useState<MachineCreate>({
    name: '',
    type: 'ssh',
    host: '',
    port: 22,
    username: '',
    password: '',
    privateKeyPath: '',
    isDefault: false,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  const loadMachines = useCallback(async () => {
    try {
      const list = await window.specter.machines.list();
      setMachines(list);
    } catch (e) {
      console.error('Failed to load machines:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMachines();

    // Listen for status changes
    window.specter.machines.onStatusChange((machineId, status) => {
      setMachines(prev => prev.map(m =>
        m.id === machineId ? { ...m, status: status as Machine['status'] } : m
      ));
    });
  }, [loadMachines]);

  const handleCreate = async () => {
    try {
      const result = await window.specter.machines.create(formData);
      if (result.success) {
        setShowModal(false);
        resetForm();
        loadMachines();
      }
    } catch (e) {
      console.error('Failed to create machine:', e);
    }
  };

  const handleUpdate = async () => {
    if (!editingMachine) return;
    try {
      const result = await window.specter.machines.update(editingMachine.id, formData);
      if (result.success) {
        setShowModal(false);
        setEditingMachine(null);
        resetForm();
        loadMachines();
      }
    } catch (e) {
      console.error('Failed to update machine:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this machine?')) return;
    try {
      await window.specter.machines.delete(id);
      loadMachines();
    } catch (e) {
      console.error('Failed to delete machine:', e);
    }
  };

  const handleConnect = async (id: string) => {
    setConnecting(id);
    try {
      const result = await window.specter.machines.connect(id);
      if (!result.success) {
        alert(`Connection failed: ${result.error}`);
      }
    } catch (e) {
      console.error('Failed to connect:', e);
    } finally {
      setConnecting(null);
      loadMachines();
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await window.specter.machines.disconnect(id);
      loadMachines();
    } catch (e) {
      console.error('Failed to disconnect:', e);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await window.specter.machines.setDefault(id);
      loadMachines();
    } catch (e) {
      console.error('Failed to set default:', e);
    }
  };

  const handleTest = async () => {
    if (!formData.host || !formData.username) {
      setTestResult({ success: false, message: 'Host and username are required' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await window.specter.machines.test({
        host: formData.host,
        port: formData.port || 22,
        username: formData.username,
        password: formData.password,
        privateKeyPath: formData.privateKeyPath,
      });
      setTestResult({
        success: result.success,
        message: result.success ? 'Connection successful!' : result.error || 'Connection failed',
      });
    } catch (e) {
      setTestResult({ success: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleSelectKeyFile = async () => {
    const result = await window.specter.file.selectFile([
      { name: 'SSH Keys', extensions: ['pem', 'key', 'pub', ''] },
    ]);
    if (result.success && result.path) {
      setFormData({ ...formData, privateKeyPath: result.path });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'ssh',
      host: '',
      port: 22,
      username: '',
      password: '',
      privateKeyPath: '',
      isDefault: false,
    });
    setTestResult(null);
  };

  const openEditModal = (machine: Machine) => {
    setEditingMachine(machine);
    setFormData({
      name: machine.name,
      type: machine.type,
      host: machine.host || '',
      port: machine.port,
      username: machine.username || '',
      password: '',
      privateKeyPath: '',
      isDefault: machine.is_default === 1,
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingMachine(null);
    resetForm();
    setShowModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'local':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'docker':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.186m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        );
    }
  };

  return (
    <div className="p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Machines</h1>
          <p className="text-gray-400">Manage your VMs, SSH hosts, and execution environments</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Machine
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-specter-accent"></div>
        </div>
      ) : machines.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-specter-medium rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Machines Configured</h3>
          <p className="text-gray-400 mb-4">Add your first machine to start running commands</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg transition-colors"
          >
            Add Machine
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((machine) => (
            <div
              key={machine.id}
              className="bg-specter-medium rounded-xl border border-specter-light p-5 hover:border-specter-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-specter-dark rounded-lg flex items-center justify-center text-gray-400">
                    {getTypeIcon(machine.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{machine.name}</h3>
                      {machine.is_default === 1 && (
                        <span className="px-2 py-0.5 bg-specter-accent/20 text-specter-accent text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 capitalize">{machine.type}</p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)}`} />
              </div>

              {machine.type !== 'local' && (
                <div className="text-sm text-gray-400 mb-4 font-mono">
                  {machine.username}@{machine.host}:{machine.port}
                </div>
              )}

              <div className="flex items-center gap-2">
                {machine.status === 'online' ? (
                  <button
                    onClick={() => handleDisconnect(machine.id)}
                    className="flex-1 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(machine.id)}
                    disabled={connecting === machine.id}
                    className="flex-1 px-3 py-1.5 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    {connecting === machine.id ? 'Connecting...' : 'Connect'}
                  </button>
                )}
                <button
                  onClick={() => openEditModal(machine)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-specter-light rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                {machine.is_default !== 1 && (
                  <button
                    onClick={() => handleSetDefault(machine.id)}
                    className="p-1.5 text-gray-400 hover:text-specter-accent hover:bg-specter-light rounded-lg transition-colors"
                    title="Set as default"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => handleDelete(machine.id)}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-specter-light rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-specter-darker rounded-xl border border-specter-light p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-white mb-6">
              {editingMachine ? 'Edit Machine' : 'Add New Machine'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                  placeholder="Kali VM"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as MachineCreate['type'] })}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                >
                  <option value="ssh">SSH</option>
                  <option value="local">Local</option>
                  <option value="docker">Docker (Future)</option>
                </select>
              </div>

              {formData.type !== 'local' && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm text-gray-400 mb-2">Host</label>
                      <input
                        type="text"
                        value={formData.host}
                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                        className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Port</label>
                      <input
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                        placeholder="22"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                      placeholder="kali"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Password</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                      placeholder="Leave empty to use key"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Private Key Path</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.privateKeyPath}
                        onChange={(e) => setFormData({ ...formData, privateKeyPath: e.target.value })}
                        className="flex-1 px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white font-mono text-sm"
                        placeholder="~/.ssh/id_rsa"
                      />
                      <button
                        onClick={handleSelectKeyFile}
                        className="px-3 py-2 bg-specter-light hover:bg-specter-accent/50 text-white rounded-lg transition-colors"
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded border-specter-light bg-specter-dark text-specter-accent"
                  />
                  <span className="text-sm text-gray-400">Set as default machine</span>
                </label>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg ${
                  testResult.success
                    ? 'bg-green-900/20 border border-green-700 text-green-400'
                    : 'bg-red-900/20 border border-red-700 text-red-400'
                }`}>
                  {testResult.message}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-6">
              <button
                onClick={handleTest}
                disabled={testing || formData.type === 'local'}
                className="px-4 py-2 bg-specter-light hover:bg-specter-accent/50 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingMachine(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingMachine ? handleUpdate : handleCreate}
                  className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg transition-colors"
                >
                  {editingMachine ? 'Save Changes' : 'Add Machine'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
