import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PentestContext, GeneratedCommand, DiscoveredHost, DiscoveredVuln } from '../services/PentestContext';

interface Phase {
  id: string;
  name: string;
  description: string;
  icon: string;
  commands: GeneratedCommand[];
  status: 'locked' | 'available' | 'in_progress' | 'completed';
}

const PHASE_CONFIG: { id: string; name: string; description: string; icon: string }[] = [
  { id: 'recon', name: 'Reconnaissance', description: 'Initial scanning and enumeration', icon: '🔍' },
  { id: 'enum', name: 'Enumeration', description: 'Service-specific enumeration', icon: '📋' },
  { id: 'vuln', name: 'Vulnerability Analysis', description: 'Identify vulnerabilities', icon: '⚠️' },
  { id: 'exploit', name: 'Exploitation', description: 'Exploit vulnerabilities', icon: '💥' },
  { id: 'post', name: 'Post-Exploitation', description: 'Maintain access, escalate privileges', icon: '🎯' },
];

export default function AttackPathsPage() {
  const navigate = useNavigate();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<string>('recon');
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [vulns, setVulns] = useState<DiscoveredVuln[]>([]);
  const [currentTarget, setCurrentTarget] = useState<string | null>(null);
  const [executedCommands, setExecutedCommands] = useState<Set<string>>(new Set());
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const updateFromContext = useCallback(() => {
    const commandsByPhase = PentestContext.getCommandsByPhase();
    const allHosts = PentestContext.getHosts();
    const allVulns = PentestContext.getVulns();
    const target = PentestContext.getCurrentTarget();

    setHosts(allHosts);
    setVulns(allVulns);
    setCurrentTarget(target);

    // Build phases with commands
    const newPhases: Phase[] = PHASE_CONFIG.map(config => {
      const commands = commandsByPhase[config.id] || [];
      let status: Phase['status'] = 'available';

      // Determine phase status based on context
      if (config.id === 'recon') {
        status = allHosts.length > 0 ? 'completed' : 'available';
      } else if (config.id === 'enum') {
        status = allHosts.length > 0 ? 'available' : 'locked';
        if (allHosts.some(h => h.ports.length > 3)) status = 'completed';
      } else if (config.id === 'vuln') {
        status = allHosts.some(h => h.ports.length > 0) ? 'available' : 'locked';
        if (allVulns.length > 0) status = 'completed';
      } else if (config.id === 'exploit') {
        status = allVulns.length > 0 || allHosts.some(h => h.ports.length > 0) ? 'available' : 'locked';
      } else if (config.id === 'post') {
        status = 'locked'; // Unlock after successful exploitation
      }

      return { ...config, commands, status };
    });

    setPhases(newPhases);
  }, []);

  useEffect(() => {
    updateFromContext();
    const unsubscribe = PentestContext.subscribe(updateFromContext);
    return () => unsubscribe();
  }, [updateFromContext]);

  const copyCommand = (command: string, id: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const markAsExecuted = (id: string) => {
    setExecutedCommands(prev => new Set([...prev, id]));
  };

  const goToTerminal = () => {
    navigate('/terminal');
  };

  const selectedPhaseData = phases.find(p => p.id === selectedPhase);

  const getStatusColor = (status: Phase['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-yellow-500 animate-pulse';
      case 'available': return 'bg-blue-500';
      case 'locked': return 'bg-gray-600';
    }
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'Reconnaissance': 'border-blue-600 bg-blue-900/20',
      'Web Enumeration': 'border-green-600 bg-green-900/20',
      'Vulnerability Scan': 'border-red-600 bg-red-900/20',
      'Brute Force': 'border-orange-600 bg-orange-900/20',
      'Exploit Research': 'border-purple-600 bg-purple-900/20',
      'SMB Enumeration': 'border-yellow-600 bg-yellow-900/20',
      'SSH Enumeration': 'border-cyan-600 bg-cyan-900/20',
      'FTP Enumeration': 'border-teal-600 bg-teal-900/20',
      'Database Enumeration': 'border-pink-600 bg-pink-900/20',
      'AD Enumeration': 'border-indigo-600 bg-indigo-900/20',
      'AD Attack': 'border-violet-600 bg-violet-900/20',
      'DNS Enumeration': 'border-amber-600 bg-amber-900/20',
      'SNMP Enumeration': 'border-lime-600 bg-lime-900/20',
      'Manual Testing': 'border-gray-600 bg-gray-900/20',
      'CMS Scan': 'border-emerald-600 bg-emerald-900/20',
      'LDAP Enumeration': 'border-fuchsia-600 bg-fuchsia-900/20',
      'RDP Enumeration': 'border-rose-600 bg-rose-900/20',
      'Path Analysis': 'border-sky-600 bg-sky-900/20',
      'Access': 'border-green-500 bg-green-900/30',
    };
    return colors[category] || 'border-specter-light bg-specter-medium';
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-specter-medium">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Attack Paths</h1>
            <p className="text-gray-400">Dynamic methodology with context-aware commands</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Current target display */}
            {currentTarget ? (
              <div className="flex items-center gap-3 px-4 py-2 bg-specter-medium rounded-lg">
                <span className="text-gray-400 text-sm">Target:</span>
                <span className="text-specter-accent font-mono text-lg">{currentTarget}</span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400">{hosts.find(h => h.ip === currentTarget)?.ports.filter(p => p.state === 'open').length || 0} ports</span>
                  <span className="text-red-400">{vulns.length} vulns</span>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-400 text-sm">
                No target detected - run a scan first
              </div>
            )}

            <button
              onClick={goToTerminal}
              className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Open Terminal
            </button>
          </div>
        </div>

        {/* Phase tabs */}
        <div className="flex items-center gap-2 mt-6">
          {phases.map((phase, index) => (
            <button
              key={phase.id}
              onClick={() => phase.status !== 'locked' && setSelectedPhase(phase.id)}
              disabled={phase.status === 'locked'}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                selectedPhase === phase.id
                  ? 'bg-specter-accent text-white'
                  : phase.status === 'locked'
                    ? 'bg-specter-dark text-gray-600 cursor-not-allowed'
                    : 'bg-specter-medium text-gray-300 hover:bg-specter-light hover:text-white'
              }`}
            >
              <span className="text-xl">{phase.icon}</span>
              <div className="text-left">
                <div className="font-medium flex items-center gap-2">
                  {phase.name}
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(phase.status)}`} />
                </div>
                <div className="text-xs opacity-70">{phase.commands.length} commands</div>
              </div>
              {index < phases.length - 1 && (
                <svg className="w-4 h-4 ml-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Discovered Info Sidebar */}
        <div className="w-80 border-r border-specter-medium overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Discovered Information</h3>

          {/* Hosts */}
          {hosts.length > 0 ? (
            <div className="space-y-3">
              {hosts.map(host => (
                <div key={host.ip} className="bg-specter-medium rounded-lg p-3 border border-specter-light">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-specter-accent">{host.ip}</span>
                    {host.hostname && <span className="text-xs text-gray-500">{host.hostname}</span>}
                  </div>
                  {host.os && <div className="text-xs text-gray-400 mb-2">OS: {host.os}</div>}
                  <div className="space-y-1">
                    {host.ports.filter(p => p.state === 'open').map(port => (
                      <div key={`${port.port}-${port.protocol}`} className="flex items-center justify-between text-xs">
                        <span className="text-green-400">{port.port}/{port.protocol}</span>
                        <span className="text-gray-400">{port.service}</span>
                        {port.version && <span className="text-yellow-400">{port.version}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <div className="w-12 h-12 bg-specter-medium rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm">No hosts discovered yet</p>
              <p className="text-xs mt-1">Run a scan to populate</p>
            </div>
          )}

          {/* Vulnerabilities */}
          {vulns.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Vulnerabilities ({vulns.length})</h4>
              <div className="space-y-2">
                {vulns.slice(0, 10).map(vuln => (
                  <div
                    key={vuln.id}
                    className={`p-2 rounded border text-xs ${
                      vuln.severity === 'critical' ? 'border-red-600 bg-red-900/20 text-red-300' :
                      vuln.severity === 'high' ? 'border-orange-600 bg-orange-900/20 text-orange-300' :
                      vuln.severity === 'medium' ? 'border-yellow-600 bg-yellow-900/20 text-yellow-300' :
                      'border-gray-600 bg-gray-900/20 text-gray-300'
                    }`}
                  >
                    <div className="font-medium">{vuln.name}</div>
                    {vuln.cve && <div className="text-xs opacity-70">{vuln.cve}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Commands */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedPhaseData ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                  <span>{selectedPhaseData.icon}</span>
                  {selectedPhaseData.name}
                </h2>
                <p className="text-gray-400 mt-1">{selectedPhaseData.description}</p>
              </div>

              {selectedPhaseData.commands.length > 0 ? (
                <div className="space-y-3">
                  {selectedPhaseData.commands.map(cmd => (
                    <div
                      key={cmd.id}
                      className={`rounded-lg border p-4 transition-all ${getCategoryColor(cmd.category)} ${
                        executedCommands.has(cmd.id) ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-black/30 text-gray-300">
                              {cmd.category}
                            </span>
                            {cmd.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                            ))}
                          </div>
                          <div className="font-medium text-white mb-2">{cmd.description}</div>
                          <div className="bg-black/40 rounded p-3 font-mono text-sm text-green-400 break-all">
                            {cmd.command}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => copyCommand(cmd.command, cmd.id)}
                            className={`p-2 rounded transition-colors ${
                              copiedCommand === cmd.id
                                ? 'bg-green-600 text-white'
                                : 'bg-specter-dark hover:bg-specter-light text-gray-400 hover:text-white'
                            }`}
                            title="Copy command"
                          >
                            {copiedCommand === cmd.id ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => markAsExecuted(cmd.id)}
                            className={`p-2 rounded transition-colors ${
                              executedCommands.has(cmd.id)
                                ? 'bg-green-900/50 text-green-400'
                                : 'bg-specter-dark hover:bg-specter-light text-gray-400 hover:text-white'
                            }`}
                            title="Mark as executed"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-16">
                  <div className="w-16 h-16 bg-specter-medium rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-lg mb-2">No commands for this phase yet</p>
                  <p className="text-sm">Run scans to discover services and unlock commands</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-16">
              Select a phase to view commands
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
