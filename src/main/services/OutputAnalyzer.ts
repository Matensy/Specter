import { getDatabase } from '../database/init';
import { v4 as uuidv4 } from 'uuid';

// Patterns for detecting services and technologies
const SERVICE_PATTERNS = {
  // Web Services
  http: /(\d+)\/tcp\s+open\s+(http|https)/gi,
  nginx: /nginx\/?(\d+\.\d+)?/gi,
  apache: /apache\/?(\d+\.\d+)?/gi,
  iis: /microsoft[\s-]iis\/?(\d+\.\d+)?/gi,
  tomcat: /tomcat\/?(\d+\.\d+)?/gi,

  // Databases
  mysql: /(\d+)\/tcp\s+open\s+mysql|mysql\/?(\d+\.\d+)?/gi,
  postgres: /(\d+)\/tcp\s+open\s+postgresql|postgres/gi,
  mssql: /(\d+)\/tcp\s+open\s+ms-sql|microsoft[\s-]sql/gi,
  mongodb: /mongodb\/?(\d+\.\d+)?/gi,
  redis: /redis\/?(\d+\.\d+)?/gi,

  // Authentication
  ssh: /(\d+)\/tcp\s+open\s+ssh|openssh[\s-]?(\d+\.\d+)?/gi,
  ldap: /(\d+)\/tcp\s+open\s+ldap/gi,
  kerberos: /(\d+)\/tcp\s+open\s+kerberos|88\/tcp/gi,

  // SMB/Windows
  smb: /(\d+)\/tcp\s+open\s+microsoft-ds|445\/tcp|139\/tcp/gi,
  rdp: /(\d+)\/tcp\s+open\s+ms-wbt-server|3389\/tcp/gi,
  winrm: /5985\/tcp|5986\/tcp/gi,

  // Mail
  smtp: /(\d+)\/tcp\s+open\s+smtp/gi,
  pop3: /(\d+)\/tcp\s+open\s+pop3/gi,
  imap: /(\d+)\/tcp\s+open\s+imap/gi,

  // Other
  ftp: /(\d+)\/tcp\s+open\s+ftp/gi,
  dns: /(\d+)\/tcp\s+open\s+domain|53\/tcp/gi,
  snmp: /(\d+)\/udp\s+open\s+snmp|161\/udp/gi,
};

// Patterns for detecting attack path completion
const PATH_PATTERNS = {
  recon: {
    patterns: [
      /nmap.*-s[STUA]/i,
      /masscan/i,
      /rustscan/i,
      /discovered open port/i,
      /host is up/i,
    ],
    description: 'Network reconnaissance detected',
  },
  web_enum: {
    patterns: [
      /gobuster/i,
      /ffuf/i,
      /dirb/i,
      /dirsearch/i,
      /nikto/i,
      /wfuzz/i,
      /Status:\s*200/i,
      /Found:/i,
    ],
    description: 'Web enumeration detected',
  },
  vuln_scan: {
    patterns: [
      /nmap.*--script.*vuln/i,
      /nikto/i,
      /nuclei/i,
      /CVE-\d{4}-\d+/i,
      /VULNERABLE/i,
    ],
    description: 'Vulnerability scanning detected',
  },
  sqli: {
    patterns: [
      /sqlmap/i,
      /sql injection/i,
      /\[INFO\].*injectable/i,
      /database.*extracted/i,
    ],
    description: 'SQL injection testing detected',
  },
  auth_bypass: {
    patterns: [
      /hydra/i,
      /medusa/i,
      /login.*success/i,
      /password.*found/i,
      /\[.*\].*:.*:.*password/i,
    ],
    description: 'Authentication bypass/brute force detected',
  },
  ad_enum: {
    patterns: [
      /bloodhound/i,
      /ldapsearch/i,
      /enum4linux/i,
      /crackmapexec/i,
      /impacket/i,
      /GetUserSPNs/i,
    ],
    description: 'Active Directory enumeration detected',
  },
  kerberos: {
    patterns: [
      /GetUserSPNs/i,
      /kerberoast/i,
      /asrep/i,
      /\$krb5tgs\$/i,
      /\$krb5asrep\$/i,
    ],
    description: 'Kerberos attack detected',
  },
  privesc: {
    patterns: [
      /linpeas/i,
      /winpeas/i,
      /linenum/i,
      /sudo.*-l/i,
      /SUID/i,
      /privilege/i,
    ],
    description: 'Privilege escalation enumeration detected',
  },
  lateral: {
    patterns: [
      /psexec/i,
      /wmiexec/i,
      /smbexec/i,
      /evil-winrm/i,
      /pass.the.hash/i,
    ],
    description: 'Lateral movement detected',
  },
};

// Recommendation templates
const RECOMMENDATIONS: Record<string, { category: string; commands: string[]; description: string }[]> = {
  http: [
    {
      category: 'Enumeration',
      commands: ['gobuster dir -u http://TARGET -w /usr/share/wordlists/dirb/common.txt', 'nikto -h http://TARGET'],
      description: 'Enumerate web directories and scan for common vulnerabilities',
    },
    {
      category: 'Vulnerability',
      commands: ['nuclei -u http://TARGET', 'whatweb http://TARGET'],
      description: 'Scan for known vulnerabilities and identify technologies',
    },
  ],
  mysql: [
    {
      category: 'Enumeration',
      commands: ['mysql -h TARGET -u root -p', 'nmap -sV -p 3306 --script mysql-enum TARGET'],
      description: 'Enumerate MySQL database',
    },
    {
      category: 'Brute Force',
      commands: ['hydra -l root -P /usr/share/wordlists/rockyou.txt TARGET mysql'],
      description: 'Brute force MySQL credentials',
    },
  ],
  smb: [
    {
      category: 'Enumeration',
      commands: ['smbclient -L //TARGET -N', 'enum4linux -a TARGET', 'crackmapexec smb TARGET'],
      description: 'Enumerate SMB shares and users',
    },
    {
      category: 'Vulnerability',
      commands: ['nmap -p 445 --script smb-vuln* TARGET'],
      description: 'Check for SMB vulnerabilities (EternalBlue, etc.)',
    },
  ],
  ssh: [
    {
      category: 'Brute Force',
      commands: ['hydra -l root -P /usr/share/wordlists/rockyou.txt TARGET ssh'],
      description: 'Brute force SSH credentials',
    },
    {
      category: 'Enumeration',
      commands: ['ssh-audit TARGET'],
      description: 'Audit SSH configuration',
    },
  ],
  ldap: [
    {
      category: 'Enumeration',
      commands: ['ldapsearch -x -H ldap://TARGET -b "dc=domain,dc=local"', 'nmap -p 389 --script ldap-search TARGET'],
      description: 'Enumerate LDAP directory',
    },
  ],
  kerberos: [
    {
      category: 'Enumeration',
      commands: ['GetUserSPNs.py DOMAIN/user:password -dc-ip TARGET', 'GetNPUsers.py DOMAIN/ -usersfile users.txt -no-pass -dc-ip TARGET'],
      description: 'Enumerate Kerberos SPNs and AS-REP roastable users',
    },
  ],
  ftp: [
    {
      category: 'Enumeration',
      commands: ['ftp TARGET', 'nmap -sV -p 21 --script ftp-anon,ftp-bounce TARGET'],
      description: 'Check for anonymous FTP access',
    },
  ],
  rdp: [
    {
      category: 'Vulnerability',
      commands: ['nmap -p 3389 --script rdp-vuln-ms12-020 TARGET'],
      description: 'Check for RDP vulnerabilities',
    },
    {
      category: 'Brute Force',
      commands: ['hydra -l Administrator -P /usr/share/wordlists/rockyou.txt TARGET rdp'],
      description: 'Brute force RDP credentials',
    },
  ],
};

export interface DetectedService {
  name: string;
  port?: number;
  version?: string;
  confidence: number;
}

export interface Recommendation {
  service: string;
  category: string;
  commands: string[];
  description: string;
}

export interface PathProgress {
  path: string;
  status: 'detected' | 'in_progress' | 'completed';
  description: string;
  timestamp: Date;
}

class OutputAnalyzerService {
  // Analyze terminal output and extract services
  analyzeOutput(output: string): DetectedService[] {
    const services: DetectedService[] = [];
    const seen = new Set<string>();

    for (const [serviceName, pattern] of Object.entries(SERVICE_PATTERNS)) {
      const matches = output.matchAll(pattern);
      for (const match of matches) {
        if (!seen.has(serviceName)) {
          seen.add(serviceName);
          services.push({
            name: serviceName,
            port: match[1] ? parseInt(match[1]) : undefined,
            version: match[2] || undefined,
            confidence: 0.9,
          });
        }
      }
    }

    return services;
  }

  // Get recommendations based on detected services
  getRecommendations(services: DetectedService[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const service of services) {
      const serviceRecs = RECOMMENDATIONS[service.name];
      if (serviceRecs) {
        for (const rec of serviceRecs) {
          recommendations.push({
            service: service.name,
            category: rec.category,
            commands: rec.commands,
            description: rec.description,
          });
        }
      }
    }

    return recommendations;
  }

  // Detect attack path progress from output
  detectPathProgress(output: string): PathProgress[] {
    const progress: PathProgress[] = [];

    for (const [pathName, config] of Object.entries(PATH_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(output)) {
          progress.push({
            path: pathName,
            status: 'detected',
            description: config.description,
            timestamp: new Date(),
          });
          break;
        }
      }
    }

    return progress;
  }

  // Update attack path progress in database
  updatePathProgress(targetId: string, progress: PathProgress[]): void {
    const db = getDatabase();

    for (const p of progress) {
      // Check if path already exists
      const existing = db.prepare(`
        SELECT id, status FROM attack_path_progress
        WHERE target_id = ? AND path_id = ?
      `).get(targetId, p.path) as { id: string; status: string } | undefined;

      if (existing) {
        // Update if not already completed
        if (existing.status !== 'completed') {
          db.prepare(`
            UPDATE attack_path_progress
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(p.status, existing.id);
        }
      } else {
        // Insert new progress
        db.prepare(`
          INSERT INTO attack_path_progress (id, target_id, path_id, step_id, status, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          targetId,
          p.path,
          p.path + '_detect',
          p.status,
          p.description
        );
      }
    }
  }

  // Store detected services
  storeDetectedServices(targetId: string, services: DetectedService[]): void {
    const db = getDatabase();

    // Get target to update metadata
    const target = db.prepare('SELECT metadata FROM targets WHERE id = ?').get(targetId) as { metadata?: string } | undefined;

    if (target) {
      let metadata: Record<string, unknown> = {};
      if (target.metadata) {
        try {
          metadata = JSON.parse(target.metadata);
        } catch {
          metadata = {};
        }
      }

      metadata.detectedServices = services;
      metadata.lastScanTime = new Date().toISOString();

      db.prepare('UPDATE targets SET metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(metadata), targetId);
    }
  }

  // Full analysis pipeline
  analyze(targetId: string, output: string): {
    services: DetectedService[];
    recommendations: Recommendation[];
    pathProgress: PathProgress[];
  } {
    const services = this.analyzeOutput(output);
    const recommendations = this.getRecommendations(services);
    const pathProgress = this.detectPathProgress(output);

    // Store results
    if (services.length > 0) {
      this.storeDetectedServices(targetId, services);
    }
    if (pathProgress.length > 0) {
      this.updatePathProgress(targetId, pathProgress);
    }

    return { services, recommendations, pathProgress };
  }
}

export const OutputAnalyzer = new OutputAnalyzerService();
