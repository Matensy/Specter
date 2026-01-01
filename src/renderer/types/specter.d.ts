export interface SpecterAPI {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  vault: {
    create: (data: unknown) => Promise<{ id: string; path: string }>;
    list: () => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
    update: (id: string, data: unknown) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    open: (id: string) => Promise<{ success: boolean }>;
    export: (id: string, format: string) => Promise<{ success: boolean; path?: string }>;
  };
  vm: {
    getStatus: () => Promise<unknown>;
    start: (config: unknown) => Promise<unknown>;
    stop: () => Promise<unknown>;
    connect: (config?: unknown) => Promise<{ success: boolean; error?: string }>;
    disconnect: () => Promise<{ success: boolean }>;
    configure: (config: unknown) => Promise<{ success: boolean }>;
    testConnection: (config: unknown) => Promise<{ success: boolean; error?: string }>;
    onStatusChange: (callback: (status: unknown) => void) => void;
  };
  terminal: {
    create: (vaultId: string) => Promise<{ success: boolean; terminalId?: string; error?: string }>;
    write: (terminalId: string, data: string) => Promise<{ success: boolean }>;
    resize: (terminalId: string, cols: number, rows: number) => Promise<{ success: boolean }>;
    close: (terminalId: string) => Promise<{ success: boolean }>;
    onData: (callback: (terminalId: string, data: string) => void) => void;
    onExit: (callback: (terminalId: string) => void) => void;
  };
  db: {
    targets: {
      create: (data: unknown) => Promise<{ id: string }>;
      list: (vaultId: string) => Promise<unknown[]>;
      get: (id: string) => Promise<unknown>;
      update: (id: string, data: unknown) => Promise<{ success: boolean }>;
      delete: (id: string) => Promise<{ success: boolean }>;
    };
    findings: {
      create: (data: unknown) => Promise<{ id: string }>;
      list: (targetId: string) => Promise<unknown[]>;
      get: (id: string) => Promise<unknown>;
      update: (id: string, data: unknown) => Promise<{ success: boolean }>;
      delete: (id: string) => Promise<{ success: boolean }>;
    };
    evidence: {
      create: (data: unknown) => Promise<{ id: string }>;
      list: (findingId: string) => Promise<unknown[]>;
      get: (id: string) => Promise<unknown>;
      delete: (id: string) => Promise<{ success: boolean }>;
    };
    logs: {
      create: (data: unknown) => Promise<{ id: string }>;
      list: (targetId: string, filters?: unknown) => Promise<unknown[]>;
      get: (id: string) => Promise<unknown>;
    };
    timeline: {
      add: (data: unknown) => Promise<{ id: string }>;
      list: (vaultId: string) => Promise<unknown[]>;
    };
    credentials: {
      create: (data: unknown) => Promise<{ id: string }>;
      list: (vaultId: string) => Promise<unknown[]>;
      get: (id: string) => Promise<unknown>;
      update: (id: string, data: unknown) => Promise<{ success: boolean }>;
      delete: (id: string) => Promise<{ success: boolean }>;
    };
    pocs: {
      create: (data: unknown) => Promise<{ id: string }>;
      list: (targetId: string) => Promise<unknown[]>;
      get: (id: string) => Promise<unknown>;
      update: (id: string, data: unknown) => Promise<{ success: boolean }>;
      delete: (id: string) => Promise<{ success: boolean }>;
    };
    attackPaths: {
      list: () => Promise<unknown>;
      getProgress: (targetId: string) => Promise<unknown[]>;
      updateProgress: (targetId: string, pathId: string, data: unknown) => Promise<{ success: boolean }>;
    };
    knowledge: {
      search: (query: string) => Promise<unknown>;
      getCVE: (cveId: string) => Promise<unknown>;
      technique: (techniqueId: string) => Promise<unknown>;
    };
  };
  file: {
    selectDirectory: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
    selectFile: (filters?: unknown) => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
    saveFile: (data: unknown, defaultPath?: string) => Promise<{ success: boolean; path?: string }>;
    readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (path: string, content: string) => Promise<{ success: boolean }>;
    openInExplorer: (path: string) => Promise<{ success: boolean }>;
    captureScreenshot: () => Promise<{ success: boolean; data?: string; fileName?: string }>;
  };
  app: {
    getVersion: () => Promise<string>;
    getConfig: () => Promise<unknown>;
    setConfig: (config: unknown) => Promise<{ success: boolean }>;
  };
}

declare global {
  interface Window {
    specter: SpecterAPI;
  }
}

export {};
