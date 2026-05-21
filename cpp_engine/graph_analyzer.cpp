#include <iostream>
#include <vector>
#include <algorithm>
#include <string>

using namespace std;

string quote(const string& s) { return "\"" + s + "\""; }

int main() {
    int n, m;
    if (!(cin >> n >> m)) return 0;

    vector<int> degree(n, 0);
    
    cout << "[\n  {\"event\": \"init\"}";

    for (int i = 0; i < m; ++i) {
        int u, v;
        cin >> u >> v;
        degree[u]++;
        degree[v]++;
        cout << ",\n  {\"event\": \"read_edge\", \"u\": " << u << ", \"v\": " << v << "}";
    }

    // Find bottleneck (max degree)
    int bottleneck = 0;
    int max_deg = degree[0];
    for (int i = 1; i < n; ++i) {
        if (degree[i] > max_deg) {
            max_deg = degree[i];
            bottleneck = i;
        }
    }

    // Find underutilized (min degree > 0 for connected components)
    int underutilized = -1;
    int min_deg = 1000000;
    for (int i = 0; i < n; ++i) {
        if (degree[i] > 0 && degree[i] < min_deg) {
            min_deg = degree[i];
            underutilized = i;
        }
    }

    cout << ",\n  {\"event\": \"analysis_complete\", \"bottleneck_node\": " << bottleneck 
         << ", \"max_traffic\": " << max_deg 
         << ", \"underutilized_node\": " << underutilized 
         << ", \"min_traffic\": " << min_deg << "}";

    cout << "\n]\n";
    return 0;
}
