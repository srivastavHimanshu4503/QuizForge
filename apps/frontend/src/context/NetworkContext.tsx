import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { offlineDb } from '../lib/offline-db';
import { apiClient } from '../api/client';

interface NetworkContextType {
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncResult: { synced: number; failed: number } | null;
  syncNow: () => Promise<void>;
  saveQuizForOffline: (quizId: string) => Promise<boolean>;
  saveDeckForOffline: (deckId: string) => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(
    null
  );

  // Update pending queue count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await offlineDb.getPendingSyncCount();
      setPendingSyncCount(count);
    } catch {
      // ignore
    }
  }, []);

  // Process sync queue
  const syncNow = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;

    try {
      setIsSyncing(true);
      const queue = await offlineDb.getPendingSyncQueue();
      let synced = 0;
      let failed = 0;

      for (const item of queue) {
        try {
          if (item.type === 'card_review') {
            await apiClient.post(
              `/api/flashcards/cards/${item.payload.cardId}/review`,
              { rating: item.payload.rating }
            );
          } else if (item.type === 'quiz_submit') {
            await apiClient.post(
              `/api/attempts/${item.payload.attemptId}/submit`,
              item.payload.submission
            );
          }
          if (item.id !== undefined) {
            await offlineDb.removeSyncItem(item.id);
          }
          synced++;
        } catch {
          failed++;
        }
      }

      setLastSyncResult({ synced, failed });
      await refreshPendingCount();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  // Online / Offline Listeners & Service Worker Registration
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial queue check
    refreshPendingCount();

    // Register PWA Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // Check for worker updates
          reg.update();
        })
        .catch(() => {
          // SW registration failed (e.g. self-signed cert or private browsing)
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncNow, refreshPendingCount]);

  // Save Quiz for Offline Access
  const saveQuizForOffline = async (quizId: string): Promise<boolean> => {
    try {
      const res = await apiClient.get<any>(`/api/quizzes/${quizId}`);
      const quizData = res.data || res;
      await offlineDb.saveQuizOffline({
        id: quizData.id,
        topic: quizData.topic,
        difficulty: quizData.difficulty,
        questionCount: quizData.questionCount || quizData.questions?.length || 0,
        questions: quizData.questions || [],
        savedAt: new Date().toISOString(),
      });
      return true;
    } catch {
      return false;
    }
  };

  // Save Flashcard Deck for Offline Access
  const saveDeckForOffline = async (deckId: string): Promise<boolean> => {
    try {
      const [deck, cards] = await Promise.all([
        apiClient.get<any>(`/api/flashcards/decks/${deckId}`),
        apiClient.get<any[]>(`/api/flashcards/decks/${deckId}/study?mode=all`),
      ]);

      await offlineDb.saveDeckOffline(
        {
          id: deck.id,
          title: deck.title,
          description: deck.description,
          quizTitle: deck.quizTitle,
          totalCards: cards.length,
          savedAt: new Date().toISOString(),
        },
        cards.map((c) => ({
          id: c.id,
          deckId: c.deckId,
          front: c.front,
          back: c.back,
          explanation: c.explanation,
          state: c.state,
          repetitionNumber: c.repetitionNumber,
          easinessFactor: c.easinessFactor,
          intervalDays: c.intervalDays,
          dueDate: c.dueDate,
        }))
      );
      return true;
    } catch {
      return false;
    }
  };

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        pendingSyncCount,
        isSyncing,
        lastSyncResult,
        syncNow,
        saveQuizForOffline,
        saveDeckForOffline,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
