import { ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/navigationApi", () => ({
  planNavigation: vi.fn(),
}));

import { planNavigation } from "../services/navigationApi";
import { useRoutePlanning } from "./useRoutePlanning";

describe("useRoutePlanning", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plans route and updates reactive state", async () => {
    planNavigation.mockResolvedValue({
      route_type: "osm",
      waypoints: [
        { latitude: 30.5, longitude: 103.9 },
        { latitude: 30.6, longitude: 104.0 },
      ],
    });

    const setStatusMessage = vi.fn();
    const routePlanning = useRoutePlanning({
      apiBaseUrl: "http://api",
      droneState: ref({ lat: 30.4, lon: 103.8 }),
      setStatusMessage,
    });

    const result = await routePlanning.planRouteToTarget(30.6, 104.0);

    expect(result.route_type).toBe("osm");
    expect(routePlanning.routeType.value).toBe("osm");
    expect(routePlanning.waypoints.value).toHaveLength(2);
    expect(routePlanning.plannedRoute.value).toEqual([
      [30.5, 103.9],
      [30.6, 104.0],
    ]);
    expect(setStatusMessage).toHaveBeenCalledWith("Route planned via OSM");
  });

  it("handles planning failure and resets route type", async () => {
    planNavigation.mockRejectedValue(new Error("planner failed"));

    const routePlanning = useRoutePlanning({
      apiBaseUrl: "http://api",
      droneState: ref({ lat: 30.4, lon: 103.8 }),
      setStatusMessage: vi.fn(),
    });

    const result = await routePlanning.planRouteToTarget(30.6, 104.0);

    expect(result).toBeNull();
    expect(routePlanning.routeType.value).toBe("direct");
    expect(routePlanning.planningError.value).toBe("planner failed");
    expect(routePlanning.waypoints.value).toEqual([]);
  });

  it("resets route planning state", () => {
    const routePlanning = useRoutePlanning({
      apiBaseUrl: "http://api",
      droneState: ref({ lat: 30.4, lon: 103.8 }),
      setStatusMessage: vi.fn(),
    });

    routePlanning.waypoints.value = [{ latitude: 1, longitude: 2 }];
    routePlanning.targetPoint.value = { latitude: 3, longitude: 4 };
    routePlanning.routeType.value = "osm";
    routePlanning.planningError.value = "bad";

    routePlanning.resetRoutePlanning();

    expect(routePlanning.waypoints.value).toEqual([]);
    expect(routePlanning.targetPoint.value).toBeNull();
    expect(routePlanning.routeType.value).toBe("direct");
    expect(routePlanning.planningError.value).toBe("");
  });
});
