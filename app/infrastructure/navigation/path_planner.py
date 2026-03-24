import asyncio
import math
from collections import OrderedDict
from typing import Dict, List

import networkx as nx
import osmnx as ox

from app.core.settings import settings


class PathPlanner:
    """Calculates obstacle-avoiding paths using the OpenStreetMap street network."""

    DEFAULT_PADDING_M = 900
    MAX_GRAPH_CACHE_SIZE = 3
    MAX_PREVIEW_GRAPH_CACHE_SIZE = 5
    PREVIEW_EXCLUDED_HIGHWAYS = {
        "corridor",
        "cycleway",
        "elevator",
        "footway",
        "path",
        "pedestrian",
        "platform",
        "service",
        "steps",
        "track",
    }

    def __init__(self):
        self.G = None
        self.center_lat = settings.osm_center_lat
        self.center_lon = settings.osm_center_lon
        self.default_radius_m = settings.osm_radius_m
        self.default_bbox = self.build_point_bbox(
            self.center_lat,
            self.center_lon,
            self.default_radius_m,
        )
        self.graph_bbox = None
        self.graph_cache = OrderedDict()
        self.preview_graph_cache = OrderedDict()
        self._load_lock = asyncio.Lock()
        print("PathPlanner initialized. Map data pending...")

    def meters_to_latitude_delta(self, meters: float) -> float:
        return meters / 111_320.0

    def meters_to_longitude_delta(self, meters: float, latitude: float) -> float:
        cos_lat = max(0.1, math.cos(math.radians(latitude)))
        return meters / (111_320.0 * cos_lat)

    def calculate_distance_m(
        self,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
    ) -> float:
        earth_radius_m = 6_371_000
        start_lat_rad = math.radians(start_lat)
        end_lat_rad = math.radians(end_lat)
        lat_delta_rad = math.radians(end_lat - start_lat)
        lon_delta_rad = math.radians(end_lon - start_lon)

        a = (
            math.sin(lat_delta_rad / 2) ** 2
            + math.cos(start_lat_rad) * math.cos(end_lat_rad) * math.sin(lon_delta_rad / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return earth_radius_m * c

    def align_route_endpoints(
        self,
        route: List[Dict],
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
    ) -> List[Dict]:
        if not route:
            return route

        aligned_route = list(route)
        start_offset_m = self.calculate_distance_m(
            start_lat,
            start_lon,
            aligned_route[0]["latitude"],
            aligned_route[0]["longitude"],
        )
        end_offset_m = self.calculate_distance_m(
            end_lat,
            end_lon,
            aligned_route[-1]["latitude"],
            aligned_route[-1]["longitude"],
        )

        if start_offset_m > 1.0:
            aligned_route.insert(
                0,
                {
                    "latitude": start_lat,
                    "longitude": start_lon,
                },
            )
        else:
            aligned_route[0] = {
                "latitude": start_lat,
                "longitude": start_lon,
            }

        if end_offset_m > 1.0:
            aligned_route.append(
                {
                    "latitude": end_lat,
                    "longitude": end_lon,
                },
            )
        else:
            aligned_route[-1] = {
                "latitude": end_lat,
                "longitude": end_lon,
            }

        return aligned_route

    def build_point_bbox(self, latitude: float, longitude: float, radius_m: float) -> tuple[float, float, float, float]:
        lat_delta = self.meters_to_latitude_delta(radius_m)
        lon_delta = self.meters_to_longitude_delta(radius_m, latitude)
        return (
            longitude - lon_delta,
            latitude - lat_delta,
            longitude + lon_delta,
            latitude + lat_delta,
        )

    def build_corridor_bbox(
        self,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
        padding_m: float | None = None,
    ) -> tuple[float, float, float, float]:
        padding = padding_m or self.DEFAULT_PADDING_M
        middle_lat = (start_lat + end_lat) / 2
        lat_padding = self.meters_to_latitude_delta(padding)
        lon_padding = self.meters_to_longitude_delta(padding, middle_lat)

        return (
            min(start_lon, end_lon) + (-lon_padding),
            min(start_lat, end_lat) + (-lat_padding),
            max(start_lon, end_lon) + lon_padding,
            max(start_lat, end_lat) + lat_padding,
        )

    def bbox_contains_point(self, bbox: tuple[float, float, float, float], latitude: float, longitude: float) -> bool:
        left, bottom, right, top = bbox
        return left <= longitude <= right and bottom <= latitude <= top

    def bbox_contains_route(
        self,
        bbox: tuple[float, float, float, float],
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
    ) -> bool:
        return (
            self.bbox_contains_point(bbox, start_lat, start_lon)
            and self.bbox_contains_point(bbox, end_lat, end_lon)
        )

    def bbox_cache_key(self, bbox: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
        return tuple(round(value, 3) for value in bbox)

    def preview_tile_key(
        self,
        bbox: tuple[float, float, float, float],
        zoom_bucket: int,
    ) -> str:
        left, bottom, right, top = self.bbox_cache_key(bbox)
        return f"{zoom_bucket}:{left}:{bottom}:{right}:{top}"

    async def load_graph_for_bbox(self, bbox: tuple[float, float, float, float]) -> bool:
        async with self._load_lock:
            cache_key = self.bbox_cache_key(bbox)
            cached_graph = self.graph_cache.get(cache_key)
            if cached_graph is not None:
                self.G = cached_graph
                self.graph_bbox = bbox
                self.graph_cache.move_to_end(cache_key)
                return True

            try:
                graph = await asyncio.to_thread(
                    ox.graph_from_bbox,
                    bbox=bbox,
                    network_type="walk",
                    retain_all=False,
                    simplify=True,
                )
            except Exception as exc:
                print(f"OSM network unavailable for bbox {bbox}, falling back to direct route: {exc}")
                return False

            self.G = graph
            self.graph_bbox = bbox
            self.graph_cache[cache_key] = graph
            while len(self.graph_cache) > self.MAX_GRAPH_CACHE_SIZE:
                self.graph_cache.popitem(last=False)
            return True

    async def load_preview_graph_for_bbox(self, bbox: tuple[float, float, float, float]):
        async with self._load_lock:
            cache_key = self.bbox_cache_key(bbox)
            cached_graph = self.preview_graph_cache.get(cache_key)
            if cached_graph is not None:
                self.preview_graph_cache.move_to_end(cache_key)
                return cached_graph

            try:
                graph = await asyncio.to_thread(
                    ox.graph_from_bbox,
                    bbox=bbox,
                    network_type="walk",
                    retain_all=False,
                    simplify=True,
                )
            except Exception as exc:
                print(f"OSM preview graph unavailable for bbox {bbox}: {exc}")
                return None

            self.preview_graph_cache[cache_key] = graph
            while len(self.preview_graph_cache) > self.MAX_PREVIEW_GRAPH_CACHE_SIZE:
                self.preview_graph_cache.popitem(last=False)
            return graph

    def should_keep_preview_edge(self, data: Dict) -> bool:
        highway = data.get("highway")
        if highway is None:
            return True

        highway_values = highway if isinstance(highway, list) else [highway]
        return any(value not in self.PREVIEW_EXCLUDED_HIGHWAYS for value in highway_values)

    def simplify_graph_for_preview(self, graph):
        preview_graph = graph.copy()
        removable_edges = []

        for u, v, key, data in preview_graph.edges(keys=True, data=True):
            if not self.should_keep_preview_edge(data):
                removable_edges.append((u, v, key))

        if removable_edges:
            preview_graph.remove_edges_from(removable_edges)

        isolated_nodes = [node for node, degree in preview_graph.degree() if degree == 0]
        if isolated_nodes:
            preview_graph.remove_nodes_from(isolated_nodes)

        if preview_graph.number_of_edges() == 0:
            return graph

        undirected_graph = preview_graph.to_undirected()
        if undirected_graph.number_of_nodes() == 0:
            return graph

        largest_component = max(nx.connected_components(undirected_graph), key=len)
        return preview_graph.subgraph(largest_component).copy()

    def build_preview_graph_payload(
        self,
        graph,
        bbox: tuple[float, float, float, float],
        zoom_bucket: int,
    ) -> Dict:
        preview_graph = self.simplify_graph_for_preview(graph)
        nodes = []
        edges = []
        seen_edges = set()

        for node_id, data in preview_graph.nodes(data=True):
            nodes.append(
                {
                    "id": str(node_id),
                    "lat": data["y"],
                    "lon": data["x"],
                }
            )

        for u, v, data in preview_graph.edges(data=True):
            edge_key = (str(u), str(v))
            if edge_key in seen_edges or u == v:
                continue
            seen_edges.add(edge_key)
            edges.append(
                {
                    "from": str(u),
                    "to": str(v),
                    "cost": float(data.get("length", 1.0)),
                }
            )

        return {
            "tile_key": self.preview_tile_key(bbox, zoom_bucket),
            "zoom_bucket": zoom_bucket,
            "bbox": {
                "left": bbox[0],
                "bottom": bbox[1],
                "right": bbox[2],
                "top": bbox[3],
            },
            "nodes": nodes,
            "edges": edges,
        }

    async def get_preview_graph_tile(
        self,
        left: float,
        bottom: float,
        right: float,
        top: float,
        zoom_bucket: int,
    ) -> Dict:
        bbox = (left, bottom, right, top)
        graph = await self.load_preview_graph_for_bbox(bbox)
        if graph is None:
            return self.build_preview_graph_payload(nx.MultiDiGraph(), bbox, zoom_bucket)

        return self.build_preview_graph_payload(graph, bbox, zoom_bucket)

    async def ensure_graph_for_route(
        self,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
    ) -> bool:
        if self.G is not None and self.graph_bbox and self.bbox_contains_route(
            self.graph_bbox,
            start_lat,
            start_lon,
            end_lat,
            end_lon,
        ):
            return True

        target_bbox = self.default_bbox
        if not self.bbox_contains_route(target_bbox, start_lat, start_lon, end_lat, end_lon):
            target_bbox = self.build_corridor_bbox(start_lat, start_lon, end_lat, end_lon)

        return await self.load_graph_for_bbox(target_bbox)

    async def load_map_data(self):
        """Downloads and caches the default street network once per process."""
        return await self.load_graph_for_bbox(self.default_bbox)

    def calculate_path(self, start_lat, start_lon, end_lat, end_lon) -> List[Dict]:
        if self.G is None:
            raise RuntimeError("Map data not loaded. Call load_map_data first.")

        orig_node = ox.distance.nearest_nodes(self.G, start_lon, start_lat)
        dest_node = ox.distance.nearest_nodes(self.G, end_lon, end_lat)
        snapped_start_lat = self.G.nodes[orig_node]["y"]
        snapped_start_lon = self.G.nodes[orig_node]["x"]
        snapped_end_lat = self.G.nodes[dest_node]["y"]
        snapped_end_lon = self.G.nodes[dest_node]["x"]

        start_offset_m = self.calculate_distance_m(start_lat, start_lon, snapped_start_lat, snapped_start_lon)
        end_offset_m = self.calculate_distance_m(end_lat, end_lon, snapped_end_lat, snapped_end_lon)

        print(
            "OSM snap offsets | "
            f"start_raw=({start_lat:.6f}, {start_lon:.6f}) "
            f"start_snapped=({snapped_start_lat:.6f}, {snapped_start_lon:.6f}) "
            f"start_offset_m={start_offset_m:.2f} | "
            f"target_raw=({end_lat:.6f}, {end_lon:.6f}) "
            f"target_snapped=({snapped_end_lat:.6f}, {snapped_end_lon:.6f}) "
            f"target_offset_m={end_offset_m:.2f}"
        )

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

        if await self.ensure_graph_for_route(start_lat, start_lon, end_lat, end_lon):
            try:
                route = self.calculate_path(start_lat, start_lon, end_lat, end_lon)
                route = self.align_route_endpoints(route, start_lat, start_lon, end_lat, end_lon)
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
