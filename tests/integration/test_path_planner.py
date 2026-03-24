import pytest
import networkx as nx

from app.infrastructure.navigation.path_planner import PathPlanner


def test_build_corridor_bbox_contains_route_endpoints():
    planner = PathPlanner()

    bbox = planner.build_corridor_bbox(
        start_lat=30.598,
        start_lon=103.991,
        end_lat=30.72,
        end_lon=104.13,
        padding_m=800,
    )

    assert planner.bbox_contains_route(
      bbox,
      30.598,
      103.991,
      30.72,
      104.13,
    )
    assert bbox != planner.default_bbox


@pytest.mark.asyncio
async def test_plan_path_uses_directional_bbox_for_distant_targets(monkeypatch):
    planner = PathPlanner()
    captured = {}

    async def fake_load_graph_for_bbox(bbox):
        captured["bbox"] = bbox
        planner.G = object()
        planner.graph_bbox = bbox
        return True

    monkeypatch.setattr(planner, "load_graph_for_bbox", fake_load_graph_for_bbox)
    monkeypatch.setattr(
        planner,
        "calculate_path",
        lambda start_lat, start_lon, end_lat, end_lon: [
            {"latitude": start_lat, "longitude": start_lon},
            {"latitude": end_lat, "longitude": end_lon},
        ],
    )

    result = await planner.plan_path(30.598, 103.991, 30.72, 104.13)

    assert result["route_type"] == "osm"
    assert result["fallback_used"] is False
    assert result["waypoints"][-1]["is_user_target"] is True
    assert captured["bbox"] != planner.default_bbox
    assert planner.bbox_contains_route(captured["bbox"], 30.598, 103.991, 30.72, 104.13)


@pytest.mark.asyncio
async def test_plan_path_aligns_osm_route_to_exact_clicked_endpoints(monkeypatch):
    planner = PathPlanner()

    async def fake_load_graph_for_bbox(_bbox):
        planner.G = object()
        planner.graph_bbox = planner.default_bbox
        return True

    def fake_calculate_path(_start_lat, _start_lon, _end_lat, _end_lon):
        return [
            {"latitude": 30.5983, "longitude": 103.9914},
            {"latitude": 30.6008, "longitude": 103.9941},
        ]

    monkeypatch.setattr(planner, "load_graph_for_bbox", fake_load_graph_for_bbox)
    monkeypatch.setattr(planner, "calculate_path", fake_calculate_path)

    result = await planner.plan_path(30.598, 103.991, 30.601, 103.995)

    assert result["route_type"] == "osm"
    assert result["waypoints"][0]["latitude"] == 30.598
    assert result["waypoints"][0]["longitude"] == 103.991
    assert result["waypoints"][-1]["latitude"] == 30.601
    assert result["waypoints"][-1]["longitude"] == 103.995
    assert result["waypoints"][-1]["is_user_target"] is True


@pytest.mark.asyncio
async def test_ensure_graph_reuses_loaded_bbox_without_reload(monkeypatch):
    planner = PathPlanner()
    planner.G = object()
    planner.graph_bbox = planner.build_corridor_bbox(30.598, 103.991, 30.63, 104.02, padding_m=800)

    load_calls = []

    async def fake_load_graph_for_bbox(bbox):
        load_calls.append(bbox)
        return True

    monkeypatch.setattr(planner, "load_graph_for_bbox", fake_load_graph_for_bbox)

    loaded = await planner.ensure_graph_for_route(30.6, 104.0, 30.62, 104.01)

    assert loaded is True
    assert load_calls == []


@pytest.mark.asyncio
async def test_get_preview_graph_tile_exports_nodes_and_edges(monkeypatch):
    planner = PathPlanner()
    graph = nx.MultiDiGraph()
    graph.add_node(1, x=103.991, y=30.598)
    graph.add_node(2, x=103.995, y=30.6)
    graph.add_edge(1, 2, length=120.0, highway="residential")

    async def fake_load_preview_graph_for_bbox(_bbox):
        return graph

    monkeypatch.setattr(planner, "load_preview_graph_for_bbox", fake_load_preview_graph_for_bbox)

    tile = await planner.get_preview_graph_tile(103.98, 30.59, 104.01, 30.61, 14)

    assert tile["zoom_bucket"] == 14
    assert tile["bbox"]["left"] == 103.98
    assert tile["nodes"][0]["id"] == "1"
    assert tile["edges"][0]["to"] == "2"
