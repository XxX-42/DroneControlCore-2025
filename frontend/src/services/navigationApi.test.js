import { afterEach, describe, expect, it, vi } from "vitest";

import { planNavigation } from "./navigationApi";

describe("navigationApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts planning payload", async () => {
    const payload = {
      start_latitude: 1,
      start_longitude: 2,
      target_latitude: 3,
      target_longitude: 4,
    };

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ route_type: "direct", waypoints: [] }),
    })));

    await expect(planNavigation("http://api", payload)).resolves.toEqual({
      route_type: "direct",
      waypoints: [],
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://api/api/v1/navigation/plan",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  });
});
