import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { apiClient } from '../api/client';
import { offlineDb } from '../lib/offline-db';
import { useNetwork } from '../context/NetworkContext';
import type {
  FlashcardDeckDto,
  FlashcardStatsDto,
} from '@quiz-forge/shared';
import {
  Layers,
  Flame,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Library,
  X,
  Zap,
  Download,
  Check,
} from 'lucide-react';

export function FlashcardsPage() {
  const navigate = useNavigate();
  const { saveDeckForOffline } = useNetwork();
  const [stats, setStats] = useState<FlashcardStatsDto | null>(null);
  const [decks, setDecks] = useState<FlashcardDeckDto[]>([]);
  const [offlineSavedDecks, setOfflineSavedDecks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');

  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [selectedDeckForCard, setSelectedDeckForCard] = useState<string | null>(null);
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [cardExplanation, setCardExplanation] = useState('');

  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<Array<{ id: string; topic: string; questionCount: number }>>([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, decksData] = await Promise.all([
        apiClient.get<FlashcardStatsDto>('/api/flashcards/stats'),
        apiClient.get<FlashcardDeckDto[]>('/api/flashcards/decks'),
      ]);
      setStats(statsData);
      setDecks(decksData);

      // Check which decks are saved offline
      const offlineDecks = await offlineDb.getOfflineDecks();
      setOfflineSavedDecks(new Set(offlineDecks.map((d) => d.id)));
    } catch (err: any) {
      // Offline fallback: load cached decks from IndexedDB
      try {
        const offlineDecks = await offlineDb.getOfflineDecks();
        if (offlineDecks.length > 0) {
          setDecks(
            offlineDecks.map((d) => ({
              id: d.id,
              userId: '',
              title: d.title,
              description: d.description,
              quizId: null,
              quizTitle: d.quizTitle,
              totalCards: d.totalCards,
              dueCards: d.totalCards,
              newCards: 0,
              learningCards: 0,
              reviewCards: 0,
              masteredCards: 0,
              createdAt: d.savedAt,
              updatedAt: d.savedAt,
            }))
          );
          setOfflineSavedDecks(new Set(offlineDecks.map((d) => d.id)));
        } else {
          setMessage({ type: 'error', text: err.message || 'Failed to load flashcard decks.' });
        }
      } catch {
        setMessage({ type: 'error', text: err.message || 'Failed to load flashcard decks.' });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load quizzes for generation modal
  const openGenerateModal = async () => {
    try {
      setIsGenerateOpen(true);
      const res = await apiClient.get<any>('/api/quizzes');
      const list = Array.isArray(res) ? res : res.data || [];
      setAvailableQuizzes(list);
      if (list.length > 0) {
        setSelectedQuizId(list[0].id);
      }
    } catch {
      // fallback
    }
  };

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckTitle.trim()) return;

    try {
      setActionLoading(true);
      await apiClient.post('/api/flashcards/decks', {
        title: newDeckTitle.trim(),
        description: newDeckDesc.trim() || undefined,
      });
      setIsCreateDeckOpen(false);
      setNewDeckTitle('');
      setNewDeckDesc('');
      setMessage({ type: 'success', text: 'Flashcard deck created successfully!' });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create deck.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDeck = async (deckId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete deck "${title}"?`)) return;

    try {
      await apiClient.delete(`/api/flashcards/decks/${deckId}`);
      setMessage({ type: 'success', text: `Deck "${title}" deleted.` });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete deck.' });
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeckForCard || !cardFront.trim() || !cardBack.trim()) return;

    try {
      setActionLoading(true);
      await apiClient.post('/api/flashcards/cards', {
        deckId: selectedDeckForCard,
        front: cardFront.trim(),
        back: cardBack.trim(),
        explanation: cardExplanation.trim() || undefined,
      });
      setIsAddCardOpen(false);
      setCardFront('');
      setCardBack('');
      setCardExplanation('');
      setMessage({ type: 'success', text: 'Card added to deck!' });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add card.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportMistakes = async () => {
    try {
      setActionLoading(true);
      setMessage(null);
      const res = await apiClient.post<{ importedCount: number; deckId: string | null; message: string }>(
        '/api/flashcards/import-mistakes',
        {}
      );
      setMessage({
        type: res.importedCount > 0 ? 'success' : 'error',
        text: res.message,
      });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to import mistakes.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateFromQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) return;

    try {
      setActionLoading(true);
      const res = await apiClient.post<{ importedCount: number; deckId: string; title: string }>(
        '/api/flashcards/generate-from-quiz',
        { quizId: selectedQuizId }
      );
      setIsGenerateOpen(false);
      setMessage({
        type: 'success',
        text: `Created "${res.title}" with ${res.importedCount} flashcards!`,
      });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to generate deck from quiz.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppLayout activeNav="flashcards">
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Banner Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8] flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#1E293B] dark:text-white">
                Spaced Repetition Flashcards
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#696F79] dark:text-slate-400">
              SuperMemo SM-2 smart review algorithm to retain knowledge and turn mistakes into mastery.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleImportMistakes}
              disabled={actionLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs hover:bg-amber-500/20 transition-all border border-amber-500/20 active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>Import Quiz Mistakes</span>
            </button>

            <button
              onClick={openGenerateModal}
              disabled={actionLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-500/20 transition-all border border-indigo-500/20 active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate from Quiz</span>
            </button>

            <button
              onClick={() => setIsCreateDeckOpen(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1935CA] text-white font-bold text-xs shadow-md shadow-[#1935CA]/20 hover:bg-[#1935CA]/90 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Deck</span>
            </button>
          </div>
        </div>

        {/* Status Toast / Alert */}
        {message && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Retention & Progress Stats HUD */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8] flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Due Today
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white">
                  {stats.dueTodayCount}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Mastered
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white">
                  {stats.masteredCount}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Day Streak
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white">
                  {stats.streakDays}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Library className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Cards
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white">
                  {stats.totalCards}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Decks Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1E293B] dark:text-white">Your Flashcard Decks</h2>
            <button
              onClick={fetchData}
              className="text-xs font-semibold text-[#1935CA] dark:text-[#38BDF8] flex items-center gap-1 hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">Loading your flashcards...</div>
          ) : decks.length === 0 ? (
            <div className="py-16 px-4 text-center rounded-3xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8] flex items-center justify-center mx-auto">
                <Layers className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-bold text-[#1E293B] dark:text-white">No Flashcard Decks Yet</h3>
                <p className="text-xs text-[#696F79] dark:text-slate-400">
                  Transform your missed quiz questions into smart spaced repetition cards, or create custom decks.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleImportMistakes}
                  className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs hover:bg-amber-500/20 transition-all border border-amber-500/20"
                >
                  Import Past Mistakes
                </button>
                <button
                  onClick={() => setIsCreateDeckOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#1935CA] text-white font-bold text-xs hover:bg-[#1935CA]/90 transition-all"
                >
                  Create First Deck
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {decks.map((deck) => {
                const total = deck.totalCards || 1;
                const masteredPct = Math.round((deck.masteredCards / total) * 100);
                const reviewPct = Math.round((deck.reviewCards / total) * 100);
                const learningPct = Math.round((deck.learningCards / total) * 100);

                return (
                  <article
                    key={deck.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group"
                  >
                    <div>
                      {/* Top Row: Quiz Tag & Actions */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        {deck.quizTitle ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8] truncate max-w-[200px]">
                            {deck.quizTitle}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            Custom Deck
                          </span>
                        )}

                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={async () => {
                              const ok = await saveDeckForOffline(deck.id);
                              if (ok) {
                                setOfflineSavedDecks((prev) => new Set(prev).add(deck.id));
                                setMessage({ type: 'success', text: `Deck "${deck.title}" saved for offline practice!` });
                              }
                            }}
                            title={offlineSavedDecks.has(deck.id) ? 'Saved for offline' : 'Save for offline'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              offlineSavedDecks.has(deck.id)
                                ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-600'
                            }`}
                          >
                            {offlineSavedDecks.has(deck.id) ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDeckForCard(deck.id);
                              setIsAddCardOpen(true);
                            }}
                            title="Add card"
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-[#1935CA]"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDeck(deck.id, deck.title)}
                            title="Delete deck"
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 className="font-bold text-base text-[#1E293B] dark:text-white leading-snug line-clamp-1">
                        {deck.title}
                      </h3>
                      {deck.description && (
                        <p className="text-xs text-[#696F79] dark:text-slate-400 line-clamp-2 mt-1">
                          {deck.description}
                        </p>
                      )}

                      {/* Card Maturity Progress Bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-400">Maturity</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                            {masteredPct}% Mastered
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                          <div
                            style={{ width: `${masteredPct}%` }}
                            className="bg-emerald-500 h-full transition-all"
                            title={`Mastered: ${deck.masteredCards}`}
                          />
                          <div
                            style={{ width: `${reviewPct}%` }}
                            className="bg-purple-500 h-full transition-all"
                            title={`Review: ${deck.reviewCards}`}
                          />
                          <div
                            style={{ width: `${learningPct}%` }}
                            className="bg-amber-500 h-full transition-all"
                            title={`Learning: ${deck.learningCards}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <footer className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <div className="text-xs">
                        {deck.dueCards > 0 ? (
                          <span className="font-extrabold text-amber-600 dark:text-amber-400">
                            {deck.dueCards} card{deck.dueCards === 1 ? '' : 's'} due
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-400">
                            {deck.totalCards} cards total
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => navigate(`/flashcards/study/${deck.id}`)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                          deck.dueCards > 0
                            ? 'bg-[#1935CA] text-white hover:bg-[#1935CA]/90 shadow-sm shadow-[#1935CA]/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>{deck.dueCards > 0 ? 'Study Due' : 'Practice All'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Create Deck */}
      {isCreateDeckOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151C2C] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1E293B] dark:text-white">Create Flashcard Deck</h3>
              <button
                onClick={() => setIsCreateDeckOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDeck} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1E293B] dark:text-white mb-1">
                  Deck Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JavaScript Async & Promises"
                  value={newDeckTitle}
                  onChange={(e) => setNewDeckTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1935CA]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E293B] dark:text-white mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of what this deck covers..."
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1935CA]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateDeckOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newDeckTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-[#1935CA] text-white text-xs font-bold hover:bg-[#1935CA]/90 disabled:opacity-50"
                >
                  Create Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Custom Card */}
      {isAddCardOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151C2C] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1E293B] dark:text-white">Add Card to Deck</h3>
              <button
                onClick={() => setIsAddCardOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1E293B] dark:text-white mb-1">
                  Front (Prompt / Question) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="What is the concept or question?"
                  value={cardFront}
                  onChange={(e) => setCardFront(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1935CA]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E293B] dark:text-white mb-1">
                  Back (Answer) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="The correct solution or concept definition..."
                  value={cardBack}
                  onChange={(e) => setCardBack(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1935CA]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E293B] dark:text-white mb-1">
                  Explanation / Mnemonic (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Why this answer is correct or memory tip..."
                  value={cardExplanation}
                  onChange={(e) => setCardExplanation(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1935CA]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCardOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !cardFront.trim() || !cardBack.trim()}
                  className="px-5 py-2 rounded-xl bg-[#1935CA] text-white text-xs font-bold hover:bg-[#1935CA]/90 disabled:opacity-50"
                >
                  Add Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Generate from Quiz */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151C2C] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1E293B] dark:text-white">Generate Flashcard Deck</h3>
              <button
                onClick={() => setIsGenerateOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateFromQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1E293B] dark:text-white mb-1">
                  Select Quiz
                </label>
                {availableQuizzes.length === 0 ? (
                  <p className="text-xs text-slate-400">No quizzes found.</p>
                ) : (
                  <select
                    value={selectedQuizId}
                    onChange={(e) => setSelectedQuizId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1935CA]"
                  >
                    {availableQuizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.topic} ({q.questionCount} questions)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGenerateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedQuizId}
                  className="px-5 py-2 rounded-xl bg-[#1935CA] text-white text-xs font-bold hover:bg-[#1935CA]/90 disabled:opacity-50"
                >
                  Generate Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
