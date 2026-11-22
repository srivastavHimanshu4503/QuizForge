import { useState, useEffect, useCallback } from 'react';
import { ActiveAttempt, AttemptResult, ChoiceId } from '@quiz-forge/shared';
import { apiClient, ApiError } from '../api/client';

export type AutosaveStatus = 'saved' | 'saving' | 'error';

interface CachedAttemptData {
  attempt: ActiveAttempt;
  answers: Record<string, ChoiceId | null>;
  savedAt: number;
}

export function useQuizAttempt(attemptId: string) {
  const storageKey = `quizforge_attempt_${attemptId}`;

  // Read initial cached state from localStorage if available
  const getInitialCache = (): CachedAttemptData | null => {
    if (!attemptId) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        return JSON.parse(raw) as CachedAttemptData;
      }
    } catch {
      // Ignore JSON error
    }
    return null;
  };

  const initialCache = getInitialCache();

  const [attempt, setAttempt] = useState<ActiveAttempt | null>(initialCache?.attempt || null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, ChoiceId | null>>(
    initialCache?.answers || initialCache?.attempt?.savedAnswers || {}
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialCache?.attempt);
  const [error, setError] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('saved');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(
    initialCache?.attempt?.tabSwitchCount || 0
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isTimedOut, setIsTimedOut] = useState<boolean>(false);
  const [lastFocusWarning, setLastFocusWarning] = useState<string | null>(null);

  const fetchAttempt = useCallback(async () => {
    if (!attemptId) return;

    // Only show full loading spinner if we don't already have questions from local storage
    if (!attempt) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await apiClient.get<ActiveAttempt>(`/api/attempts/${attemptId}`);
      setAttempt(data);
      if (data.tabSwitchCount !== undefined) {
        setTabSwitchCount((prev) => Math.max(prev, data.tabSwitchCount || 0));
      }

      setAnswers((prevLocal) => {
        // Merge server saved answers with any newer local unsaved selections
        const mergedAnswers = { ...(data.savedAnswers || {}), ...prevLocal };

        // Keep local cache in sync
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              attempt: data,
              answers: mergedAnswers,
              savedAt: Date.now(),
            })
          );
          localStorage.setItem(
            'quizforge_last_active_attempt',
            JSON.stringify({
              attemptId,
              topic: data.topic,
              totalQuestions: data.totalQuestions,
              updatedAt: Date.now(),
            })
          );
        } catch {
          // Ignore quota errors
        }

        return mergedAnswers;
      });
    } catch (err: unknown) {
      // If we already have a cached copy of the attempt in localStorage, keep displaying it!
      const fallbackCache = getInitialCache();
      if (fallbackCache?.attempt) {
        setAttempt(fallbackCache.attempt);
        setAnswers(fallbackCache.answers);
        setError(null);
      } else {
        const msg = err instanceof ApiError ? err.message : 'Failed to load quiz attempt.';
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [attemptId, storageKey]);

  useEffect(() => {
    fetchAttempt();
  }, [fetchAttempt]);

  // Timed Quiz countdown timer
  useEffect(() => {
    if (!attempt || !attempt.timeLimitMinutes || !attempt.startedAt || attempt.status !== 'in_progress') {
      setRemainingSeconds(null);
      return;
    }

    const startedTime = new Date(attempt.startedAt).getTime();
    const totalAllowedMs = attempt.timeLimitMinutes * 60 * 1000;
    const expiresAt = startedTime + totalAllowedMs;

    const updateTimer = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setRemainingSeconds(diffSec);

      if (diffSec <= 0) {
        setIsTimedOut(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [attempt?.timeLimitMinutes, attempt?.startedAt, attempt?.status]);

  // Academic Integrity: Focus loss & Tab-blur detection
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;

    let lastSwitchTime = 0;

    const handleFocusLoss = () => {
      const now = Date.now();
      // Debounce focus loss within 1500ms
      if (now - lastSwitchTime < 1500) return;
      lastSwitchTime = now;

      setTabSwitchCount((prev) => {
        const next = prev + 1;
        setLastFocusWarning(`Exam window lost focus. Integrity violation #${next} logged.`);

        apiClient
          .post(`/api/attempts/${attemptId}/integrity-event`, { tabSwitchCount: next })
          .catch(() => {});

        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFocusLoss();
      }
    };

    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleFocusLoss);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [attempt?.status, attemptId]);

  const goToQuestion = (index: number) => {
    if (!attempt || index < 0 || index >= attempt.questions.length) return;
    setCurrentIndex(index);
  };

  const prevQuestion = () => {
    goToQuestion(currentIndex - 1);
  };

  const nextQuestion = () => {
    goToQuestion(currentIndex + 1);
  };

  const selectOption = async (questionId: string, choiceId: ChoiceId) => {
    // If the same option is already selected, allow toggling off or keeping
    const newChoice: ChoiceId | null = answers[questionId] === choiceId ? null : choiceId;

    const updatedAnswers = {
      ...answers,
      [questionId]: newChoice,
    };

    // Optimistic UI update
    setAnswers(updatedAnswers);
    setAutosaveStatus('saving');

    // Immediately persist to browser localStorage so progress is NEVER lost during dev or disconnects
    try {
      if (attempt) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            attempt,
            answers: updatedAnswers,
            savedAt: Date.now(),
          })
        );
        localStorage.setItem(
          'quizforge_last_active_attempt',
          JSON.stringify({
            attemptId,
            topic: attempt.topic,
            totalQuestions: attempt.totalQuestions,
            updatedAt: Date.now(),
          })
        );
      }
    } catch {
      // Ignore quota errors
    }

    try {
      await apiClient.patch<{ questionId: string; selectedChoiceId: ChoiceId | null }>(
        `/api/attempts/${attemptId}/answers`,
        {
          questionId,
          selectedChoiceId: newChoice,
        }
      );
      setAutosaveStatus('saved');
    } catch {
      // Locally preserved even if server call drops
      setAutosaveStatus('saved');
    }
  };

  const submitQuiz = async (options?: { isTimedOut?: boolean }): Promise<AttemptResult> => {
    setIsSubmitting(true);
    try {
      // Before submitting, ensure any locally held answers are pushed to the backend
      for (const [qId, choice] of Object.entries(answers)) {
        if (choice) {
          try {
            await apiClient.patch(`/api/attempts/${attemptId}/answers`, {
              questionId: qId,
              selectedChoiceId: choice,
            });
          } catch {
            // Already synced or harmless
          }
        }
      }

      const result = await apiClient.post<AttemptResult>(`/api/attempts/${attemptId}/submit`, {
        isTimedOut: Boolean(options?.isTimedOut || isTimedOut),
        tabSwitchCount,
      });

      // Clear cached draft from localStorage on successful completion
      try {
        localStorage.removeItem(storageKey);
        const lastActive = localStorage.getItem('quizforge_last_active_attempt');
        if (lastActive) {
          const parsed = JSON.parse(lastActive);
          if (parsed.attemptId === attemptId) {
            localStorage.removeItem('quizforge_last_active_attempt');
          }
        }
      } catch {
        // Safe fallback
      }

      return result;
    } catch (err: unknown) {
      setIsSubmitting(false);
      throw err;
    }
  };

  const totalQuestions = attempt?.totalQuestions ?? 0;
  const currentQuestion = attempt?.questions[currentIndex] ?? null;

  // Count distinct questions answered with a non-null choice
  const answeredQuestionIds = new Set(
    Object.entries(answers)
      .filter(([, val]) => val !== null && val !== undefined)
      .map(([qId]) => qId)
  );

  const answeredCount = attempt?.questions.filter((q) =>
    answeredQuestionIds.has(q.question_id)
  ).length ?? 0;

  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const isLastQuestion = totalQuestions > 0 && currentIndex === totalQuestions - 1;
  const isFirstQuestion = currentIndex === 0;
  const progressPercentage =
    totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;

  return {
    attempt,
    currentQuestion,
    currentIndex,
    totalQuestions,
    answers,
    isLoading,
    error,
    autosaveStatus,
    isSubmitting,
    isSubmitModalOpen,
    isFirstQuestion,
    isLastQuestion,
    answeredCount,
    unansweredCount,
    progressPercentage,
    remainingSeconds,
    tabSwitchCount,
    isTimedOut,
    lastFocusWarning,
    dismissFocusWarning: () => setLastFocusWarning(null),
    goToQuestion,
    prevQuestion,
    nextQuestion,
    selectOption,
    submitQuiz,
    openSubmitModal: () => setIsSubmitModalOpen(true),
    closeSubmitModal: () => setIsSubmitModalOpen(false),
    refetch: fetchAttempt,
  };
}
