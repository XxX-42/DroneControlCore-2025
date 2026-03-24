import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchNavigationGraphTile } from "./navigationGraphApi";

describe("navigationGraphApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts preview graph payload", async () => {
    const payload = {
      left: 103.98,
      bottom: 30.59,
      right: 104.01,
      top: 30.61,
      zoom_bucket: 14,
    };

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ tile_key: "14:test", nodes: [], edges: [] }),
    })));

    await expect(fetchNavigationGraphTile("http://api", payload)).resolves.toEqual({
      tile_key: "14:test",
      nodes: [],
      edges: [],
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://api/api/v1/navigation/graph",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  });
});
