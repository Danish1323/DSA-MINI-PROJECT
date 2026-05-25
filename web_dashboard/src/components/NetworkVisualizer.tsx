"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LOCATIONS, ROAD_EDGES, RouteResult } from '@/app/page';

interface Props {
  routeResults: RouteResult[];
  optimized: boolean;
}

// ── Node layout — 12 nodes in a dense, layered topology ──────
const NODE_POS: Record<number, { x: number; y: number }> = {
  0:  { x: 90,  y: 280 },  // Central Warehouse  — far left middle
  1:  { x: 220, y: 100 },  // North Hub          — upper left
  2:  { x: 220, y: 440 },  // South Hub          — lower left
  3:  { x: 390, y: 80  },  // East Depot         — upper mid-left
  4:  { x: 390, y: 460 },  // West Depot         — lower mid-left
  5:  { x: 600, y: 60  },  // Airport Terminal   — top right
  6:  { x: 480, y: 270 },  // City Centre        — centre
  7:  { x: 660, y: 420 },  // Port Facility      — lower right
  8:  { x: 560, y: 160 },  // Industrial Zone    — upper centre-right
  9:  { x: 340, y: 310 },  // Riverside Depot    — centre-left
  10: { x: 700, y: 240 },  // Tech Park          — right
  11: { x: 790, y: 340 },  // Border Checkpoint  — far right
};

const ROUTE_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#a78bfa',
  '#22d3ee', '#f97316', '#ec4899', '#84cc16',
];

// ── Helpers ──────────────────────────────────────────────────
function edgeKey(a: number, b: number) {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function shrink(
  u: { x: number; y: number },
  v: { x: number; y: number },
  r: number
) {
  const dx = v.x - u.x, dy = v.y - u.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / len, ny = dy / len;
  return {
    x1: u.x + nx * r, y1: u.y + ny * r,
    x2: v.x - nx * r, y2: v.y - ny * r,
  };
}

// ── Status text from Dijkstra step ───────────────────────────
function stepStatus(step: any, pkgId: string): string {
  if (!step) return '';
  switch (step.event) {
    case 'init':
      return `[${pkgId}] Network loaded — starting route search`;
    case 'queue_push':
      return `[${pkgId}] Starting from ${LOCATIONS[step.node]?.name ?? step.node}`;
    case 'visit':
      return `[${pkgId}] Evaluating ${LOCATIONS[step.node]?.name ?? step.node} (${step.distance} km from origin)`;
    case 'relax':
      return `[${pkgId}] Shorter path found: ${LOCATIONS[step.u]?.short} → ${LOCATIONS[step.v]?.short} = ${step.new_dist} km`;
    case 'target_reached':
      return `[${pkgId}] Destination reached — confirming optimal path…`;
    case 'finish':
      return `[${pkgId}] ✓ Optimal route confirmed — ${step.total_distance} km`;
    default:
      return '';
  }
}

export default function RouteMap({ routeResults, optimized }: Props) {
  // Sort results by priority (most urgent first = lowest number)
  const sortedResults = [...routeResults].sort(
    (a, b) => a.pkg.priority - b.pkg.priority
  );

  // Animation state
  const [activeRouteIdx, setActiveRouteIdx] = useState(0); // which route we're animating
  const [stepIdx, setStepIdx]               = useState(0);
  const [playing, setPlaying]               = useState(false);
  const [done, setDone]                     = useState(false);
  const [hoveredRoute, setHoveredRoute]     = useState<number | null>(null);
  const playRef = useRef(false);

  // Completed routes (fully animated)
  const [completedRoutes, setCompletedRoutes] = useState<number[]>([]);

  // Reset when new results arrive
  useEffect(() => {
    setActiveRouteIdx(0);
    setStepIdx(0);
    setPlaying(false);
    setDone(false);
    setCompletedRoutes([]);
    playRef.current = false;
  }, [routeResults]);

  const currentRoute = sortedResults[activeRouteIdx] ?? null;
  const steps        = currentRoute?.steps ?? [];
  const currentStep  = steps[stepIdx] ?? null;

  const goNext = useCallback(() => {
    if (!currentRoute) return;
    if (stepIdx < steps.length - 1) {
      setStepIdx(s => s + 1);
    } else {
      // finished this route
      setCompletedRoutes(prev => [...prev, activeRouteIdx]);
      if (activeRouteIdx < sortedResults.length - 1) {
        setActiveRouteIdx(r => r + 1);
        setStepIdx(0);
      } else {
        setPlaying(false);
        playRef.current = false;
        setDone(true);
      }
    }
  }, [currentRoute, stepIdx, steps.length, activeRouteIdx, sortedResults.length]);

  const goPrev = () => {
    if (stepIdx > 0) setStepIdx(s => s - 1);
  };

  const togglePlay = () => {
    const next = !playing;
    setPlaying(next);
    playRef.current = next;
  };

  const reset = () => {
    setActiveRouteIdx(0);
    setStepIdx(0);
    setPlaying(false);
    setDone(false);
    setCompletedRoutes([]);
    playRef.current = false;
  };

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      if (!playRef.current) { clearInterval(iv); return; }
      goNext();
    }, 600);
    return () => clearInterval(iv);
  }, [playing, goNext]);

  // ── Build visual state from steps[0..stepIdx] of current route ──
  const visited      = new Set<number>();
  const relaxedEdges = new Set<string>();
  const finalPath    = new Set<string>();
  const finalNodes   = new Set<number>();
  const distMap      = new Map<number, number>();
  let   activeNode   = -1;
  let   relaxingEdge: string | null = null;
  let   routeFinished = false;

  for (let i = 0; i <= stepIdx; i++) {
    const s = steps[i];
    if (!s) continue;
    if (s.event === 'visit')        { visited.add(s.node); activeNode = s.node; }
    if (s.event === 'relax')        {
      relaxedEdges.add(edgeKey(s.u, s.v));
      distMap.set(s.v, s.new_dist);
      if (i === stepIdx) relaxingEdge = edgeKey(s.u, s.v);
    }
    if (s.event === 'queue_push')   distMap.set(s.node, s.distance);
    if (s.event === 'finish') {
      routeFinished = true;
      const p: number[] = s.path;
      p.forEach(n => finalNodes.add(n));
      for (let j = 0; j < p.length - 1; j++) {
        finalPath.add(edgeKey(p[j], p[j + 1]));
      }
    }
  }

  // Completed routes — show their final paths permanently
  const completedPaths = new Map<string, number>(); // edgeKey -> routeIdx
  const completedNodes = new Map<number, number>();  // nodeId  -> routeIdx
  completedRoutes.forEach(ri => {
    const r = sortedResults[ri];
    if (!r) return;
    const finish = r.steps.find((s: any) => s.event === 'finish');
    if (!finish) return;
    const p: number[] = finish.path;
    p.forEach(n => completedNodes.set(n, ri));
    for (let j = 0; j < p.length - 1; j++) {
      completedPaths.set(edgeKey(p[j], p[j + 1]), ri);
    }
  });

  const statusMsg = stepStatus(currentStep, currentRoute?.pkg.id ?? '');
  const activeColor = currentRoute ? ROUTE_COLORS[activeRouteIdx % ROUTE_COLORS.length] : '#3b82f6';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-icon ci-blue">🗺️</div>
          <div>
            <div className="card-title">Route Optimisation — Live Pathfinding</div>
            <div className="card-subtitle">
              {optimized
                ? done
                  ? `All ${sortedResults.length} routes optimised — hover legend to inspect`
                  : `Processing ${currentRoute?.pkg.id} (${activeRouteIdx + 1}/${sortedResults.length}) — priority order`
                : `${LOCATIONS.length} locations · ${ROAD_EDGES.length} road segments`}
            </div>
          </div>
        </div>

        {optimized && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Playback controls */}
            <div className="icon-btn-group">
              <button className="icon-btn" onClick={goPrev} disabled={stepIdx === 0 && activeRouteIdx === 0}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
              </button>
              <button className="icon-btn" onClick={togglePlay} disabled={done && !playing}>
                {playing
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                }
              </button>
              <button className="icon-btn" onClick={goNext} disabled={done}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              </button>
              <button className="icon-btn" onClick={reset}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
              </button>
            </div>
            {!done && (
              <span className="badge b-blue">
                Step {stepIdx + 1}/{steps.length}
              </span>
            )}
            {done && <span className="badge b-green">✓ All routes complete</span>}
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      {optimized && (
        <div style={{
          padding: '8px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', gap: '10px', minHeight: 36,
        }}>
          {statusMsg ? (
            <>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: activeColor, flexShrink: 0,
                boxShadow: `0 0 6px ${activeColor}`,
                animation: playing ? 'blink 0.8s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
                {statusMsg}
              </span>
            </>
          ) : (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
              Click ▶ to start animated route optimisation
            </span>
          )}
        </div>
      )}

      {/* ── SVG Map ── */}
      <div className="map-wrap" style={{ flex: 1, position: 'relative' }}>
        <svg
          width="100%" height="100%"
          viewBox="0 0 880 540"
          preserveAspectRatio="xMidYMid meet"
          style={{ minHeight: 460, display: 'block' }}
        >
          {/* Dot grid */}
          {Array.from({ length: 45 }).map((_, col) =>
            Array.from({ length: 28 }).map((_, row) => (
              <circle
                key={`d${col}-${row}`}
                cx={col * 20} cy={row * 20}
                r={0.8} fill="#1a2235"
              />
            ))
          )}

          {/* ── All base edges (dim) ── */}
          {ROAD_EDGES.map((e, idx) => {
            const u = NODE_POS[e.u], v = NODE_POS[e.v];
            const { x1, y1, x2, y2 } = shrink(u, v, 20);
            const key = edgeKey(e.u, e.v);

            // Completed route edge?
            const completedRouteIdx = completedPaths.get(key);
            const isCompleted = completedRouteIdx !== undefined;

            // Current route edge states
            const isFinalPath  = finalPath.has(key);
            const isRelaxing   = relaxingEdge === key;
            const isRelaxed    = relaxedEdges.has(key);

            // Hover filter
            const isHoveredCompleted = hoveredRoute !== null && completedRouteIdx === hoveredRoute;
            const isHoveredActive    = hoveredRoute === activeRouteIdx && (isFinalPath || isRelaxed);

            let stroke = '#1a2a3f';
            let sw     = 1.2;
            let opacity = 0.4;

            if (isFinalPath) {
              stroke  = activeColor;
              sw      = 4;
              opacity = 1;
            } else if (isRelaxing) {
              stroke  = '#f59e0b';
              sw      = 2.5;
              opacity = 1;
            } else if (isRelaxed) {
              stroke  = `${activeColor}88`;
              sw      = 2;
              opacity = 0.7;
            } else if (isCompleted) {
              stroke  = ROUTE_COLORS[(completedRouteIdx ?? 0) % ROUTE_COLORS.length];
              sw      = 3;
              opacity = hoveredRoute === null ? 0.6 : isHoveredCompleted ? 1 : 0.15;
            }

            const mid = midpoint(u, v);

            return (
              <g key={`e${idx}`}>
                <motion.line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={stroke} strokeWidth={sw}
                  strokeLinecap="round"
                  opacity={opacity}
                  animate={{ stroke, strokeWidth: sw, opacity }}
                  transition={{ duration: 0.25 }}
                />
                {/* km label — only show on active/completed edges */}
                {(isRelaxed || isFinalPath || isCompleted) && (
                  <g transform={`translate(${mid.x},${mid.y})`}>
                    <rect x={-13} y={-9} width={26} height={17} rx={4}
                      fill="#0b0f1a"
                      stroke={isFinalPath ? activeColor : isCompleted ? ROUTE_COLORS[(completedRouteIdx ?? 0) % ROUTE_COLORS.length] : '#2a3a55'}
                      strokeWidth={1}
                      opacity={opacity}
                    />
                    <text y={4}
                      fill={isFinalPath ? activeColor : isCompleted ? ROUTE_COLORS[(completedRouteIdx ?? 0) % ROUTE_COLORS.length] : '#4a6080'}
                      fontSize="9" fontWeight="700" textAnchor="middle"
                      fontFamily="var(--font-mono)"
                      opacity={opacity}
                    >{e.w}km</text>
                  </g>
                )}
                {/* Dim km label for unvisited edges */}
                {!isRelaxed && !isFinalPath && !isCompleted && (
                  <g transform={`translate(${mid.x},${mid.y})`}>
                    <text y={4} fill="#1e2d45"
                      fontSize="9" fontWeight="600" textAnchor="middle"
                      fontFamily="var(--font-mono)">{e.w}</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ── Moving dot along relaxing edge ── */}
          {relaxingEdge && (() => {
            const [a, b] = relaxingEdge.split('-').map(Number);
            const u = NODE_POS[a], v = NODE_POS[b];
            if (!u || !v) return null;
            return (
              <motion.circle
                key={`dot-${relaxingEdge}-${stepIdx}`}
                r={5} fill={activeColor}
                style={{ filter: `drop-shadow(0 0 6px ${activeColor})` }}
                initial={{ cx: u.x, cy: u.y, opacity: 1 }}
                animate={{ cx: v.x, cy: v.y, opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeInOut' }}
              />
            );
          })()}

          {/* ── Nodes ── */}
          {LOCATIONS.map(loc => {
            const pos = NODE_POS[loc.id];
            if (!pos) return null;

            const isActive   = activeNode === loc.id;
            const inFinal    = finalNodes.has(loc.id);
            const inVisited  = visited.has(loc.id);
            const isOrigin   = currentRoute?.pkg.origin === loc.id;
            const isDest     = currentRoute?.pkg.destination === loc.id;
            const dist       = distMap.get(loc.id);

            // Completed route node
            const completedRouteIdx = completedNodes.get(loc.id);
            const isCompleted = completedRouteIdx !== undefined;
            const isHoveredCompleted = hoveredRoute !== null && completedRouteIdx === hoveredRoute;

            let fill   = '#0f1520';
            let stroke = '#1a2a3f';
            let sw     = 1.5;
            let textC  = '#2a3a55';
            let r      = 20;

            if (routeFinished && inFinal) {
              fill = '#0a2010'; stroke = activeColor; sw = 2.5; textC = activeColor; r = 22;
            } else if (isActive) {
              fill = '#0f1e35'; stroke = activeColor; sw = 2.5; textC = '#e8edf8'; r = 22;
            } else if (isOrigin) {
              fill = '#0a2010'; stroke = '#22c55e'; sw = 2; textC = '#22c55e';
            } else if (isDest) {
              fill = '#1a0a20'; stroke = '#a78bfa'; sw = 2; textC = '#a78bfa';
            } else if (inVisited) {
              fill = '#0d1525'; stroke = '#2a3a55'; sw = 1.5; textC = '#3a5070';
            } else if (isCompleted) {
              const cc = ROUTE_COLORS[(completedRouteIdx ?? 0) % ROUTE_COLORS.length];
              fill = '#0d1525'; stroke = cc; sw = 2;
              textC = hoveredRoute === null ? cc : isHoveredCompleted ? cc : '#2a3a55';
              opacity: hoveredRoute === null ? 1 : isHoveredCompleted ? 1 : 0.3;
            }

            return (
              <g key={`n${loc.id}`}>
                {/* Pulse ring for active node */}
                {isActive && (
                  <motion.circle cx={pos.x} cy={pos.y} r={28} fill="none"
                    stroke={activeColor} strokeWidth={1.5}
                    initial={{ opacity: 0.8, r: 22 }}
                    animate={{ opacity: 0, r: 38 }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}
                {/* Origin/dest glow */}
                {(isOrigin || isDest) && (
                  <circle cx={pos.x} cy={pos.y} r={28} fill="none"
                    stroke={isOrigin ? '#22c55e' : '#a78bfa'}
                    strokeWidth={1} strokeDasharray="3 3" opacity={0.4}
                  />
                )}

                <motion.circle
                  cx={pos.x} cy={pos.y} r={r}
                  fill={fill} stroke={stroke} strokeWidth={sw}
                  animate={{ r, fill, stroke }}
                  transition={{ duration: 0.2 }}
                />

                {/* Short label */}
                <text x={pos.x} y={pos.y + 4}
                  fill={textC} fontSize="10" fontWeight="800"
                  textAnchor="middle" fontFamily="var(--font-mono)">{loc.short}</text>

                {/* Full name below */}
                <text x={pos.x} y={pos.y + 36}
                  fill="#2a3a55" fontSize="9" fontWeight="500"
                  textAnchor="middle" fontFamily="var(--font-sans)">{loc.name}</text>

                {/* ORIGIN / DEST labels */}
                {isOrigin && (
                  <text x={pos.x} y={pos.y - 30} fill="#22c55e"
                    fontSize="8" fontWeight="700" textAnchor="middle">ORIGIN</text>
                )}
                {isDest && (
                  <text x={pos.x} y={pos.y - 30} fill="#a78bfa"
                    fontSize="8" fontWeight="700" textAnchor="middle">DEST</text>
                )}

                {/* Distance badge */}
                {dist !== undefined && !routeFinished && (
                  <g>
                    <rect x={pos.x + 16} y={pos.y - 32} width={28} height={16} rx={4}
                      fill="#0b0f1a" stroke={activeColor} strokeWidth={1} />
                    <text x={pos.x + 30} y={pos.y - 21}
                      fill={activeColor} fontSize="9" fontWeight="700"
                      textAnchor="middle" fontFamily="var(--font-mono)">{dist}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Idle overlay */}
        {!optimized && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(11,15,26,0.7)', pointerEvents: 'none',
          }}>
            <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🗺️</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', fontWeight: 600 }}>Add shipments and click</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 800 }}>Optimize & Dispatch</div>
              <div style={{ fontSize: '0.72rem', marginTop: 6, color: 'var(--text-3)' }}>
                Routes will animate one by one, priority-first
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Route progress bar ── */}
      {optimized && sortedResults.length > 0 && (
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          {sortedResults.map((r, i) => {
            const isActive   = i === activeRouteIdx && !done;
            const isComplete = completedRoutes.includes(i) || done;
            const color      = ROUTE_COLORS[i % ROUTE_COLORS.length];
            const orig = LOCATIONS.find(l => l.id === r.pkg.origin);
            const dst  = LOCATIONS.find(l => l.id === r.pkg.destination);
            const finish = r.steps.find((s: any) => s.event === 'finish');

            return (
              <div key={r.pkg.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '5px 8px', borderRadius: 'var(--r-md)',
                  background: isActive ? `${color}10` : hoveredRoute === i ? 'var(--bg-raised)' : 'transparent',
                  border: `1px solid ${isActive ? `${color}30` : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                  opacity: !isActive && !isComplete && !done ? 0.4 : 1,
                }}
                onMouseEnter={() => setHoveredRoute(i)}
                onMouseLeave={() => setHoveredRoute(null)}
              >
                {/* Status dot */}
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isComplete ? color : isActive ? color : '#2a3a55',
                  flexShrink: 0,
                  boxShadow: isActive ? `0 0 8px ${color}` : 'none',
                  animation: isActive && playing ? 'blink 0.8s ease-in-out infinite' : 'none',
                }} />

                {/* Priority badge */}
                <span className={`badge ${r.pkg.priority <= 2 ? 'b-red' : r.pkg.priority <= 4 ? 'b-amber' : r.pkg.priority <= 6 ? 'b-blue' : 'b-muted'}`}
                  style={{ fontSize: '0.55rem' }}>
                  P{r.pkg.priority}
                </span>

                <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: isActive || isComplete ? color : 'var(--text-3)', minWidth: 72 }}>
                  {r.pkg.id}
                </span>

                <span style={{ fontSize: '0.68rem', color: 'var(--text-2)', flex: 1 }}>
                  {orig?.short} → {dst?.short}
                </span>

                {isComplete && finish && (
                  <>
                    <span style={{ fontSize: '0.68rem', color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {finish.path.map((n: number) => LOCATIONS.find(l => l.id === n)?.short).join('→')}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {finish.total_distance}km
                    </span>
                  </>
                )}

                {isActive && !isComplete && (
                  <span style={{ fontSize: '0.65rem', color, fontFamily: 'var(--font-mono)' }}>
                    {stepIdx + 1}/{steps.length} steps
                  </span>
                )}

                {!isActive && !isComplete && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>queued</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
