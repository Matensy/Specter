import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

// Wrapper to provide better-sqlite3-like interface
export interface DatabaseWrapper {
  prepare(sql: string): StatementWrapper;
  exec(sql: string): void;
  close(): void;
}

interface StatementWrapper {
  run(...params: unknown[]): void;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

function createStatementWrapper(database: SqlJsDatabase, sql: string): StatementWrapper {
  return {
    run(...params: unknown[]) {
      database.run(sql, params as (string | number | null | Uint8Array)[]);
      saveDatabase();
    },
    get(...params: unknown[]) {
      const stmt = database.prepare(sql);
      stmt.bind(params as (string | number | null | Uint8Array)[]);
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result;
      }
      stmt.free();
      return undefined;
    },
    all(...params: unknown[]) {
      const results: unknown[] = [];
      const stmt = database.prepare(sql);
      stmt.bind(params as (string | number | null | Uint8Array)[]);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    },
  };
}

function createDatabaseWrapper(database: SqlJsDatabase): DatabaseWrapper {
  return {
    prepare(sql: string) {
      return createStatementWrapper(database, sql);
    },
    exec(sql: string) {
      database.run(sql);
      saveDatabase();
    },
    close() {
      if (database) {
        const data = database.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
        database.close();
      }
    },
  };
}

function saveDatabase(): void {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export function getDatabase(): DatabaseWrapper {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return createDatabaseWrapper(db);
}

export async function initializeDatabase(): Promise<void> {
  dbPath = path.join(app.getPath('userData'), 'specter.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Initialize SQL.js
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
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

    -- Machines table (VMs, SSH hosts, local)
    CREATE TABLE IF NOT EXISTS machines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'ssh',
      host TEXT,
      port INTEGER DEFAULT 22,
      username TEXT,
      password_encrypted TEXT,
      private_key_path TEXT,
      is_default INTEGER DEFAULT 0,
      status TEXT DEFAULT 'offline',
      last_connected DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_targets_vault ON targets(vault_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_findings_target ON findings(target_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_evidence_finding ON evidence(finding_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_target ON command_logs(target_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_timeline_vault ON timeline_events(vault_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_credentials_vault ON credentials(vault_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pocs_target ON pocs(target_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_attack_progress_target ON attack_path_progress(target_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status)`);

  // Seed knowledge base
  await seedKnowledgeBase();

  // Save initial database
  saveDatabase();
}

async function seedKnowledgeBase(): Promise<void> {
  if (!db) return;

  // Check if already seeded
  const stmt = db.prepare('SELECT COUNT(*) as count FROM kb_techniques');
  if (stmt.step()) {
    const result = stmt.getAsObject() as { count: number };
    if (result.count > 0) {
      stmt.free();
      return;
    }
  }
  stmt.free();

  // Insert default attack techniques
  const techniques = [
    ['web-auth-001', 'AUTH-BYPASS', 'Authentication Bypass', 'Web', 'auth', 'Techniques to bypass authentication mechanisms', 'Access to login endpoint', JSON.stringify(['Identify authentication mechanism', 'Test for default credentials', 'Test for SQL injection in login', 'Test for authentication logic flaws', 'Check for JWT vulnerabilities'])],
    ['web-idor-001', 'IDOR', 'Insecure Direct Object Reference', 'Web', 'access_control', 'Access unauthorized resources by manipulating object references', 'Authenticated session, identifiable object references', JSON.stringify(['Identify object references in requests', 'Map access control patterns', 'Test horizontal privilege escalation', 'Test vertical privilege escalation', 'Document accessible resources'])],
    ['web-sqli-001', 'SQLI', 'SQL Injection', 'Web', 'input', 'Inject malicious SQL queries through user input', 'Input field connected to database', JSON.stringify(['Identify injection points', 'Test for error-based SQLi', 'Test for blind SQLi', 'Enumerate database structure', 'Extract sensitive data'])],
    ['ad-enum-001', 'AD-ENUM', 'Active Directory Enumeration', 'ActiveDirectory', 'enumeration', 'Enumerate AD environment for attack paths', 'Network access to domain', JSON.stringify(['Identify domain controllers', 'Enumerate users and groups', 'Map trust relationships', 'Identify service accounts', 'Find privileged accounts'])],
    ['ad-kerb-001', 'KERBEROAST', 'Kerberoasting', 'ActiveDirectory', 'kerberos', 'Request and crack service tickets for service accounts', 'Valid domain credentials', JSON.stringify(['Enumerate SPNs', 'Request service tickets', 'Export tickets', 'Crack tickets offline', 'Use obtained credentials'])],
  ];

  for (const tech of techniques) {
    db.run(
      `INSERT OR IGNORE INTO kb_techniques (id, technique_id, name, category, attack_path, description, prerequisites, steps) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      tech
    );
  }
}

export function closeDatabase(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    db.close();
    db = null;
  }
}
