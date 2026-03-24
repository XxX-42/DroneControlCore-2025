<template>
  <div class="page-shell">
    <div class="control-panel">
      <div class="panel-header">
        <h3>{{ ui.title }}</h3>
        <div class="header-actions">
          <div class="mode-switch" role="tablist" :aria-label="ui.modeSwitchLabel">
            <button
              class="mode-chip"
              :class="{ active: navigationMode === 'task' }"
              type="button"
              @click="setNavigationMode('task')"
            >
              {{ ui.taskMode }}
            </button>
            <button
              class="mode-chip"
              :class="{ active: navigationMode === 'realtime' }"
              type="button"
              @click="setNavigationMode('realtime')"
            >
              {{ ui.realtimeMode }}
            </button>
          </div>
          <button class="locale-toggle" type="button" @click="toggleLocale">
            {{ ui.localeButton }}
          </button>
        </div>
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
        :task-targets="taskTargetMarkers"
        :locale="locale"
        @refresh-history="refreshHistory"
        @stop="stopExecution"
        @resume="resumeExecution"
        @cancel="cancelExecution"
        @upload-mission="uploadMission"
        @resume-mission="resumeMissionFromPrimary"
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

    <div class="map-focus-tools">
      <button
        class="map-focus-button"
        type="button"
        :title="ui.deviceLocationTitle"
        @click="focusDeviceLocation"
      >
        {{ ui.deviceLocation }}
      </button>
      <button
        class="map-focus-button"
        type="button"
        :title="ui.taskStartLocationTitle"
        @click="focusTaskStartLocation"
      >
        {{ ui.taskStartLocation }}
      </button>
      <button
        class="map-focus-button"
        type="button"
        :title="ui.droneLocationTitle"
        @click="focusDroneLocation"
      >
        {{ ui.droneLocation }}
      </button>
    </div>

    <l-map
      ref="map"
      v-model:zoom="zoom"
      :center="[30.598, 103.991]"
      :use-global-leaflet="false"
      @click="onMapClick"
      @mousemove="onMapHover"
      @mouseout="clearHoverPreview"
      @ready="onMapReady"
    >
      <l-tile-layer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        layer-type="base"
        name="OpenStreetMap"
      />

      <l-marker
        v-for="marker in taskTargetMarkers"
        :key="`task-target-${marker.sequence}`"
        :lat-lng="[marker.latitude, marker.longitude]"
        :icon="marker.icon"
        :marker-kind="`task-target-${marker.sequence}`"
        @click="removeTaskTarget(marker.sequence - 1)"
      >
        <l-popup>
          <strong>{{ marker.label }}</strong><br>
          {{ marker.hint }}
        </l-popup>
      </l-marker>

      <l-marker
        v-for="(wp, index) in displayMarkers"
        :key="'wp-' + index"
        :lat-lng="[wp.latitude, wp.longitude]"
      >
        <l-popup>{{ wp.label }}</l-popup>
      </l-marker>

      <l-polyline
        v-if="visibleReplayRoute.length > 1"
        :lat-lngs="visibleReplayRoute"
        color="#fbbf24"
        :weight="6"
        :opacity="0.35"
      />

      <l-polyline
        v-if="visibleReplayPlaybackRoute.length > 1"
        :lat-lngs="visibleReplayPlaybackRoute"
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
        v-if="hoverPreviewRoute.length > 1"
        :lat-lngs="hoverPreviewRoute"
        color="#67e8f9"
        :weight="3"
        :opacity="0.65"
        :dash-array="'10 8'"
      />

      <l-polyline
        :lat-lngs="dronePath"
        :color="dronePathColor"
        :weight="2"
      />

      <l-circle-marker
        v-if="visibleReplayCursor"
        :lat-lng="[visibleReplayCursor.latitude, visibleReplayCursor.longitude]"
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

      <l-marker
        :lat-lng="[droneState.lat, droneState.lon]"
        :icon="droneLiveIcon"
      >
        <l-popup>
          <strong>{{ ui.droneLive }}</strong><br>
          {{ ui.altitude }}: {{ droneState.alt }}m<br>
          {{ ui.heading }}: {{ droneState.heading }} deg
        </l-popup>
      </l-marker>
    </l-map>
  </div>
</template>

<script setup>
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { planNavigation } from "../services/navigationApi";
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
const HOVER_PLAN_DEBOUNCE_MS = 140;
const HOVER_PLAN_MIN_DELTA = 0.00018;
const { droneState, isConnected } = useTelemetry();
const locale = ref("zh");
const navigationMode = ref("task");
const activeExecutionMode = ref("task");
const pendingTaskExecution = ref(false);
const pendingPlanTimer = ref(null);
const hoverPlanTimer = ref(null);
const hoverPreviewRoute = ref([]);
const hoverPreviewTarget = ref(null);
const lastHoverPoint = ref(null);
let hoverPlanController = null;
const lastTaskEndpoint = ref(null);
const taskTargets = ref([]);
const mapInstance = ref(null);

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
const hasActiveExecution = computed(() =>
  Boolean(currentExecutionId.value)
  && ["RUNNING", "PAUSED", "QUEUED", "EXECUTING"].includes(currentExecutionStatus.value),
);
const hasActiveTaskExecution = computed(() =>
  activeExecutionMode.value === "task"
  && Boolean(currentExecutionId.value)
  && ["RUNNING", "PAUSED", "QUEUED", "EXECUTING"].includes(currentExecutionStatus.value),
);
const isDroneMoving = computed(() => 
  ["RUNNING", "QUEUED", "EXECUTING"].includes(currentExecutionStatus.value),
);
const shouldShowReplayOverlay = computed(() => !isDroneMoving.value);
const visibleReplayRoute = computed(() => (shouldShowReplayOverlay.value ? replayRoute.value : []));
const visibleReplayPlaybackRoute = computed(() => (shouldShowReplayOverlay.value ? replayPlaybackRoute.value : []));
const visibleReplayCursor = computed(() => (shouldShowReplayOverlay.value ? replayCursor.value : null));
const droneAccentColor = computed(() => (isDroneMoving.value ? "#22c55e" : "#ef4444"));
const dronePathColor = computed(() => (isDroneMoving.value ? "#4ade80" : "#f97316"));
const droneLiveIcon = computed(() => L.divIcon({
  className: "drone-live-marker",
  html: `<span class="drone-live-dot" style="background:${droneAccentColor.value}"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
}));
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
      modeSwitchLabel: "Navigation mode",
      taskMode: "Task",
      realtimeMode: "Realtime",
      routeStart: "Route Start",
      target: "Target",
      taskPoint: (index) => `Task ${index}`,
      more: "More",
      coordinates: "Coordinates",
      deviceLocation: "Device",
      deviceLocationTitle: "Focus device location",
      taskStartLocation: "Start",
      taskStartLocationTitle: "Focus task start point",
      droneLocation: "Drone",
      droneLocationTitle: "Focus drone location",
      taskPointHint: "Click to remove",
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
    modeSwitchLabel: "\u5bfc\u822a\u6a21\u5f0f",
    taskMode: "\u4efb\u52a1\u6a21\u5f0f",
    realtimeMode: "\u5b9e\u65f6\u6a21\u5f0f",
    routeStart: "\u8def\u7ebf\u8d77\u70b9",
    target: "\u76ee\u6807",
    taskPoint: (index) => `\u4efb\u52a1\u70b9 ${index}`,
    more: "More",
    coordinates: "\u5750\u6807",
    deviceLocation: "\u8bbe\u5907",
    deviceLocationTitle: "\u5b9a\u4f4d\u5230\u5f53\u524d\u8bbe\u5907\u4f4d\u7f6e",
    taskStartLocation: "\u8d77\u70b9",
    taskStartLocationTitle: "\u5b9a\u4f4d\u5230\u4efb\u52a1\u8d77\u70b9",
    droneLocation: "\u65e0\u4eba\u673a",
    droneLocationTitle: "\u5b9a\u4f4d\u5230\u65e0\u4eba\u673a\u5f53\u524d\u4f4d\u7f6e",
    taskPointHint: "\u70b9\u51fb\u5373\u53ef\u5220\u9664",
    replayStart: "\u56de\u653e\u8d77\u70b9",
    replayEnd: "\u56de\u653e\u7ec8\u70b9",
  };
});

const taskTargetMarkers = computed(() => taskTargets.value.map((target, index) => ({
  ...target,
  sequence: index + 1,
  label: ui.value.taskPoint(index + 1),
  hint: ui.value.taskPointHint,
  coordinateLabel: `${target.latitude.toFixed(5)}, ${target.longitude.toFixed(5)}`,
  icon: L.divIcon({
    className: "task-target-marker",
    html: `
      <div class="task-target-card">
        <div class="task-target-pin">
          <span class="task-target-pin-dot"></span>
        </div>
        <div class="task-target-meta">
          <div class="task-target-sequence">${ui.value.taskPoint(index + 1)}</div>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -20],
  }),
})));

const displayMarkers = computed(() => {
  const markers = [];

  if (waypoints.value.length > 0) {
    markers.push({
      latitude: waypoints.value[0].latitude,
      longitude: waypoints.value[0].longitude,
      label: ui.value.routeStart,
    });
  }

  if (navigationMode.value !== "task" && targetPoint.value) {
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
const toStoredPoint = (point) => {
  if (!point) {
    return null;
  }

  return {
    latitude: point.latitude,
    longitude: point.longitude,
  };
};

const updateLastTaskEndpoint = (plannedWaypoints) => {
  if (!Array.isArray(plannedWaypoints) || plannedWaypoints.length === 0) {
    return;
  }

  lastTaskEndpoint.value = toStoredPoint(plannedWaypoints[plannedWaypoints.length - 1]);
};

const getCurrentDronePoint = () => ({
  latitude: droneState.value.lat,
  longitude: droneState.value.lon,
});

const resolveTaskBaseStartPoint = () => {
  if (!hasActiveTaskExecution.value) {
    return getCurrentDronePoint();
  }

  if (lastTaskEndpoint.value) {
    return lastTaskEndpoint.value;
  }

  return getCurrentDronePoint();
};

const syncLastTaskEndpointFromHistory = () => {
  const latestMission = missionHistory.value.find(
    (mission) => Array.isArray(mission.waypoints) && mission.waypoints.length > 0,
  );
  if (!latestMission) {
    return;
  }

  updateLastTaskEndpoint(latestMission.waypoints);
};

const toggleLocale = () => {
  locale.value = locale.value === "zh" ? "en" : "zh";
};
const setNavigationMode = (mode) => {
  if (mode === "task" && activeExecutionMode.value === "realtime" && hasActiveExecution.value) {
    pendingTaskExecution.value = true;
  }
  navigationMode.value = mode;
  statusMessage.value = mode === "task"
    ? (pendingTaskExecution.value
      ? "\u5df2\u5207\u6362\u5230\u4efb\u52a1\u6a21\u5f0f\uff1a\u5f53\u524d\u5b9e\u65f6\u4efb\u52a1\u5b8c\u6210\u540e\uff0c\u5c06\u6309\u987a\u5e8f\u6267\u884c\u5df2\u89c4\u5212\u4efb\u52a1"
      : "\u5df2\u5207\u6362\u5230\u4efb\u52a1\u6a21\u5f0f\uff1a\u6309\u70b9\u51fb\u987a\u5e8f\u7d2f\u79ef\u8def\u7ebf")
    : "\u5df2\u5207\u6362\u5230\u5b9e\u65f6\u6a21\u5f0f\uff1a\u70b9\u51fb\u540e\u7acb\u5373\u89c4\u5212\u5e76\u6267\u884c";
};

const updateReplayProgress = (value) => {
  setReplayProgress(value);
};

const focusMap = (latitude, longitude, zoomLevel = 17) => {
  if (!mapInstance.value) {
    return;
  }

  mapInstance.value.setView([latitude, longitude], zoomLevel);
};

const onMapReady = (map) => {
  mapInstance.value = map;
  L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);
  currentZoom.value = map.getZoom();
  map.on("zoom", () => {
    currentZoom.value = map.getZoom();
  });
};

const focusDeviceLocation = () => {
  controlError.value = "";
  if (!navigator.geolocation) {
    controlError.value = "\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u5b9e\u9645\u5b9a\u4f4d";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      focusMap(position.coords.latitude, position.coords.longitude);
      statusMessage.value = "\u5df2\u5b9a\u4f4d\u5230\u5f53\u524d\u8bbe\u5907\u4f4d\u7f6e";
    },
    () => {
      controlError.value = "\u65e0\u6cd5\u83b7\u53d6\u5f53\u524d\u8bbe\u5907\u4f4d\u7f6e";
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 10000,
    },
  );
};

const focusTaskStartLocation = () => {
  const startPoint = resolveTaskBaseStartPoint();
  focusMap(startPoint.latitude, startPoint.longitude);
  statusMessage.value = "\u5df2\u5b9a\u4f4d\u5230\u4efb\u52a1\u8d77\u70b9";
};

const focusDroneLocation = () => {
  focusMap(droneState.value.lat, droneState.value.lon);
  statusMessage.value = "\u5df2\u5b9a\u4f4d\u5230\u65e0\u4eba\u673a\u4f4d\u7f6e";
};

const uploadPlannedMission = async (plannedWaypoints) => {
  const uploadMode = navigationMode.value;
  const result = await uploadMissionRequest(plannedWaypoints);
  if (result) {
    activeExecutionMode.value = uploadMode;
    if (uploadMode === "task") {
      updateLastTaskEndpoint(plannedWaypoints);
      pendingTaskExecution.value = false;
    }
    primeReplayFromUpload({
      missionId: result.mission_id,
      executionId: result.execution_id,
      waypoints: plannedWaypoints,
    });
  }
  return result;
};

const resolveTaskStartPoint = () => {
  if (taskTargets.value.length > 0 && waypoints.value.length > 0) {
    return waypoints.value[waypoints.value.length - 1];
  }

  return resolveTaskBaseStartPoint();
};

const rebuildTaskRoute = async (targets, startPoint) => {
  clearHoverPreview();
  resetRoutePlanning();

  if (targets.length === 0) {
    return true;
  }

  let currentStartPoint = startPoint;
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const result = await planRouteToTarget(target.latitude, target.longitude, {
      startPoint: currentStartPoint,
      append: index > 0,
    });

    if (!result) {
      return false;
    }

    currentStartPoint = target;
  }

  return true;
};

const handleTaskModeClick = async (lat, lng) => {
  const append = taskTargets.value.length > 0;
  const result = await planRouteToTarget(lat, lng, {
    startPoint: resolveTaskStartPoint(),
    append,
  });

  if (result) {
    taskTargets.value = [...taskTargets.value, { latitude: lat, longitude: lng }];
    statusMessage.value = pendingTaskExecution.value
      ? "\u4efb\u52a1\u6a21\u5f0f\uff1a\u5df2\u6392\u961f\u4efb\u52a1\u70b9\uff0c\u7b49\u5f85\u5b9e\u65f6\u4efb\u52a1\u5b8c\u6210\u540e\u6309\u987a\u5e8f\u6267\u884c"
      : append
        ? "\u4efb\u52a1\u6a21\u5f0f\uff1a\u5df2\u6309\u987a\u5e8f\u8ffd\u52a0\u65b0\u76ee\u6807"
        : "\u4efb\u52a1\u6a21\u5f0f\uff1a\u5df2\u521b\u5efa\u9996\u4e2a\u4efb\u52a1\u76ee\u6807";
  }
};

const removeTaskTarget = async (targetIndex) => {
  if (targetIndex < 0 || targetIndex >= taskTargets.value.length) {
    return;
  }

  if (pendingPlanTimer.value) {
    clearTimeout(pendingPlanTimer.value);
    pendingPlanTimer.value = null;
  }

  const removedIsLast = targetIndex === taskTargets.value.length - 1;
  const remainingTargets = taskTargets.value.filter((_, index) => index !== targetIndex);
  const wasActiveTaskExecution = hasActiveTaskExecution.value;
  taskTargets.value = remainingTargets;

  if (wasActiveTaskExecution && canCancel.value) {
    await cancelExecution();
  }

  if (removedIsLast) {
    clearHoverPreview();
  resetRoutePlanning();
    targetPoint.value = null;
    statusMessage.value = "\u5df2\u5220\u9664\u6700\u540e\u4efb\u52a1\u70b9\uff0c\u65e0\u4eba\u673a\u5df2\u7acb\u5373\u505c\u6b62";
    return;
  }

  const rebuilt = await rebuildTaskRoute(
    remainingTargets,
    wasActiveTaskExecution
      ? {
        latitude: droneState.value.lat,
        longitude: droneState.value.lon,
      }
      : resolveTaskBaseStartPoint(),
  );

  if (!rebuilt) {
    return;
  }

  if (wasActiveTaskExecution) {
    const uploadResult = await uploadPlannedMission(waypoints.value);
    if (uploadResult) {
      statusMessage.value = "\u5df2\u8df3\u8fc7\u8be5\u4efb\u52a1\u70b9\uff0c\u6b63\u5728\u524d\u5f80\u4e0b\u4e00\u4e2a\u76ee\u6807";
    }
    return;
  }

  statusMessage.value = "\u5df2\u5220\u9664\u4efb\u52a1\u70b9\uff0c\u5e8f\u53f7\u5df2\u66f4\u65b0";
};

const resetRealtimeVisualState = () => {
  stopReplayPlayback();
  resetReplayHistory();
  clearHoverPreview();
  resetRoutePlanning();
};

const handleRealtimeModeClick = async (lat, lng) => {
  resetRealtimeVisualState();

  const result = await planRouteToTarget(lat, lng, {
    startPoint: {
      latitude: droneState.value.lat,
      longitude: droneState.value.lon,
    },
    append: false,
  });

  if (!result) {
    return;
  }

  if (currentExecutionId.value && canCancel.value) {
    await cancelExecution();
  }

  const uploadResult = await uploadPlannedMission(result.waypoints);
  if (uploadResult) {
    statusMessage.value = "\u5b9e\u65f6\u6a21\u5f0f\uff1a\u5df2\u7acb\u5373\u4e0b\u53d1\u65b0\u76ee\u6807";
  }
};

const onMapClick = async (event) => {
  const { lat, lng } = event.latlng;
  clearHoverPreview();
  if (pendingPlanTimer.value) {
    clearTimeout(pendingPlanTimer.value);
  }

  pendingPlanTimer.value = setTimeout(async () => {
    pendingPlanTimer.value = null;
    if (navigationMode.value === "task") {
      await handleTaskModeClick(lat, lng);
      return;
    }

    await handleRealtimeModeClick(lat, lng);
  }, PLAN_CLICK_DEBOUNCE_MS);
};

const clearHoverPreview = () => {
  if (hoverPlanTimer.value) {
    clearTimeout(hoverPlanTimer.value);
    hoverPlanTimer.value = null;
  }
  if (hoverPlanController) {
    hoverPlanController.abort("hover-reset");
    hoverPlanController = null;
  }
  hoverPreviewRoute.value = [];
  hoverPreviewTarget.value = null;
  lastHoverPoint.value = null;
};

const onMapHover = (event) => {
  const { lat, lng } = event.latlng;
  if (navigationMode.value === "task" && pendingTaskExecution.value && taskTargets.value.length > 0) {
    return;
  }

  if (lastHoverPoint.value) {
    const latDelta = Math.abs(lastHoverPoint.value.latitude - lat);
    const lonDelta = Math.abs(lastHoverPoint.value.longitude - lng);
    if (latDelta < HOVER_PLAN_MIN_DELTA && lonDelta < HOVER_PLAN_MIN_DELTA) {
      return;
    }
  }

  lastHoverPoint.value = { latitude: lat, longitude: lng };
  hoverPreviewTarget.value = { latitude: lat, longitude: lng };

  if (hoverPlanTimer.value) {
    clearTimeout(hoverPlanTimer.value);
  }

  hoverPlanTimer.value = setTimeout(async () => {
    hoverPlanTimer.value = null;

    if (hoverPlanController) {
      hoverPlanController.abort("hover-superseded");
    }

    const startPoint = navigationMode.value === "task" ? resolveTaskStartPoint() : getCurrentDronePoint();
    const controller = new AbortController();
    hoverPlanController = controller;

    try {
      const result = await planNavigation(
        apiBaseUrl,
        {
          start_latitude: startPoint.latitude,
          start_longitude: startPoint.longitude,
          target_latitude: lat,
          target_longitude: lng,
        },
        { signal: controller.signal },
      );

      if (hoverPlanController !== controller) {
        return;
      }

      hoverPreviewRoute.value = Array.isArray(result.waypoints)
        ? result.waypoints.map((point) => [point.latitude, point.longitude])
        : [];
    } catch (error) {
      if (error.name !== "AbortError") {
        hoverPreviewRoute.value = [];
      }
    } finally {
      if (hoverPlanController === controller) {
        hoverPlanController = null;
      }
    }
  }, HOVER_PLAN_DEBOUNCE_MS);
};

const clearMission = () => {
  stopReplayPlayback();
  resetReplayHistory();
  clearHoverPreview();
  resetRoutePlanning();
  resetDronePath();
  resetMissionControl();
  taskTargets.value = [];
};

const uploadMission = async () => {
  await uploadPlannedMission(waypoints.value);
};

const stopExecution = async () => {
  await sendExecutionAction("pause");
};

const resumeExecution = async () => {
  await sendExecutionAction("resume");
};

const resumeMissionFromPrimary = async () => {
  await resumeExecution();
};

const cancelExecution = async () => {
  await sendExecutionAction("cancel");
};

onMounted(async () => {
  await refreshHistory();
  syncLastTaskEndpointFromHistory();
});

watch(
  () => currentExecutionStatus.value,
  async (nextStatus, previousStatus) => {
    const activeStatuses = ["RUNNING", "QUEUED", "EXECUTING", "PAUSED"];
    const executionFinished = activeStatuses.includes(previousStatus) && !activeStatuses.includes(nextStatus);

    if (!executionFinished) {
      return;
    }

    if (
      pendingTaskExecution.value
      && navigationMode.value === "task"
      && taskTargets.value.length > 0
      && waypoints.value.length > 0
    ) {
      const uploadResult = await uploadPlannedMission(waypoints.value);
      if (uploadResult) {
        statusMessage.value = "\u5b9e\u65f6\u4efb\u52a1\u5df2\u5b8c\u6210\uff0c\u5df2\u5207\u6362\u4e3a\u4efb\u52a1\u6a21\u5f0f\u5e76\u5f00\u59cb\u6309\u987a\u5e8f\u6267\u884c";
      }
    }
  },
);

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

.map-focus-tools {
  position: absolute;
  top: 92px;
  left: 14px;
  z-index: 900;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-focus-button {
  min-width: 72px;
  padding: 8px 10px;
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(10px);
  transition: transform 0.2s ease, background 0.2s ease;
}

.map-focus-button:hover {
  background: #f8fafc;
  transform: translateY(-1px);
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-switch {
  display: flex;
  gap: 6px;
}

.mode-chip {
  border: 1px solid rgba(125, 211, 252, 0.24);
  background: rgba(15, 23, 42, 0.85);
  color: #cbd5e1;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
}

.mode-chip.active {
  background: rgba(14, 165, 233, 0.18);
  color: #7dd3fc;
  border-color: rgba(56, 189, 248, 0.5);
}

.mode-chip:hover {
  transform: translateY(-1px);
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

:global(.task-target-marker) {
  background: transparent;
  border: none;
  width: auto !important;
  height: auto !important;
}

:global(.task-target-card) {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 24px;
}

:global(.task-target-pin) {
  position: relative;
  width: 24px;
  height: 24px;
  border-radius: 999px 999px 999px 0;
  background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%);
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 22px rgba(2, 132, 199, 0.35);
}

:global(.task-target-pin-dot) {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #f8fafc;
  transform: rotate(45deg);
}

:global(.task-target-meta) {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5px 8px 6px;
  border-radius: 10px;
  background: rgba(8, 15, 29, 0.88);
  border: 1px solid rgba(56, 189, 248, 0.35);
  box-shadow: 0 10px 26px rgba(2, 6, 23, 0.4);
  white-space: nowrap;
}

:global(.task-target-sequence) {
  color: #f8fafc;
  font-size: 0.74rem;
  font-weight: 800;
  line-height: 1;
}

:global(.drone-live-marker) {
  background: transparent;
  border: none;
}

:global(.drone-live-dot) {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.18), 0 8px 18px rgba(15, 23, 42, 0.28);
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




