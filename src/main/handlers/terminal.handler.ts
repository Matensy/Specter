import { ipcMain, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { ClientChannel } from 'ssh2';
import { getSSHClient, isVMConnected } from './vm.handler';
import { getDatabase } from '../database/init';

interface TerminalSession {
  id: string;
  vaultId: string;
  channel: ClientChannel | null;
  buffer: string;
  currentCommand: string;
  commandStartTime: number | null;
}

const terminals: Map<string, TerminalSession> = new Map();

function broadcastData(terminalId: string, data: string): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send('terminal:data', terminalId, data);
  }
}

function broadcastExit(terminalId: string): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send('terminal:exit', terminalId);
  }
}

export function setupTerminalHandlers(): void {
  const db = getDatabase();

  // Create new terminal session
  ipcMain.handle('terminal:create', async (_, vaultId: string) => {
    if (!isVMConnected()) {
      return { success: false, error: 'VM not connected. Please connect to VM first.' };
    }

    const sshClient = getSSHClient();
    if (!sshClient) {
      return { success: false, error: 'SSH client not available' };
    }

    const terminalId = uuidv4();

    return new Promise((resolve) => {
      sshClient.shell({ term: 'xterm-256color' }, (err, channel) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }

        const session: TerminalSession = {
          id: terminalId,
          vaultId,
          channel,
          buffer: '',
          currentCommand: '',
          commandStartTime: null,
        };

        terminals.set(terminalId, session);

        // Handle data from terminal
        channel.on('data', (data: Buffer) => {
          const text = data.toString('utf8');
          session.buffer += text;
          broadcastData(terminalId, text);

          // Try to detect command completion and log
          processTerminalOutput(session, text);
        });

        channel.on('close', () => {
          terminals.delete(terminalId);
          broadcastExit(terminalId);
        });

        channel.stderr.on('data', (data: Buffer) => {
          const text = data.toString('utf8');
          session.buffer += text;
          broadcastData(terminalId, text);
        });

        resolve({ success: true, terminalId });
      });
    });
  });

  // Write to terminal
  ipcMain.handle('terminal:write', async (_, terminalId: string, data: string) => {
    const session = terminals.get(terminalId);
    if (!session || !session.channel) {
      return { success: false, error: 'Terminal not found' };
    }

    // Track command input
    if (data.includes('\r') || data.includes('\n')) {
      // Command was entered
      if (session.currentCommand.trim()) {
        session.commandStartTime = Date.now();
      }
    } else if (data.charCodeAt(0) >= 32) {
      // Regular character input
      session.currentCommand += data;
    } else if (data.charCodeAt(0) === 127) {
      // Backspace
      session.currentCommand = session.currentCommand.slice(0, -1);
    }

    session.channel.write(data);
    return { success: true };
  });

  // Resize terminal
  ipcMain.handle('terminal:resize', async (_, terminalId: string, cols: number, rows: number) => {
    const session = terminals.get(terminalId);
    if (!session || !session.channel) {
      return { success: false, error: 'Terminal not found' };
    }

    session.channel.setWindow(rows, cols, 0, 0);
    return { success: true };
  });

  // Close terminal
  ipcMain.handle('terminal:close', async (_, terminalId: string) => {
    const session = terminals.get(terminalId);
    if (session && session.channel) {
      session.channel.close();
    }
    terminals.delete(terminalId);
    return { success: true };
  });

  // Helper function to process terminal output and log commands
  function processTerminalOutput(session: TerminalSession, text: string): void {
    // Simple heuristic: if we see a prompt pattern, the previous command finished
    const promptPatterns = [
      /\$\s*$/,
      /#\s*$/,
      />\s*$/,
      /┌──\(/,
      /└─\$/,
    ];

    const hasPrompt = promptPatterns.some((pattern) => pattern.test(text));

    if (hasPrompt && session.currentCommand.trim() && session.commandStartTime) {
      const duration = Date.now() - session.commandStartTime;
      const command = session.currentCommand.trim();

      // Log the command
      logCommand(session.vaultId, command, session.buffer, duration);

      // Reset for next command
      session.currentCommand = '';
      session.commandStartTime = null;
      session.buffer = '';
    }
  }

  function logCommand(vaultId: string, command: string, output: string, duration: number): void {
    // Determine command category
    const category = categorizeCommand(command);
    const attackPath = detectAttackPath(command);

    // Get target_id from vault (use first target or null)
    const targetStmt = db.prepare('SELECT id FROM targets WHERE vault_id = ? LIMIT 1');
    const target = targetStmt.get(vaultId) as { id: string } | undefined;

    if (target) {
      const logStmt = db.prepare(`
        INSERT INTO command_logs (id, target_id, command, output, category, attack_path, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      logStmt.run(
        uuidv4(),
        target.id,
        command,
        output.slice(-10000), // Limit output size
        category,
        attackPath,
        duration
      );
    }
  }

  function categorizeCommand(command: string): string {
    const categories: Record<string, string[]> = {
      recon: ['nmap', 'masscan', 'rustscan', 'ping', 'traceroute', 'whois', 'dig', 'host'],
      web: ['gobuster', 'ffuf', 'dirb', 'nikto', 'wfuzz', 'sqlmap', 'burp', 'curl', 'wget'],
      enum: ['enum4linux', 'smbclient', 'rpcclient', 'ldapsearch', 'bloodhound', 'crackmapexec'],
      exploit: ['msfconsole', 'searchsploit', 'exploit', 'payload'],
      privesc: ['linpeas', 'winpeas', 'linenum', 'sudo', 'find.*suid'],
      lateral: ['psexec', 'wmiexec', 'evil-winrm', 'ssh', 'rdp'],
      creds: ['hashcat', 'john', 'hydra', 'medusa', 'crackmapexec'],
      general: ['ls', 'cd', 'cat', 'grep', 'find', 'ps', 'netstat'],
    };

    const cmd = command.toLowerCase();
    for (const [category, patterns] of Object.entries(categories)) {
      if (patterns.some((pattern) => cmd.includes(pattern) || new RegExp(pattern).test(cmd))) {
        return category;
      }
    }

    return 'other';
  }

  function detectAttackPath(command: string): string | null {
    const paths: Record<string, string[]> = {
      auth: ['login', 'auth', 'session', 'token', 'jwt', 'oauth'],
      access_control: ['idor', 'bola', 'privilege', 'role', 'permission'],
      input: ['sqli', 'xss', 'ssti', 'injection', 'sqlmap'],
      file: ['upload', 'lfi', 'rfi', 'file', 'path'],
      ssrf: ['ssrf', 'server-side', 'internal'],
      enumeration: ['enum', 'scan', 'discover', 'recon'],
      kerberos: ['kerb', 'spn', 'ticket', 'asrep', 'tgt'],
      lateral: ['lateral', 'pivot', 'psexec', 'wmi'],
      privesc: ['privesc', 'privilege', 'root', 'admin', 'system'],
    };

    const cmd = command.toLowerCase();
    for (const [path, patterns] of Object.entries(paths)) {
      if (patterns.some((pattern) => cmd.includes(pattern))) {
        return path;
      }
    }

    return null;
  }
}
