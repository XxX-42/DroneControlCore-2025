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
    vi.useRealTimers();
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
    expect(setStatusMessage).toHaveBeenCalledWith("路线规划完成（OSM）");
  });

  it("appends route segments in task mode", async () => {
    planNavigation
      .mockResolvedValueOnce({
        route_type: "osm",
        waypoints: [
          { latitude: 30.4, longitude: 103.8 },
          { latitude: 30.5, longitude: 103.9 },
        ],
      })
      .mockResolvedValueOnce({
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

    await routePlanning.planRouteToTarget(30.5, 103.9);
    const result = await routePlanning.planRouteToTarget(30.6, 104.0, {
      startPoint: { latitude: 30.5, longitude: 103.9 },
      append: true,
    });

    expect(result.waypoints).toEqual([
      { latitude: 30.4, longitude: 103.8 },
      { latitude: 30.5, longitude: 103.9 },
      { latitude: 30.6, longitude: 104.0 },
    ]);
    expect(routePlanning.waypoints.value).toHaveLength(3);
    expect(setStatusMessage).toHaveBeenLastCalledWith("任务路线已追加（OSM）");
  });

  it("handles planning timeout and clears pending state", async () => {
    vi.useFakeTimers();
    planNavigation.mockImplementation((_, __, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }));

    const routePlanning = useRoutePlanning({
      apiBaseUrl: "http://api",
      droneState: ref({ lat: 30.4, lon: 103.8 }),
      setStatusMessage: vi.fn(),
    });

    const promise = routePlanning.planRouteToTarget(30.6, 104.0);
    await vi.advanceTimersByTimeAsync(20000);
    const result = await promise;

    expect(result).toBeNull();
    expect(routePlanning.isPlanning.value).toBe(false);
    expect(routePlanning.planningError.value).toBe("规划超时，请缩小范围后重试");
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
