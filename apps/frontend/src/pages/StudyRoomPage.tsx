import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import {
  StudyRoomDto,
  WhiteboardStroke,
  StudyRoomParticipant,
  ChatMessage,
  StudyRoomWsServerMessage,
  StudyRoomWsClientMessage,
} from '@quiz-forge/shared';
import { StudyWhiteboard } from '../components/study-room/StudyWhiteboard';
import { StudyQuizViewer } from '../components/study-room/StudyQuizViewer';
import {
  Users,
  MessageSquare,
  Mic,
  MicOff,
  Hand,
  Copy,
  Check,
  LogOut,
  PenTool,
  BookOpen,
  Crown,
  Send,
  Loader2,
  AlertCircle,
  Radio,
} from 'lucide-react';

interface PeerCursor {
  userId: string;
  userName: string;
  x: number;
  y: number;
  timestamp: number;
}

export const StudyRoomPage: React.FC = () => {
  const { roomIdOrCode } = useParams<{ roomIdOrCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<StudyRoomDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Collaboration State
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [participants, setParticipants] = useState<StudyRoomParticipant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [peerCursors, setPeerCursors] = useState<PeerCursor[]>([]);

  // UI state
  const [activeView, setActiveView] = useState<'whiteboard' | 'quiz'>('whiteboard');
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastCursorSendTime = useRef<number>(0);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Clean stale cursors
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setPeerCursors((prev) => prev.filter((c) => now - c.timestamp < 4000));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Room Info
  useEffect(() => {
    if (!roomIdOrCode) return;
    setIsLoading(true);
    setErrorMessage(null);

    apiClient
      .get<{ success: boolean; data: StudyRoomDto }>(`/api/study-rooms/${roomIdOrCode}`)
      .then((res) => {
        setRoom(res.data);
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Study room not found');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [roomIdOrCode]);

  // WebSocket Connection
  useEffect(() => {
    if (!room || !user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/study-rooms/ws`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      // Send JOIN_ROOM
      const joinMsg: StudyRoomWsClientMessage = {
        type: 'JOIN_ROOM',
        roomIdOrCode: room.id,
        userId: user.id,
        userName: user.displayName || 'Participant',
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as StudyRoomWsServerMessage;

        switch (msg.type) {
          case 'ROOM_STATE':
            setRoom(msg.room);
            setStrokes(msg.strokes);
            setActiveQuestionIndex(msg.activeQuestionIndex);
            setParticipants(msg.participants);
            break;

          case 'PARTICIPANT_JOINED':
            setParticipants((prev) => {
              if (prev.some((p) => p.userId === msg.participant.userId)) return prev;
              return [...prev, msg.participant];
            });
            break;

          case 'PARTICIPANT_LEFT':
            setParticipants((prev) => prev.filter((p) => p.userId !== msg.userId));
            setPeerCursors((prev) => prev.filter((c) => c.userId !== msg.userId));
            break;

          case 'WB_STROKE_BROADCAST':
            setStrokes((prev) => [...prev, msg.stroke]);
            break;

          case 'WB_CLEAR_BROADCAST':
            setStrokes([]);
            break;

          case 'WB_UNDO_BROADCAST':
            setStrokes((prev) => (msg.strokeId ? prev.filter((s) => s.id !== msg.strokeId) : prev.slice(0, -1)));
            break;

          case 'WB_CURSOR_BROADCAST':
            setPeerCursors((prev) => {
              const filtered = prev.filter((c) => c.userId !== msg.userId);
              return [
                ...filtered,
                {
                  userId: msg.userId,
                  userName: msg.userName,
                  x: msg.x,
                  y: msg.y,
                  timestamp: Date.now(),
                },
              ];
            });
            break;

          case 'QUESTION_SYNC':
            setActiveQuestionIndex(msg.questionIndex);
            break;

          case 'PARTICIPANT_UPDATE':
            setParticipants((prev) =>
              prev.map((p) => (p.userId === msg.participant.userId ? msg.participant : p))
            );
            break;

          case 'CHAT_BROADCAST':
            setChatMessages((prev) => [...prev, msg.message]);
            break;

          case 'ROOM_ENDED':
            alert('The study room has been ended by the host.');
            navigate('/study');
            break;

          case 'ERROR':
            setErrorMessage(msg.message);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    // Heartbeat ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'LEAVE_ROOM', roomId: room.id }));
        ws.close();
      }
    };
  }, [room?.id, user, navigate]);

  // Whiteboard Actions
  const handleAddStroke = useCallback(
    (stroke: WhiteboardStroke) => {
      setStrokes((prev) => [...prev, stroke]);
      if (socketRef.current?.readyState === WebSocket.OPEN && room) {
        socketRef.current.send(
          JSON.stringify({
            type: 'WB_STROKE',
            roomId: room.id,
            stroke,
          })
        );
      }
    },
    [room]
  );

  const handleClearWhiteboard = useCallback(() => {
    if (!window.confirm('Are you sure you want to clear the whiteboard for everyone?')) return;
    setStrokes([]);
    if (socketRef.current?.readyState === WebSocket.OPEN && room) {
      socketRef.current.send(
        JSON.stringify({
          type: 'WB_CLEAR',
          roomId: room.id,
        })
      );
    }
  }, [room]);

  const handleUndoWhiteboard = useCallback(() => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    if (socketRef.current?.readyState === WebSocket.OPEN && room && last) {
      socketRef.current.send(
        JSON.stringify({
          type: 'WB_UNDO',
          roomId: room.id,
          strokeId: last.id,
        })
      );
    }
  }, [strokes, room]);

  const handleCursorMove = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastCursorSendTime.current > 60) {
        lastCursorSendTime.current = now;
        if (socketRef.current?.readyState === WebSocket.OPEN && room) {
          socketRef.current.send(
            JSON.stringify({
              type: 'WB_CURSOR',
              roomId: room.id,
              x,
              y,
            })
          );
        }
      }
    },
    [room]
  );

  const handleSelectQuestion = useCallback(
    (index: number) => {
      setActiveQuestionIndex(index);
      if (socketRef.current?.readyState === WebSocket.OPEN && room) {
        socketRef.current.send(
          JSON.stringify({
            type: 'SELECT_QUESTION',
            roomId: room.id,
            questionIndex: index,
          })
        );
      }
    },
    [room]
  );

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (socketRef.current?.readyState === WebSocket.OPEN && room) {
      socketRef.current.send(
        JSON.stringify({
          type: 'AUDIO_STATE',
          roomId: room.id,
          isMuted: next,
        })
      );
    }
  };

  const handleToggleHand = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    if (socketRef.current?.readyState === WebSocket.OPEN && room) {
      socketRef.current.send(
        JSON.stringify({
          type: 'TOGGLE_HAND',
          roomId: room.id,
          raised: next,
        })
      );
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !room) return;

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'CHAT_MESSAGE',
          roomId: room.id,
          text: chatInput.trim(),
        })
      );
      setChatInput('');
    }
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleLeaveOrEnd = async () => {
    if (!room) return;
    const isHost = room.hostUserId === user?.id;

    if (isHost) {
      if (window.confirm('Are you sure you want to end this study room for all participants?')) {
        try {
          await apiClient.post(`/api/study-rooms/${room.id}/end`);
        } catch {
          // ignore
        }
        navigate('/study');
      }
    } else {
      navigate('/study');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-semibold">Connecting to Collaborative Study Room...</p>
      </div>
    );
  }

  if (errorMessage || !room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Study Room Unavailable</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          {errorMessage || 'This room does not exist or has already ended.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/study')}
          className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
        >
          Return to Study Rooms
        </button>
      </div>
    );
  }

  const isHost = room.hostUserId === user?.id;

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shadow-xs">
        {/* Left: Title & Code */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Live Room</span>
            </span>
            <h1 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100 truncate max-w-xs md:max-w-md">
              {room.title}
            </h1>
          </div>

          {/* 6-Char Room Code */}
          <button
            type="button"
            onClick={handleCopyCode}
            title="Click to copy invite code"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold transition shadow-2xs"
          >
            <span>Code: {room.code}</span>
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        </div>

        {/* Center: Mode Selector (Whiteboard vs Quiz) */}
        <div className="hidden md:flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveView('whiteboard')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeView === 'whiteboard'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Whiteboard</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('quiz')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeView === 'quiz'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Quiz Viewer</span>
          </button>
        </div>

        {/* Right: Controls & Leave */}
        <div className="flex items-center space-x-2">
          {/* Mute toggle */}
          <button
            type="button"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            className={`p-2 rounded-xl border text-xs font-semibold transition shadow-xs ${
              isMuted
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-600'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-600'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Raise Hand toggle */}
          <button
            type="button"
            onClick={handleToggleHand}
            title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            className={`p-2 rounded-xl border text-xs font-semibold transition shadow-xs ${
              isHandRaised
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-600 ring-2 ring-amber-400/30'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Hand className="w-4 h-4" />
          </button>

          {/* Leave / End Room */}
          <button
            type="button"
            onClick={handleLeaveOrEnd}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
              isHost
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isHost ? 'End Room' : 'Leave'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        {/* Left Area: Canvas or Quiz */}
        <main className="flex-1 h-full min-w-0 flex flex-col overflow-hidden">
          {activeView === 'whiteboard' ? (
            <StudyWhiteboard
              strokes={strokes}
              onAddStroke={handleAddStroke}
              onClear={handleClearWhiteboard}
              onUndo={handleUndoWhiteboard}
              onCursorMove={handleCursorMove}
              peerCursors={peerCursors}
              currentUserId={user?.id || ''}
              currentUserName={user?.displayName || 'Peer'}
            />
          ) : (
            <StudyQuizViewer
              quizData={room.quizData}
              activeQuestionIndex={activeQuestionIndex}
              onSelectQuestion={handleSelectQuestion}
              isHost={isHost}
            />
          )}
        </main>

        {/* Right Sidebar: Chat & Participants */}
        <aside className="w-80 md:w-88 shrink-0 flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-1">
            <button
              type="button"
              onClick={() => setSidebarTab('chat')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-bold transition ${
                sidebarTab === 'chat'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Live Chat</span>
              {chatMessages.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                  {chatMessages.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('participants')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-bold transition ${
                sidebarTab === 'participants'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Peers ({participants.length})</span>
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {sidebarTab === 'chat' ? (
              <div className="flex flex-col h-full">
                {/* Messages list */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-4">
                      <MessageSquare className="w-8 h-8 opacity-40 mb-2" />
                      <p className="text-xs">No chat messages yet.</p>
                      <p className="text-[11px] opacity-75">Say hello to your study group!</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isMe = msg.userId === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center space-x-1.5 mb-0.5">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {isMe ? 'You' : msg.userName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div
                            className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input box */}
                <form onSubmit={handleSendMessage} className="mt-3 flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    placeholder="Send a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            ) : (
              /* Participants Tab */
              <div className="space-y-2">
                {participants.map((p) => {
                  const isPeerHost = p.role === 'host';
                  return (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                          {p.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {p.userName}
                            </span>
                            {isPeerHost && (
                              <span title="Host">
                                <Crown className="w-3.5 h-3.5 text-amber-500 inline" />
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 capitalize">
                            {p.role}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {p.isHandRaised && (
                          <span className="p-1 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-600 text-xs animate-bounce" title="Hand Raised">
                            <Hand className="w-3 h-3" />
                          </span>
                        )}
                        {p.isMuted ? (
                          <span title="Muted">
                            <MicOff className="w-3.5 h-3.5 text-rose-500" />
                          </span>
                        ) : (
                          <span title="Speaking">
                            <Mic className="w-3.5 h-3.5 text-emerald-500" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
