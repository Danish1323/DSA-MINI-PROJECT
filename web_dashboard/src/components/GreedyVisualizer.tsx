"use client";
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Truck } from 'lucide-react';

const PACKAGES = [
  { id: 'PKG-A', cost: 12, time: 3 },
  { id: 'PKG-B', cost: 5,  time: 8 },
  { id: 'PKG-C', cost: 9,  time: 2 },
  { id: 'PKG-D', cost: 3,  time: 4 },
  { id: 'PKG-E', cost: 7,  time: 6 },
  { id: 'PKG-F', cost: 2,  time: 1 },
];

interface Step { event: string; [key: string]: any; }
interface Pkg { id: string; score: number; }

function explain(step: Step | null, pkgs: Pkg[]): { title: string; detail: string } {
  if (!step) return {
    title: 'Ready to run greedy package assignment',
    detail: 'The greedy algorithm assigns packages to delivery trucks by always picking the "cheapest" option first. For each package, we calculate a score = shipping cost + delivery time. Then we sort by score (lowest first) and assign them in that order. It\'s fast (O(n log n) for sorting) but doesn\'t guarantee a globally optimal solution — it just makes the best local choice at each step.'
  };
  switch (step.event) {
    case 'init': return {
      title: 'Greedy assigner initialized',
      detail: 'The C++ engine has loaded all packages. The algorithm will proceed in 3 phases: (1) calculate scores, (2) sort by score, (3) assign to trucks in order.'
    };
    case 'calc_scores': {
      const examples = (step.packages || []).slice(0, 3).map((p: any) => `${p.id}: ${p.score}`).join(', ');
      return {
        title: `Phase 1: Scores calculated for ${step.packages?.length} packages`,
        detail: `Each package now has a score = cost + time. For example: ${examples}. A lower score means the package is cheaper and faster to deliver. The bars below show each package\'s score — taller bar = higher cost.`
      };
    }
    case 'sort': return {
      title: 'Phase 2: Packages sorted by score (ascending)',
      detail: `This is the "greedy choice" — we sort all packages from lowest score to highest. The idea: by always assigning the cheapest package next, we fill trucks with the most efficient deliveries first. Notice how the bars have rearranged below — lowest scores on the left.`
    };
    case 'assign': return {
      title: `Phase 3: Assigning "${step.package}" to next truck`,
      detail: `"${step.package}" has the lowest remaining score, so it gets assigned next. In a real system, this would go to the next available delivery truck. The greedy approach doesn\'t look ahead — it just picks the best option right now. The ✓ mark below shows it\'s been dispatched.`
    };
    default: return { title: '', detail: '' };
  }
}

function scoreColor(score: number) {
  if (score <= 5) return { bar: '#16a34a', border: '#16a34a', text: '#166534' };
  if (score <= 8) return { bar: '#3b82f6', border: '#3b82f6', text: '#1e40af' };
  if (score <= 12) return { bar: '#d97706', border: '#d97706', text: '#92400e' };
  return { bar: '#dc2626', border: '#dc2626', text: '#991b1b' };
}

export default function GreedyVisualizer() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIdx, setStepIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    setLoading(true); setSteps([]); setStepIdx(-1); setPlaying(false); playRef.current = false;
    try {
      const res = await fetch('/api/run-greedy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: PACKAGES }),
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
    }, 1000);
    return () => clearInterval(iv);
  }, [playing, steps.length]);

  useEffect(() => { logRef.current && (logRef.current.scrollTop = logRef.current.scrollHeight); }, [stepIdx]);

  let packages: Pkg[] = [];
  const assigned = new Set<string>();
  let phase: 'idle' | 'scored' | 'sorted' | 'assigning' = 'idle';
  let currentAssign: string | null = null;
  const assignOrder: string[] = [];

  for (let i = 0; i <= stepIdx; i++) {
    const s = steps[i];
    if (!s) continue;
    if (s.event === 'calc_scores') { packages = s.packages || []; phase = 'scored'; }
    if (s.event === 'sort') { packages = s.packages || []; phase = 'sorted'; }
    if (s.event === 'assign') { phase = 'assigning'; assigned.add(s.package); currentAssign = s.package; assignOrder.push(s.package); }
  }

  const maxScore = Math.max(...packages.map(p => p.score), 1);
  const currentStep = steps[stepIdx] || null;
  const { title, detail } = explain(currentStep, packages);

  return (
    <div className="viz-card">
      <div className="viz-titlebar">
        <div className="viz-titlebar-left">
          <div className="viz-icon viz-icon-cyan"><Truck size={18} /></div>
          <div>
            <h2 className="viz-name">Greedy Package Assignment</h2>
            <p className="viz-desc">Assigns packages to trucks by minimizing cost + time</p>
          </div>
        </div>
        <div className="viz-controls">
          <button onClick={run} disabled={loading} className="viz-btn viz-btn-cyan" id="greedy-run">
            {loading ? 'Running…' : 'Run Greedy'}
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
          <div className="greedy-container">
            {packages.length > 0 ? (
              <>
                <div className="greedy-phase">
                  {phase === 'scored' && '① Scores Calculated'}
                  {phase === 'sorted' && '② Sorted by Score'}
                  {phase === 'assigning' && `③ Dispatching (${assigned.size}/${packages.length})`}
                </div>

                <div className="greedy-chart">
                  <AnimatePresence mode="popLayout">
                    {packages.map((pkg, i) => {
                      const c = scoreColor(pkg.score);
                      const isAssigned = assigned.has(pkg.id);
                      const isCurrent = currentAssign === pkg.id;
                      const pct = (pkg.score / maxScore) * 100;
                      return (
                        <motion.div key={pkg.id} layout className="greedy-col"
                          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: i * 0.05 }}>
                          <div className="greedy-score" style={{ color: c.text }}>{pkg.score}</div>
                          <div className="greedy-bar-track">
                            <motion.div className="greedy-bar-fill"
                              style={{
                                background: isAssigned && !isCurrent ? `${c.bar}22` : c.bar,
                                borderColor: isCurrent ? '#0f172a' : c.border,
                                borderWidth: isCurrent ? '2px' : '1px',
                              }}
                              animate={{ height: `${pct}%`, opacity: isAssigned && !isCurrent ? 0.3 : 1 }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <div className={`greedy-label ${isAssigned ? 'greedy-label-done' : ''}`}>{pkg.id.replace('PKG-','')}</div>
                          {isAssigned && (
                            <motion.div className="greedy-check-mark"
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 20 }}>✓</motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {assignOrder.length > 0 && (
                  <div className="greedy-timeline">
                    <span className="greedy-timeline-label">Dispatch order:</span>
                    {assignOrder.map((id, i) => (
                      <span key={id} className="greedy-timeline-item">
                        {i > 0 && <span className="greedy-timeline-arrow">→</span>}{id}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="greedy-empty-state">{stepIdx >= 0 ? 'Initializing…' : 'Awaiting execution…'}</div>
            )}
          </div>
        </div>

        <div className="viz-sidebar">
          <div className="viz-legend">
            <h4 className="viz-legend-title">Score = Cost + Time</h4>
            <div className="viz-legend-items">
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#16a34a' }} />≤5 — Excellent</div>
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#3b82f6' }} />≤8 — Good</div>
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#d97706' }} />≤12 — Fair</div>
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#dc2626' }} />&gt;12 — Costly</div>
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
                    {s.event === 'init' && <span>INIT assigner</span>}
                    {s.event === 'calc_scores' && <span>SCORES ({s.packages?.length} pkgs)</span>}
                    {s.event === 'sort' && <span>SORTED by score ↑</span>}
                    {s.event === 'assign' && <span>ASSIGN {s.package} → truck</span>}
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
