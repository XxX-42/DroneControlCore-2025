import { computed, defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let telemetryState;
let missionControlState;
let replayHistoryState;
let routePlanningState;
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
      return () =>
        h("div", { class: "leaflet-map-stub" }, [
          h("button", { class: "map-ready-trigger", onClick: () => emit("ready", leafletMapMock) }, "ready"),
          h(
            "button",
            {
              class: "map-click-trigger-first",
              onClick: () => emit("click", { latlng: { lat: 31.2304, lng: 121.4737 } }),
            },
            "map-click-1",
          ),
          h(
            "button",
            {
              class: "map-click-trigger-second",
              onClick: () => emit("click", { latlng: { lat: 30.5728, lng: 104.0668 } }),
            },
            "map-click-2",
          ),
          h(
            "button",
            {
              class: "map-click-trigger-third",
              onClick: () => emit("click", { latlng: { lat: 30.6123, lng: 104.0821 } }),
            },
            "map-click-3",
          ),
          h(
            "button",
            {
              class: "map-click-trigger-fourth",
              onClick: () => emit("click", { latlng: { lat: 30.6215, lng: 104.0956 } }),
            },
            "map-click-4",
          ),
          h(
            "button",
            {
              class: "map-hover-trigger",
              onClick: () => emit("mousemove", { latlng: { lat: 30.6012, lng: 104.0021 } }),
            },
            "map-hover",
          ),
          h("button", { class: "map-hover-leave-trigger", onClick: () => emit("mouseout") }, "map-hover-leave"),
          slots.default?.(),
        ]);
    },
  });

  const LMarker = defineComponent({
    name: "LMarker",
    inheritAttrs: false,
    emits: ["click"],
    setup(_, { emit, attrs, slots }) {
      return () =>
        h("div", { class: "marker-stub" }, [
          attrs["marker-kind"]
            ? h(
                "button",
                {
                  class: "marker-click-trigger",
                  "data-marker-kind": attrs["marker-kind"],
                  onClick: () => emit("click"),
                },
                String(attrs["marker-kind"]),
              )
            : null,
          slots.default?.(),
        ]);
    },
  });

  const passthrough = (name) =>
    defineComponent({
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

vi.mock("./drone-map/MissionControlPanel.vue", () => ({
  default: defineComponent({
    name: "MissionControlPanel",
    setup() {
      return () => h("div", { class: "mission-control-panel-stub" });
    },
  }),
}));

vi.mock("./drone-map/MissionHistoryPanel.vue", () => ({
  default: defineComponent({
    name: "MissionHistoryPanel",
    setup() {
      return () => h("div", { class: "mission-history-panel-stub" });
    },
  }),
}));

vi.mock("./drone-map/TelemetryPanel.vue", () => ({
  default: defineComponent({
    name: "TelemetryPanel",
    setup() {
      return () => h("div", { class: "telemetry-panel-stub" });
    },
  }),
}));

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

vi.mock("../services/navigationApi", () => ({
  planNavigation: (...args) => planNavigationMock(...args),
}));

const createMissionControlState = () => ({
  missionHistory: ref([{ id: "mission-1", waypoints: [{ latitude: 30.598, longitude: 103.991 }] }]),
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
  replayTrace: ref([]),
  replayProgress: ref(0),
  isReplayPlaying: ref(false),
  selectedReplayMissionId: ref(""),
  selectedReplayExecutionId: ref(""),
  selectedReplayMission: ref(null),
  missionFilterOptions: ["ALL"],
  executionFilterOptions: ["ALL"],
  missionHistoryFilter: ref("ALL"),
  replayExecutionFilter: ref("ALL"),
  replayPlaybackLabel: computed(() => "PAUSED"),
  replayDurationLabel: computed(() => "5s"),
  replayBannerLabel: computed(() => ""),
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
  ]);
  const planRouteToTarget = vi.fn(async (lat, lng, options = {}) => {
    const startPoint = options.startPoint ?? { latitude: 30.598, longitude: 103.991 };
    const segment = [
      startPoint,
      { latitude: lat, longitude: lng },
    ];
    if (options.append && waypoints.value.length > 0) {
      waypoints.value = [...waypoints.value, segment[1]];
    } else {
      waypoints.value = segment;
    }
    return { route_type: "osm", waypoints: waypoints.value };
  });

  return {
    waypoints,
    targetPoint: ref({ latitude: 30.603, longitude: 104.001 }),
    isPlanning: ref(false),
    planningError: ref(""),
    plannedRoute: computed(() => waypoints.value.map((point) => [point.latitude, point.longitude])),
    routeTypeLabel: computed(() => "OSM"),
    planRouteToTarget,
    resetRoutePlanning: vi.fn(() => {
      waypoints.value = [];
    }),
  };
};

const getModeButtons = (wrapper) => wrapper.findAll(".mode-chip");
const getTaskMarkerButtons = (wrapper) =>
  wrapper
    .findAll(".marker-click-trigger")
    .filter((button) => String(button.attributes("data-marker-kind") || "").startsWith("task-target-"));

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
  });

  afterEach(() => {
    vi.clearAllMocks();
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

    await wrapper.find(".map-hover-leave-trigger").trigger("click");
    await flushPromises();

    expect(planNavigationMock).toHaveBeenCalledTimes(1);
  });

  it("debounces clicks and appends only the last target in task mode", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await wrapper.find(".map-click-trigger-first").trigger("click");
    await wrapper.find(".map-click-trigger-second").trigger("click");

    expect(routePlanningState.planRouteToTarget).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledTimes(1);
    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledWith(
      30.5728,
      104.0668,
      expect.objectContaining({ append: false }),
    );
  });

  it("queues task mode execution until the active realtime mission finishes", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();

    await getModeButtons(wrapper)[1].trigger("click");
    await wrapper.find(".map-click-trigger-first").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(missionControlState.uploadMission).toHaveBeenCalledTimes(1);

    missionControlState.currentExecutionId.value = "exec-realtime-1";
    missionControlState.currentExecutionStatus.value = "RUNNING";
    await flushPromises();

    await getModeButtons(wrapper)[0].trigger("click");
    await wrapper.find(".map-click-trigger-second").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(missionControlState.uploadMission).toHaveBeenCalledTimes(1);

    missionControlState.currentExecutionStatus.value = "COMPLETED";
    await flushPromises();

    expect(missionControlState.uploadMission).toHaveBeenCalledTimes(2);
  });

  it("inserts a realtime target ahead of queued task targets while preserving their order", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await wrapper.find(".map-click-trigger-first").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    await wrapper.find(".map-click-trigger-second").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    routePlanningState.resetRoutePlanning.mockClear();
    routePlanningState.planRouteToTarget.mockClear();
    missionControlState.uploadMission.mockClear();

    await getModeButtons(wrapper)[1].trigger("click");
    await wrapper.find(".map-click-trigger-third").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    expect(routePlanningState.resetRoutePlanning).toHaveBeenCalledTimes(2);
    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledTimes(3);
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      1,
      30.6123,
      104.0821,
      expect.objectContaining({
        append: false,
        startPoint: expect.objectContaining({ latitude: 30.598, longitude: 103.991 }),
      }),
    );
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      2,
      31.2304,
      121.4737,
      expect.objectContaining({ append: true }),
    );
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      3,
      30.5728,
      104.0668,
      expect.objectContaining({ append: true }),
    );
    expect(missionControlState.uploadMission).toHaveBeenCalledTimes(1);
    expect(getTaskMarkerButtons(wrapper)).toHaveLength(3);
  });

  it("keeps the newest realtime target as task point 1 before reaching the original first task point", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await wrapper.find(".map-click-trigger-first").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    await wrapper.find(".map-click-trigger-second").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    await getModeButtons(wrapper)[1].trigger("click");
    await wrapper.find(".map-click-trigger-third").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    routePlanningState.resetRoutePlanning.mockClear();
    routePlanningState.planRouteToTarget.mockClear();
    missionControlState.uploadMission.mockClear();

    await wrapper.find(".map-click-trigger-fourth").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledTimes(4);
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      1,
      30.6215,
      104.0956,
      expect.objectContaining({ append: false }),
    );
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      2,
      30.6123,
      104.0821,
      expect.objectContaining({ append: true }),
    );
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      3,
      31.2304,
      121.4737,
      expect.objectContaining({ append: true }),
    );
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      4,
      30.5728,
      104.0668,
      expect.objectContaining({ append: true }),
    );
    expect(missionControlState.uploadMission).toHaveBeenCalledTimes(1);
    expect(getTaskMarkerButtons(wrapper)).toHaveLength(4);
  });

  it("uses the last queued task point as the OSM hover start in task mode", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await wrapper.find(".map-click-trigger-first").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    await wrapper.find(".map-click-trigger-second").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    planNavigationMock.mockClear();

    await wrapper.find(".map-hover-trigger").trigger("click");
    await vi.advanceTimersByTimeAsync(140);
    await flushPromises();

    expect(planNavigationMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        start_latitude: 30.5728,
        start_longitude: 104.0668,
        target_latitude: 30.6012,
        target_longitude: 104.0021,
      }),
      expect.any(Object),
    );
  });

  it("uses the current drone position as the start point after refresh", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await wrapper.find(".map-ready-trigger").trigger("click");
    await wrapper.findAll(".map-focus-button")[1].trigger("click");

    expect(leafletMapMock.setView).toHaveBeenCalledWith([30.598, 103.991], 17);
  });

  it("rebuilds and renumbers remaining points after deleting a middle task point", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await wrapper.find(".map-click-trigger-first").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    await wrapper.find(".map-click-trigger-second").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    await wrapper.find(".map-click-trigger-third").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledTimes(3);
    expect(getTaskMarkerButtons(wrapper)).toHaveLength(3);

    await getTaskMarkerButtons(wrapper)[1].trigger("click");
    await flushPromises();

    expect(routePlanningState.resetRoutePlanning).toHaveBeenCalledTimes(1);
    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledTimes(5);
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      4,
      31.2304,
      121.4737,
      expect.objectContaining({ append: false }),
    );
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      5,
      30.6123,
      104.0821,
      expect.objectContaining({ append: true }),
    );

    const remainingMarkers = getTaskMarkerButtons(wrapper);
    expect(remainingMarkers).toHaveLength(2);
    expect(remainingMarkers[0].attributes("data-marker-kind")).toBe("task-target-1");
    expect(remainingMarkers[1].attributes("data-marker-kind")).toBe("task-target-2");
  });

  it("keeps the remaining route when deleting the last task point", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    for (const trigger of [
      ".map-click-trigger-first",
      ".map-click-trigger-second",
      ".map-click-trigger-third",
      ".map-click-trigger-fourth",
    ]) {
      await wrapper.find(trigger).trigger("click");
      await vi.advanceTimersByTimeAsync(250);
      await flushPromises();
    }

    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledTimes(4);
    await getTaskMarkerButtons(wrapper)[3].trigger("click");
    await flushPromises();

    expect(routePlanningState.resetRoutePlanning).toHaveBeenCalledTimes(1);
    expect(routePlanningState.planRouteToTarget).toHaveBeenCalledTimes(7);
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      5,
      31.2304,
      121.4737,
      expect.objectContaining({ append: false }),
    );
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      6,
      30.5728,
      104.0668,
      expect.objectContaining({ append: true }),
    );
    expect(routePlanningState.planRouteToTarget).toHaveBeenNthCalledWith(
      7,
      30.6123,
      104.0821,
      expect.objectContaining({ append: true }),
    );
    expect(getTaskMarkerButtons(wrapper)).toHaveLength(3);
  });

  it("rebuilds from the drone position to the final remaining point after removing the first three", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    for (const trigger of [
      ".map-click-trigger-first",
      ".map-click-trigger-second",
      ".map-click-trigger-third",
      ".map-click-trigger-fourth",
    ]) {
      await wrapper.find(trigger).trigger("click");
      await vi.advanceTimersByTimeAsync(250);
      await flushPromises();
    }

    await getTaskMarkerButtons(wrapper)[0].trigger("click");
    await flushPromises();
    await getTaskMarkerButtons(wrapper)[0].trigger("click");
    await flushPromises();
    await getTaskMarkerButtons(wrapper)[0].trigger("click");
    await flushPromises();

    expect(routePlanningState.planRouteToTarget).toHaveBeenLastCalledWith(
      30.6215,
      104.0956,
      expect.objectContaining({
        append: false,
        startPoint: expect.objectContaining({ latitude: 30.598, longitude: 103.991 }),
      }),
    );
    const remainingMarkers = getTaskMarkerButtons(wrapper);
    expect(remainingMarkers).toHaveLength(1);
    expect(remainingMarkers[0].attributes("data-marker-kind")).toBe("task-target-1");
  });
});
