import osmnx as ox
import networkx as nx
from typing import List, Dict

class PathPlanner:
    """Calculates obstacle-avoiding paths using the OpenStreetMap street network."""
    
    def __init__(self):
        # Initial map area (Can be expanded as needed)
        self.G = None
        self.center_lat = 30.598
        self.center_lon = 103.991
        print("PathPlanner initialized. Map data pending...")

    async def load_map_data(self):
        """Downloads and caches the street network for a fixed area (Chengdu)."""
        # Download 'walk' network within 5km radius to simulate safer, non-direct routes
        print("Downloading OSM network for avoidance...")
        self.G = ox.graph_from_point(
            (self.center_lat, self.center_lon), 
            dist=5000, 
            network_type='walk', 
            retain_all=False, 
            simplify=True
        )
        print("OSM Network loaded successfully.")

    def calculate_path(self, start_lat, start_lon, end_lat, end_lon) -> List[Dict]:
        """Calculates the shortest path avoiding non-street areas (buildings)."""
        if self.G is None:
            raise RuntimeError("Map data not loaded. Call load_map_data first.")
            
        # 1. Find nearest network nodes to start and end points
        orig_node = ox.distance.nearest_nodes(self.G, start_lon, start_lat)
        dest_node = ox.distance.nearest_nodes(self.G, end_lon, end_lat)

        # 2. Use NetworkX (A* by default) to find the shortest path
        try:
            route_nodes = nx.shortest_path(self.G, orig_node, dest_node, weight='length')
        except nx.NetworkXNoPath:
            # If no path found (e.g., trying to fly to a disconnected island)
            print("ERROR: No safe path found between start and end nodes.")
            return []

        # 3. Convert node IDs back to (lat, lon) coordinates
        coords = []
        for node in route_nodes:
            # OSMnx stores lon in 'x' and lat in 'y'
            coords.append({
                "latitude": self.G.nodes[node]['y'],
                "longitude": self.G.nodes[node]['x']
            })
            
        print(f"Path calculated: {len(coords)} nodes found.")
        return coords

# Global Planner Instance
path_planner = PathPlanner()
