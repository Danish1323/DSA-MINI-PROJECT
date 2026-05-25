"use client";
import { LOCATIONS, Package, RouteResult } from '@/app/page';

interface Props {
  packages: Package[];
  dispatchSteps: any[];
  routeResults: RouteResult[];
}

function priorityLabel(p: number) {
  if (p <= 2) return { label: 'Urgent',  cls: 'b-red' };
  if (p <= 4) return { label: 'High',    cls: 'b-amber' };
  if (p <= 6) return { label: 'Normal',  cls: 'b-blue' };
  return             { label: 'Low',     cls: 'b-muted' };
}

export default function DispatchPanel({ packages, dispatchSteps, routeResults }: Props) {
  // Extract dispatch order from queue steps
  const dispatchOrder: string[] = dispatchSteps
    .filter(s => s.event === 'process')
    .map(s => s.package);

  const pkgMap = new Map(packages.map(p => [p.id, p]));
  const routeMap = new Map(routeResults.map(r => [r.pkg.id, r]));

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-icon ci-amber">🚦</div>
          <div>
            <div className="card-title">Dispatch Order</div>
            <div className="card-subtitle">Sorted by priority — most urgent first</div>
          </div>
        </div>
        <span className="badge b-green">{dispatchOrder.length} shipments queued</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="dispatch-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Shipment ID</th>
              <th>Description</th>
              <th>Origin</th>
              <th>Destination</th>
              <th>Weight</th>
              <th>Priority</th>
              <th>Optimal Route</th>
              <th>Distance</th>
            </tr>
          </thead>
          <tbody>
            {dispatchOrder.map((id, i) => {
              const pkg   = pkgMap.get(id);
              const route = routeMap.get(id);
              if (!pkg) return null;
              const pl   = priorityLabel(pkg.priority);
              const orig = LOCATIONS.find(l => l.id === pkg.origin);
              const dst  = LOCATIONS.find(l => l.id === pkg.destination);
              const pathStr = route?.path
                .map(n => LOCATIONS.find(l => l.id === n)?.short)
                .join(' → ') ?? '—';

              return (
                <tr key={id}>
                  <td className="td-mono td-muted">{i + 1}</td>
                  <td className="td-mono">{id}</td>
                  <td>{pkg.description}</td>
                  <td className="td-muted">{orig?.name}</td>
                  <td className="td-muted">{dst?.name}</td>
                  <td className="td-mono td-muted">{pkg.weight} kg</td>
                  <td><span className={`badge ${pl.cls}`}>{pl.label}</span></td>
                  <td>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
                      {pathStr}
                    </span>
                  </td>
                  <td className="td-mono" style={{ color: 'var(--cyan)' }}>
                    {route?.totalKm ?? '—'} km
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
