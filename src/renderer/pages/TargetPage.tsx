import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Target {
  id: string;
  name: string;
  type: string;
  host?: string;
  port?: number;
  url?: string;
  description?: string;
}

interface Finding {
  id: string;
  title: string;
  description?: string;
  severity: string;
  category?: string;
  status: string;
  cve_id?: string;
  evidence_count: number;
  created_at: string;
}

interface CommandLog {
  id: string;
  command: string;
  output?: string;
  category?: string;
  executed_at: string;
}

export default function TargetPage() {
  const { vaultId, targetId } = useParams<{ vaultId: string; targetId: string }>();
  const navigate = useNavigate();
  const [target, setTarget] = useState<Target | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [activeTab, setActiveTab] = useState<'findings' | 'logs' | 'notes'>('findings');
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [newFinding, setNewFinding] = useState({
    title: '',
    description: '',
    severity: 'medium',
    category: '',
  });

  useEffect(() => {
    if (targetId) {
      loadTarget();
      loadFindings();
      loadLogs();
    }
  }, [targetId]);

  const loadTarget = async () => {
    const result = await window.specter.db.targets.get(targetId!);
    setTarget(result as Target);
  };

  const loadFindings = async () => {
    const result = await window.specter.db.findings.list(targetId!);
    setFindings(result as Finding[]);
  };

  const loadLogs = async () => {
    const result = await window.specter.db.logs.list(targetId!, { limit: 50 });
    setLogs(result as CommandLog[]);
  };

  const handleAddFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;

    await window.specter.db.findings.create({
      targetId,
      title: newFinding.title,
      description: newFinding.description,
      severity: newFinding.severity,
      category: newFinding.category,
    });

    setNewFinding({ title: '', description: '', severity: 'medium', category: '' });
    setShowAddFinding(false);
    loadFindings();
  };

  const getSeverityBadge = (severity: string) => {
    const classes = {
      critical: 'severity-critical',
      high: 'severity-high',
      medium: 'severity-medium',
      low: 'severity-low',
      info: 'severity-info',
    };
    return classes[severity as keyof typeof classes] || 'severity-info';
  };

  if (!target) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-specter-accent" />
      </div>
    );
  }

  return (
    <div className="p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate(`/vault/${vaultId}`)}
              className="p-2 text-gray-400 hover:text-white hover:bg-specter-light rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-2xl">
              {target.type === 'web' ? '🌐' : target.type === 'api' ? '🔌' : '🖥️'}
            </span>
            <h1 className="text-2xl font-bold text-white">{target.name}</h1>
          </div>
          <p className="text-gray-400 ml-12">
            {target.host && `${target.host}`}
            {target.port && `:${target.port}`}
            {target.url && ` • ${target.url}`}
          </p>
        </div>

        <button
          onClick={() => navigate('/terminal')}
          className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Open Terminal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-specter-medium rounded-lg p-4 border border-specter-light">
          <div className="text-2xl font-bold text-red-400">{findings.filter(f => f.severity === 'critical').length}</div>
          <div className="text-sm text-gray-400">Critical</div>
        </div>
        <div className="bg-specter-medium rounded-lg p-4 border border-specter-light">
          <div className="text-2xl font-bold text-orange-400">{findings.filter(f => f.severity === 'high').length}</div>
          <div className="text-sm text-gray-400">High</div>
        </div>
        <div className="bg-specter-medium rounded-lg p-4 border border-specter-light">
          <div className="text-2xl font-bold text-yellow-400">{findings.filter(f => f.severity === 'medium').length}</div>
          <div className="text-sm text-gray-400">Medium</div>
        </div>
        <div className="bg-specter-medium rounded-lg p-4 border border-specter-light">
          <div className="text-2xl font-bold text-green-400">{findings.filter(f => f.severity === 'low').length}</div>
          <div className="text-sm text-gray-400">Low</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-4 border-b border-specter-light">
        {(['findings', 'logs', 'notes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-specter-accent border-specter-accent'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'findings' && findings.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-specter-light rounded-full">{findings.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'findings' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Findings</h2>
            <button
              onClick={() => setShowAddFinding(true)}
              className="px-3 py-1.5 bg-specter-accent hover:bg-specter-accent-hover text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Finding
            </button>
          </div>

          {/* Add Finding Form */}
          {showAddFinding && (
            <form onSubmit={handleAddFinding} className="bg-specter-medium rounded-xl p-4 mb-4 border border-specter-accent animate-slideIn">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={newFinding.title}
                    onChange={(e) => setNewFinding({ ...newFinding, title: e.target.value })}
                    className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white text-sm"
                    placeholder="Finding title"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Severity</label>
                  <select
                    value={newFinding.severity}
                    onChange={(e) => setNewFinding({ ...newFinding, severity: e.target.value })}
                    className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white text-sm"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="info">Informational</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <input
                    type="text"
                    value={newFinding.category}
                    onChange={(e) => setNewFinding({ ...newFinding, category: e.target.value })}
                    className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white text-sm"
                    placeholder="e.g., XSS, SQLi, IDOR"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={newFinding.description}
                    onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })}
                    className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white text-sm resize-none"
                    rows={3}
                    placeholder="Describe the vulnerability..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddFinding(false)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-specter-accent hover:bg-specter-accent-hover text-white text-sm rounded-lg transition-colors"
                >
                  Add Finding
                </button>
              </div>
            </form>
          )}

          {/* Findings list */}
          {findings.length === 0 ? (
            <div className="bg-specter-medium rounded-xl p-8 text-center border border-specter-light border-dashed">
              <p className="text-gray-400">No findings yet. Start testing to discover vulnerabilities.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map((finding) => (
                <div key={finding.id} className="bg-specter-medium rounded-xl p-4 border border-specter-light hover:border-specter-accent/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getSeverityBadge(finding.severity)}`}>
                          {finding.severity}
                        </span>
                        {finding.category && (
                          <span className="px-2 py-0.5 text-xs bg-specter-light text-gray-400 rounded-full">
                            {finding.category}
                          </span>
                        )}
                        {finding.cve_id && (
                          <span className="px-2 py-0.5 text-xs bg-purple-900/30 text-purple-400 rounded-full">
                            {finding.cve_id}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-white mb-1">{finding.title}</h3>
                      {finding.description && (
                        <p className="text-sm text-gray-400 line-clamp-2">{finding.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{finding.evidence_count} evidence</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Command Logs</h2>
          {logs.length === 0 ? (
            <div className="bg-specter-medium rounded-xl p-8 text-center border border-specter-light border-dashed">
              <p className="text-gray-400">No command logs yet. Use the terminal to start testing.</p>
            </div>
          ) : (
            <div className="bg-specter-darker rounded-xl border border-specter-light overflow-hidden">
              {logs.map((log) => (
                <div key={log.id} className="border-b border-specter-light last:border-0 p-3 hover:bg-specter-medium/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">{new Date(log.executed_at).toLocaleString()}</span>
                    {log.category && (
                      <span className="px-1.5 py-0.5 text-xs bg-specter-light text-gray-400 rounded">{log.category}</span>
                    )}
                  </div>
                  <code className="text-sm text-green-400 font-mono">$ {log.command}</code>
                  {log.output && (
                    <pre className="mt-2 text-xs text-gray-400 font-mono max-h-24 overflow-auto">{log.output.slice(0, 500)}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Notes</h2>
          <div className="bg-specter-medium rounded-xl p-4 border border-specter-light">
            <textarea
              className="w-full h-64 bg-transparent text-gray-300 resize-none focus:outline-none font-mono text-sm"
              placeholder="Write your notes here in Markdown..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
