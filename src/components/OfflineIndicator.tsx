import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-[max(4.5rem,env(safe-area-inset-top))] right-3 z-30 flex items-center gap-1.5 rounded-lg bg-amber-950/95 border border-amber-400/70 px-3 py-1.5 text-xs font-medium text-amber-100 shadow-lg">
      <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
      <span>Offline Mode — Cached Game</span>
    </div>
  );
};
