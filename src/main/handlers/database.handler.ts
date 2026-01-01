import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { getDatabase } from '../database/init';

// Encryption key (in production, this should be derived from user password)
const ENCRYPTION_KEY = 'specter-local-key-2024';

function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function setupDatabaseHandlers(): void {
  const db = getDatabase();

  // ============= TARGETS =============
  ipcMain.handle('db:targets:create', async (_, data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO targets (id, vault_id, name, type, host, port, url, description, scope, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.vaultId,
      data.name,
      data.type,
      data.host || null,
      data.port || null,
      data.url || null,
      data.description || null,
      data.scope || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    // Add timeline event
    const timelineStmt = db.prepare(`
      INSERT INTO timeline_events (id, vault_id, target_id, event_type, title, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    timelineStmt.run(uuidv4(), data.vaultId, id, 'target_added', 'Target Added', `Target "${data.name}" was added`);

    return { id };
  });

  ipcMain.handle('db:targets:list', async (_, vaultId: string) => {
    const stmt = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM findings WHERE target_id = t.id) as finding_count,
        (SELECT COUNT(*) FROM command_logs WHERE target_id = t.id) as log_count
      FROM targets t
      WHERE t.vault_id = ? AND t.status = 'active'
      ORDER BY t.created_at DESC
    `);
    return stmt.all(vaultId);
  });

  ipcMain.handle('db:targets:get', async (_, id: string) => {
    const stmt = db.prepare('SELECT * FROM targets WHERE id = ?');
    return stmt.get(id);
  });

  ipcMain.handle('db:targets:update', async (_, id: string, data) => {
    const updates: string[] = [];
    const values: unknown[] = [];

    const fields = ['name', 'type', 'host', 'port', 'url', 'description', 'scope', 'status'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (data.metadata) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE targets SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return { success: true };
  });

  ipcMain.handle('db:targets:delete', async (_, id: string) => {
    const stmt = db.prepare("UPDATE targets SET status = 'deleted' WHERE id = ?");
    stmt.run(id);
    return { success: true };
  });

  // ============= FINDINGS =============
  ipcMain.handle('db:findings:create', async (_, data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO findings (id, target_id, title, description, severity, category, attack_path, cve_id, cvss_score, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.targetId,
      data.title,
      data.description || null,
      data.severity,
      data.category || null,
      data.attackPath || null,
      data.cveId || null,
      data.cvssScore || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    // Get vault_id for timeline
    const target = db.prepare('SELECT vault_id FROM targets WHERE id = ?').get(data.targetId) as { vault_id: string };

    // Add timeline event
    const timelineStmt = db.prepare(`
      INSERT INTO timeline_events (id, vault_id, target_id, event_type, title, description, severity, related_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    timelineStmt.run(
      uuidv4(),
      target.vault_id,
      data.targetId,
      'finding_created',
      'Finding Discovered',
      data.title,
      data.severity,
      id
    );

    return { id };
  });

  ipcMain.handle('db:findings:list', async (_, targetId: string) => {
    const stmt = db.prepare(`
      SELECT f.*,
        (SELECT COUNT(*) FROM evidence WHERE finding_id = f.id) as evidence_count
      FROM findings f
      WHERE f.target_id = ?
      ORDER BY
        CASE f.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        f.created_at DESC
    `);
    return stmt.all(targetId);
  });

  ipcMain.handle('db:findings:get', async (_, id: string) => {
    const finding = db.prepare('SELECT * FROM findings WHERE id = ?').get(id);
    if (finding) {
      const evidence = db.prepare('SELECT * FROM evidence WHERE finding_id = ?').all(id);
      return { ...finding, evidence };
    }
    return null;
  });

  ipcMain.handle('db:findings:update', async (_, id: string, data) => {
    const updates: string[] = [];
    const values: unknown[] = [];

    const fields = ['title', 'description', 'severity', 'category', 'attack_path', 'status', 'cve_id', 'cvss_score'];
    for (const field of fields) {
      const camelCase = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (data[camelCase] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[camelCase]);
      }
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE findings SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return { success: true };
  });

  ipcMain.handle('db:findings:delete', async (_, id: string) => {
    db.prepare('DELETE FROM findings WHERE id = ?').run(id);
    return { success: true };
  });

  // ============= EVIDENCE =============
  ipcMain.handle('db:evidence:create', async (_, data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO evidence (id, finding_id, type, title, file_path, content, command, output, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.findingId,
      data.type,
      data.title || null,
      data.filePath || null,
      data.content || null,
      data.command || null,
      data.output || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    // Update evidence count
    db.prepare('UPDATE findings SET evidence_count = evidence_count + 1 WHERE id = ?').run(data.findingId);

    return { id };
  });

  ipcMain.handle('db:evidence:list', async (_, findingId: string) => {
    return db.prepare('SELECT * FROM evidence WHERE finding_id = ? ORDER BY created_at DESC').all(findingId);
  });

  ipcMain.handle('db:evidence:get', async (_, id: string) => {
    return db.prepare('SELECT * FROM evidence WHERE id = ?').get(id);
  });

  ipcMain.handle('db:evidence:delete', async (_, id: string) => {
    const evidence = db.prepare('SELECT finding_id FROM evidence WHERE id = ?').get(id) as { finding_id: string };
    db.prepare('DELETE FROM evidence WHERE id = ?').run(id);
    if (evidence) {
      db.prepare('UPDATE findings SET evidence_count = evidence_count - 1 WHERE id = ?').run(evidence.finding_id);
    }
    return { success: true };
  });

  // ============= COMMAND LOGS =============
  ipcMain.handle('db:logs:create', async (_, data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO command_logs (id, target_id, command, output, error, exit_code, category, attack_path, duration_ms, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.targetId,
      data.command,
      data.output || null,
      data.error || null,
      data.exitCode || null,
      data.category || null,
      data.attackPath || null,
      data.durationMs || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    return { id };
  });

  ipcMain.handle('db:logs:list', async (_, targetId: string, filters?: { category?: string; limit?: number }) => {
    let query = 'SELECT * FROM command_logs WHERE target_id = ?';
    const params: unknown[] = [targetId];

    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    query += ' ORDER BY executed_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  });

  ipcMain.handle('db:logs:get', async (_, id: string) => {
    return db.prepare('SELECT * FROM command_logs WHERE id = ?').get(id);
  });

  // ============= TIMELINE =============
  ipcMain.handle('db:timeline:add', async (_, data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO timeline_events (id, vault_id, target_id, event_type, title, description, severity, related_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.vaultId,
      data.targetId || null,
      data.eventType,
      data.title,
      data.description || null,
      data.severity || null,
      data.relatedId || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    return { id };
  });

  ipcMain.handle('db:timeline:list', async (_, vaultId: string) => {
    return db.prepare(`
      SELECT te.*, t.name as target_name
      FROM timeline_events te
      LEFT JOIN targets t ON te.target_id = t.id
      WHERE te.vault_id = ?
      ORDER BY te.created_at DESC
    `).all(vaultId);
  });

  // ============= CREDENTIALS =============
  ipcMain.handle('db:credentials:create', async (_, data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO credentials (id, vault_id, target_id, type, username, password_encrypted, hash, domain, notes, source, valid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.vaultId,
      data.targetId || null,
      data.type,
      data.username || null,
      data.password ? encrypt(data.password) : null,
      data.hash || null,
      data.domain || null,
      data.notes || null,
      data.source || null,
      data.valid ? 1 : 0
    );

    return { id };
  });

  ipcMain.handle('db:credentials:list', async (_, vaultId: string) => {
    const creds = db.prepare(`
      SELECT c.*, t.name as target_name
      FROM credentials c
      LEFT JOIN targets t ON c.target_id = t.id
      WHERE c.vault_id = ?
      ORDER BY c.created_at DESC
    `).all(vaultId);

    // Decrypt passwords for display (masked)
    return (creds as { password_encrypted?: string }[]).map((cred) => ({
      ...cred,
      password: cred.password_encrypted ? '********' : null,
      hasPassword: !!cred.password_encrypted,
    }));
  });

  ipcMain.handle('db:credentials:get', async (_, id: string) => {
    const cred = db.prepare('SELECT * FROM credentials WHERE id = ?').get(id) as { password_encrypted?: string };
    if (cred && cred.password_encrypted) {
      return { ...cred, password: decrypt(cred.password_encrypted) };
    }
    return cred;
  });

  ipcMain.handle('db:credentials:update', async (_, id: string, data) => {
    const updates: string[] = [];
    const values: unknown[] = [];

    const fields = ['username', 'hash', 'domain', 'notes', 'source', 'type'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (data.password !== undefined) {
      updates.push('password_encrypted = ?');
      values.push(data.password ? encrypt(data.password) : null);
    }

    if (data.valid !== undefined) {
      updates.push('valid = ?');
      values.push(data.valid ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE credentials SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return { success: true };
  });

  ipcMain.handle('db:credentials:delete', async (_, id: string) => {
    db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
    return { success: true };
  });

  // ============= POCs =============
  ipcMain.handle('db:pocs:create', async (_, data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO pocs (id, target_id, finding_id, title, objective, prerequisites, steps, payload, impact, severity, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.targetId,
      data.findingId || null,
      data.title,
      data.objective,
      data.prerequisites || null,
      JSON.stringify(data.steps),
      data.payload || null,
      data.impact,
      data.severity,
      data.status || 'draft'
    );

    return { id };
  });

  ipcMain.handle('db:pocs:list', async (_, targetId: string) => {
    return db.prepare(`
      SELECT p.*, f.title as finding_title
      FROM pocs p
      LEFT JOIN findings f ON p.finding_id = f.id
      WHERE p.target_id = ?
      ORDER BY p.created_at DESC
    `).all(targetId);
  });

  ipcMain.handle('db:pocs:get', async (_, id: string) => {
    const poc = db.prepare('SELECT * FROM pocs WHERE id = ?').get(id) as { steps?: string };
    if (poc && poc.steps) {
      return { ...poc, steps: JSON.parse(poc.steps) };
    }
    return poc;
  });

  ipcMain.handle('db:pocs:update', async (_, id: string, data) => {
    const updates: string[] = [];
    const values: unknown[] = [];

    const fields = ['title', 'objective', 'prerequisites', 'payload', 'impact', 'severity', 'status'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (data.steps) {
      updates.push('steps = ?');
      values.push(JSON.stringify(data.steps));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE pocs SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return { success: true };
  });

  ipcMain.handle('db:pocs:delete', async (_, id: string) => {
    db.prepare('DELETE FROM pocs WHERE id = ?').run(id);
    return { success: true };
  });

  // ============= ATTACK PATHS =============
  ipcMain.handle('db:attackPaths:list', async () => {
    // Return predefined attack paths
    return getAttackPaths();
  });

  ipcMain.handle('db:attackPaths:progress', async (_, targetId: string) => {
    return db.prepare(`
      SELECT * FROM attack_path_progress
      WHERE target_id = ?
      ORDER BY path_id, step_id
    `).all(targetId);
  });

  ipcMain.handle('db:attackPaths:updateProgress', async (_, targetId: string, pathId: string, data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO attack_path_progress (id, target_id, path_id, step_id, status, notes, findings_count, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(target_id, path_id, step_id) DO UPDATE SET
        status = excluded.status,
        notes = excluded.notes,
        findings_count = excluded.findings_count,
        completed_at = excluded.completed_at,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      id,
      targetId,
      pathId,
      data.stepId,
      data.status,
      data.notes || null,
      data.findingsCount || 0,
      data.status === 'completed' ? new Date().toISOString() : null
    );

    return { success: true };
  });

  // ============= KNOWLEDGE BASE =============
  ipcMain.handle('db:knowledge:search', async (_, query: string) => {
    const searchTerm = `%${query}%`;
    const techniques = db.prepare(`
      SELECT * FROM kb_techniques
      WHERE name LIKE ? OR description LIKE ? OR technique_id LIKE ?
      LIMIT 20
    `).all(searchTerm, searchTerm, searchTerm);

    const cves = db.prepare(`
      SELECT * FROM kb_cves
      WHERE cve_id LIKE ? OR title LIKE ? OR description LIKE ?
      LIMIT 20
    `).all(searchTerm, searchTerm, searchTerm);

    return { techniques, cves };
  });

  ipcMain.handle('db:knowledge:cve', async (_, cveId: string) => {
    return db.prepare('SELECT * FROM kb_cves WHERE cve_id = ?').get(cveId);
  });

  ipcMain.handle('db:knowledge:technique', async (_, techniqueId: string) => {
    const technique = db.prepare('SELECT * FROM kb_techniques WHERE technique_id = ?').get(techniqueId) as { steps?: string };
    if (technique && technique.steps) {
      return { ...technique, steps: JSON.parse(technique.steps) };
    }
    return technique;
  });
}

function getAttackPaths() {
  return {
    web: [
      {
        id: 'auth',
        name: 'Authentication',
        description: 'Login, Session, Token vulnerabilities',
        steps: [
          { id: 'auth-1', name: 'Identify auth mechanism', description: 'Determine how the application handles authentication' },
          { id: 'auth-2', name: 'Test default credentials', description: 'Check for common default usernames/passwords' },
          { id: 'auth-3', name: 'Test brute force protection', description: 'Check for account lockout and rate limiting' },
          { id: 'auth-4', name: 'Test session management', description: 'Analyze session tokens, cookies, and handling' },
          { id: 'auth-5', name: 'Test password reset', description: 'Check password reset functionality for flaws' },
        ],
      },
      {
        id: 'access_control',
        name: 'Access Control',
        description: 'IDOR, BOLA, privilege escalation',
        steps: [
          { id: 'ac-1', name: 'Map access controls', description: 'Identify different user roles and permissions' },
          { id: 'ac-2', name: 'Test horizontal escalation', description: 'Try accessing other users data' },
          { id: 'ac-3', name: 'Test vertical escalation', description: 'Try accessing admin functionality' },
          { id: 'ac-4', name: 'Test direct object references', description: 'Manipulate IDs and references in requests' },
        ],
      },
      {
        id: 'input',
        name: 'Input Validation',
        description: 'XSS, SQLi, SSTI, Command Injection',
        steps: [
          { id: 'input-1', name: 'Identify input vectors', description: 'Map all user input points' },
          { id: 'input-2', name: 'Test XSS', description: 'Check for reflected, stored, and DOM-based XSS' },
          { id: 'input-3', name: 'Test SQL Injection', description: 'Check for SQL injection in all parameters' },
          { id: 'input-4', name: 'Test template injection', description: 'Check for SSTI vulnerabilities' },
          { id: 'input-5', name: 'Test command injection', description: 'Check for OS command injection' },
        ],
      },
      {
        id: 'file',
        name: 'File Handling',
        description: 'Upload, LFI, RFI, Path Traversal',
        steps: [
          { id: 'file-1', name: 'Test file upload', description: 'Check for unrestricted file upload' },
          { id: 'file-2', name: 'Test LFI', description: 'Check for local file inclusion' },
          { id: 'file-3', name: 'Test path traversal', description: 'Check for directory traversal' },
          { id: 'file-4', name: 'Test file download', description: 'Check for arbitrary file download' },
        ],
      },
      {
        id: 'ssrf',
        name: 'Backend Trust',
        description: 'SSRF, Internal API access',
        steps: [
          { id: 'ssrf-1', name: 'Identify SSRF vectors', description: 'Find parameters that fetch external resources' },
          { id: 'ssrf-2', name: 'Test internal access', description: 'Try accessing internal services' },
          { id: 'ssrf-3', name: 'Test cloud metadata', description: 'Try accessing cloud metadata endpoints' },
        ],
      },
    ],
    ad: [
      {
        id: 'recon',
        name: 'Initial Reconnaissance',
        description: 'Environment detection and initial enumeration',
        steps: [
          { id: 'recon-1', name: 'Detect AD environment', description: 'Identify domain controllers and AD presence' },
          { id: 'recon-2', name: 'Network enumeration', description: 'Scan for open ports and services' },
          { id: 'recon-3', name: 'Anonymous enumeration', description: 'Enumerate without credentials' },
        ],
      },
      {
        id: 'enum',
        name: 'Authenticated Enumeration',
        description: 'Enumeration with valid credentials',
        steps: [
          { id: 'enum-1', name: 'User enumeration', description: 'List all domain users' },
          { id: 'enum-2', name: 'Group enumeration', description: 'Map group memberships' },
          { id: 'enum-3', name: 'Computer enumeration', description: 'List domain computers' },
          { id: 'enum-4', name: 'Share enumeration', description: 'Find accessible shares' },
          { id: 'enum-5', name: 'GPO enumeration', description: 'Analyze group policies' },
        ],
      },
      {
        id: 'kerberos',
        name: 'Kerberos Attacks',
        description: 'AS-REP Roasting, Kerberoasting',
        steps: [
          { id: 'kerb-1', name: 'AS-REP Roasting', description: 'Find users with pre-auth disabled' },
          { id: 'kerb-2', name: 'Kerberoasting', description: 'Request and crack service tickets' },
          { id: 'kerb-3', name: 'Ticket extraction', description: 'Extract tickets from memory' },
        ],
      },
      {
        id: 'lateral',
        name: 'Lateral Movement',
        description: 'Moving between systems',
        steps: [
          { id: 'lat-1', name: 'Pass the Hash', description: 'Use NTLM hashes for authentication' },
          { id: 'lat-2', name: 'Pass the Ticket', description: 'Use Kerberos tickets for access' },
          { id: 'lat-3', name: 'Remote execution', description: 'Execute commands on remote systems' },
        ],
      },
      {
        id: 'privesc',
        name: 'Privilege Escalation',
        description: 'Escalate to Domain Admin',
        steps: [
          { id: 'priv-1', name: 'ACL analysis', description: 'Find exploitable permissions' },
          { id: 'priv-2', name: 'Path analysis', description: 'Map paths to Domain Admin' },
          { id: 'priv-3', name: 'Delegation abuse', description: 'Exploit delegation settings' },
          { id: 'priv-4', name: 'DCSync', description: 'Extract credentials from DC' },
        ],
      },
    ],
  };
}
