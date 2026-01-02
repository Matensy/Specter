import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('specter', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },

  // Vault operations
  vault: {
    create: (data: unknown) => ipcRenderer.invoke('vault:create', data),
    list: () => ipcRenderer.invoke('vault:list'),
    get: (id: string) => ipcRenderer.invoke('vault:get', id),
    update: (id: string, data: unknown) => ipcRenderer.invoke('vault:update', id, data),
    delete: (id: string, permanent: boolean = false) => ipcRenderer.invoke('vault:delete', id, permanent),
    open: (id: string) => ipcRenderer.invoke('vault:open', id),
    export: (id: string, format: string) => ipcRenderer.invoke('vault:export', id, format),
  },

  // VM operations
  vm: {
    getStatus: () => ipcRenderer.invoke('vm:status'),
    start: (config: unknown) => ipcRenderer.invoke('vm:start', config),
    stop: () => ipcRenderer.invoke('vm:stop'),
    connect: (config: unknown) => ipcRenderer.invoke('vm:connect', config),
    disconnect: () => ipcRenderer.invoke('vm:disconnect'),
    configure: (config: unknown) => ipcRenderer.invoke('vm:configure', config),
    testConnection: (config: unknown) => ipcRenderer.invoke('vm:test', config),
    onStatusChange: (callback: (status: unknown) => void) => {
      ipcRenderer.on('vm:status-changed', (_, status) => callback(status));
    },
  },

  // Terminal operations
  terminal: {
    create: (vaultId: string) => ipcRenderer.invoke('terminal:create', vaultId),
    write: (terminalId: string, data: string) => ipcRenderer.invoke('terminal:write', terminalId, data),
    resize: (terminalId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    close: (terminalId: string) => ipcRenderer.invoke('terminal:close', terminalId),
    logCommand: (terminalId: string, command: string) =>
      ipcRenderer.invoke('terminal:logCommand', terminalId, command),
    onData: (callback: (terminalId: string, data: string) => void) => {
      ipcRenderer.on('terminal:data', (_, terminalId, data) => callback(terminalId, data));
    },
    onExit: (callback: (terminalId: string) => void) => {
      ipcRenderer.on('terminal:exit', (_, terminalId) => callback(terminalId));
    },
  },

  // Database operations
  db: {
    // Targets
    targets: {
      create: (data: unknown) => ipcRenderer.invoke('db:targets:create', data),
      list: (vaultId: string) => ipcRenderer.invoke('db:targets:list', vaultId),
      get: (id: string) => ipcRenderer.invoke('db:targets:get', id),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:targets:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:targets:delete', id),
    },
    // Findings
    findings: {
      create: (data: unknown) => ipcRenderer.invoke('db:findings:create', data),
      list: (targetId: string) => ipcRenderer.invoke('db:findings:list', targetId),
      get: (id: string) => ipcRenderer.invoke('db:findings:get', id),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:findings:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:findings:delete', id),
    },
    // Evidence
    evidence: {
      create: (data: unknown) => ipcRenderer.invoke('db:evidence:create', data),
      list: (findingId: string) => ipcRenderer.invoke('db:evidence:list', findingId),
      get: (id: string) => ipcRenderer.invoke('db:evidence:get', id),
      delete: (id: string) => ipcRenderer.invoke('db:evidence:delete', id),
    },
    // Commands/Logs
    logs: {
      create: (data: unknown) => ipcRenderer.invoke('db:logs:create', data),
      list: (targetId: string, filters?: unknown) => ipcRenderer.invoke('db:logs:list', targetId, filters),
      get: (id: string) => ipcRenderer.invoke('db:logs:get', id),
    },
    // Timeline
    timeline: {
      add: (data: unknown) => ipcRenderer.invoke('db:timeline:add', data),
      list: (vaultId: string) => ipcRenderer.invoke('db:timeline:list', vaultId),
    },
    // Credentials
    credentials: {
      create: (data: unknown) => ipcRenderer.invoke('db:credentials:create', data),
      list: (vaultId: string) => ipcRenderer.invoke('db:credentials:list', vaultId),
      get: (id: string) => ipcRenderer.invoke('db:credentials:get', id),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:credentials:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:credentials:delete', id),
    },
    // POCs
    pocs: {
      create: (data: unknown) => ipcRenderer.invoke('db:pocs:create', data),
      list: (targetId: string) => ipcRenderer.invoke('db:pocs:list', targetId),
      get: (id: string) => ipcRenderer.invoke('db:pocs:get', id),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:pocs:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:pocs:delete', id),
    },
    // Attack Paths
    attackPaths: {
      list: () => ipcRenderer.invoke('db:attackPaths:list'),
      getProgress: (targetId: string) => ipcRenderer.invoke('db:attackPaths:progress', targetId),
      updateProgress: (targetId: string, pathId: string, data: unknown) =>
        ipcRenderer.invoke('db:attackPaths:updateProgress', targetId, pathId, data),
    },
    // Knowledge Base
    knowledge: {
      search: (query: string) => ipcRenderer.invoke('db:knowledge:search', query),
      getCVE: (cveId: string) => ipcRenderer.invoke('db:knowledge:cve', cveId),
      getTechnique: (techniqueId: string) => ipcRenderer.invoke('db:knowledge:technique', techniqueId),
    },
  },

  // File operations
  file: {
    selectDirectory: () => ipcRenderer.invoke('file:selectDirectory'),
    selectFile: (filters?: unknown) => ipcRenderer.invoke('file:selectFile', filters),
    saveFile: (data: unknown, defaultPath?: string) => ipcRenderer.invoke('file:saveFile', data, defaultPath),
    readFile: (path: string) => ipcRenderer.invoke('file:readFile', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('file:writeFile', path, content),
    openInExplorer: (path: string) => ipcRenderer.invoke('file:openInExplorer', path),
    captureScreenshot: () => ipcRenderer.invoke('file:captureScreenshot'),
  },

  // App info
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    getConfig: () => ipcRenderer.invoke('app:config'),
    setConfig: (config: unknown) => ipcRenderer.invoke('app:setConfig', config),
  },
});

// Types are declared in src/renderer/types/specter.d.ts
