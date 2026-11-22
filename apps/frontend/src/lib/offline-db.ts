// Offline IndexedDB Storage & Sync Queue Manager for QuizForge PWA

const DB_NAME = 'quizforge_offline_db';
const DB_VERSION = 1;

export interface OfflineQuizItem {
  id: string;
  topic: string;
  difficulty: string;
  questionCount: number;
  questions: Array<{
    id: string;
    questionOrder: number;
    questionText: string;
    correctChoiceId?: string;
    explanation?: string;
    choices: Array<{ choiceId: string; optionText: string }>;
  }>;
  savedAt: string;
}

export interface OfflineDeckItem {
  id: string;
  title: string;
  description: string | null;
  quizTitle?: string | null;
  totalCards: number;
  savedAt: string;
}

export interface OfflineCardItem {
  id: string;
  deckId: string;
  front: string;
  back: string;
  explanation: string | null;
  state: string;
  repetitionNumber: number;
  easinessFactor: number;
  intervalDays: number;
  dueDate: string;
}

export interface SyncQueueItem {
  id?: number;
  type: 'card_review' | 'quiz_submit';
  payload: any;
  createdAt: string;
}

class OfflineDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB is not supported in this environment'));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('quizzes')) {
          db.createObjectStore('quizzes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('decks')) {
          db.createObjectStore('decks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('flashcards')) {
          const cardStore = db.createObjectStore('flashcards', { keyPath: 'id' });
          cardStore.createIndex('deckId', 'deckId', { unique: false });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- Quiz Offline Cache ---

  async saveQuizOffline(quiz: OfflineQuizItem): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('quizzes', 'readwrite');
      tx.objectStore('quizzes').put(quiz);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getOfflineQuizzes(): Promise<OfflineQuizItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('quizzes', 'readonly');
      const req = tx.objectStore('quizzes').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getOfflineQuiz(id: string): Promise<OfflineQuizItem | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('quizzes', 'readonly');
      const req = tx.objectStore('quizzes').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async isQuizSavedOffline(id: string): Promise<boolean> {
    const quiz = await this.getOfflineQuiz(id);
    return quiz !== null;
  }

  async removeQuizOffline(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('quizzes', 'readwrite');
      tx.objectStore('quizzes').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Flashcard Deck Offline Cache ---

  async saveDeckOffline(deck: OfflineDeckItem, cards: OfflineCardItem[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['decks', 'flashcards'], 'readwrite');
      tx.objectStore('decks').put(deck);
      const cardStore = tx.objectStore('flashcards');
      for (const card of cards) {
        cardStore.put(card);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getOfflineDecks(): Promise<OfflineDeckItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('decks', 'readonly');
      const req = tx.objectStore('decks').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getOfflineDeckCards(deckId: string): Promise<OfflineCardItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('flashcards', 'readonly');
      const index = tx.objectStore('flashcards').index('deckId');
      const req = index.getAll(deckId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async isDeckSavedOffline(deckId: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('decks', 'readonly');
      const req = tx.objectStore('decks').get(deckId);
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  async removeDeckOffline(deckId: string): Promise<void> {
    const db = await this.getDB();
    const cards = await this.getOfflineDeckCards(deckId);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['decks', 'flashcards'], 'readwrite');
      tx.objectStore('decks').delete(deckId);
      const cardStore = tx.objectStore('flashcards');
      for (const card of cards) {
        cardStore.delete(card.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Background Sync Queue ---

  async enqueueSyncItem(type: 'card_review' | 'quiz_submit', payload: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').add({
        type,
        payload,
        createdAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const req = tx.objectStore('sync_queue').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async removeSyncItem(id: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingSyncCount(): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const req = tx.objectStore('sync_queue').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineDb = new OfflineDatabase();
