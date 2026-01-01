import React from 'react';
import { useVM } from '../contexts/VMContext';

export default function TitleBar() {
  const { status } = useVM();

  const handleMinimize = () => window.specter.window.minimize();
  const handleMaximize = () => window.specter.window.maximize();
  const handleClose = () => window.specter.window.close();

  return (
    <div className="h-10 bg-specter-darker flex items-center justify-between px-4 drag-region border-b border-specter-medium">
      {/* Left side - Logo */}
      <div className="flex items-center gap-3 no-drag">
        <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-purple-700 rounded-md flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 12a1 1 0 112 0v2a1 1 0 11-2 0v-2zm1-8a1 1 0 00-1 1v4a1 1 0 002 0V5a1 1 0 00-1-1z" />
          </svg>
        </div>
        <span className="font-semibold text-gray-100 text-sm">SPECTER</span>
      </div>

      {/* Center - VM Status */}
      <div className="flex items-center gap-2 no-drag">
        <div className={`status-indicator ${
          status.connected ? 'status-connected' :
          status.connecting ? 'status-connecting' :
          'status-disconnected'
        }`} />
        <span className="text-xs text-gray-400">
          {status.connected
            ? `VM: ${status.host} (${status.username})`
            : status.connecting
              ? 'Connecting...'
              : 'VM Disconnected'}
        </span>
      </div>

      {/* Right side - Window controls */}
      <div className="flex items-center gap-1 no-drag">
        <button
          onClick={handleMinimize}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-specter-light rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-specter-light rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M4 16v4h4M16 4h4v4M16 20h4v-4" />
          </svg>
        </button>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
