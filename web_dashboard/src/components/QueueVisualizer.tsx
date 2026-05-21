"use client";
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Layers } from 'lucide-react';

const DEFAULT_OPS = [
  { op: 'ADD', id: 'PKG-A', priority: 5 },
  { op: 'ADD', id: 'PKG-B', priority: 2 },
  { op: 'ADD', id: 'PKG-C', priority: 8 },
  { op: 'ADD', id: 'PKG-D', priority: 1 },
  { op: 'ADD', id: 'PKG-E', priority: 4 },
  { op: 'PROCESS' },
  { op: 'PROCESS' },
  { op: 'ADD', id: 'PKG-F', priority: 3 },
  { op: 'PROCESS' },
];

interface Step { event: string; [key: string]: any; }
interface QItem { id: string; priority: number; }

function explain(step: Step | null): { title: string; detail: string } {
  if (!step) return {
    title: 'Ready to simulate a priority queue (min-heap)',
    detail: 'A priority queue always lets you quickly access the most urgent item. Internally it uses a min-heap — a binary tree where every parent is smaller than its children. Lower priority number = more urgent. Click "Run" to start inserting and extracting packages.'
  };
  switch (step.event) {
    case 'init': return {
      title: 'Priority queue initialized (empty)',
      detail: 'The heap starts empty. As we insert packages, they\'ll be arranged so the most urgent one (lowest priority number) is always at the root. This gives us O(log n) insert and O(log n) extract-min.'
    };
    case 'add': return {
      title: `Inserting "${step.package}" with priority ${step.priority}`,
      detail: `The package is first added at the bottom of the heap. Then it "bubbles up" — if it\'s more urgent than its parent, they swap. This continues until the heap property is restored. The tree below shows the result after bubbling.`
    };
    case 'process': return {
      title: `Extracted "${step.package}" (priority ${step.priority}) — most urgent!`,
      detail: `Extract-min removes the root (the most urgent item). The last element in the heap replaces the root, then "sinks down" — swapping with the smaller child until the heap property is restored. "${step.package}" is now dispatched to a delivery truck.`
    };
    case 'process_empty': return {
      title: 'Tried to extract, but the queue is empty',
      detail: 'There are no packages left in the queue. All items have been dispatched.'
    };
    case 'state': return {
      title: `Queue now has ${step.queue?.length || 0} package(s)`,
      detail: `The tree below shows the current heap structure. The root is always the minimum (most urgent). Each parent node has a priority ≤ its children. This is the "min-heap property".`
    };
    default: return { title: '', detail: '' };
  }
}

function getColor(p: number) {
  if (p <= 2) return { bg: '#fef2f2', stroke: '#dc2626', text: '#991b1b' };
  if (p <= 4) return { bg: '#fffbeb', stroke: '#d97706', text: '#92400e' };
  if (p <= 6) return { bg: '#eff6ff', stroke: '#3b82f6', text: '#1e40af' };
  return { bg: '#f8fafc', stroke: '#94a3b8', text: '#475569' };
}

export default function QueueVisualizer() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIdx, setStepIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    setLoading(true); setSteps([]); setStepIdx(-1); setPlaying(false); playRef.current = false;
    try {
      const res = await fetch('/api/run-queue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: DEFAULT_OPS }),
      });
      const data = await res.json();
      if (!data.error) { setSteps(data); setStepIdx(0); }
      else alert("Error: " + data.error);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const next = useCallback(() => setStepIdx(p => Math.min(p + 1, steps.length - 1)), [steps.length]);
  const prev = () => setStepIdx(p => Math.max(p - 1, 0));
  const reset = () => { setSteps([]); setStepIdx(-1); setPlaying(false); playRef.current = false; };
  const togglePlay = useCallback(() => setPlaying(prev => { playRef.current = !prev; return !prev; }), []);

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      if (!playRef.current) { clearInterval(iv); return; }
      setStepIdx(p => { if (p >= steps.length - 1) { playRef.current = false; setPlaying(false); clearInterval(iv); return p; } return p + 1; });
    }, 1100);
    return () => clearInterval(iv);
  }, [playing, steps.length]);

  useEffect(() => { logRef.current && (logRef.current.scrollTop = logRef.current.scrollHeight); }, [stepIdx]);

  let queue: QItem[] = [];
  let lastProcessed: string | null = null;
  for (let i = 0; i <= stepIdx; i++) {
    const s = steps[i];
    if (!s) continue;
    if (s.event === 'state') queue = s.queue || [];
    if (s.event === 'process') lastProcessed = s.package;
  }

  const sorted = [...queue].sort((a, b) => a.priority - b.priority);
  const heapPos = sorted.map((item, i) => {
    const level = Math.floor(Math.log2(i + 1));
    const maxLevel = sorted.length > 0 ? Math.floor(Math.log2(sorted.length)) + 1 : 1;
    const posInLevel = i - (Math.pow(2, level) - 1);
    const levelNodes = Math.min(Math.pow(2, level), sorted.length - (Math.pow(2, level) - 1));
    const xSpacing = 500 / (levelNodes + 1);
    return { item, x: xSpacing * (posInLevel + 1), y: 55 + level * (300 / Math.max(maxLevel + 1, 2)), level };
  });

  const currentStep = steps[stepIdx] || null;
  const { title, detail } = explain(currentStep);

  return (
    <div className="viz-card">
      <div className="viz-titlebar">
        <div className="viz-titlebar-left">
          <div className="viz-icon viz-icon-amber"><Layers size={18} /></div>
          <div>
            <h2 className="viz-name">Priority Queue (Min-Heap)</h2>
            <p className="viz-desc">Urgent package dispatch using a binary heap</p>
          </div>
        </div>
        <div className="viz-controls">
          <button onClick={run} disabled={loading} className="viz-btn viz-btn-amber" id="queue-run">
            {loading ? 'Running…' : 'Run Queue'}
          </button>
          <div className="viz-btn-group">
            <button onClick={prev} disabled={stepIdx <= 0} className="viz-btn-icon"><SkipBack size={14} /></button>
            <button onClick={togglePlay} disabled={!steps.length || stepIdx >= steps.length - 1} className="viz-btn-icon">
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={next} disabled={stepIdx >= steps.length - 1} className="viz-btn-icon"><SkipForward size={14} /></button>
            <button onClick={reset} disabled={!steps.length} className="viz-btn-icon"><RotateCcw size={14} /></button>
          </div>
          {steps.length > 0 && <div className="viz-step-badge">Step {stepIdx + 1} of {steps.length}</div>}
        </div>
      </div>

      <div className="viz-explanation">
        <div className="viz-explanation-header">
          <span className="viz-explanation-tag">What&apos;s happening</span>
        </div>
        <div className="viz-explanation-main">{title}</div>
        <div className="viz-explanation-detail">{detail}</div>
      </div>

      <div className="viz-content">
        <div className="viz-canvas">
          <svg width="100%" height="100%" viewBox="0 0 520 380" preserveAspectRatio="xMidYMid meet">
            {/* Edges */}
            {heapPos.map((pos, i) => {
              if (i === 0) return null;
              const pi = Math.floor((i - 1) / 2);
              const parent = heapPos[pi];
              if (!parent) return null;
              return <line key={`hl-${i}`} x1={parent.x} y1={parent.y} x2={pos.x} y2={pos.y} stroke="#e2e8f0" strokeWidth={2} />;
            })}

            {/* Nodes */}
            <AnimatePresence>
              {heapPos.map((pos, i) => {
                const c = getColor(pos.item.priority);
                const isRoot = i === 0;
                return (
                  <motion.g key={pos.item.id} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }} transition={{ duration: 0.35, delay: i * 0.03 }}>
                    {isRoot && <circle cx={pos.x} cy={pos.y} r={36} fill="none" stroke="#d97706" strokeWidth={2} strokeDasharray="4 4" opacity={0.5} />}
                    <circle cx={pos.x} cy={pos.y} r={28} fill={c.bg} stroke={c.stroke} strokeWidth={isRoot ? 3 : 2} />
                    <text x={pos.x} y={pos.y - 4} fill={c.text} fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">{pos.item.id}</text>
                    <text x={pos.x} y={pos.y + 12} fill={c.text} fontSize="14" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono)">P:{pos.item.priority}</text>
                    {isRoot && <text x={pos.x} y={pos.y - 42} fill="#d97706" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="var(--font-sans)">ROOT (min)</text>}
                  </motion.g>
                );
              })}
            </AnimatePresence>

            {heapPos.length === 0 && stepIdx >= 0 && (
              <text x="260" y="190" fill="#94a3b8" fontSize="14" textAnchor="middle">Queue is empty — all packages dispatched</text>
            )}
            {stepIdx < 0 && (
              <text x="260" y="190" fill="#cbd5e1" fontSize="13" textAnchor="middle">Awaiting execution…</text>
            )}
          </svg>

          {lastProcessed && (
            <div className="queue-dispatched">
              <span className="queue-dispatched-label">Last dispatched:</span>
              <span className="queue-dispatched-pkg">{lastProcessed}</span>
            </div>
          )}
        </div>

        <div className="viz-sidebar">
          <div className="viz-legend">
            <h4 className="viz-legend-title">Priority Levels</h4>
            <div className="viz-legend-items">
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#fef2f2', border: '2px solid #dc2626' }} />1-2: Urgent</div>
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#fffbeb', border: '2px solid #d97706' }} />3-4: High</div>
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#eff6ff', border: '2px solid #3b82f6' }} />5-6: Normal</div>
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#f8fafc', border: '2px solid #94a3b8' }} />7+: Low</div>
              <div className="viz-legend-item"><span className="viz-dot-ring" />Root = minimum</div>
            </div>
          </div>

          <div className="viz-log">
            <h4 className="viz-log-title">C++ Output</h4>
            <div className="viz-log-entries" ref={logRef}>
              <AnimatePresence>
                {steps.slice(0, stepIdx + 1).map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                    className={`viz-log-entry ${i === stepIdx ? 'viz-log-active' : ''}`}>
                    <span className="viz-log-idx">{String(i+1).padStart(2,'0')}</span>
                    {s.event === 'init' && <span>INIT queue</span>}
                    {s.event === 'add' && <span>INSERT {s.package} p={s.priority}</span>}
                    {s.event === 'process' && <span>EXTRACT-MIN {s.package} p={s.priority}</span>}
                    {s.event === 'process_empty' && <span>EXTRACT — empty!</span>}
                    {s.event === 'state' && <span>STATE: {s.queue?.length} items</span>}
                  </motion.div>
                ))}
              </AnimatePresence>
              {steps.length === 0 && <div className="viz-log-empty">Waiting…</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
