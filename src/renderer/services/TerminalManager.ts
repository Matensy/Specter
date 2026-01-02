import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

export interface ManagedTerminal {
  id: string;
  name: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  vaultId: string;
  inputBuffer: string;
  isAttached: boolean;
}

class TerminalManagerClass {
  private terminals: Map<string, ManagedTerminal> = new Map();
  private listenersSetup = false;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    if (this.listenersSetup) return;
    this.listenersSetup = true;

    // Listen for terminal data from main process
    window.specter.terminal.onData((terminalId: string, data: string) => {
      const term = this.terminals.get(terminalId);
      if (term) {
        term.terminal.write(data);
      }
    });

    // Listen for terminal exit
    window.specter.terminal.onExit((terminalId: string) => {
      const term = this.terminals.get(terminalId);
      if (term) {
        term.terminal.dispose();
        this.terminals.delete(terminalId);
      }
    });
  }

  async createTerminal(vaultId: string): Promise<ManagedTerminal | null> {
    const result = await window.specter.terminal.create(vaultId);
    if (!result.success || !result.terminalId) {
      console.error('Failed to create terminal:', result.error);
      return null;
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

    const terminalId = result.terminalId;

    const managedTerminal: ManagedTerminal = {
      id: terminalId,
      name: `Terminal ${this.terminals.size + 1}`,
      terminal,
      fitAddon,
      vaultId,
      inputBuffer: '',
      isAttached: false,
    };

    // Handle terminal input - captures both typed and pasted data
    terminal.onData((data) => {
      const instance = this.terminals.get(terminalId);
      if (!instance) return;

      // Check if it's Enter key (command submission)
      if (data === '\r' || data === '\n') {
        if (instance.inputBuffer.trim()) {
          // Send command to main process for logging
          window.specter.terminal.logCommand(terminalId, instance.inputBuffer.trim());
          instance.inputBuffer = '';
        }
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        instance.inputBuffer = instance.inputBuffer.slice(0, -1);
      } else if (data === '\x03') {
        // CTRL+C - clear buffer (SIGINT)
        instance.inputBuffer = '';
      } else if (data.charCodeAt(0) >= 32 || data.length > 1) {
        // Regular characters or pasted text
        instance.inputBuffer += data;
      }

      // Send to PTY
      window.specter.terminal.write(terminalId, data);
    });

    // Custom keyboard handling for clipboard
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // CTRL+C: Copy if selection exists, otherwise send SIGINT
      if (event.ctrlKey && event.key === 'c' && event.type === 'keydown') {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          terminal.clearSelection();
          return false;
        }
        return true;
      }

      // CTRL+V: Paste
      if (event.ctrlKey && event.key === 'v' && event.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          if (text) {
            const instance = this.terminals.get(terminalId);
            if (instance) {
              instance.inputBuffer += text;
            }
            window.specter.terminal.write(terminalId, text);
          }
        });
        return false;
      }

      // CTRL+SHIFT+C: Copy (alternative)
      if (event.ctrlKey && event.shiftKey && event.key === 'C' && event.type === 'keydown') {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          terminal.clearSelection();
        }
        return false;
      }

      // CTRL+SHIFT+V: Paste (alternative)
      if (event.ctrlKey && event.shiftKey && event.key === 'V' && event.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          if (text) {
            const instance = this.terminals.get(terminalId);
            if (instance) {
              instance.inputBuffer += text;
            }
            window.specter.terminal.write(terminalId, text);
          }
        });
        return false;
      }

      return true;
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      window.specter.terminal.resize(terminalId, cols, rows);
    });

    this.terminals.set(terminalId, managedTerminal);
    return managedTerminal;
  }

  attachToContainer(terminalId: string, container: HTMLElement): boolean {
    const term = this.terminals.get(terminalId);
    if (!term) return false;

    // Clear container
    container.innerHTML = '';

    // Open terminal in container
    term.terminal.open(container);
    term.isAttached = true;

    // Fit after a short delay
    setTimeout(() => {
      term.fitAddon.fit();
      term.terminal.focus();
    }, 50);

    return true;
  }

  detachFromContainer(terminalId: string): void {
    const term = this.terminals.get(terminalId);
    if (term) {
      term.isAttached = false;
      // Don't dispose - just mark as detached
    }
  }

  closeTerminal(terminalId: string): void {
    const term = this.terminals.get(terminalId);
    if (term) {
      window.specter.terminal.close(terminalId);
      term.terminal.dispose();
      this.terminals.delete(terminalId);
    }
  }

  getTerminal(terminalId: string): ManagedTerminal | undefined {
    return this.terminals.get(terminalId);
  }

  getAllTerminals(): ManagedTerminal[] {
    return Array.from(this.terminals.values());
  }

  getTerminalIds(): string[] {
    return Array.from(this.terminals.keys());
  }

  fit(terminalId: string): void {
    const term = this.terminals.get(terminalId);
    if (term && term.isAttached) {
      try {
        term.fitAddon.fit();
      } catch (e) {
        // Ignore fit errors
      }
    }
  }
}

// Singleton instance
export const TerminalManager = new TerminalManagerClass();
