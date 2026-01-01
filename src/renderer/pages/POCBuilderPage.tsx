import React, { useState } from 'react';
import { useVault } from '../contexts/VaultContext';

interface POCStep {
  id: string;
  description: string;
  command?: string;
  expected?: string;
}

export default function POCBuilderPage() {
  const { targets } = useVault();
  const [poc, setPoc] = useState({
    title: '',
    targetId: '',
    objective: '',
    prerequisites: '',
    steps: [{ id: '1', description: '', command: '', expected: '' }] as POCStep[],
    payload: '',
    impact: '',
    severity: 'medium',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addStep = () => {
    setPoc({
      ...poc,
      steps: [...poc.steps, { id: String(poc.steps.length + 1), description: '', command: '', expected: '' }],
    });
  };

  const removeStep = (index: number) => {
    if (poc.steps.length > 1) {
      setPoc({
        ...poc,
        steps: poc.steps.filter((_, i) => i !== index),
      });
    }
  };

  const updateStep = (index: number, field: keyof POCStep, value: string) => {
    const newSteps = [...poc.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setPoc({ ...poc, steps: newSteps });
  };

  const handleSave = async () => {
    if (!poc.targetId || !poc.title || !poc.objective) return;

    setSaving(true);
    try {
      await window.specter.db.pocs.create({
        targetId: poc.targetId,
        title: poc.title,
        objective: poc.objective,
        prerequisites: poc.prerequisites,
        steps: poc.steps,
        payload: poc.payload,
        impact: poc.impact,
        severity: poc.severity,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      // Reset form
      setPoc({
        title: '',
        targetId: poc.targetId,
        objective: '',
        prerequisites: '',
        steps: [{ id: '1', description: '', command: '', expected: '' }],
        payload: '',
        impact: '',
        severity: 'medium',
      });
    } finally {
      setSaving(false);
    }
  };

  const generateMarkdown = () => {
    let md = `# POC: ${poc.title}\n\n`;
    md += `## Objective\n${poc.objective}\n\n`;
    md += `## Severity\n${poc.severity.toUpperCase()}\n\n`;

    if (poc.prerequisites) {
      md += `## Prerequisites\n${poc.prerequisites}\n\n`;
    }

    md += `## Steps to Reproduce\n\n`;
    poc.steps.forEach((step, i) => {
      md += `### Step ${i + 1}\n`;
      md += `${step.description}\n\n`;
      if (step.command) {
        md += `\`\`\`bash\n${step.command}\n\`\`\`\n\n`;
      }
      if (step.expected) {
        md += `**Expected:** ${step.expected}\n\n`;
      }
    });

    if (poc.payload) {
      md += `## Payload\n\`\`\`\n${poc.payload}\n\`\`\`\n\n`;
    }

    md += `## Impact\n${poc.impact}\n`;

    return md;
  };

  return (
    <div className="p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">POC Builder</h1>
          <p className="text-gray-400">Create structured proof of concept documentation</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-green-400 text-sm animate-fadeIn">Saved successfully!</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !poc.targetId || !poc.title || !poc.objective}
            className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save POC
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-specter-medium rounded-xl p-5 border border-specter-light">
            <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target *</label>
                <select
                  value={poc.targetId}
                  onChange={(e) => setPoc({ ...poc, targetId: e.target.value })}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                >
                  <option value="">Select target</option>
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>{target.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={poc.title}
                  onChange={(e) => setPoc({ ...poc, title: e.target.value })}
                  placeholder="e.g., SQL Injection in Login Form"
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Severity</label>
                <select
                  value={poc.severity}
                  onChange={(e) => setPoc({ ...poc, severity: e.target.value })}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Objective *</label>
                <textarea
                  value={poc.objective}
                  onChange={(e) => setPoc({ ...poc, objective: e.target.value })}
                  placeholder="What does this POC demonstrate?"
                  rows={3}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Prerequisites</label>
                <textarea
                  value={poc.prerequisites}
                  onChange={(e) => setPoc({ ...poc, prerequisites: e.target.value })}
                  placeholder="What's needed before exploitation?"
                  rows={2}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="bg-specter-medium rounded-xl p-5 border border-specter-light">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Steps to Reproduce</h2>
              <button
                onClick={addStep}
                className="p-2 text-specter-accent hover:bg-specter-light rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {poc.steps.map((step, index) => (
                <div key={step.id} className="p-4 bg-specter-dark rounded-lg border border-specter-light">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400">Step {index + 1}</span>
                    {poc.steps.length > 1 && (
                      <button
                        onClick={() => removeStep(index)}
                        className="p-1 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={step.description}
                      onChange={(e) => updateStep(index, 'description', e.target.value)}
                      placeholder="Description of this step"
                      className="w-full px-3 py-2 bg-specter-medium border border-specter-light rounded-lg text-white text-sm"
                    />
                    <input
                      type="text"
                      value={step.command}
                      onChange={(e) => updateStep(index, 'command', e.target.value)}
                      placeholder="Command (optional)"
                      className="w-full px-3 py-2 bg-specter-medium border border-specter-light rounded-lg text-green-400 text-sm font-mono"
                    />
                    <input
                      type="text"
                      value={step.expected}
                      onChange={(e) => updateStep(index, 'expected', e.target.value)}
                      placeholder="Expected result (optional)"
                      className="w-full px-3 py-2 bg-specter-medium border border-specter-light rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payload & Impact */}
          <div className="bg-specter-medium rounded-xl p-5 border border-specter-light">
            <h2 className="text-lg font-semibold text-white mb-4">Payload & Impact</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Payload</label>
                <textarea
                  value={poc.payload}
                  onChange={(e) => setPoc({ ...poc, payload: e.target.value })}
                  placeholder="The exploit payload..."
                  rows={4}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-red-400 font-mono text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Impact *</label>
                <textarea
                  value={poc.impact}
                  onChange={(e) => setPoc({ ...poc, impact: e.target.value })}
                  placeholder="What can an attacker achieve?"
                  rows={3}
                  className="w-full px-3 py-2 bg-specter-dark border border-specter-light rounded-lg text-white resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-specter-medium rounded-xl border border-specter-light overflow-hidden sticky top-6 h-fit">
          <div className="flex items-center justify-between px-5 py-3 border-b border-specter-light">
            <h2 className="font-semibold text-white">Preview</h2>
            <button
              onClick={() => navigator.clipboard.writeText(generateMarkdown())}
              className="p-2 text-gray-400 hover:text-white hover:bg-specter-light rounded-lg transition-colors"
              title="Copy Markdown"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
          <div className="p-5 max-h-[calc(100vh-200px)] overflow-auto">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">{generateMarkdown()}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
