import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArenaStateDto,
  ArenaWsServerMessage,
  ChoiceId,
} from '@quiz-forge/shared';
import { apiClient, ApiError } from '../api/client';
import {
  Users,
  Play,
  ArrowRight,
  Clock,
  Trophy,
  Copy,
  Check,
  Flame,
  Loader2,
  Sparkles,
} from 'lucide-react';

export function ArenaHostPage() {
  const { pin } = useParams<{ pin: string }>();

  const [state, setState] = useState<ArenaStateDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const wsRef = useRef<WebSocket | null>(null);

  // Poll state as fallback
  const fetchState = useCallback(async () => {
    if (!pin) return;
    try {
      const data = await apiClient.get<ArenaStateDto>(`/api/arena/${pin}/state`);
      setState(data);
    } catch (err: any) {
      if (!state) {
        setError(err instanceof ApiError ? err.message : 'Failed to load arena state.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pin, state]);

  // WebSocket Connection
  useEffect(() => {
    if (!pin) return;

    fetchState();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/arena/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'HOST_CONNECT', pin, hostId: 'host' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ArenaWsServerMessage;
        if (msg.type === 'STATE_UPDATE') {
          setState(msg.state);
        } else if (msg.type === 'QUESTION_START') {
          setQuestionStartTime(Date.now());
          setTimeLeft(msg.question.timeLimitSeconds);
          fetchState();
        } else if (msg.type === 'PLAYER_JOINED' || msg.type === 'PLAYER_ANSWERED' || msg.type === 'GAME_OVER') {
          fetchState();
        }
      } catch {
        // ignore parse error
      }
    };

    const pollTimer = setInterval(fetchState, 3000);

    return () => {
      clearInterval(pollTimer);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [pin, fetchState]);

  // Countdown timer
  useEffect(() => {
    if (state?.status !== 'question') return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
      const remaining = Math.max(0, (state.currentQuestion?.timeLimitSeconds ?? 30) - elapsed);
      setTimeLeft(remaining);

      // When countdown reaches 0, host automatically ends question
      if (remaining === 0) {
        handleEndQuestion();
      }
    }, 500);

    return () => clearInterval(timer);
  }, [state?.status, state?.currentQuestion, questionStartTime]);

  // Final Celebration Confetti
  useEffect(() => {
    if (state?.status === 'finished') {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
      });
    }
  }, [state?.status]);

  // Reset timer on question change
  useEffect(() => {
    if (state?.status === 'question') {
      setQuestionStartTime(Date.now());
      setTimeLeft(state.currentQuestion?.timeLimitSeconds ?? 30);
    }
  }, [state?.currentQuestion?.questionId]);

  const copyPinToClipboard = () => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleStartGame = async () => {
    if (!pin) return;
    setIsAdvancing(true);
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'HOST_START_GAME', pin }));
      }
      const data = await apiClient.post<ArenaStateDto>(`/api/arena/${pin}/start`);
      setState(data);
    } catch (err: any) {
      alert(err instanceof ApiError ? err.message : 'Failed to start game.');
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleEndQuestion = async () => {
    if (!pin) return;
    setIsAdvancing(true);
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'HOST_END_QUESTION', pin }));
      }
      const data = await apiClient.post<ArenaStateDto>(`/api/arena/${pin}/end-question`);
      setState(data);
    } catch (err: any) {
      alert(err instanceof ApiError ? err.message : 'Failed to end question.');
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleNextQuestion = async () => {
    if (!pin) return;
    setIsAdvancing(true);
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'HOST_NEXT_QUESTION', pin }));
      }
      const data = await apiClient.post<ArenaStateDto>(`/api/arena/${pin}/next`);
      setState(data);
    } catch (err: any) {
      alert(err instanceof ApiError ? err.message : 'Failed to advance arena.');
    } finally {
      setIsAdvancing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-[#38BDF8] animate-spin mb-4" />
        <h2 className="text-xl font-bold">Setting Up Arena Projection Screen...</h2>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold mb-2">Arena Session Not Found</h2>
        <p className="text-xs text-slate-400 mb-6">{error || 'Unable to load room.'}</p>
        <Link to="/" className="px-5 py-2.5 rounded-xl bg-[#1935CA] text-xs font-bold text-white">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const answeredCount = state.participants.filter((p) => p.hasAnswered).length;
  const totalCount = state.participants.length;

  return (
    <div className="min-h-screen bg-[#0B1120] text-white flex flex-col justify-between selection:bg-[#38BDF8] selection:text-black">
      {/* Top Projector Banner */}
      <header className="border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur-md px-6 sm:px-10 h-20 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-[#1935CA] text-white flex items-center justify-center font-black text-xl shadow-lg shadow-[#1935CA]/30">
            Q
          </div>
          <div>
            <span className="text-sm font-black tracking-tight text-white block">
              QuizForge <span className="text-[#38BDF8]">Live Arena</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Topic: <strong className="text-slate-200">{state.quizTopic}</strong>
            </span>
          </div>
        </div>

        {/* Big PIN Display */}
        <div className="flex items-center gap-3">
          <div
            onClick={copyPinToClipboard}
            className="flex items-center gap-3 px-5 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition shadow-inner group"
            title="Click to copy PIN"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Room PIN:
            </span>
            <span className="font-mono font-black text-2xl tracking-[0.2em] text-[#38BDF8]">
              {state.pin}
            </span>
            {copiedPin ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-slate-400 group-hover:text-white transition" />
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#1935CA]/20 border border-[#1935CA]/40 text-xs font-bold text-[#38BDF8]">
            <Users className="w-4 h-4" />
            <span>{totalCount} Players</span>
          </div>
        </div>
      </header>

      {/* Main Host Projector Canvas */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col justify-center">
        {/* State 1: LOBBY */}
        {state.status === 'lobby' && (
          <div className="text-center space-y-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1935CA]/20 text-[#38BDF8] text-xs font-bold border border-[#1935CA]/40">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Join at quizforge.app/arena</span>
              </span>
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white">
                Enter PIN: <span className="text-[#38BDF8] font-mono">{state.pin}</span>
              </h1>
              <p className="text-sm text-slate-400 font-medium max-w-md mx-auto">
                Players can join instantly on their phones or laptops by entering the 6-digit game PIN.
              </p>
            </div>

            {/* Players Grid Roster */}
            <div className="p-6 rounded-[28px] bg-slate-900/80 border border-slate-800 shadow-2xl min-h-[220px] flex flex-col justify-center">
              {state.participants.length === 0 ? (
                <div className="text-center space-y-2 text-slate-500">
                  <Users className="w-10 h-10 mx-auto animate-pulse" />
                  <p className="text-sm font-bold">Waiting for players to join...</p>
                  <p className="text-xs">Tell your students or audience to enter PIN: {state.pin}</p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {state.participants.map((p) => (
                    <div
                      key={p.id}
                      className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-800/80 border border-slate-700 text-white font-bold text-sm shadow-md animate-in zoom-in duration-200 flex items-center gap-2"
                    >
                      <div className="w-6 h-6 rounded-lg bg-[#1935CA] text-white flex items-center justify-center font-bold text-xs">
                        {p.nickname.charAt(0).toUpperCase()}
                      </div>
                      <span>{p.nickname}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Start Button */}
            <div>
              <button
                type="button"
                onClick={handleStartGame}
                disabled={isAdvancing || state.participants.length === 0}
                className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#1935CA] to-indigo-600 hover:from-[#142BA3] hover:to-indigo-700 disabled:opacity-50 text-white font-black text-lg shadow-2xl shadow-[#1935CA]/40 transition active:scale-95 inline-flex items-center gap-3"
              >
                {isAdvancing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-white" />}
                <span>Start Battle ({state.participants.length} Joined)</span>
              </button>
            </div>
          </div>
        )}

        {/* State 2: QUESTION */}
        {state.status === 'question' && state.currentQuestion && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Top Stats Banner */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-400">
                Question {state.currentQuestion.index} of {state.currentQuestion.total}
              </span>

              {/* Giant Countdown Clock */}
              <div
                className={`flex items-center gap-2 px-5 py-2 rounded-2xl font-black text-xl shadow-lg ${
                  timeLeft <= 5
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-[#1935CA] text-white'
                }`}
              >
                <Clock className="w-5 h-5" />
                <span>{timeLeft}s</span>
              </div>

              {/* Answered Counter */}
              <div className="text-sm font-bold text-slate-300">
                Answers: <strong className="text-[#38BDF8]">{answeredCount}</strong> / {totalCount}
              </div>
            </div>

            {/* Question Text */}
            <div className="p-8 rounded-[28px] bg-slate-900 border border-slate-800 shadow-2xl text-center">
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-snug">
                {state.currentQuestion.questionText}
              </h2>
            </div>

            {/* 4 Choices Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {state.currentQuestion.choices.map((choice) => {
                let badgeClass = '';
                if (choice.choice_id === 'A') badgeClass = 'bg-rose-600 border-rose-500';
                else if (choice.choice_id === 'B') badgeClass = 'bg-[#1935CA] border-blue-500';
                else if (choice.choice_id === 'C') badgeClass = 'bg-amber-600 border-amber-500';
                else badgeClass = 'bg-emerald-600 border-emerald-500';

                return (
                  <div
                    key={choice.choice_id}
                    className={`p-6 rounded-2xl border text-white font-bold text-lg flex items-center justify-between shadow-xl ${badgeClass}`}
                  >
                    <span>{choice.option_text}</span>
                    <span className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center font-mono font-black text-sm shrink-0 ml-4">
                      {choice.choice_id}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Host Skip / End Question Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleEndQuestion}
                disabled={isAdvancing}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-300 transition"
              >
                End Question Timer Now
              </button>
            </div>
          </div>
        )}

        {/* State 3: LEADERBOARD */}
        {state.status === 'leaderboard' && (
          <div className="space-y-8 animate-in zoom-in-95 duration-200">
            {/* Question Solution & Distribution Card */}
            {state.questionEnd && (
              <div className="p-6 rounded-[28px] bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs uppercase">
                      ✓ Correct Choice: {state.questionEnd.correctChoiceId}
                    </span>
                    <span className="text-xs text-slate-400">
                      Total Answers: {state.questionEnd.totalAnswers}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    disabled={isAdvancing}
                    className="px-7 py-3 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] text-white font-extrabold text-sm shadow-lg shadow-[#1935CA]/30 transition active:scale-95 flex items-center gap-2 ml-auto"
                  >
                    {isAdvancing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>
                      {state.currentQuestion && state.currentQuestion.index < state.currentQuestion.total
                        ? 'Next Question'
                        : 'View Final Podium'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Distribution Bars */}
                <div className="grid grid-cols-4 gap-3 pt-2">
                  {(['A', 'B', 'C', 'D'] as ChoiceId[]).map((cid) => {
                    const count = state.questionEnd?.distribution[cid] || 0;
                    const isCorrect = state.questionEnd?.correctChoiceId === cid;
                    return (
                      <div
                        key={cid}
                        className={`p-3 rounded-xl text-center border ${
                          isCorrect
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300'
                        }`}
                      >
                        <span className="font-mono font-black text-sm block">{cid}</span>
                        <strong className="text-xl font-extrabold block mt-0.5">{count}</strong>
                        <span className="text-[10px] text-slate-400 font-medium">answers</span>
                      </div>
                    );
                  })}
                </div>

                {state.questionEnd.explanation && (
                  <div className="p-3.5 rounded-xl bg-slate-800/60 text-xs text-slate-300 font-medium border border-slate-700/60">
                    <strong className="text-slate-100">AI Explanation:</strong> {state.questionEnd.explanation}
                  </div>
                )}
              </div>
            )}

            {/* Top Leaderboard Podium List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Top Contenders Leaderboard
              </h3>

              <div className="space-y-2">
                {state.leaderboard?.map((entry) => (
                  <div
                    key={entry.participantId}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-lg"
                  >
                    <div className="flex items-center gap-3.5">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          entry.rank === 1
                            ? 'bg-amber-500 text-black'
                            : entry.rank === 2
                            ? 'bg-slate-300 text-black'
                            : entry.rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      <span className="font-bold text-base text-white">{entry.nickname}</span>
                      {entry.streak > 1 && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                          <Flame className="w-3 h-3 fill-amber-500" />
                          <span>{entry.streak}</span>
                        </div>
                      )}
                    </div>

                    <strong className="text-lg font-black text-[#38BDF8] font-mono">
                      {entry.score} pts
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* State 4: FINISHED / OLYMPIC PODIUM */}
        {state.status === 'finished' && (
          <div className="text-center space-y-10 animate-in zoom-in-95 duration-200">
            <div>
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/40">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Arena Championship Complete</span>
              </span>
              <h1 className="text-4xl sm:text-6xl font-black text-white mt-2">
                Tournament Champions
              </h1>
            </div>

            {/* Olympic 3D Podium */}
            <div className="flex items-end justify-center gap-3 sm:gap-6 pt-6 max-w-xl mx-auto">
              {/* 2nd Place: Silver */}
              {state.podium && state.podium[1] && (
                <div className="flex-1 flex flex-col items-center">
                  <span className="font-bold text-sm text-slate-300 mb-2 truncate max-w-[120px]">
                    {state.podium[1].nickname}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400 mb-2">
                    {state.podium[1].score} pts
                  </span>
                  <div className="w-full h-36 rounded-t-3xl bg-gradient-to-t from-slate-700 to-slate-400 flex flex-col items-center justify-center shadow-xl border-t-2 border-slate-300">
                    <span className="font-black text-3xl text-slate-900">2</span>
                    <span className="text-[10px] font-bold text-slate-800 uppercase">Silver</span>
                  </div>
                </div>
              )}

              {/* 1st Place: Gold */}
              {state.podium && state.podium[0] && (
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500 text-black flex items-center justify-center mb-2 shadow-lg shadow-amber-500/40 animate-bounce">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <span className="font-black text-base text-amber-300 mb-1 truncate max-w-[140px]">
                    {state.podium[0].nickname}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-300 mb-2">
                    {state.podium[0].score} pts
                  </span>
                  <div className="w-full h-48 rounded-t-3xl bg-gradient-to-t from-amber-600 via-amber-400 to-yellow-300 flex flex-col items-center justify-center shadow-2xl border-t-2 border-yellow-200">
                    <span className="font-black text-4xl text-amber-950">1</span>
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wider">Champion</span>
                  </div>
                </div>
              )}

              {/* 3rd Place: Bronze */}
              {state.podium && state.podium[2] && (
                <div className="flex-1 flex flex-col items-center">
                  <span className="font-bold text-sm text-amber-600 mb-2 truncate max-w-[120px]">
                    {state.podium[2].nickname}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400 mb-2">
                    {state.podium[2].score} pts
                  </span>
                  <div className="w-full h-28 rounded-t-3xl bg-gradient-to-t from-amber-900 to-amber-700 flex flex-col items-center justify-center shadow-xl border-t-2 border-amber-600">
                    <span className="font-black text-2xl text-amber-200">3</span>
                    <span className="text-[10px] font-bold text-amber-300 uppercase">Bronze</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4">
              <Link
                to="/"
                className="px-8 py-3.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] text-white font-bold text-sm shadow-xl shadow-[#1935CA]/30 transition"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 text-center py-4 text-xs text-slate-500">
        QuizForge Projector Display • Sub-Millisecond Real-Time Engine
      </footer>
    </div>
  );
}
