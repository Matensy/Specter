import React, { useState } from 'react';
import { useVault } from '../contexts/VaultContext';
import { useNavigate } from 'react-router-dom';

interface CreateVaultModalProps {
  onClose: () => void;
}

const targetTypes = [
  { value: 'web', label: 'Web Application', icon: '🌐', description: 'Web apps, APIs, SPAs' },
  { value: 'active_directory', label: 'Active Directory', icon: '🏢', description: 'AD/Windows infrastructure' },
  { value: 'api', label: 'API', icon: '🔌', description: 'REST, GraphQL, SOAP APIs' },
  { value: 'mobile', label: 'Mobile/APK', icon: '📱', description: 'Android/iOS apps' },
  { value: 'ctf', label: 'CTF Challenge', icon: '🚩', description: 'HackTheBox, TryHackMe, etc.' },
  { value: 'infrastructure', label: 'Infrastructure', icon: '🖥️', description: 'Networks, servers, cloud' },
];

export default function CreateVaultModal({ onClose }: CreateVaultModalProps) {
  const navigate = useNavigate();
  const { createVault, selectVault } = useVault();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetType: '',
    scope: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Vault name is required');
      return;
    }

    if (!formData.targetType) {
      setError('Please select a target type');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await createVault({
        name: formData.name.trim(),
        description: formData.description.trim(),
        targetType: formData.targetType,
        scope: formData.scope.trim(),
      });

      await selectVault(result.id);
      onClose();
      navigate(`/vault/${result.id}`);
    } catch (err) {
      setError((err as Error).message || 'Failed to create vault');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-specter-medium rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto border border-specter-light animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-specter-light">
          <h2 className="text-xl font-semibold text-white">Create New Vault</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-specter-light rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Vault Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Vault Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Client XYZ Assessment"
              className="w-full px-4 py-3 bg-specter-dark border border-specter-light rounded-lg text-white placeholder-gray-500 focus:border-specter-accent focus:ring-1 focus:ring-specter-accent transition-colors"
            />
          </div>

          {/* Target Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Target Type <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {targetTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, targetType: type.value })}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    formData.targetType === type.value
                      ? 'bg-specter-accent/20 border-specter-accent'
                      : 'bg-specter-dark border-specter-light hover:border-specter-accent/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <div className="font-medium text-white">{type.label}</div>
                      <div className="text-xs text-gray-400">{type.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the assessment..."
              rows={3}
              className="w-full px-4 py-3 bg-specter-dark border border-specter-light rounded-lg text-white placeholder-gray-500 focus:border-specter-accent focus:ring-1 focus:ring-specter-accent transition-colors resize-none"
            />
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Scope Definition
            </label>
            <textarea
              value={formData.scope}
              onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
              placeholder="Define target IPs, domains, URLs, restrictions..."
              rows={4}
              className="w-full px-4 py-3 bg-specter-dark border border-specter-light rounded-lg text-white placeholder-gray-500 focus:border-specter-accent focus:ring-1 focus:ring-specter-accent transition-colors resize-none font-mono text-sm"
            />
            <p className="mt-2 text-xs text-gray-500">
              Tip: Be specific about what's in scope to avoid accidental out-of-scope testing
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-specter-light">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Vault'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
