import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WhiteboardStroke, WhiteboardPoint } from '@quiz-forge/shared';
import {
  Pen,
  Eraser,
  RotateCcw,
  Trash2,
  Download,
  Users,
} from 'lucide-react';

interface PeerCursor {
  userId: string;
  userName: string;
  x: number;
  y: number;
  timestamp: number;
}

interface StudyWhiteboardProps {
  strokes: WhiteboardStroke[];
  onAddStroke: (stroke: WhiteboardStroke) => void;
  onClear: () => void;
  onUndo: () => void;
  onCursorMove: (x: number, y: number) => void;
  peerCursors: PeerCursor[];
  currentUserId: string;
  currentUserName: string;
}

const PALETTE = [
  { name: 'Royal Blue', hex: '#1935CA' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Crimson', hex: '#EF4444' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Slate', hex: '#64748B' },
  { name: 'Dark Slate', hex: '#1E293B' },
  { name: 'White', hex: '#FFFFFF' },
];

const STROKE_SIZES = [
  { label: 'Fine', size: 2 },
  { label: 'Medium', size: 4 },
  { label: 'Bold', size: 8 },
];

export const StudyWhiteboard: React.FC<StudyWhiteboardProps> = ({
  strokes,
  onAddStroke,
  onClear,
  onUndo,
  onCursorMove,
  peerCursors,
  currentUserId,
  currentUserName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#1935CA');
  const [strokeSize, setStrokeSize] = useState<number>(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPointsRef = useRef<WhiteboardPoint[]>([]);

  // Redraw all strokes on canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    for (const stroke of strokes) {
      if (!stroke.points || stroke.points.length === 0) continue;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;
      ctx.lineWidth = stroke.size * (window.devicePixelRatio || 1);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      const p0 = stroke.points[0];
      if (!p0) continue;
      ctx.moveTo(p0.x * width, p0.y * height);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        if (!pt) continue;
        ctx.lineTo(pt.x * width, pt.y * height);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [strokes]);

  // Handle Resize & DPI Scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      redraw();
    };

    handleResize();

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [redraw]);

  // Pointer event handlers (mouse / touch / stylus)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setIsDrawing(true);
    currentPointsRef.current = [{ x, y }];

    // Draw single point immediately
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x * canvas.width, y * canvas.height, (strokeSize * dpr) / 2, 0, Math.PI * 2);
      ctx.fillStyle = activeTool === 'eraser' ? '#FFFFFF' : selectedColor;
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      }
      ctx.fill();
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    // Broadcast cursor position
    onCursorMove(x, y);

    if (!isDrawing) return;

    currentPointsRef.current.push({ x, y });

    // Render segment in real time
    const ctx = canvas.getContext('2d');
    if (ctx && currentPointsRef.current.length > 1) {
      const pts = currentPointsRef.current;
      const pPrev = pts[pts.length - 2];
      const pCurr = pts[pts.length - 1];
      if (!pPrev || !pCurr) return;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = activeTool === 'eraser' ? '#FFFFFF' : selectedColor;
      ctx.lineWidth = strokeSize * (window.devicePixelRatio || 1);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      }
      ctx.moveTo(pPrev.x * canvas.width, pPrev.y * canvas.height);
      ctx.lineTo(pCurr.x * canvas.width, pCurr.y * canvas.height);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPointsRef.current.length > 0) {
      const newStroke: WhiteboardStroke = {
        id: crypto.randomUUID(),
        tool: activeTool,
        color: selectedColor,
        size: strokeSize,
        points: [...currentPointsRef.current],
        userId: currentUserId,
        userName: currentUserName,
      };
      onAddStroke(newStroke);
    }
    currentPointsRef.current = [];
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary canvas with white background for download
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');
    if (!expCtx) return;

    // Fill white background
    expCtx.fillStyle = '#FFFFFF';
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    // Draw current canvas on top
    expCtx.drawImage(canvas, 0, 0);

    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `whiteboard-notes-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden select-none">
      {/* Top Whiteboard Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 gap-3">
        {/* Tool Selector */}
        <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTool('pen')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTool === 'pen'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Pen className="w-3.5 h-3.5" />
            <span>Brush</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('eraser')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTool === 'eraser'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>
        </div>

        {/* Color Palette */}
        {activeTool === 'pen' && (
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            {PALETTE.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={c.name}
                onClick={() => setSelectedColor(c.hex)}
                style={{ backgroundColor: c.hex }}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  selectedColor === c.hex
                    ? 'border-blue-600 scale-110 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                }`}
              />
            ))}
          </div>
        )}

        {/* Stroke Size Selector */}
        <div className="flex items-center space-x-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          {STROKE_SIZES.map((sz) => (
            <button
              key={sz.size}
              type="button"
              onClick={() => setStrokeSize(sz.size)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                strokeSize === sz.size
                  ? 'bg-slate-200 dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {sz.label}
            </button>
          ))}
        </div>

        {/* Action Buttons: Undo, Clear, Snapshot */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onUndo}
            title="Undo Last Stroke"
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClear}
            title="Clear Board"
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shadow-xs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            title="Download Notes (PNG)"
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition shadow-xs"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full bg-slate-50/50 dark:bg-slate-900/50 cursor-crosshair overflow-hidden touch-none"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0 w-full h-full"
        />

        {/* Multi-user live peer cursors */}
        {peerCursors.map((peer) => (
          <div
            key={peer.userId}
            style={{
              left: `${peer.x * 100}%`,
              top: `${peer.y * 100}%`,
              transform: 'translate(4px, 4px)',
            }}
            className="pointer-events-none absolute z-20 flex items-center space-x-1 transition-all duration-75 ease-out"
          >
            <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm ring-2 ring-blue-500/30" />
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded-md shadow-xs whitespace-nowrap">
              {peer.userName}
            </span>
          </div>
        ))}

        {strokes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <Users className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm font-medium">Shared Whiteboard Canvas</p>
            <p className="text-xs opacity-75">Draw diagrams, write equations, and solve problems together</p>
          </div>
        )}
      </div>
    </div>
  );
};
