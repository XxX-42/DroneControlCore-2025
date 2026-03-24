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
let fetchNavigationGraphTileMock;
let workerInstances;

class MockWorker {
  constructor() {
    this.onmessage = null;
    this.messages = [];
    workerInstances.push(this);
  }

  postMessage(message) {
    this.messages.push(message);

    if (message.type === "computeRoute") {
      this.onmessage?.({
        data: {
          type: "routeResult",
          payload: {
            requestId: message.payload.requestId,
            status: "ok",
            previewWaypoints: [
              message.payload.startPoint,
              message.payload.targetPoint,
            ],
            fallbackReason: "",
          },
        },
      });
    }
  }

  terminate() {}
}

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

vi.mock("../services/navigationGraphApi", () => ({
  fetchNavigationGraphTile: (...args) => fetchNavigationGraphTileMock(...args),
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
  selectedReplayMission: ref({ id: "", executions: [] }),
  missionFilterOptions: ["ALL"],
  executionFilterOptions: ["ALL"],
  missionHistoryFilter: ref("ALL"),
  replayExecutionFilter: ref("ALL"),
  replayPlaybackLabel: computed(() => "PAUSED"),
  replayDurationLabel: computed(() => "0s"),
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

  return {
    waypoints,
    targetPoint: ref({ latitude: 30.6, longitude: 103.995 }),
    isPlanning: ref(false),
    planningError: ref(""),
    plannedRoute: computed(() => waypoints.value.map((point) => [point.latitude, point.longitude])),
    routeTypeLabel: computed(() => "OSM"),
    planRouteToTarget: vi.fn().mockResolvedValue({
      route_type: "osm",
      waypoints: waypoints.value,
    }),
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
    workerInstances = [];
    scaleControlAddToMock = vi.fn();
    scaleControlFactoryMock = vi.fn(() => ({ addTo: scaleControlAddToMock }));
    divIconMock = vi.fn((config) => config);
    leafletMapMock = {
      getZoom: vi.fn(() => 16),
      on: vi.fn(),
      setView: vi.fn(),
      getBounds: vi.fn(() => ({
        getWest: () => 103.98,
        getSouth: () => 30.59,
        getEast: () => 104.01,
        getNorth: () => 30.61,
      })),
    };
    fetchNavigationGraphTileMock = vi.fn().mockResolvedValue({
      tile_key: "16:test",
      zoom_bucket: 16,
      bbox: {
        left: 103.98,
        bottom: 30.59,
        right: 104.01,
        top: 30.61,
      },
      nodes: [
        { id: "1", lat: 30.598, lon: 103.991 },
        { id: "2", lat: 30.6012, lon: 104.0021 },
      ],
      edges: [
        { from: "1", to: "2", cost: 100 },
      ],
    });
    vi.stubGlobal("Worker", MockWorker);

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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("previews a local graph route while hovering before click", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await wrapper.find(".map-hover-trigger").trigger("click");
    await vi.advanceTimersByTimeAsync(45);
    await flushPromises();

    expect(fetchNavigationGraphTileMock).toHaveBeenCalled();
    expect(workerInstances[0].messages).toContainEqual(
      expect.objectContaining({
        type: "computeRoute",
        payload: expect.objectContaining({
          targetPoint: { latitude: 30.6012, longitude: 104.0021 },
        }),
      }),
    );
    expect(wrapper.findAll(".LPolyline-stub")).toHaveLength(3);

    await wrapper.find(".map-hover-leave-trigger").trigger("click");
    await flushPromises();

    expect(wrapper.findAll(".LPolyline-stub")).toHaveLength(2);
  });

  it("starts task hover preview from the last task target", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await wrapper.find(".map-click-trigger-first").trigger("click");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    await wrapper.find(".map-hover-trigger").trigger("click");
    await vi.advanceTimersByTimeAsync(45);
    await flushPromises();

    const computeMessage = workerInstances[0].messages.find((message) => message.type === "computeRoute");
    expect(computeMessage.payload.startPoint).toEqual({
      latitude: 31.2304,
      longitude: 121.4737,
    });
  });

  it("starts realtime hover preview from the current drone position", async () => {
    const { default: DroneMap } = await import("./DroneMap.vue");
    const wrapper = mount(DroneMap);

    await flushPromises();
    await getModeButtons(wrapper)[1].trigger("click");
    await wrapper.find(".map-hover-trigger").trigger("click");
    await vi.advanceTimersByTimeAsync(45);
    await flushPromises();

    const computeMessages = workerInstances[0].messages.filter((message) => message.type === "computeRoute");
    const computeMessage = computeMessages[computeMessages.length - 1];
    expect(computeMessage.payload.startPoint).toEqual({
      latitude: 30.598,
      longitude: 103.991,
    });
  });
});
