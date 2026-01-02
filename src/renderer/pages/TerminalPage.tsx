import React, { useEffect, useRef, useState, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';
import { useVM } from '../contexts/VMContext';
import { useVault } from '../contexts/VaultContext';
import { TerminalManager, ManagedTerminal } from '../services/TerminalManager';
import { PentestContext, GeneratedCommand } from '../services/PentestContext';

export default function TerminalPage() {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const { status: vmStatus, connect } = useVM();
  const { currentVault } = useVault();
  const [terminals, setTerminals] = useState<ManagedTerminal[]>([]);
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickCommands, setQuickCommands] = useState<GeneratedCommand[]>([]);
  const [lastDetectedTool, setLastDetectedTool] = useState<string>('');
  const [showAllCommands, setShowAllCommands] = useState(false);
  const [contextInfo, setContextInfo] = useState<{ target: string | null; portsCount: number }>({ target: null, portsCount: 0 });

  // Update commands from PentestContext
  const updateCommands = useCallback(() => {
    const commands = PentestContext.generateCommands();
    setQuickCommands(commands.slice(0, showAllCommands ? 50 : 8));
    setLastDetectedTool(PentestContext.getLastDetectedTool());

    const host = PentestContext.getCurrentHost();
    setContextInfo({
      target: PentestContext.getCurrentTarget(),
      portsCount: host?.ports.filter(p => p.state === 'open').length || 0,
    });
  }, [showAllCommands]);

  // Subscribe to PentestContext changes
  useEffect(() => {
    updateCommands();
    const unsubscribe = PentestContext.subscribe(updateCommands);
    return () => unsubscribe();
  }, [updateCommands]);

  // Listen for terminal output to analyze
  useEffect(() => {
    let outputBuffer = '';
    let bufferTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleTerminalData = (_terminalId: string, data: string) => {
      // Buffer output to avoid processing every single character
      outputBuffer += data;

      if (bufferTimeout) clearTimeout(bufferTimeout);
      bufferTimeout = setTimeout(() => {
        if (outputBuffer.length > 50) { // Only analyze meaningful output
          PentestContext.analyzeOutput(outputBuffer);
        }
        outputBuffer = '';
      }, 500);
    };

    window.specter.terminal.onData(handleTerminalData);

    return () => {
      if (bufferTimeout) clearTimeout(bufferTimeout);
    };
  }, []);

  // Load existing terminals on mount
  useEffect(() => {
    const existingTerminals = TerminalManager.getAllTerminals();
    setTerminals(existingTerminals);
    if (existingTerminals.length > 0 && !activeTerminal) {
      setActiveTerminal(existingTerminals[0].id);
    }
  }, []);

  // Attach active terminal to container
  useEffect(() => {
    if (!terminalContainerRef.current || !activeTerminal) return;

    // Cleanup previous resize observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    // Attach terminal to container
    TerminalManager.attachToContainer(activeTerminal, terminalContainerRef.current);

    // Setup resize observer
    resizeObserverRef.current = new ResizeObserver(() => {
      TerminalManager.fit(activeTerminal);
    });

    resizeObserverRef.current.observe(terminalContainerRef.current);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      // Detach but don't destroy
      TerminalManager.detachFromContainer(activeTerminal);
    };
  }, [activeTerminal]);

  const createTerminal = useCallback(async () => {
    if (!vmStatus.connected) {
      setError('VM not connected');
      return;
    }

    setError(null);
    const vaultId = currentVault?.id || 'global';

    try {
      const managedTerminal = await TerminalManager.createTerminal(vaultId);
      if (!managedTerminal) {
        setError('Failed to create terminal - check console for details');
        return;
      }

      setTerminals(TerminalManager.getAllTerminals());
      setActiveTerminal(managedTerminal.id);
    } catch (err) {
      console.error('Terminal creation error:', err);
      setError(`Error: ${(err as Error).message}`);
    }
  }, [vmStatus.connected, currentVault?.id]);

  const closeTerminal = useCallback((id: string) => {
    TerminalManager.closeTerminal(id);
    setTerminals(TerminalManager.getAllTerminals());

    if (activeTerminal === id) {
      const remaining = TerminalManager.getTerminalIds();
      setActiveTerminal(remaining[0] || null);
    }
  }, [activeTerminal]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await connect();
      if (!result.success) {
        setError(result.error || 'Failed to connect');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const executeCommand = (command: string) => {
    if (activeTerminal) {
      const term = TerminalManager.getTerminal(activeTerminal);
      if (term) {
        term.inputBuffer += command;
      }
      window.specter.terminal.write(activeTerminal, command);
    }
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'Reconnaissance': 'bg-blue-900/40 text-blue-300 border-blue-700',
      'Web Enumeration': 'bg-green-900/40 text-green-300 border-green-700',
      'Vulnerability Scan': 'bg-red-900/40 text-red-300 border-red-700',
      'Brute Force': 'bg-orange-900/40 text-orange-300 border-orange-700',
      'Exploit Research': 'bg-purple-900/40 text-purple-300 border-purple-700',
      'SMB Enumeration': 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
      'SSH Enumeration': 'bg-cyan-900/40 text-cyan-300 border-cyan-700',
      'Database Enumeration': 'bg-pink-900/40 text-pink-300 border-pink-700',
      'AD Enumeration': 'bg-indigo-900/40 text-indigo-300 border-indigo-700',
      'Manual Testing': 'bg-gray-800/40 text-gray-300 border-gray-600',
    };
    return colors[category] || 'bg-specter-medium text-gray-300 border-specter-light';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-12 bg-specter-darker border-b border-specter-medium flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* Terminal tabs */}
          {terminals.map((term) => (
            <div
              key={term.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                activeTerminal === term.id
                  ? 'bg-specter-medium text-white'
                  : 'text-gray-400 hover:text-white hover:bg-specter-light/50'
              }`}
              onClick={() => setActiveTerminal(term.id)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">{term.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(term.id);
                }}
                className="ml-1 p-0.5 hover:bg-specter-light rounded"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* New terminal button */}
          {vmStatus.connected && (
            <button
              onClick={createTerminal}
              className="p-2 text-gray-400 hover:text-white hover:bg-specter-light/50 rounded-lg transition-colors"
              title="New Terminal"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {/* Context info & VM status */}
        <div className="flex items-center gap-3">
          {contextInfo.target && (
            <div className="flex items-center gap-2 px-3 py-1 bg-specter-medium rounded-lg">
              <span className="text-xs text-gray-400">Target:</span>
              <span className="text-xs text-specter-accent font-mono">{contextInfo.target}</span>
              {contextInfo.portsCount > 0 && (
                <span className="text-xs text-green-400">({contextInfo.portsCount} ports)</span>
              )}
            </div>
          )}
          {currentVault && (
            <span className="text-xs text-gray-500">
              Vault: {currentVault.name}
            </span>
          )}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
            vmStatus.connected
              ? 'bg-green-900/30 text-green-400'
              : 'bg-red-900/30 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              vmStatus.connected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            {vmStatus.connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-700 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Terminal content */}
      <div className="flex-1 relative">
        {!vmStatus.connected ? (
          <div className="absolute inset-0 flex items-center justify-center bg-specter-darker">
            <div className="text-center">
              <div className="w-16 h-16 bg-specter-medium rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">VM Not Connected</h3>
              <p className="text-gray-400 mb-4">Connect to your Linux VM to use the terminal</p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {connecting ? 'Connecting...' : 'Connect to VM'}
              </button>
            </div>
          </div>
        ) : terminals.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-specter-darker">
            <div className="text-center">
              <div className="w-16 h-16 bg-specter-medium rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Active Terminals</h3>
              <p className="text-gray-400 mb-4">Create a new terminal to start working</p>
              <button
                onClick={createTerminal}
                className="px-4 py-2 bg-specter-accent hover:bg-specter-accent-hover text-white rounded-lg font-medium transition-colors"
              >
                New Terminal
              </button>
            </div>
          </div>
        ) : (
          <div ref={terminalContainerRef} className="absolute inset-0 terminal-container p-2" />
        )}
      </div>

      {/* Smart Commands Bar - Dynamic based on context */}
      {vmStatus.connected && activeTerminal && (
        <div className="bg-specter-darker border-t border-specter-medium">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-specter-medium/50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-400">Smart Commands</span>
              {lastDetectedTool && (
                <span className="px-2 py-0.5 text-xs bg-specter-accent/20 text-specter-accent rounded">
                  detected: {lastDetectedTool}
                </span>
              )}
              {contextInfo.portsCount > 0 && (
                <span className="px-2 py-0.5 text-xs bg-green-900/30 text-green-400 rounded">
                  {contextInfo.portsCount} services found
                </span>
              )}
            </div>
            <button
              onClick={() => setShowAllCommands(!showAllCommands)}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              {showAllCommands ? 'Show Less' : `Show All (${PentestContext.generateCommands().length})`}
            </button>
          </div>

          {/* Commands */}
          <div className={`overflow-y-auto ${showAllCommands ? 'max-h-64' : 'max-h-24'} p-2`}>
            <div className="flex flex-wrap gap-2">
              {quickCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => executeCommand(cmd.command)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all hover:scale-105 ${getCategoryColor(cmd.category)}`}
                  title={`${cmd.description}\n\nCommand: ${cmd.command}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{cmd.description.substring(0, 40)}{cmd.description.length > 40 ? '...' : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Hint */}
          {quickCommands.length === 0 && (
            <div className="px-4 py-3 text-center text-gray-500 text-sm">
              Run a scan (nmap, rustscan) to get intelligent command recommendations
            </div>
          )}
        </div>
      )}
    </div>
  );
}
