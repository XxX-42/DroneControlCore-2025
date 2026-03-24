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
let divIconMock;
let planNavigationMock;

vi.mock("leaflet", () => ({
  default: {
    control: {
      scale: (...args) => scaleControlFactoryMock(...args),
    },
    divIcon: (...args) => divIconMock(...args),
  },
}));

vi.mock("@vue-leaflet/vue-leaflet", () => {
  const LMap = defineComponent({
    name: "LMap",
    emits: ["click", "mousemove", "mouseout", "ready", "update:zoom"],
    setup(_, { emit, slots }) {
      return () => h("div", { class: "leaflet-map-stub" }, [
        h("button", { class: "map-ready-trigger", onClick: () => emit("ready", leafletMapMock) }, "ready"),
        h("button", {
          class: "map-click-trigger-first",
          onClick: () => emit("click", { latlng: { lat: 31.2304, lng: 121.4737 } }),
        }, "map-click"),
        h("button", {
          class: "map-click-trigger-second",
          onClick: () => emit("click", { latlng: { lat: 30.5728, lng: 104.0668 } }),
        }, "map-click-2"),
        h("button", {
          class: "map-hover-trigger",
          onClick: () => emit("mousemove", { latlng: { lat: 30.6012, lng: 104.0021 } }),
        }, "map-hover"),
        h("button", { class: "map-hover-leave-trigger", onClick: () => emit("mouseout") }, "map-hover-leave"),
        slots.default?.(),
      ]);
    },
  });

  const LMarker = defineComponent({
    name: "LMarker",
    emits: ["click"],
    inheritAttrs: false,
    setup(_, { emit, slots, attrs }) {
      return () => h("div", { class: "LMarker-stub" }, [
        attrs["marker-kind"]
          ? h("button", {
            class: "marker-click-trigger",
            "data-marker-kind": attrs["marker-kind"],
            onClick: () => emit("click"),
          }, String(attrs["marker-kind"]))
          : null,
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
    LMarker,
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

vi.mock("../services/navigationApi", () => ({
  planNavigation: (...args) => planNavigationMock(...args),
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
  currentExecutionId: ref(""),
  currentMissionStatus: ref("IDLE"),
  currentExecutionStatus: ref("NONE"),
  canPause: ref(false),
  canResume: ref(false),
  canCancel: ref(false),
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
  ]),
  replayProgress: ref(1),
  isReplayPlaying: ref(false),
  selectedReplayMissionId: ref("mission-1"),
  selectedReplayExecutionId: ref("exec-1"),
  selectedReplayMission: ref({ id: "mission-1", executions: [{ execution_id: "exec-1" }] }),
  missionFilterOptions: ["ALL"],
  executionFilterOptions: ["ALL"],
  missionHistoryFilter: ref("ALL"),
  replayExecutionFilter: ref("ALL"),
  replayPlaybackLabel: computed(() => "PAUSED"),
  replayDurationLabel: computed(() => "5s"),
  replayBannerLabel: computed(() => "Replay: MISSION01 / EXEC0001"),
  replayExecutionCards: computed(() => []),
  historyCards: computed(() => []),
  loadMissionDetail: vi.fn(),
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
    routeTypeLabel: computed(() => "OSM"),
    planRouteToTarget: vi.fn().mockResolvedValue({ route_type: "osm", waypoints: waypoints.value }),
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

const getModeButtons = (wrapper) => wrapper.findAll(".mode-chip");

describe("DroneMap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scaleControlAddToMock = vi.fn();
    scaleControlFactoryMock = vi.fn(() => ({ addTo: scaleControlAddToMock }));
    divIconMock = vi.fn((config) => config);
    leafletMapMock = { getZoom: vi.fn(() => 16), on: vi.fn(), setView: vi.fn() };
    planNavigationMock = vi.fn().mockResolvedValue({
      route_type: "osm",
      waypoints: [
        { latitude: 30.598, longitude: 103.991 },
        { latitude: 30.6012, longitude: 104.0021 },
      ],
    });

    telemetryState = {
      droneState: ref({ lat: 30.598, lon: 103.991, alt: 120, heading: 90, pitch: 2.4, roll: -1.2 }),
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

  it("previews an OSM route while hovering before click", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await wrapper.find(".map-hover-trigger").trigger("click");
    await vi.advanceTimersByTimeAsync(140);
    await flushPromises();

    expect(planNavigationMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        target_latitude: 30.6012,
        target_longitude: 104.0021,
      }),
      expect.any(Object),
    );
    expect(wrapper.findAll(".LPolyline-stub").length).toBeGreaterThanOrEqual(4);

    await wrapper.find(".map-hover-leave-trigger").trigger("click");
    await flushPromises();

    expect(wrapper.findAll(".LPolyline-stub")).toHaveLength(3);
  });

  it("debounces clicks and appends only the last target in task mode", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await wrapper.find(".map-click-trigger-first").trigger("click");
    await wrapper.find(".map-click-trigger-second").trigger("click");

    expect(routePlanningState.planRouteToTarget).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);

    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledTimes(1);
    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledWith(
      30.5728,
      104.0668,
      expect.objectContaining({ append: false }),
    );
    expect(missionControlState.uploadMission).not.toHaveBeenCalled();
  });

  it("queues task mode execution until the active realtime mission finishes", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();

    await getModeButtons(wrapper)[1].trigger("click");
    await wrapper.find(".map-click-trigger-first").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    expect(missionControlState.uploadMission).toHaveBeenCalledTimes(1);

    missionControlState.currentExecutionId.value = "exec-realtime-1";
    missionControlState.currentExecutionStatus.value = "RUNNING";
    await flushPromises();

    await getModeButtons(wrapper)[0].trigger("click");
    await wrapper.find(".map-click-trigger-second").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    expect(missionControlState.uploadMission).toHaveBeenCalledTimes(1);

    missionControlState.currentExecutionStatus.value = "COMPLETED";
    await flushPromises();

    expect(missionControlState.uploadMission).toHaveBeenCalledTimes(2);
  });
});
