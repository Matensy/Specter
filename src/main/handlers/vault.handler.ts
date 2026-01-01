import { ipcMain, shell } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../database/init';
import { SpecterConfig } from '../config';

interface VaultCreateData {
  name: string;
  description?: string;
  targetType: string;
  scope?: string;
}

interface Vault {
  id: string;
  name: string;
  description?: string;
  path: string;
  target_type: string;
  scope?: string;
  created_at: string;
  updated_at: string;
  status: string;
  metadata?: string;
}

export function setupVaultHandlers(): void {
  const db = getDatabase();

  // Create vault
  ipcMain.handle('vault:create', async (_, data: VaultCreateData) => {
    const id = uuidv4();
    const vaultsDir = SpecterConfig.get('vaultsDirectory');
    const vaultPath = path.join(vaultsDir, `${data.name.replace(/[^a-zA-Z0-9-_]/g, '_')}_${id.slice(0, 8)}`);

    // Create vault directory structure
    const directories = [
      vaultPath,
      path.join(vaultPath, 'evidence'),
      path.join(vaultPath, 'evidence', 'screenshots'),
      path.join(vaultPath, 'evidence', 'files'),
      path.join(vaultPath, 'evidence', 'dumps'),
      path.join(vaultPath, 'logs'),
      path.join(vaultPath, 'logs', 'commands'),
      path.join(vaultPath, 'logs', 'tools'),
      path.join(vaultPath, 'notes'),
      path.join(vaultPath, 'pocs'),
      path.join(vaultPath, 'playbooks'),
      path.join(vaultPath, 'exports'),
    ];

    for (const dir of directories) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create vault info file
    const vaultInfo = {
      id,
      name: data.name,
      description: data.description,
      targetType: data.targetType,
      scope: data.scope,
      created: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(vaultPath, 'vault.json'),
      JSON.stringify(vaultInfo, null, 2)
    );

    // Create initial README
    const readme = `# ${data.name}

## Target Type
${data.targetType}

## Scope
${data.scope || 'Not defined'}

## Description
${data.description || 'No description provided'}

---
Created: ${new Date().toISOString()}
`;

    fs.writeFileSync(path.join(vaultPath, 'README.md'), readme);

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO vaults (id, name, description, path, target_type, scope, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.description || null,
      vaultPath,
      data.targetType,
      data.scope || null,
      JSON.stringify({ directories })
    );

    // Add timeline event
    const timelineStmt = db.prepare(`
      INSERT INTO timeline_events (id, vault_id, event_type, title, description)
      VALUES (?, ?, ?, ?, ?)
    `);

    timelineStmt.run(
      uuidv4(),
      id,
      'vault_created',
      'Vault Created',
      `Vault "${data.name}" was created for ${data.targetType} target`
    );

    return { id, path: vaultPath };
  });

  // List all vaults
  ipcMain.handle('vault:list', async () => {
    const stmt = db.prepare(`
      SELECT v.*,
        (SELECT COUNT(*) FROM targets WHERE vault_id = v.id) as target_count,
        (SELECT COUNT(*) FROM findings f
          JOIN targets t ON f.target_id = t.id
          WHERE t.vault_id = v.id) as finding_count
      FROM vaults v
      WHERE v.status = 'active'
      ORDER BY v.updated_at DESC
    `);

    return stmt.all();
  });

  // Get single vault
  ipcMain.handle('vault:get', async (_, id: string) => {
    const stmt = db.prepare(`
      SELECT v.*,
        (SELECT COUNT(*) FROM targets WHERE vault_id = v.id) as target_count,
        (SELECT COUNT(*) FROM findings f
          JOIN targets t ON f.target_id = t.id
          WHERE t.vault_id = v.id) as finding_count,
        (SELECT COUNT(*) FROM credentials WHERE vault_id = v.id) as credential_count
      FROM vaults v
      WHERE v.id = ?
    `);

    const vault = stmt.get(id) as Vault | undefined;

    if (vault) {
      // Get targets
      const targetsStmt = db.prepare('SELECT * FROM targets WHERE vault_id = ?');
      const targets = targetsStmt.all(id);

      // Get recent timeline
      const timelineStmt = db.prepare(`
        SELECT * FROM timeline_events
        WHERE vault_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `);
      const timeline = timelineStmt.all(id);

      return { ...vault, targets, timeline };
    }

    return null;
  });

  // Update vault
  ipcMain.handle('vault:update', async (_, id: string, data: Partial<VaultCreateData>) => {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.scope !== undefined) {
      updates.push('scope = ?');
      values.push(data.scope);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE vaults SET ${updates.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);

    return { success: true };
  });

  // Delete vault (soft delete)
  ipcMain.handle('vault:delete', async (_, id: string) => {
    const stmt = db.prepare(`
      UPDATE vaults SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);

    stmt.run(id);

    return { success: true };
  });

  // Open vault in file explorer
  ipcMain.handle('vault:open', async (_, id: string) => {
    const stmt = db.prepare('SELECT path FROM vaults WHERE id = ?');
    const vault = stmt.get(id) as { path: string } | undefined;

    if (vault && fs.existsSync(vault.path)) {
      shell.openPath(vault.path);
      return { success: true };
    }

    return { success: false, error: 'Vault path not found' };
  });

  // Export vault
  ipcMain.handle('vault:export', async (_, id: string, format: string) => {
    const stmt = db.prepare('SELECT * FROM vaults WHERE id = ?');
    const vault = stmt.get(id) as Vault | undefined;

    if (!vault) {
      return { success: false, error: 'Vault not found' };
    }

    // Get all related data
    const targets = db.prepare('SELECT * FROM targets WHERE vault_id = ?').all(id);
    const findings: unknown[] = [];
    const pocs: unknown[] = [];

    for (const target of targets as { id: string }[]) {
      const targetFindings = db.prepare('SELECT * FROM findings WHERE target_id = ?').all(target.id);
      findings.push(...targetFindings);

      const targetPocs = db.prepare('SELECT * FROM pocs WHERE target_id = ?').all(target.id);
      pocs.push(...targetPocs);
    }

    const timeline = db.prepare('SELECT * FROM timeline_events WHERE vault_id = ?').all(id);

    const exportData = {
      vault,
      targets,
      findings,
      pocs,
      timeline,
      exportedAt: new Date().toISOString(),
    };

    if (format === 'json') {
      const exportPath = path.join(vault.path, 'exports', `export_${Date.now()}.json`);
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      return { success: true, path: exportPath };
    }

    if (format === 'markdown') {
      const markdown = generateMarkdownReport(exportData);
      const exportPath = path.join(vault.path, 'exports', `report_${Date.now()}.md`);
      fs.writeFileSync(exportPath, markdown);
      return { success: true, path: exportPath };
    }

    return { success: false, error: 'Unsupported format' };
  });
}

function generateMarkdownReport(data: {
  vault: Vault;
  targets: unknown[];
  findings: unknown[];
  pocs: unknown[];
  timeline: unknown[];
  exportedAt: string;
}): string {
  let md = `# Security Assessment Report: ${data.vault.name}

## Executive Summary

- **Target Type:** ${data.vault.target_type}
- **Scope:** ${data.vault.scope || 'Not defined'}
- **Assessment Period:** ${data.vault.created_at} - ${data.exportedAt}
- **Total Findings:** ${data.findings.length}
- **Targets Assessed:** ${data.targets.length}

## Scope

${data.vault.description || 'No description provided'}

---

## Findings Summary

`;

  const severityCounts: Record<string, number> = {};
  for (const finding of data.findings as { severity: string }[]) {
    severityCounts[finding.severity] = (severityCounts[finding.severity] || 0) + 1;
  }

  md += `| Severity | Count |\n|----------|-------|\n`;
  for (const [severity, count] of Object.entries(severityCounts)) {
    md += `| ${severity} | ${count} |\n`;
  }

  md += `\n---\n\n## Detailed Findings\n\n`;

  for (const finding of data.findings as {
    title: string;
    severity: string;
    category: string;
    description: string;
    cve_id?: string;
  }[]) {
    md += `### ${finding.title}

- **Severity:** ${finding.severity}
- **Category:** ${finding.category || 'N/A'}
${finding.cve_id ? `- **CVE:** ${finding.cve_id}` : ''}

${finding.description || 'No description'}

---

`;
  }

  md += `\n## Timeline\n\n`;
  for (const event of data.timeline as { created_at: string; title: string; description: string }[]) {
    md += `- **${event.created_at}** - ${event.title}: ${event.description || ''}\n`;
  }

  return md;
}
