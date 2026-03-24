import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchMissionDetail,
  fetchMissionHistory,
  sendMissionExecutionAction,
  uploadMission,
} from "./missionsApi";

describe("missionsApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches mission history", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ([{ id: "mission-1" }]),
    })));

    await expect(fetchMissionHistory("http://api")).resolves.toEqual([{ id: "mission-1" }]);
    expect(fetch).toHaveBeenCalledWith("http://api/api/v1/missions/history");
  });

  it("uploads mission payload as json", async () => {
    const payload = { name: "Test", waypoints: [{ latitude: 1, longitude: 2 }] };
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ mission_id: "m1" }),
    })));

    await expect(uploadMission("http://api", payload)).resolves.toEqual({ mission_id: "m1" });
    expect(fetch).toHaveBeenCalledWith(
      "http://api/api/v1/missions/upload",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  });

  it("fetches mission detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "mission-1", executions: [] }),
    })));

    await expect(fetchMissionDetail("http://api", "mission-1")).resolves.toEqual({
      id: "mission-1",
      executions: [],
    });
  });

  it("sends execution action", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ execution_status: "PAUSED" }),
    })));

    await expect(sendMissionExecutionAction("http://api", "exec-1", "pause")).resolves.toEqual({
      execution_status: "PAUSED",
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://api/api/v1/missions/executions/exec-1/pause",
      { method: "POST" },
    );
  });
});
