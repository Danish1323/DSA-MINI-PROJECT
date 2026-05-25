"use client";
import { motion } from 'framer-motion';
import { Package } from '@/app/page';

interface Props {
  packages: Package[];
  fleetSteps: any[];
}

const TRUCKS = [
  { id: 'TRK-01', name: 'Alpha',  capacity: 3, region: 'North Zone' },
  { id: 'TRK-02', name: 'Beta',   capacity: 3, region: 'South Zone' },
  { id: 'TRK-03', name: 'Gamma',  capacity: 2, region: 'East Zone'  },
];

function effBadge(score: number) {
  if (score <= 5)  return { label: 'Excellent', cls: 'b-green' };
  if (score <= 10) return { label: 'Good',      cls: 'b-blue' };
  if (score <= 15) return { label: 'Fair',      cls: 'b-amber' };
  return               { label: 'Costly',   cls: 'b-red' };
}

export default function FleetPanel({ packages, fleetSteps }: Props) {
  // Extract assignment order from greedy steps
  const assignOrder: string[] = fleetSteps
    .filter(s => s.event === 'assign')
    .map(s => s.package);

  // Get scored packages from greedy output
  const scoredMap = new Map<string, number>();
  const sortStep = fleetSteps.find(s => s.event === 'sort');
  if (sortStep?.packages) {
    sortStep.packages.forEach((p: any) => scoredMap.set(p.id, p.score));
  }

  const pkgMap = new Map(packages.map(p => [p.id, p]));

  // Distribute round-robin across trucks
  const truckLoads: Record<string, string[]> = {};
  TRUCKS.forEach(t => { truckLoads[t.id] = []; });
  assignOrder.forEach((id, i) => {
    const truck = TRUCKS[i % TRUCKS.length];
    truckLoads[truck.id].push(id);
  });

  const totalAssigned = assignOrder.length;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-icon ci-green">🚛</div>
          <div>
            <div className="card-title">Fleet Assignment</div>
            <div className="card-subtitle">Optimal truck allocation</div>
          </div>
        </div>
        {totalAssigned > 0 && (
          <span className="badge b-green">{totalAssigned} assigned</span>
        )}
      </div>

      {/* Truck status */}
      <div className="fleet-grid">
        {TRUCKS.map(truck => {
          const load = truckLoads[truck.id].length;
          const pct  = Math.min(Math.round((load / truck.capacity) * 100), 100);
          const barColor = pct >= 100 ? '#22c55e' : pct > 50 ? '#f59e0b' : '#3b82f6';
          return (
            <div key={truck.id} className="fleet-card">
              <div className="fleet-card-id">{truck.id}</div>
              <div className="fleet-card-name">Truck {truck.name}</div>
              <div className="fleet-card-stat">{truck.region}</div>
              <div className="fleet-card-stat">{load} / {truck.capacity} pkgs</div>
              <div className="fleet-bar">
                <motion.div
                  className="fleet-bar-fill"
                  style={{ background: barColor }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Assignment list */}
      <div className="fleet-assignments">
        {assignOrder.length === 0 ? (
          <div className="idle-state" style={{ padding: '24px 0' }}>
            <div className="idle-icon">🚛</div>
            <div className="idle-text">No assignments yet</div>
          </div>
        ) : (
          assignOrder.map((id, i) => {
            const pkg   = pkgMap.get(id);
            const score = scoredMap.get(id) ?? 0;
            const truck = TRUCKS[i % TRUCKS.length];
            const eff   = effBadge(score);
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="fleet-row"
              >
                <span className="fleet-row-num">{i + 1}</span>
                <span className="fleet-row-id">{id}</span>
                <span className="fleet-row-truck">→ {truck.name}</span>
                {pkg && (
                  <span className="fleet-row-score">{pkg.weight}kg · P{pkg.priority}</span>
                )}
                <span className={`badge ${eff.cls}`}>{eff.label}</span>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Summary */}
      {totalAssigned > 0 && (
        <div style={{
          padding: '10px 18px', borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', gap: '16px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
            Trucks active: <strong style={{ color: 'var(--text)' }}>
              {TRUCKS.filter(t => truckLoads[t.id].length > 0).length} / {TRUCKS.length}
            </strong>
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
            Assigned: <strong style={{ color: 'var(--text)' }}>{totalAssigned} / {packages.length}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
