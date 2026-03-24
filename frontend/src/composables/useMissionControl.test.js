import { afterEach, describe, expect, it, vi } from "vitest";

import { useMissionControl } from "./useMissionControl";

describe("useMissionControl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads mission history into reactive state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ([{ id: "m-1" }]),
    })));

    const missionControl = useMissionControl("http://api");
    await missionControl.refreshHistory();

    expect(missionControl.missionHistory.value).toEqual([{ id: "m-1" }]);
    expect(missionControl.isRefreshingHistory.value).toBe(false);
  });

  it("uploads mission and updates execution state", async () => {
    vi.stubGlobal("fetch", vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mission_id: "mission-1",
          execution_id: "exec-1",
          mission_status: "EXECUTING",
          execution_status: "RUNNING",
          message: "Mission '任务 01:28:19' accepted successfully",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      }));

    const missionControl = useMissionControl("http://api");
    const result = await missionControl.uploadMission([{ latitude: 1, longitude: 2 }]);

    expect(result.mission_id).toBe("mission-1");
    expect(missionControl.currentMissionId.value).toBe("mission-1");
    expect(missionControl.currentExecutionId.value).toBe("exec-1");
    expect(missionControl.currentExecutionStatus.value).toBe("RUNNING");
    expect(missionControl.statusMessage.value).toBe("任务“任务 01:28:19”已成功接收");
  });

  it("sends execution action and refreshes state", async () => {
    vi.stubGlobal("fetch", vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mission_status: "PAUSED",
          execution_status: "PAUSED",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      }));

    const missionControl = useMissionControl("http://api");
    missionControl.currentExecutionId.value = "exec-1";

    const result = await missionControl.sendExecutionAction("pause");

    expect(result.execution_status).toBe("PAUSED");
    expect(missionControl.currentMissionStatus.value).toBe("PAUSED");
    expect(missionControl.currentExecutionStatus.value).toBe("PAUSED");
    expect(missionControl.statusMessage.value).toBe("执行暂停成功");
  });
});
