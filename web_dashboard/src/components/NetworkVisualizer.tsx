"use client";
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Route, ChevronRight } from 'lucide-react';

const NODES = [
  { id: 0, label: 'Warehouse',  x: 100, y: 220 },
  { id: 1, label: 'Hub Alpha',  x: 320, y: 70  },
  { id: 2, label: 'Hub Beta',   x: 320, y: 370 },
  { id: 3, label: 'Relay',      x: 540, y: 150 },
  { id: 4, label: 'Depot',      x: 540, y: 310 },
  { id: 5, label: 'Delivery',   x: 760, y: 220 },
];

const EDGES = [
  { u: 0, v: 1, w: 7 }, { u: 0, v: 2, w: 3 },
  { u: 1, v: 3, w: 2 }, { u: 2, v: 1, w: 1 },
  { u: 2, v: 4, w: 6 }, { u: 3, v: 5, w: 4 },
  { u: 4, v: 5, w: 2 }, { u: 3, v: 4, w: 1 },
];

interface Step { event: string; [key: string]: any; }

function explain(step: Step | null, idx: number): { title: string; detail: string } {
  if (!step) return {
    title: 'Ready to run Dijkstra\'s shortest path algorithm',
    detail: 'This algorithm finds the cheapest route from the Warehouse (node 0) to the Delivery point (node 5). It works by always expanding the nearest unvisited node first — this is called a "greedy" strategy. Click "Run" to begin.'
  };
  switch (step.event) {
    case 'init': return {
      title: 'Graph loaded — ready to find shortest path',
      detail: `The graph has ${step.nodes} nodes (locations) connected by weighted edges (travel costs). We want the cheapest path from node ${step.start} to node ${step.end}. Initially, every node\'s distance is set to ∞ (infinity) except the start node, which is 0.`
    };
    case 'queue_push': return {
      title: `Start node ${step.node} added to the priority queue`,
      detail: 'The priority queue holds nodes we still need to visit, ordered by their current shortest distance. We begin with just the start node at distance 0. The algorithm will keep picking the closest node from this queue.'
    };
    case 'visit': return {
      title: `Now visiting node ${step.node} (distance = ${step.distance})`,
      detail: `Node ${step.node} has the smallest distance in the queue (${step.distance}), so we visit it next. We\'ll check all its neighbors — if we can reach any neighbor via node ${step.node} with a shorter total distance, we update that neighbor\'s distance. This is called "relaxation".`
    };
    case 'relax': return {
      title: `Relaxing edge: ${step.u} → ${step.v} (weight ${step.weight})`,
      detail: `Can we reach node ${step.v} faster by going through node ${step.u}? Current distance to ${step.u} is ${step.new_dist - step.weight}, plus edge weight ${step.weight} = ${step.new_dist}. ${step.old_dist === '"INF"' ? `Node ${step.v} was unreachable before (∞), so ${step.new_dist} is definitely better.` : `The old distance was ${step.old_dist}, and ${step.new_dist} < ${step.old_dist}, so we update it.`} Node ${step.v}\'s distance is now ${step.new_dist}.`
    };
    case 'target_reached': return {
      title: '🎯 Target reached!',
      detail: `Node ${step.node} (the delivery point) was just popped from the priority queue. Because Dijkstra\'s always picks the node with the smallest distance, we can guarantee this is the shortest possible path. No other route can be cheaper.`
    };
    case 'finish': return {
      title: `Shortest path found: total distance = ${step.total_distance}`,
      detail: `The optimal route is: ${step.path.map((n: number) => `${n} (${NODES[n]?.label})`).join(' → ')}. Total cost: ${step.total_distance}. The green highlighted path shows this route on the graph.`
    };
    default: return { title: '', detail: '' };
  }
}

export default function NetworkVisualizer() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIdx, setStepIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    setLoading(true); setSteps([]); setStepIdx(-1); setPlaying(false); playRef.current = false;
    try {
      const res = await fetch('/api/run-dijkstra', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: NODES.length, edges: EDGES, start: 0, end: 5 }),
      });
      const data = await res.json();
      if (!data.error) { setSteps(data); setStepIdx(0); }
      else alert("C++ error: " + data.error);
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
      setStepIdx(p => {
        if (p >= steps.length - 1) { playRef.current = false; setPlaying(false); clearInterval(iv); return p; }
        return p + 1;
      });
    }, 1200);
    return () => clearInterval(iv);
  }, [playing, steps.length]);

  useEffect(() => { logRef.current && (logRef.current.scrollTop = logRef.current.scrollHeight); }, [stepIdx]);

  // Build visualization state
  const visited = new Set<number>();
  const relaxedEdges = new Set<string>();
  const finalPath = new Set<string>();
  const finalPathNodes = new Set<number>();
  const distMap = new Map<number, number | string>();
  let activeNode = -1;
  let relaxingEdge: string | null = null;
  let finished = false;

  // Initialize all distances to ∞
  NODES.forEach(n => distMap.set(n.id, '∞'));

  for (let i = 0; i <= stepIdx; i++) {
    const s = steps[i];
    if (!s) continue;
    if (s.event === 'visit') { visited.add(s.node); activeNode = s.node; }
    if (s.event === 'relax') {
      relaxedEdges.add(`${s.u}-${s.v}`); relaxedEdges.add(`${s.v}-${s.u}`);
      distMap.set(s.v, s.new_dist);
      if (i === stepIdx) relaxingEdge = `${s.u}-${s.v}`;
    }
    if (s.event === 'queue_push') distMap.set(s.node, s.distance);
    if (s.event === 'finish') {
      finished = true;
      const p: number[] = s.path;
      p.forEach(n => finalPathNodes.add(n));
      for (let j = 0; j < p.length - 1; j++) { finalPath.add(`${p[j]}-${p[j+1]}`); finalPath.add(`${p[j+1]}-${p[j]}`); }
    }
  }

  const currentStep = steps[stepIdx] || null;
  const { title, detail } = explain(currentStep, stepIdx);

  return (
    <div className="viz-card">
      <div className="viz-titlebar">
        <div className="viz-titlebar-left">
          <div className="viz-icon viz-icon-indigo"><Route size={18} /></div>
          <div>
            <h2 className="viz-name">Dijkstra&apos;s Shortest Path Algorithm</h2>
            <p className="viz-desc">Finds the minimum-cost route through a weighted graph</p>
          </div>
        </div>
        <div className="viz-controls">
          <button onClick={run} disabled={loading} className="viz-btn viz-btn-indigo" id="dijkstra-run">
            {loading ? 'Running…' : 'Run Algorithm'}
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

      {/* Explanation Panel */}
      <div className="viz-explanation">
        <div className="viz-explanation-header">
          <span className="viz-explanation-tag">What&apos;s happening</span>
          {steps.length > 0 && <span className="viz-explanation-step">Step {stepIdx + 1}/{steps.length}</span>}
        </div>
        <div className="viz-explanation-main">{title}</div>
        <div className="viz-explanation-detail">{detail}</div>
      </div>

      <div className="viz-content">
        <div className="viz-canvas">
          <svg width="100%" height="100%" viewBox="0 0 860 460" preserveAspectRatio="xMidYMid meet">
            {/* Grid */}
            {Array.from({ length: 22 }).map((_, i) => (
              <line key={`gx-${i}`} x1={i*40} y1={0} x2={i*40} y2={460} stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`gy-${i}`} x1={0} y1={i*40} x2={860} y2={i*40} stroke="#f1f5f9" strokeWidth="1" />
            ))}

            {/* Edges */}
            {EDGES.map((e, idx) => {
              const u = NODES[e.u], v = NODES[e.v];
              const eid = `${e.u}-${e.v}`;
              const isFinal = finalPath.has(eid);
              const isRelaxing = relaxingEdge === eid;
              const isRelaxed = relaxedEdges.has(eid);

              let color = '#e2e8f0', width = 2, opacity = 1;
              if (isFinal) { color = '#16a34a'; width = 4; }
              else if (isRelaxing) { color = '#d97706'; width = 3.5; }
              else if (isRelaxed) { color = '#818cf8'; width = 2.5; }

              const dx = v.x - u.x, dy = v.y - u.y;
              const len = Math.sqrt(dx*dx + dy*dy);
              const nx = dx/len, ny = dy/len, r = 28;

              return (
                <g key={`e-${idx}`}>
                  <motion.line
                    x1={u.x + nx*r} y1={u.y + ny*r} x2={v.x - nx*r} y2={v.y - ny*r}
                    stroke={color} strokeWidth={width} opacity={opacity}
                    strokeLinecap="round"
                    animate={{ stroke: color, strokeWidth: width }}
                    transition={{ duration: 0.3 }}
                  />
                  <g transform={`translate(${(u.x+v.x)/2},${(u.y+v.y)/2})`}>
                    <rect x={-14} y={-12} width={28} height={22} rx={6} fill="white" stroke="#e2e8f0" strokeWidth={1} />
                    <text y={4} fill={isFinal ? '#16a34a' : isRelaxing ? '#d97706' : '#64748b'}
                      fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">{e.w}</text>
                  </g>
                </g>
              );
            })}

            {/* Nodes */}
            {NODES.map(node => {
              const isActive = activeNode === node.id;
              const isVisited = visited.has(node.id);
              const isOnPath = finalPathNodes.has(node.id);
              const isStart = node.id === 0;
              const isTarget = node.id === 5;
              const d = distMap.get(node.id);

              let fill = 'white', stroke = '#e2e8f0', textColor = '#64748b', sw = 2;

              if (finished && isOnPath) { fill = '#dcfce7'; stroke = '#16a34a'; textColor = '#166534'; sw = 3; }
              else if (isActive) { fill = '#eef2ff'; stroke = '#4f46e5'; textColor = '#3730a3'; sw = 3; }
              else if (isVisited) { fill = '#f1f5f9'; stroke = '#94a3b8'; textColor = '#475569'; }
              else if (isStart) { fill = '#f0fdf4'; stroke = '#16a34a'; textColor = '#166534'; }
              else if (isTarget) { fill = '#fef2f2'; stroke = '#dc2626'; textColor = '#991b1b'; }

              return (
                <g key={`n-${node.id}`}>
                  {isActive && (
                    <motion.circle cx={node.x} cy={node.y} r={36} fill="none" stroke="#4f46e5" strokeWidth={2}
                      initial={{ opacity: 0.5, r: 30 }} animate={{ opacity: 0, r: 48 }}
                      transition={{ duration: 1.5, repeat: Infinity }} />
                  )}
                  <motion.circle cx={node.x} cy={node.y} r={26} fill={fill} stroke={stroke} strokeWidth={sw}
                    animate={{ r: isActive ? 28 : 26 }} transition={{ duration: 0.3 }} />
                  <text x={node.x} y={node.y + 5} fill={textColor}
                    fontSize="15" fontWeight="800" textAnchor="middle" fontFamily="var(--font-sans)">{node.id}</text>
                  <text x={node.x} y={node.y + 48} fill="#94a3b8"
                    fontSize="11" fontWeight="500" textAnchor="middle" fontFamily="var(--font-sans)">{node.label}</text>
                  {isStart && !finished && (
                    <text x={node.x} y={node.y - 38} fill="#16a34a" fontSize="10" fontWeight="700" textAnchor="middle">SOURCE</text>
                  )}
                  {isTarget && !finished && (
                    <text x={node.x} y={node.y - 38} fill="#dc2626" fontSize="10" fontWeight="700" textAnchor="middle">TARGET</text>
                  )}
                  {/* Distance badge */}
                  {d !== undefined && d !== '∞' && (
                    <g>
                      <rect x={node.x + 18} y={node.y - 38} width={30} height={20} rx={5}
                        fill={finished && isOnPath ? '#dcfce7' : '#eef2ff'}
                        stroke={finished && isOnPath ? '#16a34a' : '#818cf8'} strokeWidth={1} />
                      <text x={node.x + 33} y={node.y - 24} fill={finished && isOnPath ? '#166534' : '#4338ca'}
                        fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">{d}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="viz-sidebar">
          {/* Distance Table */}
          <div className="viz-table">
            <h4 className="viz-table-title">Distance Table</h4>
            <div className="viz-table-grid">
              {NODES.map(node => {
                const d = distMap.get(node.id);
                const isActive = activeNode === node.id;
                const isOnPath = finalPathNodes.has(node.id);
                return (
                  <div key={node.id} className={`viz-table-row ${isActive ? 'viz-table-row-active' : ''} ${finished && isOnPath ? 'viz-table-row-path' : ''}`}>
                    <span className="viz-table-node">{node.id}</span>
                    <span className={d === '∞' ? 'viz-table-dist-inf' : isActive ? 'viz-table-dist-updated' : 'viz-table-dist'}>
                      {d === '∞' ? '∞' : d}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="viz-legend">
            <h4 className="viz-legend-title">Legend</h4>
            <div className="viz-legend-items">
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#16a34a' }} />Source node</div>
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#dc2626' }} />Target node</div>
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#4f46e5' }} />Currently visiting</div>
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#d97706' }} />Edge being relaxed</div>
              <div className="viz-legend-item"><span className="viz-dot" style={{ background: '#16a34a', border: '2px solid #166534' }} />Shortest path</div>
            </div>
          </div>

          {/* Log */}
          <div className="viz-log">
            <h4 className="viz-log-title">C++ Output</h4>
            <div className="viz-log-entries" ref={logRef}>
              <AnimatePresence>
                {steps.slice(0, stepIdx + 1).map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                    className={`viz-log-entry ${i === stepIdx ? 'viz-log-active' : ''}`}>
                    <span className="viz-log-idx">{String(i+1).padStart(2,'0')}</span>
                    {s.event === 'init' && <span>INIT n={s.nodes} src={s.start} dst={s.end}</span>}
                    {s.event === 'queue_push' && <span>PUSH node={s.node} dist={s.distance}</span>}
                    {s.event === 'visit' && <span>VISIT node={s.node} dist={s.distance}</span>}
                    {s.event === 'relax' && <span>RELAX {s.u}→{s.v} w={s.weight} {s.old_dist}→{s.new_dist}</span>}
                    {s.event === 'target_reached' && <span>TARGET node={s.node} ✓</span>}
                    {s.event === 'finish' && <span>DONE path={s.path.join('→')} cost={s.total_distance}</span>}
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
