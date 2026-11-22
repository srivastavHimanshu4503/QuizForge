import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiError } from '../api/client';
import { ClassroomDto, AssignmentDto, StudentSubmissionDto } from '@quiz-forge/shared';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function ClassroomsPage() {
  const { user } = useAuth();
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
    assignments: {
      id: string;
      title: string;
      quizType: 'mcq' | 'code_review';
      dueDate: string | null;
      maxAttempts: number;
      createdAt: string;
    }[];
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Teacher Assign Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignQuizId, setAssignQuizId] = useState('');
  const [assignTitle, setAssignTitle] = useState('');
  const [assignMaxAttempts, setAssignMaxAttempts] = useState(1);
  const [assignDueDate, setAssignDueDate] = useState('');
  const [myQuizzes, setMyQuizzes] = useState<{ id: string; topic: string; difficulty: string }[]>([]);

  // Submissions Modal
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmissionDto[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const fetchMyQuizzes = async () => {
    try {
      const res = await apiClient.get<any>('/api/history?limit=50&type=all');
      if (res && res.items) {
        const mcqs = res.items
          .filter((item: any) => item.type === 'mcq')
          .map((item: any) => ({
            id: item.quizId,
            topic: item.topic,
            difficulty: item.difficulty,
          }));
        const unique = Array.from(new Map(mcqs.map((q: any) => [q.id, q])).values());
        setMyQuizzes(unique as any);
        if (unique.length > 0 && !assignQuizId) {
          const first = unique[0] as { id: string; topic: string };
          setAssignQuizId(first.id);
          setAssignTitle(`Homework: ${first.topic}`);
        }
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchClassDetails(selectedClassId);
    }
  }, [selectedClassId]);

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
      await apiClient.post<AssignmentDto>('/api/classrooms/assignments', {
        classroomId: selectedClassId,
        quizId: assignQuizId,
        quizType: 'mcq',
        title: assignTitle.trim(),
        maxAttempts: Number(assignMaxAttempts),
        dueDate: assignDueDate ? new Date(assignDueDate).toISOString() : undefined,
        showFeedbackImmediately: true,
      });
      setShowAssignModal(false);
      fetchClassDetails(selectedClassId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to create assignment.');
    } finally {
      setIsSubmitting(false);
    }
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] tracking-tight">
                {isTeacher ? 'Instructor Classroom Studio' : 'My Enrolled Classrooms'}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isTeacher
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-[#EEF2FF] text-[#1935CA]'
                }`}
              >
                {isTeacher ? 'Teacher' : 'Student'}
              </span>
            </div>
            <p className="text-sm text-[#696F79] mt-1 font-medium">
              {isTeacher
                ? 'Organize student cohorts, assign quizzes with deadlines, and inspect gradebook analytics.'
                : 'Collaborate with your classes, view authorized assignments, and track submission scores.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isTeacher ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] rounded-xl transition shadow-lg shadow-[#1935CA]/20"
              >
                <Plus className="w-4 h-4" />
                <span>Create Classroom</span>
              </button>
            ) : (
              <>
                <Link
                  to="/assignments"
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#1E293B] hover:text-[#1935CA] bg-white hover:bg-slate-50 rounded-xl transition border border-slate-200/80 shadow-sm"
                >
                  <ClipboardList className="w-4 h-4 text-[#1935CA]" />
                  <span>My Assigned Tasks</span>
                </Link>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] rounded-xl transition shadow-lg shadow-[#1935CA]/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Join with Code</span>
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Classroom List */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-bold text-[#696F79] uppercase tracking-wider px-1">
              Classrooms ({classrooms.length})
            </h2>

            {isLoading ? (
              <div className="p-8 text-center text-[#696F79] text-sm bg-white rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100">
                Loading classrooms...
              </div>
            ) : classrooms.length === 0 ? (
              <div className="p-8 text-center text-[#696F79] text-sm bg-white rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100 space-y-2">
                <Users className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-semibold text-[#1E293B]">No classrooms found.</p>
                <p className="text-xs text-[#696F79]">
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
                        ? 'bg-white border-2 border-[#1935CA] shadow-[0_12px_32px_rgba(25,53,202,0.12)]'
                        : 'bg-white border border-slate-100 shadow-[0_10px_30px_rgba(25,53,202,0.04)] hover:shadow-[0_14px_36px_rgba(25,53,202,0.08)]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-[#1E293B] text-base">{c.name}</h3>
                        {c.description && (
                          <p className="text-xs text-[#696F79] line-clamp-1 mt-0.5">{c.description}</p>
                        )}
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-[#F8F9FC] text-[#1935CA] font-mono text-xs font-bold border border-slate-200/80">
                        {c.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-[#696F79] font-medium">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#1935CA]" />
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
              <div className="p-12 text-center text-[#696F79] text-sm bg-white rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100">
                Loading classroom details...
              </div>
            ) : !classDetails ? (
              <div className="p-12 text-center text-[#696F79] text-sm bg-white rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100">
                Select a classroom from the left to view members and assignments.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Classroom Overview Card */}
                <div className="p-6 sm:p-7 rounded-[20px] bg-white border border-slate-100 shadow-[0_10px_30px_rgba(25,53,202,0.05)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-[#1E293B]">{classDetails.classroom.name}</h2>
                      <p className="text-sm text-[#696F79] mt-1 font-medium">
                        Instructor: <span className="text-[#1E293B] font-bold">{classDetails.classroom.teacherName}</span>
                      </p>
                      {classDetails.classroom.description && (
                        <p className="text-xs text-[#696F79] mt-2">{classDetails.classroom.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-[#F8F9FC] border border-slate-200/80 text-center">
                        <span className="text-[10px] font-bold text-[#696F79] uppercase tracking-wider block">
                          Join Code
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-lg font-mono font-extrabold text-[#1935CA] tracking-wider">
                            {classDetails.classroom.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(classDetails.classroom.code)}
                            className="p-1 rounded text-slate-400 hover:text-[#1935CA] hover:bg-[#EEF2FF] transition"
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

                      {isTeacher && (
                        <button
                          onClick={() => {
                            fetchMyQuizzes();
                            setShowAssignModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] rounded-xl transition shadow-lg shadow-[#1935CA]/20"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Assign Quiz</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assignments Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold text-[#696F79] uppercase tracking-wider">
                      Assignments ({classDetails.assignments.length})
                    </h3>
                    {!isTeacher && (
                      <Link
                        to="/assignments"
                        className="text-xs font-bold text-[#1935CA] hover:underline flex items-center gap-1"
                      >
                        <span>Take Assigned Quizzes</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>

                  {classDetails.assignments.length === 0 ? (
                    <div className="p-8 text-center text-[#696F79] text-sm bg-white rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100">
                      No quizzes have been assigned to this classroom yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {classDetails.assignments.map((a) => (
                        <div
                          key={a.id}
                          className="p-4 sm:p-5 rounded-[18px] bg-white border border-slate-100 shadow-[0_8px_24px_rgba(25,53,202,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#1E293B] text-sm">{a.title}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#EEF2FF] text-[#1935CA]">
                                {a.quizType}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-[#696F79] font-medium">
                              {a.dueDate && (
                                <div className="flex items-center gap-1 text-amber-600">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                                </div>
                              )}
                              <div>
                                <span>Limit: {a.maxAttempts} {a.maxAttempts === 1 ? 'attempt' : 'attempts'}</span>
                              </div>
                            </div>
                          </div>

                          {isTeacher && (
                            <button
                              onClick={() => handleViewSubmissions(a.id)}
                              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1935CA] hover:bg-[#EEF2FF] bg-[#F8F9FC] rounded-xl border border-slate-200/80 transition"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>Gradebook</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Roster Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[#696F79] uppercase tracking-wider px-1">
                    Enrolled Students ({classDetails.members.length})
                  </h3>

                  {classDetails.members.length === 0 ? (
                    <div className="p-8 text-center text-[#696F79] text-sm bg-white rounded-[20px] shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100">
                      No students have joined yet. Share the code{' '}
                      <span className="font-mono text-[#1935CA] font-bold">
                        {classDetails.classroom.code}
                      </span>{' '}
                      with your class!
                    </div>
                  ) : (
                    <div className="p-2 rounded-[20px] bg-white border border-slate-100 shadow-[0_10px_30px_rgba(25,53,202,0.05)] divide-y divide-slate-100">
                      {classDetails.members.map((m) => (
                        <div
                          key={m.studentId}
                          className="p-3.5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#1935CA] flex items-center justify-center font-bold">
                              {m.studentName.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-[#1E293B] block">{m.studentName}</span>
                              <span className="text-[#696F79] text-[11px] font-medium">{m.studentEmail}</span>
                            </div>
                          </div>
                          <span className="text-[#696F79] text-[11px] font-medium">
                            Joined {new Date(m.joinedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Classroom Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[24px] p-6 sm:p-7 w-full max-w-md shadow-2xl space-y-4 border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#1935CA]" />
                  <span>Create New Classroom</span>
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                    Classroom Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Science 101"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] border border-slate-200/80 text-[#1E293B] placeholder-[#94A3B8] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Fall 2026 Cohort on Algorithms and Data Structures"
                    value={newClassDesc}
                    onChange={(e) => setNewClassDesc(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] border border-slate-200/80 text-[#1E293B] placeholder-[#94A3B8] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white outline-none font-medium resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#696F79] hover:text-[#1E293B] transition"
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
            <div className="bg-white rounded-[24px] p-6 sm:p-7 w-full max-w-sm shadow-2xl space-y-4 border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#1935CA]" />
                  <span>Join Classroom</span>
                </h3>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-[#696F79] font-medium">
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
                    className="w-full px-4 py-3 rounded-xl bg-[#F8F9FC] border border-slate-200/80 text-[#1935CA] placeholder-[#94A3B8] font-mono font-extrabold text-center text-xl tracking-widest uppercase focus:ring-2 focus:ring-[#1935CA] focus:bg-white outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#696F79] hover:text-[#1E293B] transition"
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
            <div className="bg-white rounded-[24px] p-6 sm:p-7 w-full max-w-lg shadow-2xl space-y-4 border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#1935CA]" />
                  <span>Assign Quiz to Classroom</span>
                </h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                    Assignment Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={assignTitle}
                    onChange={(e) => setAssignTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] border border-slate-200/80 text-[#1E293B] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                    Select Source Quiz *
                  </label>
                  {myQuizzes.length === 0 ? (
                    <p className="text-xs text-amber-600 font-medium">
                      No quizzes found in your history. Generate a quiz from the Dashboard first!
                    </p>
                  ) : (
                    <select
                      value={assignQuizId}
                      onChange={(e) => {
                        setAssignQuizId(e.target.value);
                        const q = myQuizzes.find((x) => x.id === e.target.value);
                        if (q) setAssignTitle(`Homework: ${q.topic}`);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] border border-slate-200/80 text-[#1E293B] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white outline-none font-medium"
                    >
                      {myQuizzes.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.topic} ({q.difficulty})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                      Max Attempts
                    </label>
                    <select
                      value={assignMaxAttempts}
                      onChange={(e) => setAssignMaxAttempts(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] border border-slate-200/80 text-[#1E293B] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white outline-none font-medium"
                    >
                      <option value={1}>1 (Strict Exam)</option>
                      <option value={2}>2 Attempts</option>
                      <option value={3}>3 Attempts</option>
                      <option value={5}>5 Attempts</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] border border-slate-200/80 text-[#1E293B] text-sm focus:ring-2 focus:ring-[#1935CA] focus:bg-white outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#696F79] hover:text-[#1E293B] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || myQuizzes.length === 0}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 rounded-xl transition shadow-lg shadow-[#1935CA]/20"
                  >
                    {isSubmitting ? 'Assigning...' : 'Assign Quiz'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Submissions Gradebook Modal */}
        {selectedAssignmentId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[24px] p-6 sm:p-7 w-full max-w-2xl shadow-2xl space-y-4 border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#1935CA]" />
                  <span>Assignment Submissions & Gradebook</span>
                </h3>
                <button
                  onClick={() => setSelectedAssignmentId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isLoadingSubmissions ? (
                <div className="p-8 text-center text-[#696F79] text-sm">Loading gradebook...</div>
              ) : submissions.length === 0 ? (
                <div className="p-8 text-center text-[#696F79] text-sm">
                  No students enrolled in this classroom.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1E293B]">
                    <thead className="bg-[#F8F9FC] text-[#696F79] uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Student</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Attempts</th>
                        <th className="p-3">Best Score</th>
                        <th className="p-3">Last Attempt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {submissions.map((s) => (
                        <tr key={s.studentId} className="hover:bg-[#F8F9FC]/80">
                          <td className="p-3">
                            <span className="font-bold text-[#1E293B] block">{s.studentName}</span>
                            <span className="text-[10px] text-[#696F79]">{s.studentEmail}</span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                s.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : s.status === 'in_progress'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {s.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold">{s.attemptsCount}</td>
                          <td className="p-3 font-bold text-[#1935CA]">
                            {s.bestScore !== null ? `${s.bestScore} pts` : '—'}
                          </td>
                          <td className="p-3 text-[#696F79]">
                            {s.lastAttemptAt
                              ? new Date(s.lastAttemptAt).toLocaleDateString()
                              : 'Not attempted'}
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
      </div>
    </AppLayout>
  );
}
