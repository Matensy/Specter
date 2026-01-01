import React, { useEffect, useState } from 'react';
import { useVault } from '../contexts/VaultContext';

interface Finding {
  id: string;
  target_id: string;
  title: string;
  description?: string;
  severity: string;
  category?: string;
  status: string;
  cve_id?: string;
  evidence_count: number;
  created_at: string;
  target_name?: string;
}

export default function FindingsPage() {
  const { targets } = useVault();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    severity: 'all',
    status: 'all',
    search: '',
  });

  useEffect(() => {
    loadAllFindings();
  }, [targets]);

  const loadAllFindings = async () => {
    setLoading(true);
    const allFindings: Finding[] = [];

    for (const target of targets) {
      const result = await window.specter.db.findings.list(target.id);
      allFindings.push(...(result as Finding[]).map(f => ({ ...f, target_name: target.name })));
    }

    setFindings(allFindings);
    setLoading(false);
  };

  const getSeverityBadge = (severity: string) => {
    const classes: Record<string, string> = {
      critical: 'severity-critical',
      high: 'severity-high',
      medium: 'severity-medium',
      low: 'severity-low',
      info: 'severity-info',
    };
    return classes[severity] || 'severity-info';
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      open: 'bg-red-900/30 text-red-400',
      confirmed: 'bg-yellow-900/30 text-yellow-400',
      resolved: 'bg-green-900/30 text-green-400',
      false_positive: 'bg-gray-900/30 text-gray-400',
    };
    return classes[status] || 'bg-gray-900/30 text-gray-400';
  };

  const filteredFindings = findings.filter((finding) => {
    if (filter.severity !== 'all' && finding.severity !== filter.severity) return false;
    if (filter.status !== 'all' && finding.status !== filter.status) return false;
    if (filter.search && !finding.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };

  return (
    <div className="p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Findings</h1>
          <p className="text-gray-400">All discovered vulnerabilities across targets</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setFilter({ ...filter, severity: filter.severity === 'critical' ? 'all' : 'critical' })}
          className={`bg-specter-medium rounded-lg p-4 border transition-all ${
            filter.severity === 'critical' ? 'border-red-500' : 'border-specter-light hover:border-red-500/50'
          }`}
        >
          <div className="text-3xl font-bold text-red-400">{severityCounts.critical}</div>
          <div className="text-sm text-gray-400">Critical</div>
        </button>
        <button
          onClick={() => setFilter({ ...filter, severity: filter.severity === 'high' ? 'all' : 'high' })}
          className={`bg-specter-medium rounded-lg p-4 border transition-all ${
            filter.severity === 'high' ? 'border-orange-500' : 'border-specter-light hover:border-orange-500/50'
          }`}
        >
          <div className="text-3xl font-bold text-orange-400">{severityCounts.high}</div>
          <div className="text-sm text-gray-400">High</div>
        </button>
        <button
          onClick={() => setFilter({ ...filter, severity: filter.severity === 'medium' ? 'all' : 'medium' })}
          className={`bg-specter-medium rounded-lg p-4 border transition-all ${
            filter.severity === 'medium' ? 'border-yellow-500' : 'border-specter-light hover:border-yellow-500/50'
          }`}
        >
          <div className="text-3xl font-bold text-yellow-400">{severityCounts.medium}</div>
          <div className="text-sm text-gray-400">Medium</div>
        </button>
        <button
          onClick={() => setFilter({ ...filter, severity: filter.severity === 'low' ? 'all' : 'low' })}
          className={`bg-specter-medium rounded-lg p-4 border transition-all ${
            filter.severity === 'low' ? 'border-green-500' : 'border-specter-light hover:border-green-500/50'
          }`}
        >
          <div className="text-3xl font-bold text-green-400">{severityCounts.low}</div>
          <div className="text-sm text-gray-400">Low</div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            placeholder="Search findings..."
            className="w-full px-4 py-2 bg-specter-medium border border-specter-light rounded-lg text-white placeholder-gray-500"
          />
        </div>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-4 py-2 bg-specter-medium border border-specter-light rounded-lg text-white"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="confirmed">Confirmed</option>
          <option value="resolved">Resolved</option>
          <option value="false_positive">False Positive</option>
        </select>
        {(filter.severity !== 'all' || filter.status !== 'all' || filter.search) && (
          <button
            onClick={() => setFilter({ severity: 'all', status: 'all', search: '' })}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Findings list */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-specter-accent" />
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="bg-specter-medium rounded-xl p-12 text-center border border-specter-light border-dashed">
          <div className="w-16 h-16 bg-specter-light rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {findings.length === 0 ? 'No findings yet' : 'No matching findings'}
          </h3>
          <p className="text-gray-400">
            {findings.length === 0
              ? 'Start testing your targets to discover vulnerabilities'
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((finding) => (
            <div key={finding.id} className="bg-specter-medium rounded-xl p-5 border border-specter-light hover:border-specter-accent/50 transition-all cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${getSeverityBadge(finding.severity)}`}>
                      {finding.severity.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(finding.status)}`}>
                      {finding.status.replace('_', ' ')}
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
                  <h3 className="text-lg font-medium text-white mb-1">{finding.title}</h3>
                  {finding.description && (
                    <p className="text-sm text-gray-400 line-clamp-2 mb-2">{finding.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Target: {finding.target_name}</span>
                    <span>{finding.evidence_count} evidence</span>
                    <span>{new Date(finding.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
