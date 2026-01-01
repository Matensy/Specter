import React, { useEffect, useState } from 'react';
import { useVault } from '../contexts/VaultContext';

interface Credential {
  id: string;
  type: string;
  username?: string;
  hasPassword: boolean;
  hash?: string;
  domain?: string;
  notes?: string;
  source?: string;
  valid: boolean;
  target_name?: string;
  created_at: string;
}

export default function CredentialsPage() {
  const { currentVault, targets } = useVault();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newCred, setNewCred] = useState({
    type: 'password',
    username: '',
    password: '',
    hash: '',
    domain: '',
    notes: '',
    source: '',
    targetId: '',
  });

  useEffect(() => {
    if (currentVault) {
      loadCredentials();
    }
  }, [currentVault]);

  const loadCredentials = async () => {
    if (!currentVault) return;
    setLoading(true);
    const result = await window.specter.db.credentials.list(currentVault.id);
    setCredentials(result as Credential[]);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVault) return;

    await window.specter.db.credentials.create({
      vaultId: currentVault.id,
      targetId: newCred.targetId || undefined,
      type: newCred.type,
      username: newCred.username || undefined,
      password: newCred.password || undefined,
      hash: newCred.hash || undefined,
      domain: newCred.domain || undefined,
      notes: newCred.notes || undefined,
      source: newCred.source || undefined,
    });

    setNewCred({ type: 'password', username: '', password: '', hash: '', domain: '', notes: '', source: '', targetId: '' });
    setShowAdd(false);
    loadCredentials();
  };

  const handleDelete = async (id: string) => {
    await window.specter.db.credentials.delete(id);
    loadCredentials();
  };

  const toggleValid = async (cred: Credential) => {
    await window.specter.db.credentials.update(cred.id, { valid: !cred.valid });
    loadCredentials();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'password': return '🔑';
      case 'hash': return '🔐';
      case 'api_key': return '🎫';
      case 'ssh_key': return '📜';
      case 'token': return '🎟️';
      default: return '🔒';
    }
  };

  if (!currentVault) {
    return (
      <div className="p-6 animate-fadeIn">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 bg-specter-medium rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No Vault Selected</h3>
            <p className="text-gray-400">Select a vault from the dashboard to manage credentials</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Credentials</h1>
          <p className="text-gray-400">Securely manage discovered credentials for {currentVault.name}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Credential
        </button>
      </div>

      {/* Security notice */}
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 className="text-yellow-500 font-medium">Security Notice</h4>
            <p className="text-sm text-yellow-400/80">Credentials are encrypted locally. Never commit credential files to version control.</p>
          </div>
        </div>
      </div>

      {/* Add credential form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-specter-medium rounded-xl p-5 mb-6 border border-specter-accent animate-slideIn">
          <h3 className="text-lg font-medium text-white mb-4">Add New Credential</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={newCred.type}
                onChange={(e) => setNewCred({ ...newCred, type: e.target.value })}
                className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
              >
                <option value="password">Password</option>
                <option value="hash">Hash</option>
                <option value="api_key">API Key</option>
                <option value="ssh_key">SSH Key</option>
                <option value="token">Token</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                type="text"
                value={newCred.username}
                onChange={(e) => setNewCred({ ...newCred, username: e.target.value })}
                className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Domain</label>
              <input
                type="text"
                value={newCred.domain}
                onChange={(e) => setNewCred({ ...newCred, domain: e.target.value })}
                className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                placeholder="DOMAIN"
              />
            </div>
            {newCred.type === 'password' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={newCred.password}
                  onChange={(e) => setNewCred({ ...newCred, password: e.target.value })}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                />
              </div>
            )}
            {newCred.type === 'hash' && (
              <div className="col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Hash</label>
                <input
                  type="text"
                  value={newCred.hash}
                  onChange={(e) => setNewCred({ ...newCred, hash: e.target.value })}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white font-mono text-sm"
                  placeholder="NTLM or other hash"
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Source</label>
              <input
                type="text"
                value={newCred.source}
                onChange={(e) => setNewCred({ ...newCred, source: e.target.value })}
                className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                placeholder="Where was it found?"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Target (optional)</label>
              <select
                value={newCred.targetId}
                onChange={(e) => setNewCred({ ...newCred, targetId: e.target.value })}
                className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
              >
                <option value="">No specific target</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-sm text-gray-400 mb-1">Notes</label>
              <input
                type="text"
                value={newCred.notes}
                onChange={(e) => setNewCred({ ...newCred, notes: e.target.value })}
                className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg transition-colors"
            >
              Add Credential
            </button>
          </div>
        </form>
      )}

      {/* Credentials list */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-specter-accent" />
        </div>
      ) : credentials.length === 0 ? (
        <div className="bg-specter-medium rounded-xl p-12 text-center border border-specter-light border-dashed">
          <div className="w-16 h-16 bg-specter-light rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No credentials yet</h3>
          <p className="text-gray-400">Add discovered credentials to track and manage them securely</p>
        </div>
      ) : (
        <div className="bg-specter-medium rounded-xl border border-specter-light overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-specter-light">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Username</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Domain</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Secret</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Source</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Valid</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((cred) => (
                <tr key={cred.id} className="border-b border-specter-light/50 hover:bg-specter-light/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span>{getTypeIcon(cred.type)}</span>
                      <span className="text-sm text-gray-300 capitalize">{cred.type.replace('_', ' ')}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-white font-mono">{cred.username || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">{cred.domain || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {cred.hasPassword ? (
                      <span className="text-sm text-green-400">••••••••</span>
                    ) : cred.hash ? (
                      <span className="text-sm text-yellow-400 font-mono truncate max-w-32 block">{cred.hash.slice(0, 20)}...</span>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">{cred.source || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleValid(cred)}
                      className={`px-2 py-1 text-xs rounded-full ${
                        cred.valid
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-gray-900/30 text-gray-400'
                      }`}
                    >
                      {cred.valid ? 'Valid' : 'Unverified'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(cred.id)}
                      className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
