import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const dbPath = path.join(app.getPath('userData'), 'specter.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    -- Vaults table
    CREATE TABLE IF NOT EXISTS vaults (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      path TEXT NOT NULL UNIQUE,
      target_type TEXT NOT NULL,
      scope TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active',
      metadata TEXT
    );

    -- Targets table (within a vault)
    CREATE TABLE IF NOT EXISTS targets (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      host TEXT,
      port INTEGER,
      url TEXT,
      description TEXT,
      scope TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
    );

    -- Findings table
    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL,
      category TEXT,
      attack_path TEXT,
      status TEXT DEFAULT 'open',
      cve_id TEXT,
      cvss_score REAL,
      evidence_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
    );

    -- Evidence table
    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      finding_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      file_path TEXT,
      content TEXT,
      command TEXT,
      output TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE
    );

    -- Command logs table
    CREATE TABLE IF NOT EXISTS command_logs (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      command TEXT NOT NULL,
      output TEXT,
      error TEXT,
      exit_code INTEGER,
      category TEXT,
      attack_path TEXT,
      duration_ms INTEGER,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE
    );

    -- Timeline events table
    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL,
      target_id TEXT,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT,
      related_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
    );

    -- Credentials table (encrypted)
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL,
      target_id TEXT,
      type TEXT NOT NULL,
      username TEXT,
      password_encrypted TEXT,
      hash TEXT,
      domain TEXT,
      notes TEXT,
      source TEXT,
      valid INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
    );

    -- POC (Proof of Concept) table
    CREATE TABLE IF NOT EXISTS pocs (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      finding_id TEXT,
      title TEXT NOT NULL,
      objective TEXT NOT NULL,
      prerequisites TEXT,
      steps TEXT NOT NULL,
      payload TEXT,
      impact TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE,
      FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE SET NULL
    );

    -- Attack path progress table
    CREATE TABLE IF NOT EXISTS attack_path_progress (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      path_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      findings_count INTEGER DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE,
      UNIQUE(target_id, path_id, step_id)
    );

    -- Knowledge base - CVEs
    CREATE TABLE IF NOT EXISTS kb_cves (
      id TEXT PRIMARY KEY,
      cve_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT,
      cvss_score REAL,
      affected_products TEXT,
      prerequisites TEXT,
      exploitation_steps TEXT,
      impact TEXT,
      mitigation TEXT,
      references TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Knowledge base - Techniques
    CREATE TABLE IF NOT EXISTS kb_techniques (
      id TEXT PRIMARY KEY,
      technique_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      attack_path TEXT,
      prerequisites TEXT,
      steps TEXT,
      detection TEXT,
      tools TEXT,
      references TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Notes table
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL,
      target_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
    );

    -- Playbooks table
    CREATE TABLE IF NOT EXISTS playbooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      target_type TEXT NOT NULL,
      steps TEXT NOT NULL,
      version TEXT DEFAULT '1.0',
      is_custom INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_targets_vault ON targets(vault_id);
    CREATE INDEX IF NOT EXISTS idx_findings_target ON findings(target_id);
    CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
    CREATE INDEX IF NOT EXISTS idx_evidence_finding ON evidence(finding_id);
    CREATE INDEX IF NOT EXISTS idx_logs_target ON command_logs(target_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_vault ON timeline_events(vault_id);
    CREATE INDEX IF NOT EXISTS idx_credentials_vault ON credentials(vault_id);
    CREATE INDEX IF NOT EXISTS idx_pocs_target ON pocs(target_id);
    CREATE INDEX IF NOT EXISTS idx_attack_progress_target ON attack_path_progress(target_id);
  `);

  // Insert default playbooks and knowledge base data
  await seedKnowledgeBase(db);
}

async function seedKnowledgeBase(database: Database.Database): Promise<void> {
  // Check if already seeded
  const count = database.prepare('SELECT COUNT(*) as count FROM kb_techniques').get() as { count: number };
  if (count.count > 0) return;

  // Insert default attack techniques
  const techniques = [
    {
      id: 'web-auth-001',
      technique_id: 'AUTH-BYPASS',
      name: 'Authentication Bypass',
      category: 'Web',
      attack_path: 'auth',
      description: 'Techniques to bypass authentication mechanisms',
      prerequisites: 'Access to login endpoint',
      steps: JSON.stringify([
        'Identify authentication mechanism',
        'Test for default credentials',
        'Test for SQL injection in login',
        'Test for authentication logic flaws',
        'Check for JWT vulnerabilities',
      ]),
    },
    {
      id: 'web-idor-001',
      technique_id: 'IDOR',
      name: 'Insecure Direct Object Reference',
      category: 'Web',
      attack_path: 'access_control',
      description: 'Access unauthorized resources by manipulating object references',
      prerequisites: 'Authenticated session, identifiable object references',
      steps: JSON.stringify([
        'Identify object references in requests',
        'Map access control patterns',
        'Test horizontal privilege escalation',
        'Test vertical privilege escalation',
        'Document accessible resources',
      ]),
    },
    {
      id: 'web-sqli-001',
      technique_id: 'SQLI',
      name: 'SQL Injection',
      category: 'Web',
      attack_path: 'input',
      description: 'Inject malicious SQL queries through user input',
      prerequisites: 'Input field connected to database',
      steps: JSON.stringify([
        'Identify injection points',
        'Test for error-based SQLi',
        'Test for blind SQLi',
        'Enumerate database structure',
        'Extract sensitive data',
      ]),
    },
    {
      id: 'ad-enum-001',
      technique_id: 'AD-ENUM',
      name: 'Active Directory Enumeration',
      category: 'ActiveDirectory',
      attack_path: 'enumeration',
      description: 'Enumerate AD environment for attack paths',
      prerequisites: 'Network access to domain',
      steps: JSON.stringify([
        'Identify domain controllers',
        'Enumerate users and groups',
        'Map trust relationships',
        'Identify service accounts',
        'Find privileged accounts',
      ]),
    },
    {
      id: 'ad-kerb-001',
      technique_id: 'KERBEROAST',
      name: 'Kerberoasting',
      category: 'ActiveDirectory',
      attack_path: 'kerberos',
      description: 'Request and crack service tickets for service accounts',
      prerequisites: 'Valid domain credentials',
      steps: JSON.stringify([
        'Enumerate SPNs',
        'Request service tickets',
        'Export tickets',
        'Crack tickets offline',
        'Use obtained credentials',
      ]),
    },
  ];

  const insertTechnique = database.prepare(`
    INSERT OR IGNORE INTO kb_techniques
    (id, technique_id, name, category, attack_path, description, prerequisites, steps)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const tech of techniques) {
    insertTechnique.run(
      tech.id,
      tech.technique_id,
      tech.name,
      tech.category,
      tech.attack_path,
      tech.description,
      tech.prerequisites,
      tech.steps
    );
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
