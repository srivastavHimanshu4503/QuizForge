import { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../api/client';
import { AssignmentDto } from '@quiz-forge/shared';
import {
  ClipboardList,
  Calendar,
  Award,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  GraduationCap,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export function StudentAssignmentsPage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [startingId, setStartingId] = useState<string | null>(null);

  const fetchAssignments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<AssignmentDto[]>('/api/classrooms/assignments/student');
      setAssignments(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load assigned tasks.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleStartAssignment = async (assignment: AssignmentDto) => {
    setStartingId(assignment.id);
    try {
      const res = await apiClient.post<{
        attemptId: string;
        quizId: string;
        totalQuestions: number;
        status: string;
      }>(`/api/classrooms/assignments/${assignment.id}/start`);

      // Route to player based on quizType
      if (assignment.quizType === 'mcq') {
        navigate(`/quiz/${res.attemptId}`);
      } else {
        navigate(`/code-quiz/attempt/${res.attemptId}`);
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to start quiz assignment.');
    } finally {
      setStartingId(null);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (filter === 'pending') return !a.isCompleted && !a.isOverdue;
    if (filter === 'completed') return a.isCompleted;
    if (filter === 'overdue') return a.isOverdue;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              My Assigned Quizzes
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Tasks and assessments assigned by your teachers across enrolled classrooms.
          </p>
        </div>

        <Link
          to="/classrooms"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700 self-start sm:self-auto"
        >
          <GraduationCap className="w-4 h-4 text-purple-400" />
          <span>My Classrooms</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['all', 'pending', 'completed', 'overdue'] as const).map((tab) => {
          const isActive = filter === tab;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl capitalize transition whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Assignment List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-sm bg-slate-900 rounded-2xl border border-slate-800">
          Loading your assignments...
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-sm bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="font-medium text-slate-400">No {filter !== 'all' ? filter : ''} assignments found.</p>
          <p className="text-xs text-slate-500">
            When your teacher assigns a quiz in one of your enrolled classrooms, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAssignments.map((a) => {
            const hasAttemptsLeft = a.myAttemptsCount < a.maxAttempts;
            const canAttempt = hasAttemptsLeft && !a.isOverdue;

            return (
              <div
                key={a.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block">
                      {a.classroomName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        a.isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : a.isOverdue
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {a.isCompleted ? 'Completed' : a.isOverdue ? 'Overdue' : 'Pending'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition">
                      {a.title}
                    </h3>
                    {a.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                    {a.dueDate && (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        Attempts: {a.myAttemptsCount} / {a.maxAttempts}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    {a.myBestScore !== null && a.myBestScore !== undefined ? (
                      <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                        <Award className="w-3.5 h-3.5" />
                        <span>Best Score: {a.myBestScore} pts</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Not graded yet</span>
                    )}
                  </div>

                  {canAttempt ? (
                    <button
                      onClick={() => handleStartAssignment(a)}
                      disabled={startingId === a.id}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition shadow-md shadow-indigo-900/30"
                    >
                      {a.myAttemptsCount === 0 ? (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{startingId === a.id ? 'Starting...' : 'Start Quiz'}</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{startingId === a.id ? 'Loading...' : 'Retake Quiz'}</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-slate-500 italic">
                      {a.isOverdue ? 'Submissions closed' : 'Attempt limit reached'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
