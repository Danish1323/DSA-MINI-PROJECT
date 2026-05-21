#include <iostream>
#include <vector>
#include <queue>
#include <limits>
#include <string>

using namespace std;

const int INF = numeric_limits<int>::max();

struct Edge {
    int to;
    int weight;
};

// Helper for JSON escaping/formatting
string quote(const string& s) {
    return "\"" + s + "\"";
}

int main() {
    int n, m;
    if (!(cin >> n >> m)) return 0;

    vector<vector<Edge>> adj(n);
    for (int i = 0; i < m; ++i) {
        int u, v, w;
        cin >> u >> v >> w;
        adj[u].push_back({v, w});
        adj[v].push_back({u, w}); // Undirected graph for logistics
    }

    int start_node, end_node;
    cin >> start_node >> end_node;

    vector<int> dist(n, INF);
    vector<int> parent(n, -1);
    
    // priority queue: {distance, node}
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;

    cout << "[\n";
    cout << "  {\"event\": \"init\", \"nodes\": " << n << ", \"start\": " << start_node << ", \"end\": " << end_node << "}";

    dist[start_node] = 0;
    pq.push({0, start_node});

    cout << ",\n  {\"event\": \"queue_push\", \"node\": " << start_node << ", \"distance\": 0}";

    while (!pq.empty()) {
        int d = pq.top().first;
        int u = pq.top().second;
        pq.pop();

        cout << ",\n  {\"event\": \"visit\", \"node\": " << u << ", \"distance\": " << d << "}";

        if (d > dist[u]) continue;

        if (u == end_node) {
            cout << ",\n  {\"event\": \"target_reached\", \"node\": " << u << "}";
            break;
        }

        for (const auto& edge : adj[u]) {
            int v = edge.to;
            int weight = edge.weight;

            if (dist[u] + weight < dist[v]) {
                string old_dist = (dist[v] == INF) ? "\"INF\"" : to_string(dist[v]);
                dist[v] = dist[u] + weight;
                parent[v] = u;
                pq.push({dist[v], v});
                
                cout << ",\n  {\"event\": \"relax\", \"u\": " << u << ", \"v\": " << v << ", \"weight\": " << weight 
                     << ", \"old_dist\": " << old_dist << ", \"new_dist\": " << dist[v] << "}";
            }
        }
    }

    // Reconstruct path
    vector<int> path;
    if (dist[end_node] != INF) {
        for (int curr = end_node; curr != -1; curr = parent[curr]) {
            path.push_back(curr);
        }
        // Reverse path
        int left = 0, right = path.size() - 1;
        while (left < right) {
            swap(path[left], path[right]);
            left++; right--;
        }
    }

    cout << ",\n  {\"event\": \"finish\", \"path\": [";
    for (size_t i = 0; i < path.size(); ++i) {
        cout << path[i];
        if (i + 1 < path.size()) cout << ", ";
    }
    cout << "], \"total_distance\": ";
    if (dist[end_node] == INF) cout << "\"UNREACHABLE\"";
    else cout << dist[end_node];
    cout << "}\n";

    cout << "]\n";

    return 0;
}
