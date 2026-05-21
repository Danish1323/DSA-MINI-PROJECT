CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2
INCLUDES = -I./include

TARGETS = dijkstra_router urgent_queue greedy_assigner graph_analyzer

all: $(TARGETS)

dijkstra_router: dijkstra_router.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) -o dijkstra_router dijkstra_router.cpp

urgent_queue: urgent_queue.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) -o urgent_queue urgent_queue.cpp

greedy_assigner: greedy_assigner.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) -o greedy_assigner greedy_assigner.cpp

graph_analyzer: graph_analyzer.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) -o graph_analyzer graph_analyzer.cpp

clean:
	rm -f $(TARGETS)
