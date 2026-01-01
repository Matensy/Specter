import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useVM } from '../contexts/VMContext';
import { useVault } from '../contexts/VaultContext';

interface TerminalInstance {
  id: string;
  name: string;
  terminal: Terminal;
  fitAddon: FitAddon;
}

export default function TerminalPage() {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalsRef = useRef<Map<string, TerminalInstance>>(new Map());
  const listenersSetupRef = useRef(false);
  const { status: vmStatus, connect } = useVM();
  const { currentVault } = useVault();
  const [terminalIds, setTerminalIds] = useState<string[]>([]);
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup IPC listeners only once
  useEffect(() => {
    if (listenersSetupRef.current) return;
    listenersSetupRef.current = true;

    window.specter.terminal.onData((terminalId: string, data: string) => {
      const term = terminalsRef.current.get(terminalId);
      if (term) {
        term.terminal.write(data);
      }
    });

    window.specter.terminal.onExit((terminalId: string) => {
      const term = terminalsRef.current.get(terminalId);
      if (term) {
        term.terminal.dispose();
        terminalsRef.current.delete(terminalId);
        setTerminalIds(prev => prev.filter(id => id !== terminalId));
        setActiveTerminal(prev => prev === terminalId ? null : prev);
      }
    });
  }, []);

  const createTerminal = useCallback(async () => {
    if (!vmStatus.connected) {
      setError('VM not connected');
      return;
    }

    setError(null);

    // Use vault ID or 'global' for terminals without vault
    const vaultId = currentVault?.id || 'global';

    const result = await window.specter.terminal.create(vaultId);
    if (!result.success || !result.terminalId) {
      setError(result.error || 'Failed to create terminal');
      console.error('Failed to create terminal:', result.error);
      return;
    }

    const terminal = new Terminal({
      theme: {
        background: '#0a0a0f',
        foreground: '#e4e4e7',
        cursor: '#7c3aed',
        cursorAccent: '#0a0a0f',
        selectionBackground: 'rgba(124, 58, 237, 0.4)',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#3f3f46',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    const terminalInstance: TerminalInstance = {
      id: result.terminalId,
      name: `Terminal ${terminalsRef.current.size + 1}`,
      terminal,
      fitAddon,
    };

    // Handle terminal input
    terminal.onData((data) => {
      window.specter.terminal.write(result.terminalId!, data);
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      window.specter.terminal.resize(result.terminalId!, cols, rows);
    });

    terminalsRef.current.set(result.terminalId, terminalInstance);
    setTerminalIds(prev => [...prev, result.terminalId!]);
    setActiveTerminal(result.terminalId);
  }, [vmStatus.connected, currentVault?.id]);

  // Attach terminal to DOM when active changes
  useEffect(() => {
    if (!terminalContainerRef.current || !activeTerminal) return;

    const term = terminalsRef.current.get(activeTerminal);
    if (!term) return;

    // Clear container
    terminalContainerRef.current.innerHTML = '';

    // Open terminal
    term.terminal.open(terminalContainerRef.current);

    // Delay fit to ensure container is rendered
    setTimeout(() => {
      term.fitAddon.fit();
      term.terminal.focus();
    }, 50);

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        term.fitAddon.fit();
      } catch (e) {
        // Ignore resize errors
      }
    });

    resizeObserver.observe(terminalContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeTerminal]);

  const closeTerminal = useCallback((id: string) => {
    window.specter.terminal.close(id);
    const term = terminalsRef.current.get(id);
    if (term) {
      term.terminal.dispose();
      terminalsRef.current.delete(id);
    }
    setTerminalIds(prev => prev.filter(tid => tid !== id));
    setActiveTerminal(prev => {
      if (prev === id) {
        const remaining = Array.from(terminalsRef.current.keys());
        return remaining[0] || null;
      }
      return prev;
    });
  }, []);

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

  const getTerminalsList = () => {
    return terminalIds.map(id => {
      const term = terminalsRef.current.get(id);
      return term ? { id: term.id, name: term.name } : null;
    }).filter(Boolean) as { id: string; name: string }[];
  };

  const terminals = getTerminalsList();

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

      {/* Quick commands bar */}
      {vmStatus.connected && activeTerminal && (
        <div className="h-10 bg-specter-darker border-t border-specter-medium flex items-center px-4 gap-2">
          <span className="text-xs text-gray-500 mr-2">Quick:</span>
          {['nmap -sV', 'gobuster dir', 'ffuf -w', 'sqlmap -u', 'nikto -h'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => {
                if (activeTerminal) {
                  window.specter.terminal.write(activeTerminal, cmd);
                }
              }}
              className="px-2 py-1 text-xs bg-specter-medium hover:bg-specter-light text-gray-400 hover:text-white rounded transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
