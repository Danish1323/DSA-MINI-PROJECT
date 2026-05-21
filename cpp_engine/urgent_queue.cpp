#include <iostream>
#include <vector>
#include <queue>
#include <string>

using namespace std;

struct Package {
    string id;
    int priority; // Lower number means higher priority

    bool operator>(const Package& other) const {
        return priority > other.priority;
    }
};

string quote(const string& s) {
    return "\"" + s + "\"";
}

int main() {
    int n;
    if (!(cin >> n)) return 0;

    priority_queue<Package, vector<Package>, greater<Package>> pq;
    vector<Package> current_elements; // To simulate showing the whole queue state

    cout << "[\n";
    cout << "  {\"event\": \"init\"}";

    for (int i = 0; i < n; ++i) {
        string op;
        cin >> op;

        if (op == "ADD") {
            string id;
            int priority;
            cin >> id >> priority;
            pq.push({id, priority});
            current_elements.push_back({id, priority});
            
            cout << ",\n  {\"event\": \"add\", \"package\": " << quote(id) 
                 << ", \"priority\": " << priority << "}";
        } else if (op == "PROCESS") {
            if (!pq.empty()) {
                Package p = pq.top();
                pq.pop();
                
                // Remove from current_elements for visualization state
                for (auto it = current_elements.begin(); it != current_elements.end(); ++it) {
                    if (it->id == p.id) {
                        current_elements.erase(it);
                        break;
                    }
                }

                cout << ",\n  {\"event\": \"process\", \"package\": " << quote(p.id) 
                     << ", \"priority\": " << p.priority << "}";
            } else {
                cout << ",\n  {\"event\": \"process_empty\"}";
            }
        }
        
        // Dump the current "unordered" state so the frontend can animate sorting visually
        cout << ",\n  {\"event\": \"state\", \"queue\": [";
        for (size_t j = 0; j < current_elements.size(); ++j) {
            cout << "{\"id\": " << quote(current_elements[j].id) << ", \"priority\": " << current_elements[j].priority << "}";
            if (j + 1 < current_elements.size()) cout << ", ";
        }
        cout << "]}";
    }

    cout << "\n]\n";
    return 0;
}
