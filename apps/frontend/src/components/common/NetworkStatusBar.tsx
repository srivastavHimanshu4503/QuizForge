import { useState, useEffect } from 'react';
import { useNetwork } from '../../context/NetworkContext';
import {
  WifiOff,
  RefreshCw,
  CheckCircle2,
  X,
  CloudUpload,
} from 'lucide-react';

export function NetworkStatusBar() {
  const { isOnline, pendingSyncCount, isSyncing, lastSyncResult, syncNow } = useNetwork();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Auto-show success toast when items sync
  useEffect(() => {
    if (lastSyncResult && lastSyncResult.synced > 0) {
      setShowSyncSuccess(true);
      const timer = setTimeout(() => setShowSyncSuccess(false), 4000);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [lastSyncResult]);

  // If dismissed and network status toggles, reset dismissal
  useEffect(() => {
    setIsDismissed(false);
  }, [isOnline]);

  if (isDismissed && isOnline && !showSyncSuccess && pendingSyncCount === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Network Status"
      className="sticky top-0 z-40 transition-all duration-300"
    >
      {/* 1. Offline Mode Active Banner */}
      {!isOnline && (
        <div className="bg-amber-500 dark:bg-amber-600 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 max-w-4xl">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              You are currently offline. Offline mode is active — cached quizzes and flashcards remain available. All your progress is stored locally.
              {pendingSyncCount > 0 && ` (${pendingSyncCount} action${pendingSyncCount === 1 ? '' : 's'} queued for sync)`}
            </span>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-md hover:bg-black/10 transition-colors shrink-0 ml-2"
            aria-label="Dismiss offline banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Syncing in Progress Indicator */}
      {isOnline && isSyncing && (
        <div className="bg-[#1935CA] text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>Syncing your offline activity with cloud servers...</span>
          </div>
        </div>
      )}

      {/* 3. Pending Sync Items Banner (when online but queue has remaining items) */}
      {isOnline && !isSyncing && pendingSyncCount > 0 && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <CloudUpload className="w-4 h-4 shrink-0" />
            <span>
              {pendingSyncCount} offline action{pendingSyncCount === 1 ? '' : 's'} waiting to be synced.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => syncNow()}
              className="px-2.5 py-1 rounded-lg bg-white text-indigo-700 hover:bg-white/90 text-[11px] font-black transition-all active:scale-95"
            >
              Sync Now
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Dismiss sync banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Sync Success Toast */}
      {isOnline && !isSyncing && showSyncSuccess && lastSyncResult && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Successfully synced {lastSyncResult.synced} offline item{lastSyncResult.synced === 1 ? '' : 's'}!
            </span>
          </div>

          <button
            onClick={() => setShowSyncSuccess(false)}
            className="p-1 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
