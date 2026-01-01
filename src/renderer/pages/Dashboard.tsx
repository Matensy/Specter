import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVault } from '../contexts/VaultContext';
import { useVM } from '../contexts/VMContext';
import CreateVaultModal from '../components/CreateVaultModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const { vaults, loading, openVaultFolder, selectVault } = useVault();
  const { status: vmStatus, connect, disconnect } = useVM();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleVaultClick = async (vaultId: string) => {
    await selectVault(vaultId);
    navigate(`/vault/${vaultId}`);
  };

  const handleVMToggle = async () => {
    setConnecting(true);
    try {
      if (vmStatus.connected) {
        await disconnect();
      } else {
        await connect();
      }
    } finally {
      setConnecting(false);
    }
  };

  const getTargetTypeIcon = (type: string) => {
    switch (type) {
      case 'web':
        return '🌐';
      case 'active_directory':
        return '🏢';
      case 'api':
        return '🔌';
      case 'mobile':
        return '📱';
      case 'ctf':
        return '🚩';
      case 'infrastructure':
        return '🖥️';
      default:
        return '📁';
    }
  };

  const getSeverityColor = (count: number) => {
    if (count === 0) return 'text-gray-500';
    if (count < 5) return 'text-yellow-500';
    if (count < 10) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Manage your security assessments</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Vault
        </button>
      </div>

      {/* VM Status Card */}
      <div className="bg-specter-medium rounded-xl p-6 mb-6 border border-specter-light">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              vmStatus.connected ? 'bg-green-900/30' : 'bg-specter-light'
            }`}>
              <svg className={`w-6 h-6 ${vmStatus.connected ? 'text-green-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Linux VM</h3>
              <p className="text-sm text-gray-400">
                {vmStatus.connected
                  ? `Connected to ${vmStatus.host} as ${vmStatus.username}`
                  : vmStatus.connecting
                    ? 'Connecting...'
                    : 'Not connected'}
              </p>
            </div>
          </div>
          <button
            onClick={handleVMToggle}
            disabled={connecting || vmStatus.connecting}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              vmStatus.connected
                ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {connecting || vmStatus.connecting
              ? 'Processing...'
              : vmStatus.connected
                ? 'Disconnect'
                : 'Connect'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-specter-medium rounded-lg p-4 border border-specter-light">
          <div className="text-3xl font-bold text-white mb-1">{vaults.length}</div>
          <div className="text-sm text-gray-400">Active Vaults</div>
        </div>
        <div className="bg-specter-medium rounded-lg p-4 border border-specter-light">
          <div className="text-3xl font-bold text-white mb-1">
            {vaults.reduce((acc, v) => acc + (v.target_count || 0), 0)}
          </div>
          <div className="text-sm text-gray-400">Total Targets</div>
        </div>
        <div className="bg-specter-medium rounded-lg p-4 border border-specter-light">
          <div className="text-3xl font-bold text-red-400 mb-1">
            {vaults.reduce((acc, v) => acc + (v.finding_count || 0), 0)}
          </div>
          <div className="text-sm text-gray-400">Findings</div>
        </div>
        <div className="bg-specter-medium rounded-lg p-4 border border-specter-light">
          <div className={`text-3xl font-bold mb-1 ${vmStatus.connected ? 'text-green-400' : 'text-gray-500'}`}>
            {vmStatus.connected ? 'Online' : 'Offline'}
          </div>
          <div className="text-sm text-gray-400">VM Status</div>
        </div>
      </div>

      {/* Vaults List */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white mb-4">Your Vaults</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-specter-accent" />
        </div>
      ) : vaults.length === 0 ? (
        <div className="bg-specter-medium rounded-xl p-12 text-center border border-specter-light border-dashed">
          <div className="w-16 h-16 bg-specter-light rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No vaults yet</h3>
          <p className="text-gray-400 mb-4">Create your first vault to start a security assessment</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg font-medium transition-colors"
          >
            Create Vault
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vaults.map((vault) => (
            <div
              key={vault.id}
              className="bg-specter-medium rounded-xl p-5 border border-specter-light hover:border-specter-accent/50 transition-all cursor-pointer group"
              onClick={() => handleVaultClick(vault.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getTargetTypeIcon(vault.target_type)}</span>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-specter-accent transition-colors">
                      {vault.name}
                    </h3>
                    <p className="text-xs text-gray-500 capitalize">{vault.target_type.replace('_', ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openVaultFolder(vault.id);
                  }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-specter-light rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Open folder"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                </button>
              </div>

              {vault.description && (
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">{vault.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-gray-400">{vault.target_count || 0} targets</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className={`w-4 h-4 ${getSeverityColor(vault.finding_count || 0)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className={getSeverityColor(vault.finding_count || 0)}>
                    {vault.finding_count || 0} findings
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-specter-light/50 flex items-center justify-between text-xs text-gray-500">
                <span>Created {new Date(vault.created_at).toLocaleDateString()}</span>
                <span>Updated {new Date(vault.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Vault Modal */}
      {showCreateModal && (
        <CreateVaultModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
