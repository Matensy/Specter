import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
  target_count?: number;
  finding_count?: number;
  credential_count?: number;
}

interface Target {
  id: string;
  vault_id: string;
  name: string;
  type: string;
  host?: string;
  port?: number;
  url?: string;
  description?: string;
  scope?: string;
  status: string;
  finding_count?: number;
  log_count?: number;
}

interface VaultContextType {
  vaults: Vault[];
  currentVault: Vault | null;
  loading: boolean;
  loadVaults: () => Promise<void>;
  createVault: (data: {
    name: string;
    description?: string;
    targetType: string;
    scope?: string;
  }) => Promise<{ id: string; path: string }>;
  selectVault: (id: string) => Promise<void>;
  updateVault: (id: string, data: Partial<Vault>) => Promise<void>;
  deleteVault: (id: string) => Promise<void>;
  openVaultFolder: (id: string) => Promise<void>;
  exportVault: (id: string, format: string) => Promise<{ path?: string }>;
  // Target operations
  targets: Target[];
  loadTargets: (vaultId: string) => Promise<void>;
  createTarget: (data: {
    vaultId: string;
    name: string;
    type: string;
    host?: string;
    port?: number;
    url?: string;
    description?: string;
    scope?: string;
  }) => Promise<{ id: string }>;
}

const VaultContext = createContext<VaultContextType | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [currentVault, setCurrentVault] = useState<Vault | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(false);

  const loadVaults = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.specter.vault.list();
      setVaults(result as Vault[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createVault = useCallback(async (data: {
    name: string;
    description?: string;
    targetType: string;
    scope?: string;
  }) => {
    const result = await window.specter.vault.create(data);
    await loadVaults();
    return result as { id: string; path: string };
  }, [loadVaults]);

  const selectVault = useCallback(async (id: string) => {
    const vault = await window.specter.vault.get(id);
    setCurrentVault(vault as Vault);
    if (vault) {
      await loadTargets(id);
    }
  }, []);

  const updateVault = useCallback(async (id: string, data: Partial<Vault>) => {
    await window.specter.vault.update(id, data);
    await loadVaults();
    if (currentVault?.id === id) {
      await selectVault(id);
    }
  }, [loadVaults, currentVault, selectVault]);

  const deleteVault = useCallback(async (id: string) => {
    await window.specter.vault.delete(id);
    if (currentVault?.id === id) {
      setCurrentVault(null);
      setTargets([]);
    }
    await loadVaults();
  }, [loadVaults, currentVault]);

  const openVaultFolder = useCallback(async (id: string) => {
    await window.specter.vault.open(id);
  }, []);

  const exportVault = useCallback(async (id: string, format: string) => {
    const result = await window.specter.vault.export(id, format);
    return result as { path?: string };
  }, []);

  // Target operations
  const loadTargets = useCallback(async (vaultId: string) => {
    const result = await window.specter.db.targets.list(vaultId);
    setTargets(result as Target[]);
  }, []);

  const createTarget = useCallback(async (data: {
    vaultId: string;
    name: string;
    type: string;
    host?: string;
    port?: number;
    url?: string;
    description?: string;
    scope?: string;
  }) => {
    const result = await window.specter.db.targets.create(data);
    await loadTargets(data.vaultId);
    return result as { id: string };
  }, [loadTargets]);

  // Load vaults on mount
  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  return (
    <VaultContext.Provider
      value={{
        vaults,
        currentVault,
        loading,
        loadVaults,
        createVault,
        selectVault,
        updateVault,
        deleteVault,
        openVaultFolder,
        exportVault,
        targets,
        loadTargets,
        createTarget,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
