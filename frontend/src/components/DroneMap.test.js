import { computed, defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let telemetryState;
let missionControlState;
let replayHistoryState;
let routePlanningState;
let dronePathState;
let leafletMapMock;
let scaleControlAddToMock;
let scaleControlFactoryMock;

vi.mock("leaflet", () => ({
  default: {
    control: {
      scale: (...args) => scaleControlFactoryMock(...args),
    },
  },
}));

vi.mock("@vue-leaflet/vue-leaflet", () => {
  const LMap = defineComponent({
    name: "LMap",
    emits: ["click", "ready", "update:zoom"],
    setup(_, { emit, slots }) {
      return () => h("div", { class: "leaflet-map-stub" }, [
        h("button", {
          class: "map-ready-trigger",
          onClick: () => emit("ready", leafletMapMock),
        }, "ready"),
        h("button", {
          class: "map-click-trigger-first",
          onClick: () => emit("click", { latlng: { lat: 31.2304, lng: 121.4737 } }),
        }, "map-click"),
        h("button", {
          class: "map-click-trigger-second",
          onClick: () => emit("click", { latlng: { lat: 30.5728, lng: 104.0668 } }),
        }, "map-click-2"),
        slots.default?.(),
      ]);
    },
  });

  const passthrough = (name) => defineComponent({
    name,
    setup(_, { slots }) {
      return () => h("div", { class: `${name}-stub` }, slots.default?.());
    },
  });

  return {
    LMap,
    LTileLayer: passthrough("LTileLayer"),
    LMarker: passthrough("LMarker"),
    LPopup: passthrough("LPopup"),
    LPolyline: passthrough("LPolyline"),
    LCircleMarker: passthrough("LCircleMarker"),
  };
});

vi.mock("../composables/useTelemetry", () => ({
  useTelemetry: () => telemetryState,
}));

vi.mock("../composables/useMissionControl", () => ({
  useMissionControl: () => missionControlState,
}));

vi.mock("../composables/useReplayHistory", () => ({
  useReplayHistory: () => replayHistoryState,
}));

vi.mock("../composables/useRoutePlanning", () => ({
  useRoutePlanning: () => routePlanningState,
}));

vi.mock("../composables/useDronePath", () => ({
  useDronePath: () => dronePathState,
}));

const createMissionControlState = () => ({
  missionHistory: ref([{ id: "mission-1" }]),
  isUploading: ref(false),
  isControlling: ref(false),
  isRefreshingHistory: ref(false),
  controlError: ref(""),
  statusMessage: ref(""),
  pendingAction: ref(""),
  currentMissionId: ref("mission-12345678"),
  currentExecutionId: ref("exec-87654321"),
  currentMissionStatus: ref("EXECUTING"),
  currentExecutionStatus: ref("RUNNING"),
  canPause: ref(true),
  canResume: ref(false),
  canCancel: ref(true),
  refreshHistory: vi.fn().mockResolvedValue(undefined),
  uploadMission: vi.fn().mockResolvedValue({
    mission_id: "mission-abcdef01",
    execution_id: "exec-abcdef01",
    mission_status: "EXECUTING",
    execution_status: "RUNNING",
  }),
  sendExecutionAction: vi.fn().mockResolvedValue({}),
  resetMissionControl: vi.fn(),
});

const createReplayHistoryState = () => ({
  replayWaypoints: ref([]),
  replayTrace: ref([
    { latitude: 30.598, longitude: 103.991, timestamp: "2026-03-25T10:00:00Z" },
    { latitude: 30.6, longitude: 103.995, timestamp: "2026-03-25T10:00:05Z" },
    { latitude: 30.603, longitude: 104.001, timestamp: "2026-03-25T10:00:10Z" },
  ]),
  replayProgress: ref(1),
  isReplayPlaying: ref(false),
  selectedReplayMissionId: ref("mission-1"),
  selectedReplayExecutionId: ref("exec-1"),
  selectedReplayMission: ref({
    id: "mission-1",
    executions: [{ execution_id: "exec-1" }],
  }),
  missionFilterOptions: ["ALL", "ACTIVE", "COMPLETED"],
  executionFilterOptions: ["ALL", "ACTIVE", "COMPLETED"],
  missionHistoryFilter: ref("ALL"),
  replayExecutionFilter: ref("ALL"),
  replayPlaybackLabel: computed(() => "PAUSED"),
  replayDurationLabel: computed(() => "5s"),
  replayBannerLabel: computed(() => "Replay: MISSION01 / EXEC0001"),
  replayExecutionCards: computed(() => [
    {
      id: "exec-1",
      title: "EXEC0001",
      summary: "Active 路 2 pts",
      detail: "RUNNING 路 SIMULATION 路 10:00:00",
    },
  ]),
  historyCards: computed(() => [
    {
      id: "mission-1",
      name: "Mission One",
      statusLine: "EXECUTING 路 RUNNING",
      timeLine: "Last run 2026/3/25",
    },
  ]),
  loadMissionDetail: vi.fn().mockResolvedValue({ id: "mission-1" }),
  selectReplayExecution: vi.fn(),
  clearReplay: vi.fn(),
  updateReplayProgress: vi.fn(),
  toggleReplayPlayback: vi.fn(),
  stepReplayBackward: vi.fn(),
  stepReplayForward: vi.fn(),
  stopReplayPlayback: vi.fn(),
  resetReplayHistory: vi.fn(),
  primeReplayFromUpload: vi.fn(),
});

const createRoutePlanningState = () => {
  const waypoints = ref([
    { latitude: 30.598, longitude: 103.991 },
    { latitude: 30.6, longitude: 103.995 },
    { latitude: 30.603, longitude: 104.001 },
  ]);

  return {
    waypoints,
    targetPoint: ref({ latitude: 30.603, longitude: 104.001 }),
    isPlanning: ref(false),
    planningError: ref(""),
    plannedRoute: computed(() => waypoints.value.map((point) => [point.latitude, point.longitude])),
    routeTypeLabel: computed(() => "ASTAR"),
    planRouteToTarget: vi.fn().mockResolvedValue({ waypoints: waypoints.value }),
    resetRoutePlanning: vi.fn(),
  };
};

const createDronePathState = () => ({
  dronePath: ref([
    [30.598, 103.991],
    [30.599, 103.992],
  ]),
  resetDronePath: vi.fn(),
});

const findButtonByText = (wrapper, text) => wrapper.findAll("button").find((button) => button.text().trim() === text);

describe("DroneMap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scaleControlAddToMock = vi.fn();
    scaleControlFactoryMock = vi.fn(() => ({
      addTo: scaleControlAddToMock,
    }));
    leafletMapMock = {
      getZoom: vi.fn(() => 16),
      on: vi.fn(),
    };

    telemetryState = {
      droneState: ref({
        lat: 30.598,
        lon: 103.991,
        alt: 120,
        heading: 90,
        pitch: 2.4,
        roll: -1.2,
      }),
      isConnected: ref(true),
    };
    missionControlState = createMissionControlState();
    replayHistoryState = createReplayHistoryState();
    routePlanningState = createRoutePlanningState();
    dronePathState = createDronePathState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("wires planning, upload, and replay actions through the orchestration layer", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();

    expect(missionControlState.refreshHistory).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("L3 自主导航");
    expect(findButtonByText(wrapper, "English")).toBeTruthy();

    await wrapper.find(".map-ready-trigger").trigger("click");
    expect(scaleControlFactoryMock).toHaveBeenCalledWith({
      metric: true,
      imperial: false,
      position: "bottomleft",
    });
    expect(scaleControlAddToMock).toHaveBeenCalledWith(leafletMapMock);
    expect(leafletMapMock.on).toHaveBeenCalledWith("zoom", expect.any(Function));

    await wrapper.find(".map-click-trigger-first").trigger("click");
    await wrapper.find(".map-click-trigger-second").trigger("click");
    expect(routePlanningState.planRouteToTarget).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);
    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledTimes(1);
    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledWith(30.5728, 104.0668);

    await findButtonByText(wrapper, "上传任务").trigger("click");
    expect(missionControlState.uploadMission).toHaveBeenCalledWith(routePlanningState.waypoints.value);
    expect(replayHistoryState.primeReplayFromUpload).toHaveBeenCalledWith({
      missionId: "mission-abcdef01",
      executionId: "exec-abcdef01",
      waypoints: routePlanningState.waypoints.value,
    });

    await wrapper.find(".history-item").trigger("click");
    expect(replayHistoryState.loadMissionDetail).toHaveBeenCalledWith("mission-1");

    await wrapper.find(".execution-item").trigger("click");
    expect(replayHistoryState.selectReplayExecution).toHaveBeenCalledWith("exec-1");

    await wrapper.find(".timeline").setValue("2");
    expect(replayHistoryState.updateReplayProgress).toHaveBeenCalledWith(2);

    await findButtonByText(wrapper, "播放回放").trigger("click");
    expect(replayHistoryState.toggleReplayPlayback).toHaveBeenCalledTimes(1);

    await findButtonByText(wrapper, "后退").trigger("click");
    expect(replayHistoryState.stepReplayBackward).toHaveBeenCalledTimes(1);

    await findButtonByText(wrapper, "前进").trigger("click");
    expect(replayHistoryState.stepReplayForward).toHaveBeenCalledTimes(1);

    await findButtonByText(wrapper, "清空回放").trigger("click");
    expect(replayHistoryState.clearReplay).toHaveBeenCalledTimes(1);
  });

  it("routes mission control and reset actions to the correct composables", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();

    await findButtonByText(wrapper, "English").trigger("click");
    expect(wrapper.text()).toContain("L3 Autonomous Nav");
    expect(findButtonByText(wrapper, "中文")).toBeTruthy();

    await findButtonByText(wrapper, "PAUSE").trigger("click");
    await findButtonByText(wrapper, "CANCEL").trigger("click");

    expect(missionControlState.sendExecutionAction).toHaveBeenNthCalledWith(1, "pause");
    expect(missionControlState.sendExecutionAction).toHaveBeenNthCalledWith(2, "cancel");

    missionControlState.canPause.value = false;
    missionControlState.canResume.value = true;
    await flushPromises();

    await findButtonByText(wrapper, "RESUME").trigger("click");
    expect(missionControlState.sendExecutionAction).toHaveBeenNthCalledWith(3, "resume");

    await findButtonByText(wrapper, "CLEAR").trigger("click");
    expect(replayHistoryState.stopReplayPlayback).toHaveBeenCalledTimes(1);
    expect(replayHistoryState.resetReplayHistory).toHaveBeenCalledTimes(1);
    expect(routePlanningState.resetRoutePlanning).toHaveBeenCalledTimes(1);
    expect(dronePathState.resetDronePath).toHaveBeenCalledTimes(1);
    expect(missionControlState.resetMissionControl).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    expect(replayHistoryState.stopReplayPlayback).toHaveBeenCalledTimes(2);
  });
});
