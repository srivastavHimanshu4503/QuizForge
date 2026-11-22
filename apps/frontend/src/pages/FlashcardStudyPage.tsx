import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { offlineDb } from '../lib/offline-db';
import confetti from 'canvas-confetti';
import type {
  FlashcardCardDto,
  FlashcardDeckDto,
  FlashcardRating,
  FlashcardReviewResultDto,
} from '@quiz-forge/shared';
import {
  ArrowLeft,
  RotateCw,
  Award,
  Volume2,
  Square,
} from 'lucide-react';
import { useAudioTutor } from '../context/AudioContext';

export function FlashcardStudyPage() {
  const { deckId } = useParams<{ deckId: string }>();

  const [deck, setDeck] = useState<FlashcardDeckDto | null>(null);
  const [cards, setCards] = useState<FlashcardCardDto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studyMode, setStudyMode] = useState<'due' | 'all'>('due');

  // Session summary counters
  const [sessionResults, setSessionResults] = useState<{
    again: number;
    hard: number;
    good: number;
    easy: number;
  }>({ again: 0, hard: 0, good: 0, easy: 0 });

  const [isComplete, setIsComplete] = useState(false);

  const { speak, stopSpeaking, isSpeaking, isSupported: isAudioSupported } = useAudioTutor();

  const handleSpeakCardText = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speak(text);
    }
  };

  const fetchSession = useCallback(async () => {
    if (!deckId) return;
    try {
      setLoading(true);
      const [deckData, cardsData] = await Promise.all([
        apiClient.get<FlashcardDeckDto>(`/api/flashcards/decks/${deckId}`),
        apiClient.get<FlashcardCardDto[]>(`/api/flashcards/decks/${deckId}/study?mode=${studyMode}`),
      ]);
      setDeck(deckData);
      setCards(cardsData);
      setCurrentIndex(0);
      setIsFlipped(false);
      setIsComplete(cardsData.length === 0);
    } catch {
      // Offline fallback: load cards cached in IndexedDB
      try {
        const cachedCards = await offlineDb.getOfflineDeckCards(deckId);
        if (cachedCards && cachedCards.length > 0) {
          setCards(cachedCards as any);
          setCurrentIndex(0);
          setIsFlipped(false);
          setIsComplete(false);
        }
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }, [deckId, studyMode]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const currentCard = cards[currentIndex];

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleRate = async (rating: FlashcardRating) => {
    if (!currentCard || submitting) return;

    try {
      setSubmitting(true);
      if (navigator.onLine) {
        await apiClient.post<FlashcardReviewResultDto>(`/api/flashcards/cards/${currentCard.id}/review`, {
          rating,
        });
      } else {
        await offlineDb.enqueueSyncItem('card_review', {
          cardId: currentCard.id,
          rating,
        });
      }

      // Update counters
      setSessionResults((prev) => ({
        ...prev,
        again: rating === 1 ? prev.again + 1 : prev.again,
        hard: rating === 2 ? prev.hard + 1 : prev.hard,
        good: rating === 3 ? prev.good + 1 : prev.good,
        easy: rating === 4 ? prev.easy + 1 : prev.easy,
      }));

      // Advance to next card or complete
      if (currentIndex + 1 < cards.length) {
        setIsFlipped(false);
        setCurrentIndex((i) => i + 1);
      } else {
        setIsComplete(true);
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } catch {
      // Network failure fallback: queue review for sync
      await offlineDb.enqueueSyncItem('card_review', {
        cardId: currentCard.id,
        rating,
      });

      if (currentIndex + 1 < cards.length) {
        setIsFlipped(false);
        setCurrentIndex((i) => i + 1);
      } else {
        setIsComplete(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcut trigger when typing in inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (isFlipped && !submitting) {
        if (e.key === '1') handleRate(1);
        else if (e.key === '2') handleRate(2);
        else if (e.key === '3') handleRate(3);
        else if (e.key === '4') handleRate(4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, submitting, currentCard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0F19] flex items-center justify-center p-6 text-slate-400 text-sm">
        Preparing your spaced repetition study deck...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0F19] text-[#1E293B] dark:text-[#F8FAFC] flex flex-col justify-between transition-colors duration-200">
      {/* Top Header Bar */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#151C2C]/90 backdrop-blur-md px-4 sm:px-8 h-16 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/flashcards"
            className="p-2 rounded-xl text-slate-500 hover:text-[#1935CA] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-[#1E293B] dark:text-white line-clamp-1">
              {deck?.title || 'Flashcards'}
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              SM-2 Spaced Repetition Mode
            </span>
          </div>
        </div>

        {/* Progress & Study Mode Switcher */}
        <div className="flex items-center gap-3">
          {!isComplete && cards.length > 0 && (
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
              Card <span className="text-[#1935CA] dark:text-[#38BDF8]">{currentIndex + 1}</span> of{' '}
              {cards.length}
            </div>
          )}

          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-bold">
            <button
              onClick={() => setStudyMode('due')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                studyMode === 'due'
                  ? 'bg-white dark:bg-slate-700 text-[#1935CA] dark:text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Due
            </button>
            <button
              onClick={() => setStudyMode('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                studyMode === 'all'
                  ? 'bg-white dark:bg-slate-700 text-[#1935CA] dark:text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </header>

      {/* Main Study Arena */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 flex flex-col justify-center items-center">
        {isComplete || !currentCard ? (
          /* Session Complete Screen */
          <div className="w-full max-w-md text-center p-8 rounded-3xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
              <Award className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-[#1E293B] dark:text-white">Session Complete!</h2>
              <p className="text-xs text-[#696F79] dark:text-slate-400 mt-1">
                {cards.length === 0
                  ? 'All caught up! No flashcards are due for review right now.'
                  : `You reviewed ${cards.length} card${cards.length === 1 ? '' : 's'} in this session.`}
              </p>
            </div>

            {cards.length > 0 && (
              <div className="grid grid-cols-4 gap-2 py-3 border-y border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <span className="text-[10px] font-bold block uppercase">Again</span>
                  <span className="text-lg font-black">{sessionResults.again}</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <span className="text-[10px] font-bold block uppercase">Hard</span>
                  <span className="text-lg font-black">{sessionResults.hard}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8]">
                  <span className="text-[10px] font-bold block uppercase">Good</span>
                  <span className="text-lg font-black">{sessionResults.good}</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <span className="text-[10px] font-bold block uppercase">Easy</span>
                  <span className="text-lg font-black">{sessionResults.easy}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 justify-center pt-2">
              <button
                onClick={() => {
                  setStudyMode('all');
                  fetchSession();
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Review All Again
              </button>
              <Link
                to="/flashcards"
                className="px-5 py-2.5 rounded-xl bg-[#1935CA] text-white text-xs font-bold shadow-md shadow-[#1935CA]/20 hover:bg-[#1935CA]/90 transition-all"
              >
                Back to Decks
              </Link>
            </div>
          </div>
        ) : (
          /* Active Card Review View */
          <div className="w-full space-y-6">
            {/* Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-[#1935CA] transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
              />
            </div>

            {/* 3D Flip Card Container */}
            <div
              onClick={handleFlip}
              className="w-full min-h-[380px] cursor-pointer select-none"
              style={{ perspective: '1200px' }}
            >
              <div
                className="relative w-full min-h-[380px] rounded-3xl transition-transform duration-500 shadow-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#151C2C]"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* FRONT FACE */}
                <div
                  className="absolute inset-0 p-8 flex flex-col justify-between rounded-3xl bg-white dark:bg-[#151C2C]"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        currentCard.state === 'mastered'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : currentCard.state === 'review'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : currentCard.state === 'learning'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      {currentCard.state} card
                    </span>

                    <div className="flex items-center gap-2">
                      {isAudioSupported && (
                        <button
                          type="button"
                          onClick={(e) => handleSpeakCardText(e, currentCard.front)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title={isSpeaking ? 'Stop audio' : 'Listen to card prompt'}
                          aria-label={isSpeaking ? 'Stop audio' : 'Listen to card prompt'}
                        >
                          {isSpeaking ? <Square className="w-3.5 h-3.5 text-rose-500 fill-current" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <span className="text-[11px] font-mono text-slate-400 font-bold">
                        Repetition: #{currentCard.repetitionNumber}
                      </span>
                    </div>
                  </div>

                  <div className="my-auto text-center py-6">
                    <p className="text-xl sm:text-2xl font-black text-[#1E293B] dark:text-white leading-relaxed whitespace-pre-line">
                      {currentCard.front}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400">
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Click or press Space to reveal answer</span>
                  </div>
                </div>

                {/* BACK FACE */}
                <div
                  className="absolute inset-0 p-8 flex flex-col justify-between rounded-3xl bg-slate-50 dark:bg-[#111726] border border-indigo-500/20"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/10 text-[#1935CA] dark:text-[#38BDF8]">
                      Answer Revealed
                    </span>
                    <div className="flex items-center gap-2">
                      {isAudioSupported && (
                        <button
                          type="button"
                          onClick={(e) =>
                            handleSpeakCardText(
                              e,
                              `${currentCard.back}. ${currentCard.explanation || ''}`
                            )
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
                          title={isSpeaking ? 'Stop audio' : 'Listen to card answer'}
                          aria-label={isSpeaking ? 'Stop audio' : 'Listen to card answer'}
                        >
                          {isSpeaking ? (
                            <Square className="w-3.5 h-3.5 text-rose-500 fill-current" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                      <span className="text-[11px] font-mono text-slate-400 font-bold">
                        EF: {currentCard.easinessFactor.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="my-auto space-y-4 py-4 text-center">
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-sm inline-block max-w-full">
                      <p className="text-lg sm:text-xl font-black text-[#1935CA] dark:text-[#38BDF8] whitespace-pre-line">
                        {currentCard.back}
                      </p>
                    </div>

                    {currentCard.explanation && (
                      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-left max-w-lg mx-auto">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Explanation
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          {currentCard.explanation}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="text-center text-xs font-semibold text-slate-400">
                    How well did you remember this?
                  </div>
                </div>
              </div>
            </div>

            {/* SM-2 Rating Button Controls */}
            {isFlipped && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-3 duration-150">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRate(1);
                  }}
                  disabled={submitting}
                  className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-xs flex flex-col items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="text-sm font-black">1. Again</span>
                  <span className="text-[10px] font-semibold opacity-75">&lt; 1 day</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRate(2);
                  }}
                  disabled={submitting}
                  className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold text-xs flex flex-col items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="text-sm font-black">2. Hard</span>
                  <span className="text-[10px] font-semibold opacity-75">+ 1 day</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRate(3);
                  }}
                  disabled={submitting}
                  className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-[#1935CA] dark:text-[#38BDF8] font-bold text-xs flex flex-col items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="text-sm font-black">3. Good</span>
                  <span className="text-[10px] font-semibold opacity-75">+ 6 days</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRate(4);
                  }}
                  disabled={submitting}
                  className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex flex-col items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="text-sm font-black">4. Easy</span>
                  <span className="text-[10px] font-semibold opacity-75">+ 8+ days</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
