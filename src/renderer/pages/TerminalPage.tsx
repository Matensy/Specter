import React, { useEffect, useRef, useState, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';
import { useVM } from '../contexts/VMContext';
import { useVault } from '../contexts/VaultContext';
import { TerminalManager, ManagedTerminal } from '../services/TerminalManager';

interface QuickCommand {
  label: string;
  command: string;
  description?: string;
}

// Recommendations based on detected commands/output
const NEXT_STEP_RECOMMENDATIONS: Record<string, QuickCommand[]> = {
  nmap: [
    { label: 'gobuster dir', command: 'gobuster dir -u http://TARGET -w /usr/share/wordlists/dirb/common.txt', description: 'Enumerate directories' },
    { label: 'nikto', command: 'nikto -h http://TARGET', description: 'Web vulnerability scan' },
    { label: 'searchsploit', command: 'searchsploit ', description: 'Search for exploits' },
    { label: 'nmap scripts', command: 'nmap -sC -sV -p- TARGET', description: 'Full port scan with scripts' },
  ],
  rustscan: [
    { label: 'nmap detailed', command: 'nmap -sC -sV -p PORT TARGET', description: 'Detailed scan on found ports' },
    { label: 'gobuster', command: 'gobuster dir -u http://TARGET -w /usr/share/wordlists/dirb/common.txt', description: 'Directory enumeration' },
    { label: 'whatweb', command: 'whatweb http://TARGET', description: 'Web technology detection' },
  ],
  gobuster: [
    { label: 'ffuf', command: 'ffuf -u http://TARGET/FUZZ -w /usr/share/wordlists/dirb/common.txt', description: 'Fuzz for more paths' },
    { label: 'curl', command: 'curl -v http://TARGET/path', description: 'Inspect found paths' },
    { label: 'sqlmap', command: 'sqlmap -u "http://TARGET/page?id=1"', description: 'Test for SQL injection' },
    { label: 'nuclei', command: 'nuclei -u http://TARGET -t cves/', description: 'CVE scanning' },
  ],
  ffuf: [
    { label: 'curl inspect', command: 'curl -v http://TARGET/path', description: 'Inspect results' },
    { label: 'sqlmap', command: 'sqlmap -u "http://TARGET/page?id=1"', description: 'SQL injection test' },
    { label: 'wfuzz', command: 'wfuzz -c -z file,/usr/share/wordlists/rockyou.txt http://TARGET/login', description: 'Brute force' },
  ],
  nikto: [
    { label: 'searchsploit', command: 'searchsploit ', description: 'Search exploits for found vulns' },
    { label: 'metasploit', command: 'msfconsole', description: 'Launch Metasploit' },
    { label: 'curl test', command: 'curl -v http://TARGET/vuln-path', description: 'Test vulnerability' },
  ],
  sqlmap: [
    { label: 'dump db', command: 'sqlmap -u "URL" --dbs', description: 'Enumerate databases' },
    { label: 'dump tables', command: 'sqlmap -u "URL" -D db --tables', description: 'Enumerate tables' },
    { label: 'os-shell', command: 'sqlmap -u "URL" --os-shell', description: 'Get OS shell' },
  ],
  default: [
    { label: 'nmap -sV', command: 'nmap -sV ', description: 'Service version scan' },
    { label: 'gobuster dir', command: 'gobuster dir -u http:// -w /usr/share/wordlists/dirb/common.txt', description: 'Directory enumeration' },
    { label: 'ffuf -w', command: 'ffuf -u http://TARGET/FUZZ -w /usr/share/wordlists/dirb/common.txt', description: 'Web fuzzing' },
    { label: 'sqlmap -u', command: 'sqlmap -u ', description: 'SQL injection test' },
    { label: 'nikto -h', command: 'nikto -h ', description: 'Web vulnerability scan' },
  ],
};

export default function TerminalPage() {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const { status: vmStatus, connect } = useVM();
  const { currentVault } = useVault();
  const [terminals, setTerminals] = useState<ManagedTerminal[]>([]);
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickCommands, setQuickCommands] = useState<QuickCommand[]>(NEXT_STEP_RECOMMENDATIONS.default);
  const [lastDetectedTool, setLastDetectedTool] = useState<string>('');

  // Detect tools from terminal output
  const detectToolFromOutput = useCallback((data: string) => {
    const toolPatterns = [
      { pattern: /nmap.*scan report|Nmap done/i, tool: 'nmap' },
      { pattern: /rustscan|Open.*PORT/i, tool: 'rustscan' },
      { pattern: /gobuster|Gobuster.*v|Status:/i, tool: 'gobuster' },
      { pattern: /ffuf|FUZZ|:: Progress/i, tool: 'ffuf' },
      { pattern: /nikto.*scan|Nikto v/i, tool: 'nikto' },
      { pattern: /sqlmap|injection/i, tool: 'sqlmap' },
    ];

    for (const { pattern, tool } of toolPatterns) {
      if (pattern.test(data)) {
        if (tool !== lastDetectedTool) {
          setLastDetectedTool(tool);
          setQuickCommands(NEXT_STEP_RECOMMENDATIONS[tool] || NEXT_STEP_RECOMMENDATIONS.default);
        }
        return;
      }
    }
  }, [lastDetectedTool]);

  // Listen for terminal output to detect tools
  useEffect(() => {
    const handleTerminalData = (_terminalId: string, data: string) => {
      detectToolFromOutput(data);
    };

    window.specter.terminal.onData(handleTerminalData);
  }, [detectToolFromOutput]);

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

    const managedTerminal = await TerminalManager.createTerminal(vaultId);
    if (!managedTerminal) {
      setError('Failed to create terminal');
      return;
    }

    setTerminals(TerminalManager.getAllTerminals());
    setActiveTerminal(managedTerminal.id);
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

        {/* VM status */}
        <div className="flex items-center gap-3">
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

      {/* Quick commands bar - Dynamic based on detected tools */}
      {vmStatus.connected && activeTerminal && (
        <div className="h-12 bg-specter-darker border-t border-specter-medium flex items-center px-4 gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500">Next:</span>
            {lastDetectedTool && (
              <span className="px-2 py-0.5 text-xs bg-specter-accent/20 text-specter-accent rounded">
                after {lastDetectedTool}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {quickCommands.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => {
                  if (activeTerminal) {
                    const term = TerminalManager.getTerminal(activeTerminal);
                    if (term) {
                      term.inputBuffer += cmd.command;
                    }
                    window.specter.terminal.write(activeTerminal, cmd.command);
                  }
                }}
                className="px-2 py-1 text-xs bg-specter-medium hover:bg-specter-light text-gray-400 hover:text-white rounded transition-colors whitespace-nowrap flex-shrink-0"
                title={cmd.description}
              >
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
