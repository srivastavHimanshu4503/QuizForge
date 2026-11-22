import { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../api/client';
import { AssignmentDto } from '@quiz-forge/shared';
import { AppLayout } from '../components/layout/AppLayout';
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
        navigate(`/code-quiz/${res.attemptId}`);
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
    <AppLayout activeNav="assignments">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 transition-colors duration-200">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] flex items-center justify-center shadow-sm">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] dark:text-[#F8FAFC] tracking-tight">
                My Assigned Quizzes
              </h1>
            </div>
            <p className="text-sm text-[#696F79] dark:text-slate-400 mt-1 font-medium">
              Tasks and assessments assigned by your teachers across enrolled classrooms.
            </p>
          </div>

          <Link
            to="/classrooms"
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] hover:text-[#1935CA] dark:hover:text-[#38BDF8] bg-white dark:bg-[#151C2C] hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition border border-slate-200/80 dark:border-slate-700 shadow-sm self-start sm:self-auto"
          >
            <GraduationCap className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
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
                className={`px-4 py-2 text-xs font-bold rounded-xl capitalize transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1935CA] text-white shadow-md shadow-[#1935CA]/20'
                    : 'bg-white dark:bg-[#151C2C] text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white border border-slate-200/80 dark:border-slate-700'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Assignment List */}
        {isLoading ? (
          <div className="p-12 text-center text-[#696F79] dark:text-slate-400 text-sm bg-white dark:bg-[#151C2C] rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 dark:border-slate-800">
            Loading your assignments...
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="p-12 text-center text-[#696F79] dark:text-slate-400 text-sm bg-white dark:bg-[#151C2C] rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 dark:border-slate-800 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="font-bold text-[#1E293B] dark:text-[#F8FAFC]">No {filter !== 'all' ? filter : ''} assignments found.</p>
            <p className="text-xs text-[#696F79] dark:text-slate-400">
              When your teacher assigns a quiz in one of your enrolled classrooms, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredAssignments.map((a) => {
              const hasAttemptsLeft = a.myAttemptsCount < a.maxAttempts;
              const canAttempt = hasAttemptsLeft && !a.isOverdue;

              return (
                <div
                  key={a.id}
                  className="p-6 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.05)] hover:shadow-[0_14px_36px_rgba(25,53,202,0.08)] transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#1935CA] dark:text-[#38BDF8] uppercase tracking-wider block">
                        {a.classroomName}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          a.isCompleted
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : a.isOverdue
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {a.isCompleted ? 'Completed' : a.isOverdue ? 'Overdue' : 'Pending'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#1E293B] dark:text-[#F8FAFC]">
                        {a.title}
                      </h3>
                      {a.description && (
                        <p className="text-xs text-[#696F79] dark:text-slate-400 mt-1 line-clamp-2">{a.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#696F79] dark:text-slate-400 pt-1 font-medium">
                      {a.dueDate && (
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Attempts: {a.myAttemptsCount} / {a.maxAttempts}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      {a.myBestScore !== null && a.myBestScore !== undefined ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <Award className="w-4 h-4" />
                          <span>Best Score: {a.myBestScore} pts</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#696F79] dark:text-slate-400 font-medium">Not graded yet</span>
                      )}
                    </div>

                    {canAttempt ? (
                      <button
                        onClick={() => handleStartAssignment(a)}
                        disabled={startingId === a.id}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 rounded-xl transition shadow-md shadow-[#1935CA]/20"
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
                      <span className="text-xs font-semibold text-[#696F79] dark:text-slate-400 italic">
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
    </AppLayout>
  );
}
