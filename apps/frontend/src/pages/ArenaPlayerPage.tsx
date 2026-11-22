import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArenaStateDto,
  ArenaWsServerMessage,
  ChoiceId,
} from '@quiz-forge/shared';
import { apiClient } from '../api/client';
import {
  Loader2,
  Trophy,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

export function ArenaPlayerPage() {
  const { pin } = useParams<{ pin: string }>();
  const [searchParams] = useSearchParams();

  const participantId =
    searchParams.get('participantId') || (pin ? localStorage.getItem(`arena_part_${pin}`) : null);
  const nickname =
    searchParams.get('nickname') || (pin ? localStorage.getItem(`arena_nick_${pin}`) : null) || 'Warrior';

  const [state, setState] = useState<ArenaStateDto | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<ChoiceId | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [lastSubmissionResult, setLastSubmissionResult] = useState<{
    isCorrect: boolean;
    pointsAwarded: number;
    newScore: number;
    newStreak: number;
  } | null>(null);

  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const wsRef = useRef<WebSocket | null>(null);

  // Poll state as fallback
  const fetchState = useCallback(async () => {
    if (!pin) return;
    try {
      const data = await apiClient.get<ArenaStateDto>(`/api/arena/${pin}/state`);
      setState(data);
    } catch {
      // ignore transient poll error
    }
  }, [pin]);

  // WebSocket Connection
  useEffect(() => {
    if (!pin || !participantId) return;

    fetchState();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/arena/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'JOIN', pin, participantId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ArenaWsServerMessage;
        if (msg.type === 'STATE_UPDATE') {
          setState(msg.state);
        } else if (msg.type === 'QUESTION_START') {
          setSelectedChoice(null);
          setHasSubmitted(false);
          setLastSubmissionResult(null);
          setQuestionStartTime(Date.now());
          setTimeLeft(msg.question.timeLimitSeconds);
          fetchState();
        } else if (msg.type === 'QUESTION_END' || msg.type === 'GAME_OVER') {
          fetchState();
        }
      } catch {
        // parse error
      }
    };

    const pollTimer = setInterval(fetchState, 3000);

    return () => {
      clearInterval(pollTimer);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [pin, participantId, fetchState]);

  // Question Countdown Effect
  useEffect(() => {
    if (state?.status !== 'question') return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
      const remaining = Math.max(0, (state.currentQuestion?.timeLimitSeconds ?? 30) - elapsed);
      setTimeLeft(remaining);
    }, 500);

    return () => clearInterval(timer);
  }, [state?.status, state?.currentQuestion, questionStartTime]);

  // Final Celebration Confetti
  useEffect(() => {
    if (state?.status === 'finished') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [state?.status]);

  // Reset answer states on new question
  useEffect(() => {
    if (state?.status === 'question') {
      setSelectedChoice(null);
      setHasSubmitted(false);
      setLastSubmissionResult(null);
      setQuestionStartTime(Date.now());
      setTimeLeft(state.currentQuestion?.timeLimitSeconds ?? 30);
    }
  }, [state?.currentQuestion?.questionId]);

  if (!participantId || !pin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold mb-2">Participant session not found</h2>
        <Link to="/arena" className="text-xs font-bold text-[#1935CA] hover:underline">
          Return to Join Arena
        </Link>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B1120] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-[#1935CA] animate-spin mb-4" />
        <h2 className="text-xl font-extrabold text-[#1E293B] dark:text-white">Connecting to Battle Room...</h2>
        <p className="text-xs text-[#696F79] dark:text-slate-400 mt-1">Room PIN: {pin}</p>
      </div>
    );
  }

  // Find this player in participant list
  const me = state.participants.find((p) => p.id === participantId);
  const myRank = me?.rank ?? '-';
  const myScore = me?.score ?? 0;
  const myStreak = me?.streak ?? 0;

  const handleSelectChoice = async (choiceId: ChoiceId) => {
    if (hasSubmitted || state.status !== 'question' || !state.currentQuestion) return;

    const responseTimeMs = Date.now() - questionStartTime;
    setSelectedChoice(choiceId);
    setHasSubmitted(true);

    try {
      // Send via WebSocket or fallback REST
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'SUBMIT_ANSWER',
            pin,
            participantId,
            questionId: state.currentQuestion.questionId,
            selectedChoiceId: choiceId,
            responseTimeMs,
          })
        );
      }

      const res = await apiClient.post<{
        isCorrect: boolean;
        pointsAwarded: number;
        newScore: number;
        newStreak: number;
      }>(`/api/arena/${pin}/answer`, {
        participantId,
        questionId: state.currentQuestion.questionId,
        selectedChoiceId: choiceId,
        responseTimeMs,
      });

      setLastSubmissionResult(res);
      fetchState();
    } catch {
      // already submitted or network hiccup
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B1120] text-[#1E293B] dark:text-[#F8FAFC] flex flex-col justify-between transition-colors duration-200">
      {/* Top HUD Bar */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#1935CA] text-white flex items-center justify-center font-bold text-sm shadow-md shadow-[#1935CA]/20">
            Q
          </div>
          <div>
            <span className="text-xs font-black text-[#1E293B] dark:text-white block leading-tight">
              {nickname}
            </span>
            <span className="text-[10px] text-[#696F79] dark:text-slate-400 font-mono">
              PIN: {pin}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {myStreak > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/20">
              <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>{myStreak} Streak</span>
            </div>
          )}

          <div className="px-3 py-1 rounded-xl bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8] font-bold text-xs">
            Score: <span className="font-extrabold">{myScore}</span>
          </div>

          <div className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs">
            Rank: #{myRank}
          </div>
        </div>
      </header>

      {/* Main Dynamic Viewport */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col justify-center">
        {/* State 1: LOBBY */}
        {state.status === 'lobby' && (
          <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#1935CA] to-indigo-500 text-white flex items-center justify-center text-3xl font-black mx-auto shadow-2xl shadow-[#1935CA]/30 animate-pulse">
              {nickname.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1E293B] dark:text-white">
                You're in the Battle, {nickname}!
              </h2>
              <p className="text-xs text-[#696F79] dark:text-slate-400 font-medium max-w-sm mx-auto mt-1">
                See your name on the host's screen? Get ready to answer fast and build your streak.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-xl max-w-xs mx-auto space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Topic
              </span>
              <p className="text-sm font-bold text-[#1935CA] dark:text-[#38BDF8]">
                {state.quizTopic}
              </p>
              <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Waiting for host to start...</span>
              </div>
            </div>
          </div>
        )}

        {/* State 2: QUESTION */}
        {state.status === 'question' && state.currentQuestion && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Question Progress & Timer */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#696F79] dark:text-slate-400">
                Question {state.currentQuestion.index} of {state.currentQuestion.total}
              </span>
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${
                  timeLeft <= 5
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{timeLeft}s</span>
              </div>
            </div>

            {/* Question Header */}
            <div className="p-6 rounded-[22px] bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-xl text-center space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC]">
                {state.currentQuestion.questionText}
              </h3>
            </div>

            {/* 4 Colored Kahoot-Style Answer Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {state.currentQuestion.choices.map((choice) => {
                const isSelected = selectedChoice === choice.choice_id;
                let colorClass = '';

                if (choice.choice_id === 'A') {
                  colorClass = isSelected
                    ? 'bg-rose-700 text-white ring-4 ring-rose-400'
                    : 'bg-rose-600 hover:bg-rose-700 text-white';
                } else if (choice.choice_id === 'B') {
                  colorClass = isSelected
                    ? 'bg-blue-800 text-white ring-4 ring-blue-400'
                    : 'bg-[#1935CA] hover:bg-[#142BA3] text-white';
                } else if (choice.choice_id === 'C') {
                  colorClass = isSelected
                    ? 'bg-amber-700 text-white ring-4 ring-amber-400'
                    : 'bg-amber-600 hover:bg-amber-700 text-white';
                } else {
                  colorClass = isSelected
                    ? 'bg-emerald-800 text-white ring-4 ring-emerald-400'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white';
                }

                return (
                  <button
                    key={choice.choice_id}
                    type="button"
                    disabled={hasSubmitted}
                    onClick={() => handleSelectChoice(choice.choice_id)}
                    className={`p-5 rounded-2xl font-bold text-sm sm:text-base text-left shadow-lg transition-all duration-150 active:scale-98 disabled:opacity-80 flex items-center justify-between ${colorClass}`}
                  >
                    <span>{choice.option_text}</span>
                    <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-mono font-extrabold text-xs shrink-0 ml-3">
                      {choice.choice_id}
                    </span>
                  </button>
                );
              })}
            </div>

            {hasSubmitted && (
              <div className="p-4 rounded-xl bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8] text-center text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Answer locked in! Waiting for time expiration or other players...</span>
              </div>
            )}
          </div>
        )}

        {/* State 3: LEADERBOARD / QUESTION END */}
        {state.status === 'leaderboard' && (
          <div className="text-center space-y-6 animate-in zoom-in-95 duration-200">
            {lastSubmissionResult?.isCorrect ? (
              <div className="p-6 rounded-[24px] bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                <h3 className="text-2xl font-black">CORRECT!</h3>
                <p className="text-sm font-bold">
                  +{lastSubmissionResult.pointsAwarded} Points Awarded
                </p>
                {lastSubmissionResult.newStreak > 1 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-extrabold">
                    <Flame className="w-3.5 h-3.5 fill-amber-500" />
                    <span>{lastSubmissionResult.newStreak} Correct Streak!</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-[24px] bg-rose-500/10 border-2 border-rose-500/40 text-rose-700 dark:text-rose-400 space-y-2">
                <XCircle className="w-12 h-12 mx-auto text-rose-500" />
                <h3 className="text-2xl font-black">INCORRECT</h3>
                <p className="text-xs font-medium">Streak reset. Get ready for the next question!</p>
              </div>
            )}

            <div className="p-5 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-xl max-w-sm mx-auto space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Your Current Standings
              </span>
              <div className="flex items-center justify-around py-2">
                <div>
                  <span className="text-xs text-slate-400 block">Rank</span>
                  <strong className="text-2xl font-black text-[#1935CA] dark:text-[#38BDF8]">
                    #{myRank}
                  </strong>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Total Score</span>
                  <strong className="text-2xl font-black text-[#1E293B] dark:text-white">
                    {myScore}
                  </strong>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Next question coming up shortly...</span>
            </p>
          </div>
        )}

        {/* State 4: FINISHED / PODIUM */}
        {state.status === 'finished' && (
          <div className="text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 text-white flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/30">
              <Trophy className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-3xl font-black text-[#1E293B] dark:text-white">
                Battle Finished!
              </h2>
              <p className="text-xs text-[#696F79] dark:text-slate-400 font-medium max-w-sm mx-auto mt-1">
                Great match! Here is your final placement in this live arena battle.
              </p>
            </div>

            <div className="p-6 rounded-[24px] bg-white dark:bg-[#151C2C] border-2 border-amber-500/30 dark:border-amber-500/40 shadow-2xl max-w-sm mx-auto space-y-3">
              <span className="text-xs font-extrabold uppercase px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                Final Result
              </span>
              <p className="text-3xl font-black text-[#1935CA] dark:text-[#38BDF8]">
                Rank #{myRank}
              </p>
              <p className="text-sm font-bold text-[#1E293B] dark:text-slate-200">
                Final Score: <strong className="text-lg">{myScore} pts</strong>
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/arena"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] text-white font-bold text-xs shadow-lg shadow-[#1935CA]/20 transition active:scale-98"
              >
                <span>Play Another Arena</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Footer */}
      <footer className="text-center py-4 text-xs text-slate-400">
        QuizForge Real-Time Arena Engine
      </footer>
    </div>
  );
}
