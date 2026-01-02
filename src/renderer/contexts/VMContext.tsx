import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface VMStatus {
  connected: boolean;
  connecting: boolean;
  host?: string;
  username?: string;
  lastError?: string;
  uptime?: number;
}

interface VMConfig {
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  password?: string;
  autoStart?: boolean;
}

interface VMContextType {
  status: VMStatus;
  config: VMConfig | null;
  connect: (config?: Partial<VMConfig>) => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<void>;
  testConnection: (config: Partial<VMConfig>) => Promise<{ success: boolean; error?: string }>;
  configure: (config: Partial<VMConfig>) => Promise<void>;
}

const VMContext = createContext<VMContextType | null>(null);

export function VMProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VMStatus>({
    connected: false,
    connecting: false,
  });
  const [config, setConfig] = useState<VMConfig | null>(null);

  useEffect(() => {
    // Get initial status
    window.specter.vm.getStatus().then(setStatus);

    // Load saved config and try auto-connect
    window.specter.app.getConfig().then((appConfig: any) => {
      if (appConfig?.vm) {
        setConfig(appConfig.vm);

        // Auto-connect if configured
        if (appConfig.vm.autoStart && !status.connected) {
          window.specter.vm.connect();
        }
      }
    });

    // Listen for status changes
    window.specter.vm.onStatusChange((newStatus) => {
      setStatus(newStatus as VMStatus);
    });
  }, []);

  const connect = useCallback(async (config?: Partial<VMConfig>) => {
    const result = await window.specter.vm.connect(config);
    return result as { success: boolean; error?: string };
  }, []);

  const disconnect = useCallback(async () => {
    await window.specter.vm.disconnect();
  }, []);

  const testConnection = useCallback(async (config: Partial<VMConfig>) => {
    const result = await window.specter.vm.testConnection(config);
    return result as { success: boolean; error?: string };
  }, []);

  const configure = useCallback(async (config: Partial<VMConfig>) => {
    await window.specter.vm.configure(config);
  }, []);

  return (
    <VMContext.Provider value={{ status, config, connect, disconnect, testConnection, configure }}>
      {children}
    </VMContext.Provider>
  );
}

export function useVM() {
  const context = useContext(VMContext);
  if (!context) {
    throw new Error('useVM must be used within a VMProvider');
  }
  return context;
}
