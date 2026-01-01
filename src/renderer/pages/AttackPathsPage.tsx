import React, { useEffect, useState } from 'react';
import { useVault } from '../contexts/VaultContext';

interface AttackStep {
  id: string;
  name: string;
  description: string;
}

interface AttackPath {
  id: string;
  name: string;
  description: string;
  steps: AttackStep[];
}

interface PathProgress {
  step_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  notes?: string;
  findings_count: number;
}

export default function AttackPathsPage() {
  const { currentVault, targets } = useVault();
  const [paths, setPaths] = useState<{ web: AttackPath[]; ad: AttackPath[] }>({ web: [], ad: [] });
  const [selectedCategory, setSelectedCategory] = useState<'web' | 'ad'>('web');
  const [selectedPath, setSelectedPath] = useState<AttackPath | null>(null);
  const [progress, setProgress] = useState<PathProgress[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  useEffect(() => {
    loadPaths();
  }, []);

  useEffect(() => {
    if (selectedTarget && selectedPath) {
      loadProgress();
    }
  }, [selectedTarget, selectedPath]);

  const loadPaths = async () => {
    const result = await window.specter.db.attackPaths.list();
    setPaths(result as { web: AttackPath[]; ad: AttackPath[] });
    if (result.web?.length > 0) {
      setSelectedPath(result.web[0]);
    }
  };

  const loadProgress = async () => {
    if (!selectedTarget) return;
    const result = await window.specter.db.attackPaths.getProgress(selectedTarget);
    setProgress(result as PathProgress[]);
  };

  const updateStepProgress = async (stepId: string, status: PathProgress['status']) => {
    if (!selectedTarget || !selectedPath) return;

    await window.specter.db.attackPaths.updateProgress(selectedTarget, selectedPath.id, {
      stepId,
      status,
    });

    await loadProgress();
  };

  const getStepStatus = (stepId: string): PathProgress['status'] => {
    const step = progress.find((p) => p.step_id === stepId);
    return step?.status || 'pending';
  };

  const getStatusColor = (status: PathProgress['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 border-green-400';
      case 'in_progress':
        return 'bg-yellow-500 border-yellow-400 animate-pulse';
      case 'skipped':
        return 'bg-gray-500 border-gray-400';
      default:
        return 'bg-specter-medium border-specter-light';
    }
  };

  const currentPaths = paths[selectedCategory] || [];

  return (
    <div className="p-6 animate-fadeIn h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Attack Paths</h1>
          <p className="text-gray-400">Follow structured attack methodologies</p>
        </div>

        {/* Target selector */}
        {targets.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Target:</span>
            <select
              value={selectedTarget || ''}
              onChange={(e) => setSelectedTarget(e.target.value || null)}
              className="px-3 py-2 bg-specter-medium border border-specter-light rounded-lg text-white text-sm"
            >
              <option value="">Select target</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => {
            setSelectedCategory('web');
            setSelectedPath(paths.web?.[0] || null);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCategory === 'web'
              ? 'bg-specter-accent text-white'
              : 'bg-specter-medium text-gray-400 hover:text-white'
          }`}
        >
          <span className="mr-2">🌐</span>
          Web Application
        </button>
        <button
          onClick={() => {
            setSelectedCategory('ad');
            setSelectedPath(paths.ad?.[0] || null);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCategory === 'ad'
              ? 'bg-specter-accent text-white'
              : 'bg-specter-medium text-gray-400 hover:text-white'
          }`}
        >
          <span className="mr-2">🏢</span>
          Active Directory
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex gap-6">
        {/* Paths list */}
        <div className="w-72 flex-shrink-0 overflow-y-auto">
          <div className="space-y-2">
            {currentPaths.map((path) => (
              <button
                key={path.id}
                onClick={() => setSelectedPath(path)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedPath?.id === path.id
                    ? 'bg-specter-accent/20 border-specter-accent'
                    : 'bg-specter-medium border-specter-light hover:border-specter-accent/50'
                }`}
              >
                <h3 className="font-medium text-white mb-1">{path.name}</h3>
                <p className="text-xs text-gray-400">{path.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex -space-x-1">
                    {path.steps.slice(0, 5).map((step, i) => (
                      <div
                        key={step.id}
                        className={`w-4 h-4 rounded-full border-2 ${getStatusColor(getStepStatus(step.id))}`}
                        style={{ zIndex: path.steps.length - i }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">
                    {progress.filter((p) => p.status === 'completed').length}/{path.steps.length}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Path details */}
        <div className="flex-1 overflow-y-auto">
          {selectedPath ? (
            <div className="bg-specter-medium rounded-xl border border-specter-light p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">{selectedPath.name}</h2>
                <p className="text-gray-400">{selectedPath.description}</p>
              </div>

              {!selectedTarget ? (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 text-yellow-400 text-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Select a target to track progress
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedPath.steps.map((step, index) => {
                    const status = getStepStatus(step.id);
                    return (
                      <div key={step.id} className="path-step">
                        <div
                          className={`absolute left-0 top-0 w-4 h-4 rounded-full border-2 -translate-x-1/2 ${getStatusColor(status)}`}
                        />
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-500">Step {index + 1}</span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                status === 'completed' ? 'bg-green-900/30 text-green-400' :
                                status === 'in_progress' ? 'bg-yellow-900/30 text-yellow-400' :
                                status === 'skipped' ? 'bg-gray-900/30 text-gray-400' :
                                'bg-specter-light text-gray-500'
                              }`}>
                                {status}
                              </span>
                            </div>
                            <h4 className="font-medium text-white mb-1">{step.name}</h4>
                            <p className="text-sm text-gray-400">{step.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateStepProgress(step.id, 'in_progress')}
                              disabled={status === 'in_progress'}
                              className="p-2 text-yellow-400 hover:bg-yellow-900/30 rounded-lg transition-colors disabled:opacity-50"
                              title="Start"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => updateStepProgress(step.id, 'completed')}
                              disabled={status === 'completed'}
                              className="p-2 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50"
                              title="Complete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => updateStepProgress(step.id, 'skipped')}
                              disabled={status === 'skipped'}
                              className="p-2 text-gray-400 hover:bg-gray-900/30 rounded-lg transition-colors disabled:opacity-50"
                              title="Skip"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a path to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
