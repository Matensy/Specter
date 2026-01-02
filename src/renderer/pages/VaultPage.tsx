import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVault } from '../contexts/VaultContext';

interface TimelineEvent {
  id: string;
  event_type: string;
  title: string;
  description?: string;
  severity?: string;
  created_at: string;
  target_name?: string;
}

export default function VaultPage() {
  const { vaultId } = useParams<{ vaultId: string }>();
  const navigate = useNavigate();
  const { currentVault, selectVault, targets, openVaultFolder, exportVault, createTarget, updateVault, deleteVault } = useVault();
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', scope: '' });
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [newTarget, setNewTarget] = useState({
    name: '',
    type: 'host',
    host: '',
    port: '',
    url: '',
    description: '',
  });

  useEffect(() => {
    if (vaultId) {
      selectVault(vaultId).then(() => {
        loadTimeline();
      });
    }
  }, [vaultId, selectVault]);

  useEffect(() => {
    if (currentVault) {
      setEditForm({
        name: currentVault.name,
        description: currentVault.description || '',
        scope: currentVault.scope || '',
      });
    }
  }, [currentVault]);

  const loadTimeline = async () => {
    if (vaultId) {
      const events = await window.specter.db.timeline.list(vaultId);
      setTimeline(events as TimelineEvent[]);
    }
  };

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultId || !newTarget.name) return;

    await createTarget({
      vaultId,
      name: newTarget.name,
      type: newTarget.type,
      host: newTarget.host || undefined,
      port: newTarget.port ? parseInt(newTarget.port) : undefined,
      url: newTarget.url || undefined,
      description: newTarget.description || undefined,
    });

    setNewTarget({ name: '', type: 'host', host: '', port: '', url: '', description: '' });
    setShowAddTarget(false);
    loadTimeline();
  };

  const handleExport = async (format: string) => {
    if (!vaultId) return;
    const result = await exportVault(vaultId, format);
    if (result.path) {
      // Show success notification
    }
  };

  const handleEditVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultId || !editForm.name.trim()) return;

    await updateVault(vaultId, {
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      scope: editForm.scope.trim(),
    });
    setShowEditModal(false);
  };

  const handleDeleteVault = async (permanent: boolean) => {
    if (!vaultId) return;
    await deleteVault(vaultId);
    navigate('/');
  };

  if (!currentVault) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-specter-accent" />
      </div>
    );
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'vault_created':
        return '📁';
      case 'target_added':
        return '🎯';
      case 'finding_created':
        return '⚠️';
      case 'scan_completed':
        return '🔍';
      default:
        return '📝';
    }
  };

  return (
    <div className="p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-gray-400 hover:text-white hover:bg-specter-light rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-white">{currentVault.name}</h1>
            <span className="px-2 py-1 text-xs bg-specter-light rounded-full text-gray-400 capitalize">
              {currentVault.target_type.replace('_', ' ')}
            </span>
          </div>
          {currentVault.description && (
            <p className="text-gray-400 ml-12">{currentVault.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-specter-light rounded-lg transition-colors"
            title="Edit vault"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => openVaultFolder(currentVault.id)}
            className="p-2 text-gray-400 hover:text-white hover:bg-specter-light rounded-lg transition-colors"
            title="Open folder"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
          </button>
          <div className="relative group">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-specter-light rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-specter-medium border border-specter-light rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleExport('markdown')}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-specter-light hover:text-white transition-colors rounded-t-lg"
              >
                Export as Markdown
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-specter-light hover:text-white transition-colors rounded-b-lg"
              >
                Export as JSON
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
            title="Delete vault"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scope Card */}
      {currentVault.scope && (
        <div className="bg-specter-medium rounded-xl p-4 mb-6 border border-specter-light">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Scope</h3>
          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">{currentVault.scope}</pre>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Targets Column */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Targets</h2>
            <button
              onClick={() => setShowAddTarget(true)}
              className="px-3 py-1.5 bg-specter-accent hover:bg-specter-accent-hover text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Target
            </button>
          </div>

          {/* Add Target Form */}
          {showAddTarget && (
            <form onSubmit={handleAddTarget} className="bg-specter-medium rounded-xl p-4 mb-4 border border-specter-accent animate-slideIn">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newTarget.name}
                    onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                    className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white text-sm"
                    placeholder="Target name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select
                    value={newTarget.type}
                    onChange={(e) => setNewTarget({ ...newTarget, type: e.target.value })}
                    className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white text-sm"
                  >
                    <option value="host">Host</option>
                    <option value="web">Web App</option>
                    <option value="api">API</option>
                    <option value="service">Service</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Host/IP</label>
                  <input
                    type="text"
                    value={newTarget.host}
                    onChange={(e) => setNewTarget({ ...newTarget, host: e.target.value })}
                    className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white text-sm"
                    placeholder="192.168.1.1 or domain.com"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={newTarget.port}
                    onChange={(e) => setNewTarget({ ...newTarget, port: e.target.value })}
                    className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white text-sm"
                    placeholder="80, 443, 22..."
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">URL</label>
                  <input
                    type="text"
                    value={newTarget.url}
                    onChange={(e) => setNewTarget({ ...newTarget, url: e.target.value })}
                    className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white text-sm"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTarget(false)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-specter-accent hover:bg-specter-accent-hover text-white text-sm rounded-lg transition-colors"
                >
                  Add Target
                </button>
              </div>
            </form>
          )}

          {/* Targets List */}
          {targets.length === 0 ? (
            <div className="bg-specter-medium rounded-xl p-8 text-center border border-specter-light border-dashed">
              <div className="w-12 h-12 bg-specter-light rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">No targets yet. Add your first target to begin.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {targets.map((target) => (
                <div
                  key={target.id}
                  onClick={() => navigate(`/vault/${vaultId}/target/${target.id}`)}
                  className="bg-specter-medium rounded-xl p-4 border border-specter-light hover:border-specter-accent/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-specter-light rounded-lg flex items-center justify-center">
                        <span className="text-lg">
                          {target.type === 'web' ? '🌐' : target.type === 'api' ? '🔌' : '🖥️'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-white group-hover:text-specter-accent transition-colors">
                          {target.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {target.host && `${target.host}`}
                          {target.port && `:${target.port}`}
                          {target.url && ` • ${target.url}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">{target.finding_count || 0} findings</span>
                      <span className="text-gray-400">{target.log_count || 0} logs</span>
                      <svg className="w-5 h-5 text-gray-500 group-hover:text-specter-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline Column */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Timeline</h2>
          <div className="bg-specter-medium rounded-xl border border-specter-light overflow-hidden">
            {timeline.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No events yet
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                {timeline.map((event) => (
                  <div key={event.id} className="px-4 py-3 border-b border-specter-light/50 last:border-0 hover:bg-specter-light/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{getEventIcon(event.event_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{event.title}</p>
                        {event.description && (
                          <p className="text-xs text-gray-400 truncate">{event.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                      {event.severity && (
                        <span className={`px-2 py-0.5 text-xs rounded-full severity-${event.severity}`}>
                          {event.severity}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-specter-medium rounded-xl w-full max-w-lg border border-specter-light">
            <div className="flex items-center justify-between p-4 border-b border-specter-light">
              <h3 className="text-lg font-semibold text-white">Edit Vault</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditVault} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Scope</label>
                <textarea
                  value={editForm.scope}
                  onChange={(e) => setEditForm({ ...editForm, scope: e.target.value })}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white font-mono text-sm resize-none"
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-specter-medium rounded-xl w-full max-w-md border border-specter-light p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Vault</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <strong>"{currentVault.name}"</strong>? All targets, findings, and data will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteVault(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
