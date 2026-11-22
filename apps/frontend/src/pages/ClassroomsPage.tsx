import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiError } from '../api/client';
import {
  ClassroomDto,
  AssignmentDto,
  StudentSubmissionDto,
  CreatedQuizSummaryDto,
  ClassroomAssignmentSummaryDto,
  ClassroomGradebookPayload,
} from '@quiz-forge/shared';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Users,
  Plus,
  BookOpen,
  Copy,
  Check,
  Calendar,
  Award,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ClipboardList,
  X,
  Share2,
  Trash2,
  SlidersHorizontal,
  Settings,
  FileText,
  Globe,
  Image as ImageIcon,
  Code2,
  FileQuestion,
  Download,
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Search,
  Clock,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { GenerateQuizModal } from '../components/quiz/GenerateQuizModal';
import { PdfQuizModal } from '../components/quiz/PdfQuizModal';
import { UrlQuizModal } from '../components/quiz/UrlQuizModal';
import { ImageQuizModal } from '../components/quiz/ImageQuizModal';
import { CodeQuizModal } from '../components/code-quiz/CodeQuizModal';

export function ClassroomsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const [classrooms, setClassrooms] = useState<ClassroomDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Teacher Create Classroom Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Student Join Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  // Selected Classroom Detail
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classDetails, setClassDetails] = useState<{
    classroom: ClassroomDto;
    members: { studentId: string; studentName: string; studentEmail: string; joinedAt: string }[];
    assignments: ClassroomAssignmentSummaryDto[];
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Teacher Assign Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignQuizId, setAssignQuizId] = useState('');
  const [assignTitle, setAssignTitle] = useState('');
  const [assignMaxAttempts, setAssignMaxAttempts] = useState(1);
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignTimeLimit, setAssignTimeLimit] = useState<number | ''>('');
  const [assignShuffle, setAssignShuffle] = useState(true);
  const [myQuizzes, setMyQuizzes] = useState<CreatedQuizSummaryDto[]>([]);

  // Generation launcher modals inside classroom
  const [activeCreationModal, setActiveCreationModal] = useState<'topic' | 'pdf' | 'url' | 'image' | 'code' | null>(null);

  // Edit Assignment Modal
  const [editingAssignment, setEditingAssignment] = useState<ClassroomAssignmentSummaryDto | null>(null);
  const [editAssignTitle, setEditAssignTitle] = useState('');
  const [editAssignDueDate, setEditAssignDueDate] = useState('');
  const [editAssignMaxAttempts, setEditAssignMaxAttempts] = useState(1);
  const [editAssignTimeLimit, setEditAssignTimeLimit] = useState<number | ''>('');
  const [editAssignShuffle, setEditAssignShuffle] = useState(true);

  // Share Modal
  const [shareModalData, setShareModalData] = useState<{
    type: 'classroom' | 'assignment';
    title: string;
    code?: string;
    url: string;
  } | null>(null);

  // Submissions Modal
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmissionDto[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  // Gradebook & Analytics State
  const [activeTab, setActiveTab] = useState<'assignments' | 'gradebook' | 'roster'>('assignments');
  const [gradebookData, setGradebookData] = useState<ClassroomGradebookPayload | null>(null);
  const [isLoadingGradebook, setIsLoadingGradebook] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [selectedAnalysisAssignmentId, setSelectedAnalysisAssignmentId] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchGradebook = async (classId: string) => {
    setIsLoadingGradebook(true);
    try {
      const res = await apiClient.get<ClassroomGradebookPayload>(`/api/classrooms/${classId}/gradebook`);
      setGradebookData(res);
      if (res.assignments.length > 0) {
        setSelectedAnalysisAssignmentId((prev) => prev || res.assignments[0]?.id || null);
      }
    } catch (err) {
      console.error('Failed to load gradebook', err);
    } finally {
      setIsLoadingGradebook(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedClassId) return;
    setIsExportingCsv(true);
    try {
      const res = await fetch(`/api/classrooms/${selectedClassId}/gradebook/export`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to export gradebook CSV.');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition');
      let filename = `gradebook_${selectedClassId}.csv`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const fetchClassrooms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ClassroomDto[]>('/api/classrooms');
      setClassrooms(res);
      if (res.length > 0 && !selectedClassId) {
        setSelectedClassId(res[0]?.id || null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load classrooms.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClassDetails = async (id: string) => {
    setIsLoadingDetails(true);
    try {
      const res = await apiClient.get<any>(`/api/classrooms/${id}`);
      setClassDetails(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load classroom details.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const fetchMyQuizzes = async (): Promise<CreatedQuizSummaryDto[]> => {
    try {
      const res = await apiClient.get<{ quizzes: CreatedQuizSummaryDto[] }>('/api/quizzes/mine');
      if (res && res.quizzes) {
        setMyQuizzes(res.quizzes);
        if (res.quizzes.length > 0 && !assignQuizId) {
          const first = res.quizzes[0];
          if (first) {
            setAssignQuizId(first.id);
            setAssignTitle(`Homework: ${first.topic}`);
          }
        }
        return res.quizzes;
      }
    } catch {
      // Fallback
    }
    return [];
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  // Detect URL query parameter for join code (?join=CODE)
  useEffect(() => {
    const codeParam = searchParams.get('join');
    if (codeParam && !isTeacher) {
      setJoinCode(codeParam.toUpperCase());
      setShowJoinModal(true);
    }
  }, [searchParams, isTeacher]);

  useEffect(() => {
    if (selectedClassId) {
      fetchClassDetails(selectedClassId);
      if (activeTab === 'gradebook' && isTeacher) {
        fetchGradebook(selectedClassId);
      }
    }
  }, [selectedClassId, activeTab, isTeacher]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<ClassroomDto>('/api/classrooms', {
        name: newClassName.trim(),
        description: newClassDesc.trim() || undefined,
      });
      setClassrooms((prev) => [res, ...prev]);
      setSelectedClassId(res.id);
      setShowCreateModal(false);
      setNewClassName('');
      setNewClassDesc('');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to create classroom.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<ClassroomDto>('/api/classrooms/join', {
        code: joinCode.trim().toUpperCase(),
      });
      setClassrooms((prev) => [res, ...prev]);
      setSelectedClassId(res.id);
      setShowJoinModal(false);
      setJoinCode('');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to join classroom.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !assignQuizId || !assignTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const selectedQuiz = myQuizzes.find((q) => q.id === assignQuizId);
      await apiClient.post<AssignmentDto>('/api/classrooms/assignments', {
        classroomId: selectedClassId,
        quizId: assignQuizId,
        quizType: selectedQuiz?.quizType || 'mcq',
        title: assignTitle.trim(),
        maxAttempts: Number(assignMaxAttempts),
        timeLimitMinutes: assignTimeLimit ? Number(assignTimeLimit) : null,
        shuffleQuestions: assignShuffle,
        dueDate: assignDueDate ? new Date(assignDueDate).toISOString() : undefined,
        showFeedbackImmediately: true,
      });
      setShowAssignModal(false);
      setAssignTimeLimit('');
      setAssignShuffle(true);
      fetchClassDetails(selectedClassId);
      if (activeTab === 'gradebook' && isTeacher) fetchGradebook(selectedClassId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to create assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment) return;
    setIsSubmitting(true);
    try {
      await apiClient.put(`/api/classrooms/assignments/${editingAssignment.id}`, {
        title: editAssignTitle.trim(),
        maxAttempts: Number(editAssignMaxAttempts),
        timeLimitMinutes: editAssignTimeLimit ? Number(editAssignTimeLimit) : null,
        shuffleQuestions: editAssignShuffle,
        dueDate: editAssignDueDate ? new Date(editAssignDueDate).toISOString() : null,
      });
      setEditingAssignment(null);
      if (selectedClassId) {
        fetchClassDetails(selectedClassId);
        if (activeTab === 'gradebook' && isTeacher) fetchGradebook(selectedClassId);
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!window.confirm('Are you sure you want to delete this assignment from the classroom?')) return;
    try {
      await apiClient.delete(`/api/classrooms/assignments/${assignmentId}`);
      if (selectedClassId) {
        fetchClassDetails(selectedClassId);
        if (activeTab === 'gradebook' && isTeacher) fetchGradebook(selectedClassId);
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete assignment.');
    }
  };

  const handleDeleteClassroom = async (classroomId: string) => {
    if (!window.confirm('Are you sure you want to delete this classroom? All enrolled members and assignments will be removed.')) return;
    try {
      await apiClient.delete(`/api/classrooms/${classroomId}`);
      setClassrooms((prev) => prev.filter((c) => c.id !== classroomId));
      setSelectedClassId(null);
      setClassDetails(null);
      fetchClassrooms();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete classroom.');
    }
  };

  const handleQuizCreatedForClassroom = async (newQuizId: string, topic?: string) => {
    setActiveCreationModal(null);
    const updatedQuizzes = await fetchMyQuizzes();
    setAssignQuizId(newQuizId);
    const q = updatedQuizzes.find((x) => x.id === newQuizId);
    setAssignTitle(topic ? `Homework: ${topic}` : q ? `Homework: ${q.topic}` : 'New Homework Assignment');
    setShowAssignModal(true);
  };

  const handleViewSubmissions = async (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setIsLoadingSubmissions(true);
    try {
      const res = await apiClient.get<StudentSubmissionDto[]>(
        `/api/classrooms/assignments/${assignmentId}/submissions`
      );
      setSubmissions(res);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to load submissions.');
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <AppLayout activeNav="classrooms">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 transition-colors duration-200">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] dark:text-[#F8FAFC] tracking-tight">
                {isTeacher ? 'Instructor Classroom Studio' : 'My Enrolled Classrooms'}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isTeacher
                    ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                    : 'bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8]'
                }`}
              >
                {isTeacher ? 'Teacher' : 'Student'}
              </span>
            </div>
            <p className="text-sm text-[#696F79] dark:text-slate-400 mt-1 font-medium">
              {isTeacher
                ? 'Organize student cohorts, assign quizzes with deadlines, inspect gradebook analytics, and share access codes.'
                : 'Collaborate with your classes, view authorized assignments, and track submission scores.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isTeacher ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] rounded-xl transition shadow-lg shadow-[#1935CA]/20 active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>Create Classroom</span>
              </button>
            ) : (
              <>
                <Link
                  to="/assignments"
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] hover:text-[#1935CA] dark:hover:text-[#38BDF8] bg-white dark:bg-[#151C2C] hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition border border-slate-200/80 dark:border-slate-700 shadow-sm"
                >
                  <ClipboardList className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                  <span>My Assigned Tasks</span>
                </Link>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] rounded-xl transition shadow-lg shadow-[#1935CA]/20 active:scale-98"
                >
                  <Plus className="w-4 h-4" />
                  <span>Join with Code</span>
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Classroom List */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider px-1">
              Classrooms ({classrooms.length})
            </h2>

            {isLoading ? (
              <div className="p-8 text-center text-[#696F79] dark:text-slate-400 text-sm bg-white dark:bg-[#151C2C] rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 dark:border-slate-800">
                Loading classrooms...
              </div>
            ) : classrooms.length === 0 ? (
              <div className="p-8 text-center text-[#696F79] dark:text-slate-400 text-sm bg-white dark:bg-[#151C2C] rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 dark:border-slate-800 space-y-2">
                <Users className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-semibold text-[#1E293B] dark:text-[#F8FAFC]">No classrooms found.</p>
                <p className="text-xs text-[#696F79] dark:text-slate-400">
                  {isTeacher ? 'Create your first classroom above.' : 'Join a classroom with a teacher code.'}
                </p>
              </div>
            ) : (
              classrooms.map((c) => {
                const isSelected = c.id === selectedClassId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClassId(c.id)}
                    className={`p-5 rounded-[20px] cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-[#151C2C] border-2 border-[#1935CA] dark:border-[#38BDF8] shadow-[0_12px_32px_rgba(25,53,202,0.12)]'
                        : 'bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.04)] hover:shadow-[0_14px_36px_rgba(25,53,202,0.08)]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-[#1E293B] dark:text-[#F8FAFC] text-base">{c.name}</h3>
                        {c.description && (
                          <p className="text-xs text-[#696F79] dark:text-slate-400 line-clamp-1 mt-0.5">{c.description}</p>
                        )}
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-[#F8F9FC] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] font-mono text-xs font-bold border border-slate-200/80 dark:border-slate-700">
                        {c.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-[#696F79] dark:text-slate-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#1935CA] dark:text-[#38BDF8]" />
                        <span>{c.memberCount} students</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                        <span>{c.assignmentCount} assignments</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Classroom Detail & Assignments */}
          <div className="lg:col-span-8">
            {isLoadingDetails ? (
              <div className="p-12 text-center text-[#696F79] dark:text-slate-400 text-sm bg-white dark:bg-[#151C2C] rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 dark:border-slate-800">
                Loading classroom details...
              </div>
            ) : !classDetails ? (
              <div className="p-12 text-center text-[#696F79] dark:text-slate-400 text-sm bg-white dark:bg-[#151C2C] rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 dark:border-slate-800">
                Select a classroom from the left to view members and assignments.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Classroom Overview Card */}
                <div className="p-6 sm:p-7 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.05)] space-y-4 transition-colors duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-[#1E293B] dark:text-[#F8FAFC]">{classDetails.classroom.name}</h2>
                        {isTeacher && (
                          <button
                            onClick={() => handleDeleteClassroom(classDetails.classroom.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Delete Classroom"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-[#696F79] dark:text-slate-400 mt-1 font-medium">
                        Instructor: <span className="text-[#1E293B] dark:text-[#F8FAFC] font-bold">{classDetails.classroom.teacherName}</span>
                      </p>
                      {classDetails.classroom.description && (
                        <p className="text-xs text-[#696F79] dark:text-slate-400 mt-2">{classDetails.classroom.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="p-3 rounded-xl bg-[#F8F9FC] dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-center">
                        <span className="text-[10px] font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider block">
                          Join Code
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-lg font-mono font-extrabold text-[#1935CA] dark:text-[#38BDF8] tracking-wider">
                            {classDetails.classroom.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(classDetails.classroom.code)}
                            className="p-1 rounded text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 transition"
                            title="Copy join code"
                          >
                            {copiedCode === classDetails.classroom.code ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setShareModalData({
                            type: 'classroom',
                            title: classDetails.classroom.name,
                            code: classDetails.classroom.code,
                            url: `${window.location.origin}/classrooms?join=${classDetails.classroom.code}`,
                          })
                        }
                        className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] bg-[#EEF2FF] dark:bg-slate-800 hover:bg-[#E0E7FF] dark:hover:bg-slate-700 rounded-xl transition"
                        title="Share Classroom Invite Link"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Share Class</span>
                      </button>

                      {isTeacher && (
                        <button
                          onClick={() => {
                            fetchMyQuizzes();
                            setShowAssignModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] rounded-xl transition shadow-lg shadow-[#1935CA]/20 active:scale-98"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Assign Quiz</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Classroom Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('assignments')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      activeTab === 'assignments'
                        ? 'bg-[#1935CA] text-white shadow-md shadow-[#1935CA]/20'
                        : 'text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Assignments</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        activeTab === 'assignments'
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/70 dark:bg-slate-700 text-[#1E293B] dark:text-slate-300'
                      }`}
                    >
                      {classDetails.assignments.length}
                    </span>
                  </button>

                  {isTeacher && (
                    <button
                      onClick={() => setActiveTab('gradebook')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                        activeTab === 'gradebook'
                          ? 'bg-[#1935CA] text-white shadow-md shadow-[#1935CA]/20'
                          : 'text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>Gradebook & Analytics</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                          activeTab === 'gradebook'
                            ? 'bg-white/20 text-white'
                            : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        Live
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('roster')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      activeTab === 'roster'
                        ? 'bg-[#1935CA] text-white shadow-md shadow-[#1935CA]/20'
                        : 'text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Student Roster</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        activeTab === 'roster'
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/70 dark:bg-slate-700 text-[#1E293B] dark:text-slate-300'
                      }`}
                    >
                      {classDetails.members.length}
                    </span>
                  </button>
                </div>

                {/* Tab 1: Assignments Section */}
                {activeTab === 'assignments' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider">
                        Assignments ({classDetails.assignments.length})
                      </h3>
                      {!isTeacher ? (
                        <Link
                          to="/assignments"
                          className="text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] hover:underline flex items-center gap-1"
                        >
                          <span>Take Assigned Quizzes</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              fetchMyQuizzes();
                              setShowAssignModal(true);
                            }}
                            className="text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Assign Quiz</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {classDetails.assignments.length === 0 ? (
                      <div className="p-8 text-center text-[#696F79] dark:text-slate-400 text-sm bg-white dark:bg-[#151C2C] rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 dark:border-slate-800 space-y-2">
                        <p>No quizzes have been assigned to this classroom yet.</p>
                        {isTeacher && (
                          <button
                            onClick={() => {
                              fetchMyQuizzes();
                              setShowAssignModal(true);
                            }}
                            className="px-4 py-2 text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] bg-[#EEF2FF] dark:bg-slate-800 hover:bg-[#E0E7FF] dark:hover:bg-slate-700 rounded-xl transition"
                          >
                            Create First Assignment
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {classDetails.assignments.map((a) => (
                          <div
                            key={a.id}
                            className="p-4 sm:p-5 rounded-[18px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_8px_24px_rgba(25,53,202,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-200"
                          >
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-[#1E293B] dark:text-[#F8FAFC] text-sm truncate">{a.title}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8]">
                                  {a.quizType === 'code_review' ? 'Code Review' : 'MCQ'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-xs text-[#696F79] dark:text-slate-400 font-medium">
                                {a.dueDate && (
                                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                                  </div>
                                )}
                                <div>
                                  <span>Limit: {a.maxAttempts} {a.maxAttempts === 1 ? 'attempt' : 'attempts'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
                              {isTeacher ? (
                                <>
                                  {/* Edit Questions in Studio (MCQ only) */}
                                  {a.quizType === 'mcq' && (
                                    <Link
                                      to={`/studio/${a.quizId}`}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 bg-[#F8F9FC] dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 transition"
                                      title="Edit questions, choices and answers in Quiz Studio"
                                    >
                                      <SlidersHorizontal className="w-3.5 h-3.5" />
                                      <span>Edit Quiz</span>
                                    </Link>
                                  )}

                                  {/* Share Assignment Link */}
                                  <button
                                    onClick={() =>
                                      setShareModalData({
                                        type: 'assignment',
                                        title: a.title,
                                        code: a.shareCode || undefined,
                                        url: a.shareCode
                                          ? `${window.location.origin}/quiz/shared/${a.shareCode}`
                                          : `${window.location.origin}/classrooms?join=${classDetails.classroom.code}`,
                                      })
                                    }
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 bg-[#F8F9FC] dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 transition"
                                    title="Share quiz or direct access code"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>Share</span>
                                  </button>

                                  {/* Edit Assignment Settings */}
                                  <button
                                    onClick={() => {
                                      setEditingAssignment(a);
                                      setEditAssignTitle(a.title);
                                      setEditAssignDueDate(a.dueDate ? a.dueDate.split('T')[0] || '' : '');
                                      setEditAssignMaxAttempts(a.maxAttempts);
                                      setEditAssignTimeLimit(a.timeLimitMinutes ?? '');
                                      setEditAssignShuffle(a.shuffleQuestions ?? true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#696F79] dark:text-slate-300 hover:text-[#1E293B] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 bg-[#F8F9FC] dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 transition"
                                    title="Edit Assignment Settings (Due date, attempts, title)"
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                    <span>Settings</span>
                                  </button>

                                  {/* Submissions Modal */}
                                  <button
                                    onClick={() => handleViewSubmissions(a.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#696F79] dark:text-slate-300 hover:text-[#1E293B] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 bg-[#F8F9FC] dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 transition"
                                    title="View individual student attempts and scores"
                                  >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                    <span>Submissions</span>
                                  </button>

                                  {/* Switch directly to Gradebook matrix */}
                                  <button
                                    onClick={() => {
                                      setSelectedAnalysisAssignmentId(a.id);
                                      setActiveTab('gradebook');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 bg-[#F8F9FC] dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 transition"
                                  >
                                    <Award className="w-3.5 h-3.5" />
                                    <span>Gradebook</span>
                                  </button>

                                  {/* Delete Assignment */}
                                  <button
                                    onClick={() => handleDeleteAssignment(a.id)}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition border border-transparent hover:border-rose-100"
                                    title="Delete Assignment"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <Link
                                  to="/assignments"
                                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] rounded-xl transition shadow-sm"
                                >
                                  <span>Start Task</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Gradebook & Analytics Section (Teacher Only) */}
                {activeTab === 'gradebook' && isTeacher && (
                  <div className="space-y-6">
                    {isLoadingGradebook ? (
                      <div className="p-12 text-center text-[#696F79] dark:text-slate-400 text-sm bg-white dark:bg-[#151C2C] rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 dark:border-slate-800">
                        Loading gradebook matrix and analytics...
                      </div>
                    ) : !gradebookData ? (
                      <div className="p-12 text-center text-[#696F79] dark:text-slate-400 text-sm bg-white dark:bg-[#151C2C] rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 dark:border-slate-800">
                        Unable to load gradebook data.
                      </div>
                    ) : (
                      <>
                        {/* Summary Metrics Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="p-5 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.04)] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#696F79] dark:text-slate-400">Class Average</span>
                              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="text-2xl font-extrabold text-[#1E293B] dark:text-[#F8FAFC]">
                              {gradebookData.stats.classAveragePercentage !== null
                                ? `${gradebookData.stats.classAveragePercentage}%`
                                : '—'}
                            </div>
                            <p className="text-[11px] text-[#696F79] dark:text-slate-400 font-medium">Cohort weighted average</p>
                          </div>

                          <div className="p-5 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.04)] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#696F79] dark:text-slate-400">Completion Rate</span>
                              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1935CA] dark:text-[#38BDF8]">
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="text-2xl font-extrabold text-[#1E293B] dark:text-[#F8FAFC]">
                              {gradebookData.stats.overallCompletionRate}%
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-[#1935CA] dark:bg-[#38BDF8] h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, gradebookData.stats.overallCompletionRate))}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-5 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.04)] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#696F79] dark:text-slate-400">Enrolled Students</span>
                              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                                <Users className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="text-2xl font-extrabold text-[#1E293B] dark:text-[#F8FAFC]">
                              {gradebookData.stats.totalStudents}
                            </div>
                            <p className="text-[11px] text-[#696F79] dark:text-slate-400 font-medium">Registered student cohort</p>
                          </div>

                          <div className="p-5 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.04)] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#696F79] dark:text-slate-400">Total Quizzes</span>
                              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                                <BookOpen className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="text-2xl font-extrabold text-[#1E293B] dark:text-[#F8FAFC]">
                              {gradebookData.stats.totalAssignments}
                            </div>
                            <p className="text-[11px] text-[#696F79] dark:text-slate-400 font-medium">Active classroom tasks</p>
                          </div>
                        </div>

                        {/* Gradebook Matrix Card */}
                        <div className="p-6 sm:p-7 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.05)] space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                            <div>
                              <h3 className="text-base font-bold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
                                <Award className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                                <span>Student Gradebook Matrix</span>
                              </h3>
                              <p className="text-xs text-[#696F79] dark:text-slate-400 mt-0.5">
                                Cross-assignment performance, completion statuses, and individual scores.
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Student search input */}
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  placeholder="Filter students..."
                                  value={studentSearchQuery}
                                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#1935CA]"
                                />
                              </div>

                              {/* CSV Export Button */}
                              <button
                                onClick={handleExportCsv}
                                disabled={isExportingCsv}
                                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 rounded-xl transition shadow-md shadow-[#1935CA]/20 active:scale-98 whitespace-nowrap"
                                title="Download complete classroom gradebook as CSV"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>{isExportingCsv ? 'Exporting...' : 'Export to CSV'}</span>
                              </button>
                            </div>
                          </div>

                          {/* Matrix Table */}
                          {gradebookData.students.length === 0 ? (
                            <div className="p-8 text-center text-[#696F79] dark:text-slate-400 text-sm">
                              No students are enrolled in this classroom yet.
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-[#696F79] dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                                    <th className="py-3 px-4 font-bold sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 min-w-[200px]">
                                      Student
                                    </th>
                                    <th className="py-3 px-4 font-bold text-center min-w-[110px]">
                                      Average
                                    </th>
                                    <th className="py-3 px-4 font-bold text-center min-w-[100px]">
                                      Completed
                                    </th>
                                    {gradebookData.assignments.map((a) => (
                                      <th key={a.id} className="py-3 px-4 font-bold text-center min-w-[150px]">
                                        <div className="truncate max-w-[160px] mx-auto text-[#1E293B] dark:text-[#F8FAFC]" title={a.title}>
                                          {a.title}
                                        </div>
                                        <div className="flex items-center justify-center gap-1.5 mt-0.5">
                                          <span className="text-[10px] uppercase font-bold text-[#1935CA] dark:text-[#38BDF8]">
                                            {a.quizType === 'code_review' ? 'Code' : 'MCQ'}
                                          </span>
                                          <span className="text-[10px] text-slate-400">
                                            ({a.totalQuestions} Qs)
                                          </span>
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                  {gradebookData.students
                                    .filter(
                                      (s) =>
                                        s.studentName.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                                        s.studentEmail.toLowerCase().includes(studentSearchQuery.toLowerCase())
                                    )
                                    .map((s) => (
                                      <tr key={s.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                        <td className="py-3 px-4 sticky left-0 bg-white dark:bg-[#151C2C] z-10 border-r border-slate-100 dark:border-slate-800/60">
                                          <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] flex items-center justify-center font-bold text-xs">
                                              {s.studentName.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="font-bold text-[#1E293B] dark:text-[#F8FAFC] truncate">
                                                {s.studentName}
                                              </div>
                                              <div className="text-[11px] text-[#696F79] dark:text-slate-400 truncate">
                                                {s.studentEmail}
                                              </div>
                                            </div>
                                          </div>
                                        </td>

                                        {/* Overall Average */}
                                        <td className="py-3 px-4 text-center">
                                          {s.overallAveragePercentage !== null ? (
                                            <span
                                              className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                                                s.overallAveragePercentage >= 80
                                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                  : s.overallAveragePercentage >= 60
                                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-[#1935CA] dark:text-[#38BDF8] border border-blue-200 dark:border-blue-800'
                                                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                              }`}
                                            >
                                              {s.overallAveragePercentage}%
                                            </span>
                                          ) : (
                                            <span className="text-slate-400">—</span>
                                          )}
                                        </td>

                                        {/* Completed Count */}
                                        <td className="py-3 px-4 text-center text-[#696F79] dark:text-slate-400 font-mono text-xs">
                                          {s.completedCount} / {gradebookData.assignments.length}
                                        </td>

                                        {/* Per-Assignment Cell */}
                                        {gradebookData.assignments.map((a) => {
                                          const sc = s.scores[a.id];
                                          if (!sc || sc.status === 'not_started') {
                                            return (
                                              <td key={a.id} className="py-3 px-4 text-center">
                                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                                                  Not Started
                                                </span>
                                              </td>
                                            );
                                          }
                                          if (sc.status === 'overdue') {
                                            return (
                                              <td key={a.id} className="py-3 px-4 text-center">
                                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                                                  Overdue
                                                </span>
                                              </td>
                                            );
                                          }
                                          if (sc.status === 'in_progress') {
                                            return (
                                              <td key={a.id} className="py-3 px-4 text-center">
                                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                  In Progress
                                                </span>
                                              </td>
                                            );
                                          }
                                          return (
                                            <td key={a.id} className="py-3 px-4 text-center">
                                              <div className="flex flex-col items-center gap-0.5">
                                                <span
                                                  className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                    (sc.percentage ?? 0) >= 80
                                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                      : (sc.percentage ?? 0) >= 60
                                                      ? 'bg-blue-50 dark:bg-blue-950/40 text-[#1935CA] dark:text-[#38BDF8] border border-blue-200 dark:border-blue-800'
                                                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                                  }`}
                                                >
                                                  {sc.score}/{sc.totalQuestions} ({sc.percentage}%)
                                                </span>
                                                {(sc.isTimedOut || (sc.tabSwitchCount ?? 0) > 0) && (
                                                  <div className="flex items-center gap-1 text-[10px]">
                                                    {sc.isTimedOut && (
                                                      <span className="text-rose-500 font-bold" title="Auto-submitted (Time Limit reached)">
                                                        ⏱️ Timed out
                                                      </span>
                                                    )}
                                                    {(sc.tabSwitchCount ?? 0) > 0 && (
                                                      <span className="text-amber-600 dark:text-amber-400 font-medium" title={`${sc.tabSwitchCount} tab switch(es) recorded`}>
                                                        ⚠️ {sc.tabSwitchCount}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Psychometric Item Analysis & Question Calibration */}
                        {gradebookData.assignments.length > 0 && (
                          <div className="p-6 sm:p-7 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.05)] space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                              <div>
                                <h3 className="text-base font-bold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
                                  <BarChart2 className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                                  <span>Psychometric Item Analysis & Question Calibration</span>
                                </h3>
                                <p className="text-xs text-[#696F79] dark:text-slate-400 mt-0.5">
                                  Item difficulty index ($p$-value = % correct) and automated curriculum calibration flags.
                                </p>
                              </div>

                              {/* Assignment Selector Pills */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {gradebookData.assignments.map((a) => {
                                  const isSelected = (selectedAnalysisAssignmentId || gradebookData.assignments[0]?.id) === a.id;
                                  return (
                                    <button
                                      key={a.id}
                                      onClick={() => setSelectedAnalysisAssignmentId(a.id)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                        isSelected
                                          ? 'bg-[#1935CA] text-white shadow-sm'
                                          : 'bg-slate-100 dark:bg-slate-800 text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white'
                                      }`}
                                    >
                                      {a.title}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Active Assignment Analysis */}
                            {(() => {
                              const activeCol =
                                gradebookData.assignments.find(
                                  (a) => a.id === (selectedAnalysisAssignmentId || gradebookData.assignments[0]?.id)
                                ) || gradebookData.assignments[0];

                              if (!activeCol) return null;

                              return (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm text-[#1E293B] dark:text-[#F8FAFC]">
                                        {activeCol.title}
                                      </span>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8]">
                                        {activeCol.quizType === 'code_review' ? 'Code Review' : 'MCQ'}
                                      </span>
                                    </div>

                                    {activeCol.quizType === 'mcq' && (
                                      <Link
                                        to={`/studio/${activeCol.quizId}`}
                                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] bg-[#EEF2FF] dark:bg-slate-800 hover:bg-[#E0E7FF] dark:hover:bg-slate-700 rounded-xl transition"
                                      >
                                        <SlidersHorizontal className="w-3.5 h-3.5" />
                                        <span>Calibrate in Quiz Studio</span>
                                      </Link>
                                    )}
                                  </div>

                                  {activeCol.itemAnalysis.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-[#696F79] dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                                      No item analysis data available for this assignment yet.
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {activeCol.itemAnalysis.map((item) => (
                                        <div
                                          key={item.questionId}
                                          className={`p-4 rounded-xl border transition ${
                                            item.flagged
                                              ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                                              : 'bg-[#F8F9FC] dark:bg-[#1E293B]/60 border-slate-200/80 dark:border-slate-800'
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                              <span className="text-[10px] font-mono font-bold text-[#696F79] dark:text-slate-400 block mb-1">
                                                QUESTION {item.orderIndex + 1}
                                              </span>
                                              <p className="text-xs font-semibold text-[#1E293B] dark:text-[#F8FAFC] line-clamp-2">
                                                {item.questionText}
                                              </p>
                                            </div>

                                            {item.flagged ? (
                                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800 shrink-0">
                                                <AlertTriangle className="w-3 h-3" />
                                                <span>Needs Review</span>
                                              </span>
                                            ) : (
                                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 shrink-0">
                                                <Check className="w-3 h-3" />
                                                <span>Balanced</span>
                                              </span>
                                            )}
                                          </div>

                                          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-3 text-[#696F79] dark:text-slate-400 text-[11px] font-medium">
                                              <span>Responses: {item.totalAnswered}</span>
                                              <span>Correct: {item.correctAnswered}</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                              <span className="font-mono text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC]">
                                                p = {(item.difficultyIndex * 100).toFixed(0)}%
                                              </span>
                                              <span
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                  item.difficultyLabel === 'Easy'
                                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                                    : item.difficultyLabel === 'Moderate'
                                                    ? 'bg-blue-100 dark:bg-blue-950/60 text-[#1935CA] dark:text-[#38BDF8]'
                                                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                                                }`}
                                              >
                                                {item.difficultyLabel}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Tab 3: Roster Section */}
                {activeTab === 'roster' && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider px-1">
                      Enrolled Students ({classDetails.members.length})
                    </h3>

                    {classDetails.members.length === 0 ? (
                      <div className="p-8 text-center text-[#696F79] dark:text-slate-400 text-sm bg-white dark:bg-[#151C2C] rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 dark:border-slate-800">
                        No students have joined yet. Share the code{' '}
                        <span className="font-mono text-[#1935CA] dark:text-[#38BDF8] font-bold">
                          {classDetails.classroom.code}
                        </span>{' '}
                        with your class!
                      </div>
                    ) : (
                      <div className="p-2 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.05)] divide-y divide-slate-100 dark:divide-slate-800">
                        {classDetails.members.map((m) => (
                          <div
                            key={m.studentId}
                            className="p-3.5 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] flex items-center justify-center font-bold">
                                {m.studentName.charAt(0)}
                              </div>
                              <div>
                                <span className="font-bold text-[#1E293B] dark:text-[#F8FAFC] block">{m.studentName}</span>
                                <span className="text-[#696F79] dark:text-slate-400 text-[11px] font-medium">{m.studentEmail}</span>
                              </div>
                            </div>
                            <span className="text-[#696F79] dark:text-slate-400 text-[11px] font-medium">
                              Joined {new Date(m.joinedAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create Classroom Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-6 sm:p-7 w-full max-w-md shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800 transition-colors duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#1935CA] dark:text-[#38BDF8]" />
                  <span>Create New Classroom</span>
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                    Classroom Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Science 101"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-500 text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Fall 2026 Cohort on Algorithms and Data Structures"
                    value={newClassDesc}
                    onChange={(e) => setNewClassDesc(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-500 text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 rounded-xl transition shadow-lg shadow-[#1935CA]/20"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Classroom'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Join Classroom Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-6 sm:p-7 w-full max-w-sm shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800 transition-colors duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#1935CA] dark:text-[#38BDF8]" />
                  <span>Join Classroom</span>
                </h3>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-[#696F79] dark:text-slate-400 font-medium">
                Enter the 6-character code provided by your teacher to enroll in this class.
              </p>

              <form onSubmit={handleJoinClass} className="space-y-4">
                <div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. CS101A"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1935CA] dark:text-[#38BDF8] placeholder-[#94A3B8] dark:placeholder-slate-500 font-mono font-extrabold text-center text-xl tracking-widest uppercase focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 rounded-xl transition shadow-lg shadow-[#1935CA]/20"
                  >
                    {isSubmitting ? 'Joining...' : 'Join Class'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Quiz Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-6 sm:p-7 w-full max-w-xl shadow-2xl space-y-5 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto transition-colors duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#1935CA] dark:text-[#38BDF8]" />
                  <span>Assign Quiz to Classroom</span>
                </h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Quiz Creator Panel */}
              <div className="p-4 rounded-2xl bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#1935CA] dark:text-[#38BDF8]" />
                    <span>Create a Brand New Quiz with AI</span>
                  </span>
                  <span className="text-[10px] text-[#696F79] dark:text-slate-400 font-medium">No quiz-taking required</span>
                </div>
                <p className="text-[11px] text-[#696F79] dark:text-slate-400 leading-relaxed">
                  Generate questions from any source below and immediately attach them to this classroom:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveCreationModal('topic')}
                    className="p-2 rounded-xl bg-white dark:bg-[#151C2C] border border-slate-200 dark:border-slate-700 hover:border-[#1935CA] dark:hover:border-[#38BDF8] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 text-left transition flex flex-col items-center text-center group"
                  >
                    <FileQuestion className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8] mb-1 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-bold text-[#1E293B] dark:text-[#F8FAFC]">Topic MCQ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCreationModal('pdf')}
                    className="p-2 rounded-xl bg-white dark:bg-[#151C2C] border border-slate-200 dark:border-slate-700 hover:border-[#1935CA] dark:hover:border-[#38BDF8] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 text-left transition flex flex-col items-center text-center group"
                  >
                    <FileText className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8] mb-1 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-bold text-[#1E293B] dark:text-[#F8FAFC]">PDF Doc</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCreationModal('url')}
                    className="p-2 rounded-xl bg-white dark:bg-[#151C2C] border border-slate-200 dark:border-slate-700 hover:border-[#1935CA] dark:hover:border-[#38BDF8] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 text-left transition flex flex-col items-center text-center group"
                  >
                    <Globe className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8] mb-1 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-bold text-[#1E293B] dark:text-[#F8FAFC]">Web URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCreationModal('image')}
                    className="p-2 rounded-xl bg-white dark:bg-[#151C2C] border border-slate-200 dark:border-slate-700 hover:border-[#1935CA] dark:hover:border-[#38BDF8] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 text-left transition flex flex-col items-center text-center group"
                  >
                    <ImageIcon className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8] mb-1 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-bold text-[#1E293B] dark:text-[#F8FAFC]">Diagram</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCreationModal('code')}
                    className="p-2 rounded-xl bg-white dark:bg-[#151C2C] border border-slate-200 dark:border-slate-700 hover:border-[#1935CA] dark:hover:border-[#38BDF8] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 text-left transition flex flex-col items-center text-center group"
                  >
                    <Code2 className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8] mb-1 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-bold text-[#1E293B] dark:text-[#F8FAFC]">Code Review</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                    Assignment Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={assignTitle}
                    onChange={(e) => setAssignTitle(e.target.value)}
                    placeholder="e.g. Midterm Homework: Distributed Systems"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-500 text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200">
                      Select Source Quiz *
                    </label>
                    <span className="text-[10px] text-[#696F79] dark:text-slate-400">
                      {myQuizzes.length} available quizzes
                    </span>
                  </div>

                  {myQuizzes.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
                      No quizzes created yet. Use the quick buttons above to generate one now!
                    </div>
                  ) : (
                    <select
                      value={assignQuizId}
                      onChange={(e) => {
                        setAssignQuizId(e.target.value);
                        const q = myQuizzes.find((x) => x.id === e.target.value);
                        if (q) setAssignTitle(`Homework: ${q.topic}`);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium"
                    >
                      {myQuizzes.map((q) => (
                        <option key={q.id} value={q.id} className="dark:bg-[#151C2C]">
                          {q.topic} ({q.quizType === 'code_review' ? 'Code Review' : `${q.difficulty} • ${q.questionCount} Qs`})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                      Max Attempts
                    </label>
                    <select
                      value={assignMaxAttempts}
                      onChange={(e) => setAssignMaxAttempts(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium"
                    >
                      <option value={1} className="dark:bg-[#151C2C]">1 (Strict Exam)</option>
                      <option value={2} className="dark:bg-[#151C2C]">2 Attempts</option>
                      <option value={3} className="dark:bg-[#151C2C]">3 Attempts</option>
                      <option value={5} className="dark:bg-[#151C2C]">5 Attempts</option>
                      <option value={10} className="dark:bg-[#151C2C]">10 Attempts</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#1935CA] dark:text-[#38BDF8]" />
                        <span>Timer (Mins)</span>
                      </span>
                      <span className="text-[10px] text-[#696F79] dark:text-slate-400 font-normal">Optional</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      placeholder="e.g. 15, 30"
                      value={assignTimeLimit}
                      onChange={(e) => setAssignTimeLimit(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignShuffle}
                        onChange={(e) => setAssignShuffle(e.target.checked)}
                        className="w-4 h-4 text-[#1935CA] rounded focus:ring-[#1935CA]"
                      />
                      <span className="text-xs font-bold text-[#1E293B] dark:text-slate-200">
                        Shuffle Questions
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || myQuizzes.length === 0}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 rounded-xl transition shadow-lg shadow-[#1935CA]/20 active:scale-98"
                  >
                    {isSubmitting ? 'Assigning...' : 'Assign Quiz'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Assignment Settings Modal */}
        {editingAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-6 sm:p-7 w-full max-w-md shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800 transition-colors duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#1935CA] dark:text-[#38BDF8]" />
                  <span>Edit Assignment Settings</span>
                </h3>
                <button
                  onClick={() => setEditingAssignment(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                    Assignment Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editAssignTitle}
                    onChange={(e) => setEditAssignTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                      Max Attempts
                    </label>
                    <select
                      value={editAssignMaxAttempts}
                      onChange={(e) => setEditAssignMaxAttempts(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium"
                    >
                      <option value={1} className="dark:bg-[#151C2C]">1 (Strict Exam)</option>
                      <option value={2} className="dark:bg-[#151C2C]">2 Attempts</option>
                      <option value={3} className="dark:bg-[#151C2C]">3 Attempts</option>
                      <option value={5} className="dark:bg-[#151C2C]">5 Attempts</option>
                      <option value={10} className="dark:bg-[#151C2C]">10 Attempts</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editAssignDueDate}
                      onChange={(e) => setEditAssignDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#1935CA] dark:text-[#38BDF8]" />
                        <span>Timer (Mins)</span>
                      </span>
                      <span className="text-[10px] text-[#696F79] dark:text-slate-400 font-normal">Optional</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      placeholder="e.g. 15, 30"
                      value={editAssignTimeLimit}
                      onChange={(e) => setEditAssignTimeLimit(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] outline-none font-medium"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editAssignShuffle}
                        onChange={(e) => setEditAssignShuffle(e.target.checked)}
                        className="w-4 h-4 text-[#1935CA] rounded focus:ring-[#1935CA]"
                      />
                      <span className="text-xs font-bold text-[#1E293B] dark:text-slate-200">
                        Shuffle Questions
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingAssignment(null)}
                    className="px-4 py-2 text-xs font-bold text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 rounded-xl transition shadow-lg shadow-[#1935CA]/20 active:scale-98"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {shareModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-6 sm:p-7 w-full max-w-md shadow-2xl space-y-5 border border-slate-100 dark:border-slate-800 transition-colors duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-[#1935CA] dark:text-[#38BDF8]" />
                  <span>Share {shareModalData.type === 'classroom' ? 'Classroom Invite' : 'Quiz Assignment'}</span>
                </h3>
                <button
                  onClick={() => setShareModalData(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h4 className="font-bold text-[#1E293B] dark:text-[#F8FAFC] text-sm">{shareModalData.title}</h4>
                <p className="text-xs text-[#696F79] dark:text-slate-400 mt-0.5">
                  Send this code or direct link to your students to grant access.
                </p>
              </div>

              {shareModalData.code && (
                <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider block mb-1">
                    {shareModalData.type === 'classroom' ? 'Join Code' : 'Quiz Share Code'}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-mono font-black text-[#1935CA] dark:text-[#38BDF8] tracking-wider">
                      {shareModalData.code}
                    </span>
                    <button
                      onClick={() => copyToClipboard(shareModalData.code!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] bg-white dark:bg-[#151C2C] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition"
                    >
                      {copiedCode === shareModalData.code ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200">
                  Direct Invite Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareModalData.url}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F9FC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-[#696F79] dark:text-slate-300 font-mono outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(shareModalData.url)}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] rounded-xl transition shrink-0 active:scale-98"
                  >
                    {copiedCode === shareModalData.url ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShareModalData(null)}
                  className="px-4 py-2 text-xs font-bold text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submissions Gradebook Modal */}
        {selectedAssignmentId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-6 sm:p-7 w-full max-w-2xl shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800 transition-colors duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#1935CA] dark:text-[#38BDF8]" />
                  <span>Assignment Submissions & Gradebook</span>
                </h3>
                <button
                  onClick={() => setSelectedAssignmentId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isLoadingSubmissions ? (
                <div className="p-8 text-center text-[#696F79] dark:text-slate-400 text-sm">Loading gradebook...</div>
              ) : submissions.length === 0 ? (
                <div className="p-8 text-center text-[#696F79] dark:text-slate-400 text-sm">
                  No students enrolled in this classroom.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1E293B] dark:text-[#F8FAFC]">
                    <thead className="bg-[#F8F9FC] dark:bg-slate-800 text-[#696F79] dark:text-slate-400 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Student</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Attempts</th>
                        <th className="p-3">Best Score</th>
                        <th className="p-3">Integrity & Duration</th>
                        <th className="p-3">Last Attempt</th>
                        <th className="p-3">Report</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {submissions.map((s) => (
                        <tr key={s.studentId} className="hover:bg-[#F8F9FC]/80 dark:hover:bg-slate-800/50">
                          <td className="p-3">
                            <span className="font-bold text-[#1E293B] dark:text-[#F8FAFC] block">{s.studentName}</span>
                            <span className="text-[10px] text-[#696F79] dark:text-slate-400">{s.studentEmail}</span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                s.status === 'completed'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : s.status === 'in_progress'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {s.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold">{s.attemptsCount}</td>
                          <td className="p-3 font-bold text-[#1935CA] dark:text-[#38BDF8]">
                            {s.bestScore !== null ? `${s.bestScore} pts` : '—'}
                          </td>
                          <td className="p-3">
                            {s.status === 'completed' ? (
                              <div className="flex flex-col gap-1 text-[11px]">
                                {s.durationSeconds !== null && s.durationSeconds !== undefined && (
                                  <span className="font-mono text-slate-500 dark:text-slate-400">
                                    ⏱️ {Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s
                                  </span>
                                )}
                                {s.isTimedOut && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 w-fit">
                                    Timed Out
                                  </span>
                                )}
                                {(s.tabSwitchCount ?? 0) > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 w-fit">
                                    ⚠️ {s.tabSwitchCount} switch(es)
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                                    ✓ Clean
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-[#696F79] dark:text-slate-400">
                            {s.lastAttemptAt
                              ? new Date(s.lastAttemptAt).toLocaleDateString()
                              : 'Not attempted'}
                          </td>
                          <td className="p-3">
                            {s.bestAttemptId ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/certificates/${s.bestAttemptId}/report-card`, {
                                      credentials: 'include',
                                    });
                                    if (!res.ok) throw new Error('Failed to download report.');
                                    const blob = await res.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    const safeName = s.studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
                                    a.download = `QuizForge-Report-${safeName}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    window.URL.revokeObjectURL(url);
                                  } catch (err: any) {
                                    alert(err.message || 'Failed to download report card.');
                                  }
                                }}
                                title="Download Student Diagnostic Report Card (PDF)"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1935CA]/10 hover:bg-[#1935CA]/20 text-[#1935CA] dark:text-[#38BDF8] text-[10px] font-bold transition active:scale-95"
                              >
                                <FileText className="w-3 h-3" />
                                <span>PDF Report</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Embedded Generation Modals */}
        <GenerateQuizModal
          isOpen={activeCreationModal === 'topic'}
          onClose={() => setActiveCreationModal(null)}
          onQuizCreated={handleQuizCreatedForClassroom}
        />
        <PdfQuizModal
          isOpen={activeCreationModal === 'pdf'}
          onClose={() => setActiveCreationModal(null)}
          onQuizCreated={handleQuizCreatedForClassroom}
        />
        <UrlQuizModal
          isOpen={activeCreationModal === 'url'}
          onClose={() => setActiveCreationModal(null)}
          onQuizCreated={handleQuizCreatedForClassroom}
        />
        <ImageQuizModal
          isOpen={activeCreationModal === 'image'}
          onClose={() => setActiveCreationModal(null)}
          onQuizCreated={handleQuizCreatedForClassroom}
        />
        <CodeQuizModal
          isOpen={activeCreationModal === 'code'}
          onClose={() => setActiveCreationModal(null)}
          onQuizCreated={handleQuizCreatedForClassroom}
        />
      </div>
    </AppLayout>
  );
}