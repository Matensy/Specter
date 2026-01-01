import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import VaultPage from './pages/VaultPage';
import TargetPage from './pages/TargetPage';
import TerminalPage from './pages/TerminalPage';
import AttackPathsPage from './pages/AttackPathsPage';
import FindingsPage from './pages/FindingsPage';
import POCBuilderPage from './pages/POCBuilderPage';
import CredentialsPage from './pages/CredentialsPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import SettingsPage from './pages/SettingsPage';
import { VMProvider } from './contexts/VMContext';
import { VaultProvider } from './contexts/VaultContext';

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <VMProvider>
      <VaultProvider>
        <div className="h-screen flex flex-col bg-specter-darker">
          <TitleBar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <main className="flex-1 overflow-auto bg-specter-dark">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/vault/:vaultId" element={<VaultPage />} />
                <Route path="/vault/:vaultId/target/:targetId" element={<TargetPage />} />
                <Route path="/terminal" element={<TerminalPage />} />
                <Route path="/attack-paths" element={<AttackPathsPage />} />
                <Route path="/findings" element={<FindingsPage />} />
                <Route path="/poc-builder" element={<POCBuilderPage />} />
                <Route path="/credentials" element={<CredentialsPage />} />
                <Route path="/knowledge" element={<KnowledgeBasePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </VaultProvider>
    </VMProvider>
  );
}
