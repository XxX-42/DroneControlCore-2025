<template>
  <div class="page-shell">
    <div class="control-panel">
      <div class="panel-header">
        <h3>{{ ui.title }}</h3>
        <button class="locale-toggle" type="button" @click="toggleLocale">
          {{ ui.localeButton }}
        </button>
      </div>

      <TelemetryPanel
        :drone-state="droneState"
        :is-connected="isConnected"
        :current-zoom="currentZoom"
        :route-type-label="routeTypeLabel"
        :locale="locale"
      />

      <MissionControlPanel
        :current-mission-id-label="currentMissionIdLabel"
        :current-execution-id-label="currentExecutionIdLabel"
        :current-mission-status="currentMissionStatus"
        :current-execution-status="currentExecutionStatus"
        :status-message="statusMessage"
        :control-error="controlError"
        :can-pause="canPause"
        :can-resume="canResume"
        :can-cancel="canCancel"
        :is-controlling="isControlling"
        :pending-action="pendingAction"
        :is-refreshing-history="isRefreshingHistory"
        :is-planning="isPlanning"
        :planning-error="planningError"
        :waypoint-count="waypoints.length"
        :is-uploading="isUploading"
        :locale="locale"
        @refresh-history="refreshHistory"
        @pause="pauseExecution"
        @resume="resumeExecution"
        @cancel="cancelExecution"
        @upload-mission="uploadMission"
        @clear-mission="clearMission"
      />

      <MissionHistoryPanel
        :mission-count="missionHistory.length"
        :mission-filter-options="missionFilterOptions"
        :mission-history-filter="missionHistoryFilter"
        :replay-banner-label="replayBannerLabel"
        :selected-replay-mission="selectedReplayMission"
        :execution-filter-options="executionFilterOptions"
        :replay-execution-filter="replayExecutionFilter"
        :replay-execution-cards="replayExecutionCards"
        :selected-replay-execution-id="selectedReplayExecutionId"
        :replay-trace-length="replayTrace.length"
        :replay-playback-label="replayPlaybackLabel"
        :replay-progress="replayProgress"
        :replay-duration-label="replayDurationLabel"
        :is-replay-playing="isReplayPlaying"
        :history-cards="historyCards"
        :selected-replay-mission-id="selectedReplayMissionId"
        :locale="locale"
        @update:mission-history-filter="missionHistoryFilter = $event"
        @clear-replay="clearReplay"
        @update:replay-execution-filter="replayExecutionFilter = $event"
        @select-replay-execution="selectReplayExecution"
        @update:replay-progress="updateReplayProgress"
        @toggle-replay="toggleReplayPlayback"
        @step-replay-backward="stepReplayBackward"
        @step-replay-forward="stepReplayForward"
        @load-mission-detail="loadMissionDetail"
      />
    </div>

    <l-map
      ref="map"
      v-model:zoom="zoom"
      :center="[30.598, 103.991]"
      :use-global-leaflet="false"
      @click="onMapClick"
      @ready="onMapReady"
    >
      <l-tile-layer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        layer-type="base"
        name="OpenStreetMap"
      />

      <l-marker
        v-for="(wp, index) in displayMarkers"
        :key="'wp-' + index"
        :lat-lng="[wp.latitude, wp.longitude]"
      >
        <l-popup>{{ wp.label }}</l-popup>
      </l-marker>

      <l-polyline
        v-if="replayRoute.length > 1"
        :lat-lngs="replayRoute"
        color="#fbbf24"
        :weight="6"
        :opacity="0.35"
      />

      <l-polyline
        v-if="replayPlaybackRoute.length > 1"
        :lat-lngs="replayPlaybackRoute"
        color="#f59e0b"
        :weight="7"
        :opacity="0.95"
      />

      <l-polyline
        v-if="plannedRoute.length > 1"
        :lat-lngs="plannedRoute"
        color="#38bdf8"
        :weight="4"
      />

      <l-polyline
        :lat-lngs="dronePath"
        color="#f97316"
        :weight="2"
      />

      <l-circle-marker
        v-if="replayCursor"
        :lat-lng="[replayCursor.latitude, replayCursor.longitude]"
        :radius="7"
        color="#f59e0b"
        fill-color="#facc15"
        :fill-opacity="1"
      >
        <l-popup>
          <strong>{{ ui.replayCursor }}</strong><br>
          {{ ui.step }}: {{ replayProgress }}
        </l-popup>
      </l-circle-marker>

      <l-circle-marker
        :lat-lng="[droneState.lat, droneState.lon]"
        :radius="8"
        color="#ef4444"
        fill-color="#ef4444"
        :fill-opacity="1"
      >
        <l-popup>
          <strong>{{ ui.droneLive }}</strong><br>
          {{ ui.altitude }}: {{ droneState.alt }}m<br>
          {{ ui.heading }}: {{ droneState.heading }} deg
        </l-popup>
      </l-circle-marker>
    </l-map>
  </div>
</template>

<script setup>
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { LCircleMarker, LMap, LMarker, LPopup, LPolyline, LTileLayer } from "@vue-leaflet/vue-leaflet";

import MissionControlPanel from "./drone-map/MissionControlPanel.vue";
import MissionHistoryPanel from "./drone-map/MissionHistoryPanel.vue";
import TelemetryPanel from "./drone-map/TelemetryPanel.vue";
import { useDronePath } from "../composables/useDronePath";
import { useMissionControl } from "../composables/useMissionControl";
import { useReplayHistory } from "../composables/useReplayHistory";
import { useRoutePlanning } from "../composables/useRoutePlanning";
import { useTelemetry } from "../composables/useTelemetry";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8090";
const PLAN_CLICK_DEBOUNCE_MS = 250;
const { droneState, isConnected } = useTelemetry();
const locale = ref("zh");
const pendingPlanTimer = ref(null);

const zoom = ref(14);
const currentZoom = ref(14);

const {
  missionHistory,
  isUploading,
  isControlling,
  isRefreshingHistory,
  controlError,
  statusMessage,
  pendingAction,
  currentMissionId,
  currentExecutionId,
  currentMissionStatus,
  currentExecutionStatus,
  canPause,
  canResume,
  canCancel,
  refreshHistory,
  uploadMission: uploadMissionRequest,
  sendExecutionAction,
  resetMissionControl,
} = useMissionControl(apiBaseUrl);

const {
  replayWaypoints,
  replayTrace,
  replayProgress,
  isReplayPlaying,
  selectedReplayMissionId,
  selectedReplayExecutionId,
  selectedReplayMission,
  missionFilterOptions,
  executionFilterOptions,
  missionHistoryFilter,
  replayExecutionFilter,
  replayPlaybackLabel,
  replayDurationLabel,
  replayBannerLabel,
  replayExecutionCards,
  historyCards,
  loadMissionDetail,
  selectReplayExecution,
  clearReplay,
  updateReplayProgress: setReplayProgress,
  toggleReplayPlayback,
  stepReplayBackward,
  stepReplayForward,
  stopReplayPlayback,
  resetReplayHistory,
  primeReplayFromUpload,
} = useReplayHistory({
  apiBaseUrl,
  missionHistory,
  setStatusMessage: (message) => {
    statusMessage.value = message;
  },
  setControlError: (message) => {
    controlError.value = message;
  },
});

const {
  waypoints,
  targetPoint,
  isPlanning,
  planningError,
  plannedRoute,
  routeTypeLabel,
  planRouteToTarget,
  resetRoutePlanning,
} = useRoutePlanning({
  apiBaseUrl,
  droneState,
  setStatusMessage: (message) => {
    statusMessage.value = message;
  },
});

const {
  dronePath,
  resetDronePath,
} = useDronePath(droneState);

const replayRoute = computed(() => replayTrace.value.map((point) => [point.latitude, point.longitude]));
const replayPlaybackRoute = computed(() =>
  replayTrace.value.slice(0, replayProgress.value + 1).map((point) => [point.latitude, point.longitude]),
);
const replayCursor = computed(() => replayTrace.value[replayProgress.value] || null);
const currentMissionIdLabel = computed(() => currentMissionId.value ? shortId(currentMissionId.value) : "NONE");
const currentExecutionIdLabel = computed(() => currentExecutionId.value ? shortId(currentExecutionId.value) : "NONE");
const ui = computed(() => {
  if (locale.value === "en") {
    return {
      title: "L3 Autonomous Nav",
      localeButton: "\u4e2d\u6587",
      replayCursor: "Replay Cursor",
      step: "Step",
      droneLive: "Drone Live",
      altitude: "Alt",
      heading: "Hdg",
      routeStart: "Route Start",
      target: "Target",
      replayStart: "Replay Start",
      replayEnd: "Replay End",
    };
  }

  return {
    title: "L3 \u81ea\u4e3b\u5bfc\u822a",
    localeButton: "English",
    replayCursor: "\u56de\u653e\u5149\u6807",
    step: "\u6b65\u9aa4",
    droneLive: "\u65e0\u4eba\u673a\u5b9e\u65f6",
    altitude: "\u9ad8\u5ea6",
    heading: "\u822a\u5411",
    routeStart: "\u8def\u7ebf\u8d77\u70b9",
    target: "\u76ee\u6807",
    replayStart: "\u56de\u653e\u8d77\u70b9",
    replayEnd: "\u56de\u653e\u7ec8\u70b9",
  };
});

const displayMarkers = computed(() => {
  const markers = [];

  if (waypoints.value.length > 0) {
    markers.push({
      latitude: waypoints.value[0].latitude,
      longitude: waypoints.value[0].longitude,
      label: ui.value.routeStart,
    });
  }

  if (targetPoint.value) {
    markers.push({
      latitude: targetPoint.value.latitude,
      longitude: targetPoint.value.longitude,
      label: ui.value.target,
    });
  }

  if (replayTrace.value.length > 0) {
    markers.push({
      latitude: replayTrace.value[0].latitude,
      longitude: replayTrace.value[0].longitude,
      label: ui.value.replayStart,
    });
    markers.push({
      latitude: replayTrace.value[replayTrace.value.length - 1].latitude,
      longitude: replayTrace.value[replayTrace.value.length - 1].longitude,
      label: ui.value.replayEnd,
    });
  }

  return markers;
});

const shortId = (value) => value.slice(0, 8).toUpperCase();
const toggleLocale = () => {
  locale.value = locale.value === "zh" ? "en" : "zh";
};

const updateReplayProgress = (value) => {
  setReplayProgress(value);
};

const onMapReady = (map) => {
  L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);
  currentZoom.value = map.getZoom();
  map.on("zoom", () => {
    currentZoom.value = map.getZoom();
  });
};

const onMapClick = async (event) => {
  const { lat, lng } = event.latlng;
  if (pendingPlanTimer.value) {
    clearTimeout(pendingPlanTimer.value);
  }

  pendingPlanTimer.value = setTimeout(async () => {
    pendingPlanTimer.value = null;
    await planRouteToTarget(lat, lng);
  }, PLAN_CLICK_DEBOUNCE_MS);
};

const clearMission = () => {
  stopReplayPlayback();
  resetReplayHistory();
  resetRoutePlanning();
  resetDronePath();
  resetMissionControl();
};

const uploadMission = async () => {
  const result = await uploadMissionRequest(waypoints.value);
  if (result) {
    primeReplayFromUpload({
      missionId: result.mission_id,
      executionId: result.execution_id,
      waypoints: waypoints.value,
    });
  }
};

const pauseExecution = async () => {
  await sendExecutionAction("pause");
};

const resumeExecution = async () => {
  await sendExecutionAction("resume");
};

const cancelExecution = async () => {
  await sendExecutionAction("cancel");
};

onMounted(async () => {
  await refreshHistory();
});

onBeforeUnmount(() => {
  if (pendingPlanTimer.value) {
    clearTimeout(pendingPlanTimer.value);
    pendingPlanTimer.value = null;
  }
  stopReplayPlayback();
});
</script>

<style scoped>
.page-shell {
  height: 100vh;
  width: 100%;
  background:
    radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.18), transparent 30%),
    radial-gradient(circle at 80% 10%, rgba(249, 115, 22, 0.16), transparent 25%),
    linear-gradient(135deg, #07111f 0%, #0f172a 55%, #172033 100%);
}

.control-panel {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 1000;
  background: rgba(8, 15, 29, 0.9);
  color: #e2e8f0;
  padding: 18px;
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  font-family: "Inter", sans-serif;
  width: 320px;
  backdrop-filter: blur(16px);
  border: 1px solid rgba(148, 163, 184, 0.16);
  max-height: calc(100vh - 36px);
  overflow-y: auto;
}

h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #7dd3fc;
  text-transform: uppercase;
  letter-spacing: 1.2px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  padding-bottom: 10px;
  margin-bottom: 14px;
  gap: 12px;
}

.locale-toggle {
  border: 1px solid rgba(125, 211, 252, 0.3);
  background: rgba(14, 165, 233, 0.1);
  color: #7dd3fc;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.locale-toggle:hover {
  background: rgba(14, 165, 233, 0.18);
  transform: translateY(-1px);
}

@media (max-width: 960px) {
  .control-panel {
    left: 12px;
    right: 12px;
    width: auto;
    max-height: 54vh;
  }
}
</style>
