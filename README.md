# 🚛 Courier Logistics DSA Visualizer

An interactive **Data Structures & Algorithms** visualizer built for a courier logistics network. The system uses **native C++ engines** for algorithmic computation and a **React/Next.js dashboard** for step-by-step animated visualization.

Each algorithm is implemented in pure C++ and outputs structured JSON events. The web frontend consumes these events and renders interactive, educational animations — making it easy to understand how Dijkstra's shortest path, min-heap priority queues, and greedy assignment actually work.

---

## ✨ Features

- **Dijkstra's Shortest Path** — Find the optimal delivery route through a 6-node weighted graph with animated edge relaxation, distance updates, and path highlighting
- **Priority Queue (Min-Heap)** — Visualize insert and extract-min operations on a binary heap for urgent package dispatch
- **Greedy Package Assignment** — Watch packages get scored, sorted, and assigned to trucks using a greedy heuristic
- **Step-by-Step Explanations** — Every step includes a plain-English description explaining *what* is happening and *why*
- **Live Distance Table** — Dijkstra's visualizer shows a real-time distance table updating as the algorithm runs
- **C++ Execution Trace** — Raw output from the C++ engines displayed alongside the visualization
- **Auto-play & Manual Stepping** — Play through automatically or step forward/backward at your own pace

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Web Browser                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │         React Frontend (Next.js)                │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │    │
│  │  │ Dijkstra │ │  Queue   │ │   Greedy     │    │    │
│  │  │   Viz    │ │   Viz    │ │    Viz       │    │    │
│  │  └────┬─────┘ └────┬─────┘ └──────┬───────┘    │    │
│  │       │             │              │            │    │
│  │  ┌────▼─────────────▼──────────────▼───────┐    │    │
│  │  │         Next.js API Routes              │    │    │
│  │  │  /api/run-dijkstra                      │    │    │
│  │  │  /api/run-queue                         │    │    │
│  │  │  /api/run-greedy                        │    │    │
│  │  │  /api/run-analyzer                      │    │    │
│  │  └────┬─────────────┬──────────────┬───────┘    │    │
│  └───────│─────────────│──────────────│────────────┘    │
│          │ stdin/stdout │              │                 │
└──────────│─────────────│──────────────│─────────────────┘
           │             │              │
┌──────────▼─────────────▼──────────────▼─────────────────┐
│                   C++ Engines                           │
│  ┌──────────────┐ ┌─────────────┐ ┌───────────────┐    │
│  │  dijkstra_   │ │  urgent_    │ │   greedy_     │    │
│  │  router      │ │  queue      │ │   assigner    │    │
│  └──────────────┘ └─────────────┘ └───────────────┘    │
│  ┌──────────────┐                                      │
│  │  graph_      │  All compiled with g++ -O2           │
│  │  analyzer    │                                      │
│  └──────────────┘                                      │
└─────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User clicks "Run Algorithm" on the dashboard
2. React sends a POST request to the Next.js API route
3. The API route spawns the corresponding C++ binary via `child_process.exec()`
4. Input is piped to the binary via stdin
5. The C++ engine processes the input and outputs a JSON array of step events to stdout
6. The API route parses the JSON and returns it to the frontend
7. React animates through each step, updating the visualization and explanation

---

## 📁 Project Structure

```
Mini-Project/
├── cpp_engine/                    # C++ algorithm implementations
│   ├── Makefile                   # Build all 4 engines
│   ├── dijkstra_router.cpp        # Dijkstra's shortest path (adjacency list + min-heap)
│   ├── urgent_queue.cpp           # Priority queue operations (min-heap)
│   ├── greedy_assigner.cpp        # Greedy assignment (sort + sequential assign)
│   └── graph_analyzer.cpp         # Graph degree analysis (bottleneck detection)
│
└── web_dashboard/                 # Next.js React frontend
    └── src/
        ├── app/
        │   ├── layout.tsx         # Root layout with fonts & metadata
        │   ├── page.tsx           # Dashboard page composing all visualizers
        │   ├── globals.css        # Design system (clean professional theme)
        │   └── api/
        │       ├── run-dijkstra/route.ts   # Spawns dijkstra_router binary
        │       ├── run-queue/route.ts      # Spawns urgent_queue binary
        │       ├── run-greedy/route.ts     # Spawns greedy_assigner binary
        │       └── run-analyzer/route.ts   # Spawns graph_analyzer binary
        │
        └── components/
            ├── NetworkVisualizer.tsx    # Dijkstra graph visualization + distance table
            ├── QueueVisualizer.tsx      # Min-heap tree visualization
            └── GreedyVisualizer.tsx     # Bar chart with sort animation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **g++** with C++17 support
- **npm**

### 1. Compile the C++ Engines

```bash
cd cpp_engine
make clean && make
```

This compiles 4 binaries: `dijkstra_router`, `urgent_queue`, `greedy_assigner`, `graph_analyzer`

### 2. Install Frontend Dependencies

```bash
cd web_dashboard
npm install
```

### 3. Start the Development Server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 📊 Algorithms & Data Structures

### 1. Dijkstra's Shortest Path

| Property | Value |
|---|---|
| **File** | `dijkstra_router.cpp` |
| **Data Structures** | Adjacency List (graph), Min-Heap Priority Queue |
| **Time Complexity** | O((V + E) log V) |
| **Space Complexity** | O(V + E) |

**How it works:** Finds the minimum-cost path between two nodes in a weighted graph. Uses a priority queue to always expand the nearest unvisited node. When a shorter path to a neighbor is discovered, it "relaxes" the edge and updates the distance.

**Key operations visualized:**
- `INIT` — Graph loaded, distances set to ∞
- `VISIT` — Dequeue the closest node from the min-heap
- `RELAX` — Found a shorter path through the current node
- `TARGET` — Destination reached, shortest path guaranteed
- `DONE` — Path reconstructed via parent pointers

---

### 2. Priority Queue (Min-Heap)

| Property | Value |
|---|---|
| **File** | `urgent_queue.cpp` |
| **Data Structure** | Binary Min-Heap |
| **Insert** | O(log n) |
| **Extract-Min** | O(log n) |
| **Peek** | O(1) |

**How it works:** A complete binary tree where every parent is ≤ its children. Insert adds at the bottom and bubbles up. Extract-min removes the root, replaces with the last element, and sinks down.

**Key operations visualized:**
- `INSERT` — Package added, heap restructures (bubble up)
- `EXTRACT-MIN` — Most urgent package removed and dispatched (sink down)
- `STATE` — Current heap structure shown as a tree

---

### 3. Greedy Package Assignment

| Property | Value |
|---|---|
| **File** | `greedy_assigner.cpp` |
| **Algorithm** | Greedy (sort + sequential assign) |
| **Time Complexity** | O(n log n) — dominated by sorting |
| **Space Complexity** | O(n) |

**How it works:** Each package gets a score = cost + time. Packages are sorted by score (ascending). The algorithm assigns the cheapest package first — a classic greedy strategy that makes the best local choice at each step.

**Phases visualized:**
1. **Score Calculation** — Compute score for each package
2. **Greedy Sort** — Sort packages by score (uses Introsort internally)
3. **Dispatch** — Assign packages to trucks in sorted order

---

### 4. Graph Degree Analysis

| Property | Value |
|---|---|
| **File** | `graph_analyzer.cpp` |
| **Algorithm** | Linear scan |
| **Time Complexity** | O(V + E) |
| **Space Complexity** | O(V) |

**How it works:** Counts the degree (number of connections) of each node. The node with the highest degree is the bottleneck; the node with the lowest degree is underutilized.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Algorithm Engines** | C++17, g++ -O2 | High-performance DSA computation |
| **Frontend Framework** | Next.js 16, React 19 | Server-side rendering + API routes |
| **Styling** | Tailwind CSS 4 | Clean, professional design system |
| **Animations** | Framer Motion | Smooth layout transitions for heap/bar animations |
| **Icons** | Lucide React | Consistent iconography |
| **Language** | TypeScript | Type-safe frontend code |
| **IPC** | child_process (stdin/stdout) | Bridge between Node.js and C++ binaries |

---

## 🔧 C++ Engine I/O Format

Each C++ engine reads from **stdin** and writes a JSON array to **stdout**. Example for Dijkstra:

**Input (stdin):**
```
6 8
0 1 7
0 2 3
1 3 2
2 1 1
2 4 6
3 5 4
4 5 2
3 4 1
0 5
```
Format: `n m` (nodes, edges), then `u v w` for each edge, then `start end`

**Output (stdout):**
```json
[
  {"event": "init", "nodes": 6, "start": 0, "end": 5},
  {"event": "queue_push", "node": 0, "distance": 0},
  {"event": "visit", "node": 0, "distance": 0},
  {"event": "relax", "u": 0, "v": 1, "weight": 7, "old_dist": "INF", "new_dist": 7},
  {"event": "relax", "u": 0, "v": 2, "weight": 3, "old_dist": "INF", "new_dist": 3},
  ...
  {"event": "finish", "path": [0, 2, 1, 3, 4, 5], "total_distance": 9}
]
```

---

## 📝 How to Add a New Algorithm

1. **Create a C++ engine** in `cpp_engine/` that reads stdin and outputs JSON events to stdout
2. **Add it to the Makefile** with a new build target
3. **Create an API route** in `web_dashboard/src/app/api/run-<name>/route.ts`
4. **Build a React visualizer** in `web_dashboard/src/components/<Name>Visualizer.tsx`
5. **Add it to the dashboard** in `page.tsx`

---

## 👥 Team

Built as a DSA Mini Project for university coursework.

---

## 📄 License

This project is for educational purposes.
