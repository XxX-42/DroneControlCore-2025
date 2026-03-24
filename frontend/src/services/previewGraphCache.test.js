import { describe, expect, it } from "vitest";

import { buildGraphTileKey, buildGraphTileRequest } from "./previewGraphCache";

describe("previewGraphCache", () => {
  it("builds a tile request from viewport and endpoints", () => {
    const request = buildGraphTileRequest({
      mapBounds: {
        left: 103.98,
        bottom: 30.59,
        right: 104.01,
        top: 30.61,
      },
      zoom: 14.2,
      dronePoint: { latitude: 30.598, longitude: 103.991 },
      startPoint: { latitude: 30.6, longitude: 103.995 },
      targetPoint: { latitude: 30.603, longitude: 104.001 },
    });

    expect(request.zoom_bucket).toBe(14);
    expect(request.left).toBeLessThanOrEqual(103.98);
    expect(request.top).toBeGreaterThanOrEqual(30.61);
  });

  it("creates a stable tile key", () => {
    expect(buildGraphTileKey({
      zoomBucket: 14,
      bbox: {
        left: 103.98,
        bottom: 30.59,
        right: 104.01,
        top: 30.61,
      },
    })).toBe("14:103.98:30.59:104.01:30.61");
  });
});
