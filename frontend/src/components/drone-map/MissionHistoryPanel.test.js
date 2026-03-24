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
    { id: "exec-1", title: "EXEC0001", summary: "Active 路 3 pts", detail: "RUNNING 路 SIMULATION 路 10:00:00" },
  ],
  selectedReplayExecutionId: "exec-1",
  replayTraceLength: 4,
  replayPlaybackLabel: "PAUSED",
  replayProgress: 1,
  replayDurationLabel: "12s",
  isReplayPlaying: false,
  historyCards: [
    { id: "mission-1", name: "Mission One", statusLine: "EXECUTING 路 RUNNING", timeLine: "Last run 2026/3/24" },
    { id: "mission-2", name: "Mission Two", statusLine: "COMPLETED 路 COMPLETED", timeLine: "Last run 2026/3/23" },
  ],
  selectedReplayMissionId: "mission-1",
  locale: "en",
};

describe("MissionHistoryPanel", () => {
  it("shows one mission by default and expands on demand", async () => {
    const wrapper = mount(MissionHistoryPanel, {
      props: baseProps,
    });

    expect(wrapper.findAll(".history-item")).toHaveLength(1);
    expect(wrapper.text()).toContain("EXPAND");

    await wrapper.find(".history-toggle").trigger("click");

    expect(wrapper.findAll(".history-item")).toHaveLength(2);
    expect(wrapper.text()).toContain("COLLAPSE");
  });

  it("renders cards and emits mission/execution selection", async () => {
    const wrapper = mount(MissionHistoryPanel, {
      props: baseProps,
    });

    expect(wrapper.text()).toContain("Mission One");
    expect(wrapper.text()).toContain("EXEC0001");

    await wrapper.find(".execution-item").trigger("click");
    await wrapper.find(".history-toggle").trigger("click");
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

  it("renders chinese labels when locale is zh", () => {
    const wrapper = mount(MissionHistoryPanel, {
      props: {
        ...baseProps,
        locale: "zh",
      },
    });

    expect(wrapper.text()).toContain("最近任务");
    expect(wrapper.text()).toContain("清空回放");
    expect(wrapper.text()).toContain("全部");
    expect(wrapper.text()).toContain("展开");
  });
});
