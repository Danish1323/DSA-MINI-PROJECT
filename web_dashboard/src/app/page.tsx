import NetworkVisualizer from '@/components/NetworkVisualizer';
import QueueVisualizer from '@/components/QueueVisualizer';
import GreedyVisualizer from '@/components/GreedyVisualizer';
import { Boxes } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="header-icon-wrap">
            <Boxes className="header-icon" />
          </div>
          <div>
            <h1 className="header-title">Logistics Control Room</h1>
            <p className="header-subtitle">Interactive DSA algorithm visualizer — powered by native C++ engines</p>
          </div>
        </div>
        <div className="header-badges">
          <span className="badge badge-green">C++ Backend</span>
          <span className="badge badge-indigo">Dijkstra</span>
          <span className="badge badge-amber">Min-Heap</span>
          <span className="badge badge-cyan">Greedy</span>
        </div>
      </header>

      <main className="dashboard-main">
        <NetworkVisualizer />
        <div className="dashboard-grid-2">
          <QueueVisualizer />
          <GreedyVisualizer />
        </div>
      </main>
    </div>
  );
}
