import pytest

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
