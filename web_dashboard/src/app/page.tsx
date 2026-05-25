"use client";
import { useEffect, useState, useCallback } from 'react';
import RouteMap from '@/components/NetworkVisualizer';
import DispatchPanel from '@/components/QueueVisualizer';
import FleetPanel from '@/components/GreedyVisualizer';

// ── City network ──────────────────────────────────────────────
export const LOCATIONS = [
  { id: 0,  name: 'Central Warehouse', short: 'CW' },
  { id: 1,  name: 'North Hub',         short: 'NH' },
  { id: 2,  name: 'South Hub',         short: 'SH' },
  { id: 3,  name: 'East Depot',        short: 'ED' },
  { id: 4,  name: 'West Depot',        short: 'WD' },
  { id: 5,  name: 'Airport Terminal',  short: 'AT' },
  { id: 6,  name: 'City Centre',       short: 'CC' },
  { id: 7,  name: 'Port Facility',     short: 'PF' },
  { id: 8,  name: 'Industrial Zone',   short: 'IZ' },
  { id: 9,  name: 'Riverside Depot',   short: 'RD' },
  { id: 10, name: 'Tech Park',         short: 'TP' },
  { id: 11, name: 'Border Checkpoint', short: 'BC' },
];

// Dense road network (undirected, weights = km)
export const ROAD_EDGES = [
  { u: 0,  v: 1,  w: 8  },
  { u: 0,  v: 2,  w: 5  },
  { u: 0,  v: 4,  w: 11 },
  { u: 1,  v: 3,  w: 4  },
  { u: 1,  v: 6,  w: 6  },
  { u: 1,  v: 10, w: 7  },
  { u: 2,  v: 4,  w: 7  },
  { u: 2,  v: 6,  w: 3  },
  { u: 2,  v: 9,  w: 6  },
  { u: 3,  v: 5,  w: 5  },
  { u: 3,  v: 6,  w: 2  },
  { u: 3,  v: 8,  w: 9  },
  { u: 4,  v: 7,  w: 4  },
  { u: 4,  v: 9,  w: 5  },
  { u: 5,  v: 7,  w: 6  },
  { u: 5,  v: 11, w: 3  },
  { u: 6,  v: 7,  w: 9  },
  { u: 6,  v: 5,  w: 4  },
  { u: 6,  v: 10, w: 5  },
  { u: 7,  v: 11, w: 7  },
  { u: 8,  v: 10, w: 4  },
  { u: 8,  v: 11, w: 6  },
  { u: 9,  v: 10, w: 3  },
  { u: 9,  v: 11, w: 8  },
];

export interface Package {
  id: string;
  description: string;
  origin: number;
  destination: number;
  weight: number;      // kg
  priority: number;    // 1 = urgent … 9 = low
}

export interface RouteResult {
  pkg: Package;
  path: number[];
  totalKm: number;
  steps: any[];
}

let pkgCounter = 1;

export default function Dashboard() {
  const [time, setTime] = useState('');

  // Package form state
  const [desc,    setDesc]    = useState('');
  const [origin,  setOrigin]  = useState(0);
  const [dest,    setDest]    = useState(5);
  const [weight,  setWeight]  = useState(10);
  const [priority,setPriority]= useState(3);

  // Package list
  const [packages, setPackages] = useState<Package[]>([]);

  // Results
  const [routeResults,  setRouteResults]  = useState<RouteResult[]>([]);
  const [dispatchSteps, setDispatchSteps] = useState<any[]>([]);
  const [fleetSteps,    setFleetSteps]    = useState<any[]>([]);
  const [optimizing,    setOptimizing]    = useState(false);
  const [optimized,     setOptimized]     = useState(false);

  // Live clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const addPackage = () => {
    if (origin === dest) return;
    const pkg: Package = {
      id: `PKG-${String(pkgCounter++).padStart(3, '0')}`,
      description: desc.trim() || 'General Cargo',
      origin,
      destination: dest,
      weight,
      priority,
    };
    setPackages(p => [...p, pkg]);
    setDesc(''); setWeight(10); setPriority(3);
    setOptimized(false);
  };

  const removePackage = (id: string) => {
    setPackages(p => p.filter(x => x.id !== id));
    setOptimized(false);
  };

  const optimize = useCallback(async () => {
    if (packages.length === 0) return;
    setOptimizing(true);
    setRouteResults([]); setDispatchSteps([]); setFleetSteps([]);

    try {
      // 1. Run Dijkstra for each package
      const routes: RouteResult[] = [];
      for (const pkg of packages) {
        const res = await fetch('/api/run-dijkstra', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodes: LOCATIONS.length,
            edges: ROAD_EDGES,
            start: pkg.origin,
            end: pkg.destination,
          }),
        });
        const steps = await res.json();
        const finish = steps.find((s: any) => s.event === 'finish');
        routes.push({
          pkg,
          path: finish?.path ?? [],
          totalKm: finish?.total_distance ?? 0,
          steps,
        });
      }
      setRouteResults(routes);

      // 2. Run priority queue (dispatch order)
      const ops = [
        ...packages.map(p => ({ op: 'ADD', id: p.id, priority: p.priority })),
        ...packages.map(() => ({ op: 'PROCESS' })),
      ];
      const qRes = await fetch('/api/run-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: ops }),
      });
      setDispatchSteps(await qRes.json());

      // 3. Run greedy fleet assignment
      const greedyPkgs = packages.map(p => ({
        id: p.id,
        cost: p.weight,
        time: p.priority,
      }));
      const gRes = await fetch('/api/run-greedy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: greedyPkgs }),
      });
      setFleetSteps(await gRes.json());

      setOptimized(true);
    } catch (e) {
      console.error(e);
    }
    setOptimizing(false);
  }, [packages]);

  const priorityLabel = (p: number) => {
    if (p <= 2) return { label: 'Urgent',  cls: 'b-red' };
    if (p <= 4) return { label: 'High',    cls: 'b-amber' };
    if (p <= 6) return { label: 'Normal',  cls: 'b-blue' };
    return             { label: 'Low',     cls: 'b-muted' };
  };

  const totalKm      = routeResults.reduce((s, r) => s + r.totalKm, 0);
  const avgKm        = routeResults.length ? Math.round(totalKm / routeResults.length) : 0;
  const urgentCount  = packages.filter(p => p.priority <= 2).length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top Nav ── */}
      <nav className="topnav">
        <div className="topnav-brand">
          <div className="topnav-logo">🚚</div>
          <div>
            <div className="topnav-name">SwiftLog</div>
            <div className="topnav-sub">Logistics Management System</div>
          </div>
        </div>
        <div className="topnav-right">
          <div className="live-pill"><span className="live-dot" />Live</div>
          <span className="topnav-time">{time}</span>
        </div>
      </nav>

      {/* ── KPI Bar ── */}
      <div className="kpi-bar">
        <div className="kpi-item">
          <div className="kpi-label">Packages Queued</div>
          <div className="kpi-val c-blue">{packages.length}</div>
          <div className="kpi-sub">ready to dispatch</div>
        </div>
        <div className="kpi-item">
          <div className="kpi-label">Urgent Shipments</div>
          <div className="kpi-val c-amber">{urgentCount}</div>
          <div className="kpi-sub">priority ≤ 2</div>
        </div>
        <div className="kpi-item">
          <div className="kpi-label">Routes Optimized</div>
          <div className="kpi-val c-green">{routeResults.length}</div>
          <div className="kpi-sub">{optimized ? 'last run complete' : 'pending'}</div>
        </div>
        <div className="kpi-item">
          <div className="kpi-label">Total Distance</div>
          <div className="kpi-val c-purple">{totalKm} km</div>
          <div className="kpi-sub">all routes combined</div>
        </div>
        <div className="kpi-item">
          <div className="kpi-label">Avg Route Length</div>
          <div className="kpi-val c-cyan">{avgKm} km</div>
          <div className="kpi-sub">per shipment</div>
        </div>
        <div className="kpi-item">
          <div className="kpi-label">Network Nodes</div>
          <div className="kpi-val c-blue">{LOCATIONS.length}</div>
          <div className="kpi-sub">{ROAD_EDGES.length} road segments</div>
        </div>
      </div>

      {/* ── Main ── */}
      <main className="page">

        {/* ── Row 1: Package Builder + Route Map ── */}
        <div>
          <div className="section-title">📦 Shipment Planning</div>
          <div className="two-col">

            {/* Left: Add package form + list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Add form */}
              <div className="card">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-icon ci-blue">📦</div>
                    <div>
                      <div className="card-title">Add Shipment</div>
                      <div className="card-subtitle">Configure package details</div>
                    </div>
                  </div>
                </div>
                <div className="form-body">
                  <div className="field">
                    <label className="field-label">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Electronics, Medical Supplies…"
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                    />
                  </div>

                  <div className="field-row">
                    <div className="field">
                      <label className="field-label">Origin</label>
                      <div className="select-wrap">
                        <select value={origin} onChange={e => setOrigin(Number(e.target.value))}>
                          {LOCATIONS.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">Destination</label>
                      <div className="select-wrap">
                        <select value={dest} onChange={e => setDest(Number(e.target.value))}>
                          {LOCATIONS.filter(l => l.id !== origin).map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="field-row">
                    <div className="field">
                      <label className="field-label">Weight (kg)</label>
                      <input
                        type="number"
                        min={1} max={999}
                        value={weight}
                        onChange={e => setWeight(Number(e.target.value))}
                      />
                    </div>
                    <div className="field">
                      <label className="field-label">Priority (1=Urgent, 9=Low)</label>
                      <div className="select-wrap">
                        <select value={priority} onChange={e => setPriority(Number(e.target.value))}>
                          <option value={1}>1 — Urgent</option>
                          <option value={2}>2 — Very High</option>
                          <option value={3}>3 — High</option>
                          <option value={4}>4 — Above Normal</option>
                          <option value={5}>5 — Normal</option>
                          <option value={6}>6 — Below Normal</option>
                          <option value={7}>7 — Low</option>
                          <option value={8}>8 — Very Low</option>
                          <option value={9}>9 — Deferred</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-full"
                    onClick={addPackage}
                    disabled={origin === dest}
                  >
                    + Add to Queue
                  </button>
                </div>
              </div>

              {/* Package list */}
              <div className="card">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-icon ci-amber">📋</div>
                    <div>
                      <div className="card-title">Shipment Queue</div>
                      <div className="card-subtitle">{packages.length} package{packages.length !== 1 ? 's' : ''} pending</div>
                    </div>
                  </div>
                  {packages.length > 0 && (
                    <button
                      className="btn btn-success"
                      onClick={optimize}
                      disabled={optimizing}
                    >
                      {optimizing ? '⏳ Optimizing…' : '🚀 Optimize & Dispatch'}
                    </button>
                  )}
                </div>

                {packages.length === 0 ? (
                  <div className="pkg-empty">No shipments yet — add one above</div>
                ) : (
                  <div className="pkg-list">
                    {packages.map((pkg, i) => {
                      const pl = priorityLabel(pkg.priority);
                      const orig = LOCATIONS.find(l => l.id === pkg.origin);
                      const dst  = LOCATIONS.find(l => l.id === pkg.destination);
                      return (
                        <div key={pkg.id} className="pkg-item">
                          <div className="pkg-num">{i + 1}</div>
                          <div className="pkg-info">
                            <div className="pkg-id">{pkg.id} — {pkg.description}</div>
                            <div className="pkg-route">
                              {orig?.name} → {dst?.name} · {pkg.weight}kg
                            </div>
                          </div>
                          <div className="pkg-meta">
                            <span className={`badge ${pl.cls}`}>{pl.label}</span>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => removePackage(pkg.id)}
                            >✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Route Map */}
            <RouteMap routeResults={routeResults} optimized={optimized} />
          </div>
        </div>

        {/* ── Row 2: Dispatch + Fleet ── */}
        {optimized && (
          <div>
            <div className="section-title">🚛 Dispatch & Fleet Operations</div>
            <div className="three-col">
              <div style={{ gridColumn: 'span 2' }}>
                <DispatchPanel packages={packages} dispatchSteps={dispatchSteps} routeResults={routeResults} />
              </div>
              <FleetPanel packages={packages} fleetSteps={fleetSteps} />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
