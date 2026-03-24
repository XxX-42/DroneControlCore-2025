import { ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/missionsApi", () => ({
  fetchMissionDetail: vi.fn(),
}));

import { fetchMissionDetail } from "../services/missionsApi";
import { useReplayHistory } from "./useReplayHistory";

describe("useReplayHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads mission detail and builds replay cards", async () => {
    fetchMissionDetail.mockResolvedValue({
      id: "mission-1",
      name: "Mission One",
      timestamp: "2026-03-24T10:00:00Z",
      status: "EXECUTING",
      waypoints: [
        { latitude: 30.5, longitude: 103.9, timestamp: "2026-03-24T10:00:00Z" },
      ],
      executions: [
        {
          execution_id: "exec-older",
          status: "COMPLETED",
          mode: "simulation",
          started_at: "2026-03-24T09:00:00Z",
          ended_at: "2026-03-24T09:10:00Z",
          trace: [{ latitude: 30.5, longitude: 103.9, timestamp: "2026-03-24T09:00:00Z" }],
        },
        {
          execution_id: "exec-newer",
          status: "RUNNING",
          mode: "simulation",
          started_at: "2026-03-24T10:00:00Z",
          trace: [{ latitude: 30.6, longitude: 104.0, timestamp: "2026-03-24T10:00:00Z" }],
        },
      ],
    });

    const missionHistory = ref([
      {
        id: "mission-1",
        name: "Mission One",
        status: "EXECUTING",
        timestamp: "2026-03-24T10:00:00Z",
        latest_execution: {
          status: "RUNNING",
          mode: "simulation",
          started_at: "2026-03-24T10:00:00Z",
        },
      },
    ]);
    const setStatusMessage = vi.fn();
    const setControlError = vi.fn();

    const replayHistory = useReplayHistory({
      apiBaseUrl: "http://api",
      missionHistory,
      setStatusMessage,
      setControlError,
    });

    await replayHistory.loadMissionDetail("mission-1");

    expect(replayHistory.selectedReplayMissionId.value).toBe("mission-1");
    expect(replayHistory.selectedReplayExecutionId.value).toBe("exec-newer");
    expect(replayHistory.replayExecutionCards.value).toHaveLength(2);
    expect(replayHistory.replayExecutionCards.value[0].id).toBe("exec-newer");
    expect(replayHistory.historyCards.value[0].id).toBe("mission-1");
    expect(setStatusMessage).toHaveBeenCalledWith("Replay loaded for Mission One");
  });

  it("filters replay executions by status and falls back selection", async () => {
    const replayHistory = useReplayHistory({
      apiBaseUrl: "http://api",
      missionHistory: ref([]),
      setStatusMessage: vi.fn(),
      setControlError: vi.fn(),
    });

    replayHistory.selectedReplayMission.value = {
      id: "mission-1",
      executions: [
        {
          execution_id: "exec-completed",
          status: "COMPLETED",
          mode: "simulation",
          started_at: "2026-03-24T09:00:00Z",
          ended_at: "2026-03-24T09:10:00Z",
          trace: [{ latitude: 1, longitude: 2, timestamp: "2026-03-24T09:00:00Z" }],
        },
        {
          execution_id: "exec-running",
          status: "RUNNING",
          mode: "simulation",
          started_at: "2026-03-24T10:00:00Z",
          trace: [{ latitude: 3, longitude: 4, timestamp: "2026-03-24T10:00:00Z" }],
        },
      ],
    };
    replayHistory.replayWaypoints.value = [{ latitude: 0, longitude: 0, timestamp: "2026-03-24T08:00:00Z" }];
    replayHistory.selectedReplayExecutionId.value = "exec-completed";

    replayHistory.replayExecutionFilter.value = "ACTIVE";
    await Promise.resolve();

    expect(replayHistory.replayExecutionCards.value).toHaveLength(1);
    expect(replayHistory.selectedReplayExecutionId.value).toBe("exec-running");
    expect(replayHistory.replayTrace.value[0].latitude).toBe(3);
  });

  it("clears and resets replay state", () => {
    const setStatusMessage = vi.fn();
    const replayHistory = useReplayHistory({
      apiBaseUrl: "http://api",
      missionHistory: ref([]),
      setStatusMessage,
      setControlError: vi.fn(),
    });

    replayHistory.primeReplayFromUpload({
      missionId: "mission-1",
      executionId: "exec-1",
      waypoints: [{ latitude: 1, longitude: 2, timestamp: "2026-03-24T10:00:00Z" }],
    });

    replayHistory.clearReplay();

    expect(replayHistory.selectedReplayMissionId.value).toBe("");
    expect(replayHistory.selectedReplayExecutionId.value).toBe("");
    expect(replayHistory.replayTrace.value).toEqual([]);
    expect(setStatusMessage).toHaveBeenCalledWith("Replay cleared");
  });
});
