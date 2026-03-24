import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import MissionHistoryPanel from "./MissionHistoryPanel.vue";

const baseProps = {
  missionCount: 2,
  missionFilterOptions: ["ALL", "ACTIVE", "COMPLETED"],
  missionHistoryFilter: "ALL",
  replayBannerLabel: "Replay: MISSION01 / EXEC0001",
  selectedReplayMission: {
    executions: [{ execution_id: "exec-1" }],
  },
  executionFilterOptions: ["ALL", "ACTIVE", "COMPLETED"],
  replayExecutionFilter: "ALL",
  replayExecutionCards: [
    { id: "exec-1", title: "EXEC0001", summary: "Active · 3 pts", detail: "RUNNING · SIMULATION · 10:00:00" },
  ],
  selectedReplayExecutionId: "exec-1",
  replayTraceLength: 4,
  replayPlaybackLabel: "PAUSED",
  replayProgress: 1,
  replayDurationLabel: "12s",
  isReplayPlaying: false,
  historyCards: [
    { id: "mission-1", name: "Mission One", statusLine: "EXECUTING · RUNNING", timeLine: "Last run 2026/3/24" },
    { id: "mission-2", name: "Mission Two", statusLine: "COMPLETED · COMPLETED", timeLine: "Last run 2026/3/23" },
  ],
  selectedReplayMissionId: "mission-1",
};

describe("MissionHistoryPanel", () => {
  it("renders cards and emits mission/execution selection", async () => {
    const wrapper = mount(MissionHistoryPanel, {
      props: baseProps,
    });

    expect(wrapper.text()).toContain("Mission One");
    expect(wrapper.text()).toContain("EXEC0001");

    await wrapper.find(".execution-item").trigger("click");
    await wrapper.findAll(".history-item")[1].trigger("click");

    expect(wrapper.emitted("select-replay-execution")).toEqual([["exec-1"]]);
    expect(wrapper.emitted("load-mission-detail")).toEqual([["mission-2"]]);
  });

  it("emits filter and playback actions", async () => {
    const wrapper = mount(MissionHistoryPanel, {
      props: baseProps,
    });

    const filterChips = wrapper.findAll(".filter-chip");
    await filterChips[1].trigger("click");
    await filterChips[4].trigger("click");
    await wrapper.find(".timeline").setValue("2");
    await wrapper.find(".btn-secondary").trigger("click");

    expect(wrapper.emitted("update:mission-history-filter")).toEqual([["ACTIVE"]]);
    expect(wrapper.emitted("update:replay-execution-filter")).toEqual([["ACTIVE"]]);
    expect(wrapper.emitted("update:replay-progress")).toEqual([[2]]);
    expect(wrapper.emitted("toggle-replay")).toHaveLength(1);
  });

  it("shows empty state when there is no history", () => {
    const wrapper = mount(MissionHistoryPanel, {
      props: {
        ...baseProps,
        replayBannerLabel: "",
        selectedReplayMission: { executions: [] },
        replayTraceLength: 0,
        historyCards: [],
      },
    });

    expect(wrapper.text()).toContain("No mission history yet.");
  });
});
