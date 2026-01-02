import { ipcMain, BrowserWindow } from 'electron';
import { OutputAnalyzer, DetectedService, Recommendation, PathProgress } from '../services/OutputAnalyzer';
import { getDatabase } from '../database/init';

export function setupAnalysisHandlers(): void {
  const db = getDatabase();

  // Analyze output manually
  ipcMain.handle('analysis:analyze', async (_, targetId: string, output: string) => {
    try {
      const result = OutputAnalyzer.analyze(targetId, output);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Get recommendations for a target
  ipcMain.handle('analysis:recommendations', async (_, targetId: string) => {
    try {
      // Get detected services from target metadata
      const target = db.prepare('SELECT metadata FROM targets WHERE id = ?').get(targetId) as { metadata?: string } | undefined;

      if (!target || !target.metadata) {
        return { success: true, recommendations: [] };
      }

      let metadata: { detectedServices?: DetectedService[] } = {};
      try {
        metadata = JSON.parse(target.metadata);
      } catch {
        return { success: true, recommendations: [] };
      }

      if (!metadata.detectedServices) {
        return { success: true, recommendations: [] };
      }

      const recommendations = OutputAnalyzer.getRecommendations(metadata.detectedServices);
      return { success: true, recommendations };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Get detected services for a target
  ipcMain.handle('analysis:services', async (_, targetId: string) => {
    try {
      const target = db.prepare('SELECT metadata FROM targets WHERE id = ?').get(targetId) as { metadata?: string } | undefined;

      if (!target || !target.metadata) {
        return { success: true, services: [] };
      }

      let metadata: { detectedServices?: DetectedService[] } = {};
      try {
        metadata = JSON.parse(target.metadata);
      } catch {
        return { success: true, services: [] };
      }

      return { success: true, services: metadata.detectedServices || [] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Get attack path progress for a target
  ipcMain.handle('analysis:pathProgress', async (_, targetId: string) => {
    try {
      const progress = db.prepare(`
        SELECT * FROM attack_path_progress
        WHERE target_id = ?
        ORDER BY created_at DESC
      `).all(targetId);

      return { success: true, progress };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Manually update path progress
  ipcMain.handle('analysis:updatePath', async (_, targetId: string, pathId: string, status: string) => {
    try {
      db.prepare(`
        UPDATE attack_path_progress
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE target_id = ? AND path_id = ?
      `).run(status, targetId, pathId);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Get all available attack paths with their definitions
  ipcMain.handle('analysis:paths', async () => {
    const paths = [
      {
        id: 'web',
        name: 'Web Application',
        stages: [
          { id: 'recon', name: 'Reconnaissance', description: 'Port scanning and service detection' },
          { id: 'web_enum', name: 'Web Enumeration', description: 'Directory and file discovery' },
          { id: 'vuln_scan', name: 'Vulnerability Scanning', description: 'Automated vulnerability detection' },
          { id: 'sqli', name: 'SQL Injection', description: 'SQL injection testing' },
          { id: 'auth_bypass', name: 'Authentication Bypass', description: 'Login brute force and bypass' },
          { id: 'privesc', name: 'Privilege Escalation', description: 'Escalate privileges on target' },
        ],
      },
      {
        id: 'ad',
        name: 'Active Directory',
        stages: [
          { id: 'recon', name: 'Reconnaissance', description: 'Network and domain discovery' },
          { id: 'ad_enum', name: 'AD Enumeration', description: 'Users, groups, and trust relationships' },
          { id: 'kerberos', name: 'Kerberos Attacks', description: 'Kerberoasting and AS-REP roasting' },
          { id: 'lateral', name: 'Lateral Movement', description: 'Move between systems' },
          { id: 'privesc', name: 'Privilege Escalation', description: 'Domain admin escalation' },
        ],
      },
      {
        id: 'network',
        name: 'Network Infrastructure',
        stages: [
          { id: 'recon', name: 'Reconnaissance', description: 'Host and port discovery' },
          { id: 'service_enum', name: 'Service Enumeration', description: 'Identify running services' },
          { id: 'vuln_scan', name: 'Vulnerability Scanning', description: 'Check for known CVEs' },
          { id: 'exploit', name: 'Exploitation', description: 'Exploit identified vulnerabilities' },
          { id: 'post', name: 'Post-Exploitation', description: 'Maintain access and pivot' },
        ],
      },
    ];

    return { success: true, paths };
  });
}

// Function to broadcast analysis results to renderer
export function broadcastAnalysisResult(
  targetId: string,
  services: DetectedService[],
  recommendations: Recommendation[],
  pathProgress: PathProgress[]
): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send('analysis:result', {
      targetId,
      services,
      recommendations,
      pathProgress,
    });
  }
}
