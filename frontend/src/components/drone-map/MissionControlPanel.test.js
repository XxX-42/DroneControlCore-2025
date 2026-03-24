import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import MissionControlPanel from "./MissionControlPanel.vue";

const baseProps = {
  currentMissionIdLabel: "MISSION01",
  currentExecutionIdLabel: "EXEC0001",
  currentMissionStatus: "EXECUTING",
  currentExecutionStatus: "RUNNING",
  statusMessage: "",
  controlError: "",
  canPause: true,
  canResume: false,
  canCancel: true,
  isControlling: false,
  pendingAction: "",
  isRefreshingHistory: false,
  isPlanning: false,
  planningError: "",
  waypointCount: 3,
  taskTargets: [],
  isUploading: false,
  locale: "en",
};

describe("MissionControlPanel", () => {
  it("renders mission state and emits control events", async () => {
    const wrapper = mount(MissionControlPanel, {
      props: baseProps,
    });

    expect(wrapper.text()).toContain("MISSION01");
    expect(wrapper.text()).toContain("EXECUTING");

    const buttons = wrapper.findAll("button");
    await buttons[0].trigger("click");
    await buttons[1].trigger("click");
    await buttons[2].trigger("click");
    await buttons[3].trigger("click");
    await buttons[5].trigger("click");

    expect(wrapper.emitted("refresh-history")).toHaveLength(1);
    expect(wrapper.emitted("stop")).toHaveLength(1);
    expect(wrapper.emitted("resume")).toBeUndefined();
    expect(wrapper.emitted("cancel")).toHaveLength(1);
    expect(wrapper.emitted("clear-mission")).toHaveLength(1);
  });

  it("uses continue mission as the primary action when paused", async () => {
    const wrapper = mount(MissionControlPanel, {
      props: {
        ...baseProps,
        currentExecutionStatus: "PAUSED",
        canResume: true,
        canPause: false,
      },
    });

    const buttons = wrapper.findAll("button");
    expect(buttons[1].attributes("disabled")).toBeDefined();
    expect(buttons[2].attributes("disabled")).toBeUndefined();
    expect(buttons[4].text()).toContain("CONTINUE MISSION");

    await buttons[4].trigger("click");
    expect(wrapper.emitted("resume-mission")).toHaveLength(1);
  });

  it("shows planning and control status messages", () => {
    const wrapper = mount(MissionControlPanel, {
      props: {
        ...baseProps,
        statusMessage: "Route planned",
        controlError: "Control failed",
        isPlanning: true,
      },
    });

    expect(wrapper.text()).toContain("Route planned");
    expect(wrapper.text()).toContain("Control failed");
    expect(wrapper.text()).toContain("Planning route...");
  });

  it("renders chinese labels and translated statuses in zh locale", () => {
    const wrapper = mount(MissionControlPanel, {
      props: {
        ...baseProps,
        locale: "zh",
      },
    });

    expect(wrapper.text()).toContain("当前任务");
    expect(wrapper.text()).toContain("停止");
    expect(wrapper.text()).toContain("执行中");
    expect(wrapper.text()).toContain("运行中");
  });
});
