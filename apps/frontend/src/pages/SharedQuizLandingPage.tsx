import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import { Navbar } from '../components/layout/Navbar';
import { QuizMetadata, ClientQuestion } from '@quiz-forge/shared';
import {
  Globe,
  Play,
  Loader2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

export function SharedQuizLandingPage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<QuizMetadata | null>(null);
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareCode) return;
    setIsLoading(true);
    apiClient
      .get<{ quiz: QuizMetadata; questions: ClientQuestion[] }>(`/api/quizzes/share/${shareCode}`)
      .then((data) => {
        setQuiz(data.quiz);
        setQuestions(data.questions);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setIsLoading(false);
        setError(
          err instanceof ApiError
            ? err.message
            : 'The shared quiz was not found or is no longer published.'
        );
      });
  }, [shareCode]);

  const handleStartAttempt = async () => {
    if (!shareCode) return;
    setIsStarting(true);
    setError(null);

    try {
      const data = await apiClient.post<{ attemptId: string; quizId: string }>(
        `/api/quizzes/share/${shareCode}/start`
      );
      navigate(`/quiz/${data.attemptId}`);
    } catch (err: unknown) {
      setIsStarting(false);
      setError(
        err instanceof ApiError ? err.message : 'Failed to launch quiz attempt. Please try again.'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col justify-center">
        {error ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white">Quiz Unavailable</h1>
            <p className="text-sm text-slate-400">{error}</p>
          </div>
        ) : (
          quiz && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider w-fit mb-4">
                <Globe className="w-3.5 h-3.5" />
                <span>Public Assessment</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white mb-3">
                {quiz.topic}
              </h1>

              <p className="text-xs text-slate-400 mb-8 leading-relaxed">
                You have been invited to take this assessment. Questions will be presented in a randomized sequence, and your responses will be evaluated server-side upon submission.
              </p>

              {/* Assessment Specs */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                  <span className="block text-xs text-slate-500 font-medium">Questions</span>
                  <span className="block text-lg font-bold text-white mt-0.5">
                    {questions.length}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                  <span className="block text-xs text-slate-500 font-medium">Difficulty</span>
                  <span className="block text-lg font-bold text-indigo-400 capitalize mt-0.5">
                    {quiz.difficulty}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                  <span className="block text-xs text-slate-500 font-medium">Format</span>
                  <span className="block text-lg font-bold text-white mt-0.5">
                    MCQ
                  </span>
                </div>
              </div>

              {/* Features list */}
              <div className="space-y-2.5 mb-8 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Fisher-Yates randomized question sequence</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Comprehensive pedagogical explanations revealed upon completion</span>
                </div>
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Attempt will be recorded to your user profile</span>
                </div>
              </div>

              {/* Start Button */}
              <button
                type="button"
                onClick={handleStartAttempt}
                disabled={isStarting}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-indigo-600/20 transition flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>Begin Assessment</span>
              </button>
            </div>
          )
        )}
      </main>
    </div>
  );
}
