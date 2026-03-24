import { describe, expect, it } from "vitest";

import { buildGraphRuntime, computePreviewRoute } from "./hoverPreviewWorkerCore";

describe("hoverPreviewWorkerCore", () => {
  it("computes a preview route through the graph", () => {
    const runtime = buildGraphRuntime({
      tile_key: "14:test",
      nodes: [
        { id: "1", lat: 30.598, lon: 103.991 },
        { id: "2", lat: 30.599, lon: 103.993 },
        { id: "3", lat: 30.601, lon: 103.996 },
      ],
      edges: [
        { from: "1", to: "2", cost: 50 },
        { from: "2", to: "3", cost: 50 },
      ],
    });

    const result = computePreviewRoute(
      runtime,
      { latitude: 30.5981, longitude: 103.9911 },
      { latitude: 30.6009, longitude: 103.9959 },
    );

    expect(result.status).toBe("ok");
    expect(result.previewWaypoints.length).toBeGreaterThan(3);
    expect(result.previewWaypoints[0].latitude).toBeCloseTo(30.5981);
    expect(result.previewWaypoints.at(-1).longitude).toBeCloseTo(103.9959);
  });

  it("returns no-path when graph is disconnected", () => {
    const runtime = buildGraphRuntime({
      tile_key: "14:test",
      nodes: [
        { id: "1", lat: 30.598, lon: 103.991 },
        { id: "2", lat: 30.601, lon: 103.996 },
      ],
      edges: [],
    });

    const result = computePreviewRoute(
      runtime,
      { latitude: 30.598, longitude: 103.991 },
      { latitude: 30.601, longitude: 103.996 },
    );

    expect(result.status).toBe("no-path");
    expect(result.previewWaypoints).toEqual([]);
  });
});
