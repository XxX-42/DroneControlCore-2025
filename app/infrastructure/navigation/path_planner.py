import asyncio
import math
from typing import Dict, List

import networkx as nx
import osmnx as ox

from app.core.settings import settings


class PathPlanner:
    """Calculates obstacle-avoiding paths using the OpenStreetMap street network."""

    def __init__(self):
        self.G = None
        self.center_lat = settings.osm_center_lat
        self.center_lon = settings.osm_center_lon
        self._load_lock = asyncio.Lock()
        self._load_attempted = False
        print("PathPlanner initialized. Map data pending...")

    async def load_map_data(self):
        """Downloads and caches the street network once per process."""
        async with self._load_lock:
            if self.G is not None or self._load_attempted:
                return self.G is not None

            self._load_attempted = True
            print("Downloading OSM network for avoidance...")
            try:
                self.G = await asyncio.to_thread(
                    ox.graph_from_point,
                    (self.center_lat, self.center_lon),
                    dist=settings.osm_radius_m,
                    network_type="walk",
                    retain_all=False,
                    simplify=True,
                )
                print("OSM Network loaded successfully.")
                return True
            except Exception as exc:
                print(f"OSM network unavailable, falling back to direct route: {exc}")
                self.G = None
                return False

    def calculate_path(self, start_lat, start_lon, end_lat, end_lon) -> List[Dict]:
        if self.G is None:
            raise RuntimeError("Map data not loaded. Call load_map_data first.")

        orig_node = ox.distance.nearest_nodes(self.G, start_lon, start_lat)
        dest_node = ox.distance.nearest_nodes(self.G, end_lon, end_lat)

        try:
            route_nodes = nx.shortest_path(self.G, orig_node, dest_node, weight="length")
        except nx.NetworkXNoPath:
            print("ERROR: No safe path found between start and end nodes.")
            return []

        coords = []
        for node in route_nodes:
            coords.append(
                {
                    "latitude": self.G.nodes[node]["y"],
                    "longitude": self.G.nodes[node]["x"],
                }
            )

        print(f"Path calculated: {len(coords)} nodes found.")
        return coords

    def build_direct_path(
        self,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
        segments: int = 12,
    ) -> List[Dict]:
        route = []
        steps = max(2, segments)
        for index in range(steps + 1):
            ratio = index / steps
            route.append(
                {
                    "latitude": start_lat + ((end_lat - start_lat) * ratio),
                    "longitude": start_lon + ((end_lon - start_lon) * ratio),
                }
            )
        return route

    async def plan_path(
        self,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
    ) -> Dict:
        route = None
        route_type = "direct"

        if await self.load_map_data():
            try:
                route = self.calculate_path(start_lat, start_lon, end_lat, end_lon)
                route_type = "osm"
            except Exception as exc:
                print(f"OSM route calculation failed, using direct route: {exc}")

        if not route:
            approx_distance_deg = math.hypot(end_lat - start_lat, end_lon - start_lon)
            dynamic_segments = max(8, min(40, int(approx_distance_deg / 0.0003)))
            route = self.build_direct_path(
                start_lat,
                start_lon,
                end_lat,
                end_lon,
                segments=dynamic_segments,
            )

        route[0]["is_user_target"] = False
        route[-1]["is_user_target"] = True
        return {
            "route_type": route_type,
            "fallback_used": route_type != "osm",
            "waypoints": route,
        }


path_planner = PathPlanner()
