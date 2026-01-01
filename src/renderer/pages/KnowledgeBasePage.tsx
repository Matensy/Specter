import React, { useState } from 'react';

interface Technique {
  id: string;
  technique_id: string;
  name: string;
  category: string;
  description?: string;
  attack_path?: string;
  prerequisites?: string;
  steps?: string[];
}

interface CVE {
  id: string;
  cve_id: string;
  title: string;
  description?: string;
  severity?: string;
  cvss_score?: number;
}

export default function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ techniques: Technique[]; cves: CVE[] }>({ techniques: [], cves: [] });
  const [selectedTechnique, setSelectedTechnique] = useState<Technique | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const results = await window.specter.db.knowledge.search(searchQuery);
      setSearchResults(results as { techniques: Technique[]; cves: CVE[] });
    } finally {
      setLoading(false);
    }
  };

  const loadTechniqueDetails = async (techniqueId: string) => {
    const technique = await window.specter.db.knowledge.technique(techniqueId);
    setSelectedTechnique(technique as Technique);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Web': return 'bg-blue-900/30 text-blue-400';
      case 'ActiveDirectory': return 'bg-purple-900/30 text-purple-400';
      case 'Network': return 'bg-green-900/30 text-green-400';
      case 'Privilege Escalation': return 'bg-red-900/30 text-red-400';
      default: return 'bg-gray-900/30 text-gray-400';
    }
  };

  return (
    <div className="p-6 animate-fadeIn h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Knowledge Base</h1>
        <p className="text-gray-400">Search techniques, CVEs, and attack methodologies</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search for techniques, CVEs, attack patterns..."
            className="w-full px-4 py-3 bg-specter-medium border border-specter-light rounded-lg text-white placeholder-gray-500 pl-12"
          />
          <svg className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-3 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex gap-6">
        {/* Results */}
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Techniques */}
          {searchResults.techniques.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-specter-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Techniques ({searchResults.techniques.length})
              </h2>
              <div className="space-y-3">
                {searchResults.techniques.map((technique) => (
                  <div
                    key={technique.id}
                    onClick={() => loadTechniqueDetails(technique.technique_id)}
                    className={`bg-specter-medium rounded-xl p-4 border transition-all cursor-pointer ${
                      selectedTechnique?.id === technique.id
                        ? 'border-specter-accent'
                        : 'border-specter-light hover:border-specter-accent/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-500 font-mono">{technique.technique_id}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(technique.category)}`}>
                            {technique.category}
                          </span>
                        </div>
                        <h3 className="font-medium text-white">{technique.name}</h3>
                        {technique.description && (
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{technique.description}</p>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CVEs */}
          {searchResults.cves.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                CVEs ({searchResults.cves.length})
              </h2>
              <div className="space-y-3">
                {searchResults.cves.map((cve) => (
                  <div key={cve.id} className="bg-specter-medium rounded-xl p-4 border border-specter-light hover:border-specter-accent/50 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-red-400">{cve.cve_id}</span>
                      {cve.cvss_score && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          cve.cvss_score >= 9 ? 'bg-red-900/30 text-red-400' :
                          cve.cvss_score >= 7 ? 'bg-orange-900/30 text-orange-400' :
                          cve.cvss_score >= 4 ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-green-900/30 text-green-400'
                        }`}>
                          CVSS: {cve.cvss_score}
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-white">{cve.title}</h3>
                    {cve.description && (
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{cve.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {searchResults.techniques.length === 0 && searchResults.cves.length === 0 && searchQuery && !loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 bg-specter-medium rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No results found</h3>
                <p className="text-gray-400">Try a different search term</p>
              </div>
            </div>
          )}

          {/* Initial state */}
          {!searchQuery && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 bg-specter-medium rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Search the Knowledge Base</h3>
                <p className="text-gray-400">Find techniques, CVEs, and attack methodologies</p>
              </div>
            </div>
          )}
        </div>

        {/* Technique details */}
        {selectedTechnique && (
          <div className="w-96 flex-shrink-0 bg-specter-medium rounded-xl border border-specter-light overflow-hidden">
            <div className="p-5 border-b border-specter-light">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-mono">{selectedTechnique.technique_id}</span>
                <button
                  onClick={() => setSelectedTechnique(null)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h2 className="text-xl font-semibold text-white">{selectedTechnique.name}</h2>
              <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${getCategoryColor(selectedTechnique.category)}`}>
                {selectedTechnique.category}
              </span>
            </div>

            <div className="p-5 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
              {selectedTechnique.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Description</h3>
                  <p className="text-sm text-gray-300">{selectedTechnique.description}</p>
                </div>
              )}

              {selectedTechnique.prerequisites && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Prerequisites</h3>
                  <p className="text-sm text-gray-300">{selectedTechnique.prerequisites}</p>
                </div>
              )}

              {selectedTechnique.steps && selectedTechnique.steps.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Steps</h3>
                  <ol className="space-y-2">
                    {selectedTechnique.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="text-specter-accent font-medium">{i + 1}.</span>
                        <span className="text-sm text-gray-300">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
