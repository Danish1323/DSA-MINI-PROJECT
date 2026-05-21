#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

struct Package {
    string id;
    int cost;
    int time;
    int score() const { return cost + time; }
};

string quote(const string& s) { return "\"" + s + "\""; }

int main() {
    int n;
    if (!(cin >> n)) return 0;
    
    vector<Package> packages(n);
    for (int i = 0; i < n; ++i) {
        cin >> packages[i].id >> packages[i].cost >> packages[i].time;
    }

    cout << "[\n  {\"event\": \"init\"}";

    // Step 1: Calculate scores
    cout << ",\n  {\"event\": \"calc_scores\", \"packages\": [";
    for (int i = 0; i < n; ++i) {
        cout << "{\"id\": " << quote(packages[i].id) << ", \"score\": " << packages[i].score() << "}";
        if (i + 1 < n) cout << ", ";
    }
    cout << "]}";

    // Step 2: Sort based on greedy choice
    sort(packages.begin(), packages.end(), [](const Package& a, const Package& b) {
        return a.score() < b.score();
    });

    cout << ",\n  {\"event\": \"sort\", \"packages\": [";
    for (int i = 0; i < n; ++i) {
        cout << "{\"id\": " << quote(packages[i].id) << ", \"score\": " << packages[i].score() << "}";
        if (i + 1 < n) cout << ", ";
    }
    cout << "]}";

    // Step 3: Assign sequentially
    for (int i = 0; i < n; ++i) {
        cout << ",\n  {\"event\": \"assign\", \"package\": " << quote(packages[i].id) << "}";
    }

    cout << "\n]\n";
    return 0;
}
