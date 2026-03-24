<template>
  <div class="page-shell">
    <div class="control-panel">
      <h3>L3 Autonomous Nav</h3>

      <div class="status-box">
        <span class="label">Telemetry</span>
        <span class="value" :class="{ connected: isConnected, disconnected: !isConnected }">
          {{ isConnected ? "ONLINE" : "OFFLINE" }}
        </span>
      </div>

      <div class="telemetry-grid">
        <div>
          <span class="label">Lat</span>
          <span class="value">{{ droneState.lat.toFixed(5) }}</span>
        </div>
        <div>
          <span class="label">Lon</span>
          <span class="value">{{ droneState.lon.toFixed(5) }}</span>
        </div>
        <div>
          <span class="label">Altitude</span>
          <span class="value">{{ droneState.alt.toFixed(1) }} m</span>
        </div>
        <div>
          <span class="label">Heading</span>
          <span class="value">{{ droneState.heading.toFixed(0) }} deg</span>
        </div>
        <div>
          <span class="label">Zoom</span>
          <span class="value">{{ currentZoom.toFixed(1) }}</span>
        </div>
        <div>
          <span class="label">Route</span>
          <span class="value">{{ routeTypeLabel }}</span>
        </div>
      </div>

      <div class="hud-panel">
        <div class="hud-item">
          <span class="label">Pitch</span>
          <span class="value" :class="{ warning: Math.abs(droneState.pitch) > 10 }">
            {{ droneState.pitch.toFixed(1) }} deg
          </span>
        </div>
        <div class="hud-item">
          <span class="label">Roll</span>
          <span class="value">{{ droneState.roll.toFixed(1) }} deg</span>
        </div>
      </div>

      <div class="mission-card">
        <div class="section-head">
          <span>Current Mission</span>
          <button class="btn-ghost" @click="refreshHistory" :disabled="isRefreshingHistory">
            {{ isRefreshingHistory ? "SYNC..." : "SYNC" }}
          </button>
        </div>
        <div class="mission-grid">
          <div>
            <span class="label">Mission</span>
            <span class="value">{{ currentMissionId ? shortId(currentMissionId) : "NONE" }}</span>
          </div>
          <div>
            <span class="label">Execution</span>
            <span class="value">{{ currentExecutionId ? shortId(currentExecutionId) : "NONE" }}</span>
          </div>
          <div>
            <span class="label">Mission State</span>
            <span class="value">{{ currentMissionStatus }}</span>
          </div>
          <div>
            <span class="label">Exec State</span>
            <span class="value">{{ currentExecutionStatus }}</span>
          </div>
        </div>

        <p v-if="statusMessage" class="hint status-message">{{ statusMessage }}</p>
        <p v-if="controlError" class="hint hint-error">{{ controlError }}</p>

        <div class="btn-row">
          <button
            class="btn-secondary"
            @click="pauseExecution"
            :disabled="!canPause || isControlling"
          >
            {{ isControlling && pendingAction === "pause" ? "PAUSING..." : "PAUSE" }}
          </button>
          <button
            class="btn-secondary"
            @click="resumeExecution"
            :disabled="!canResume || isControlling"
          >
            {{ isControlling && pendingAction === "resume" ? "RESUMING..." : "RESUME" }}
          </button>
          <button
            class="btn-danger"
            @click="cancelExecution"
            :disabled="!canCancel || isControlling"
          >
            {{ isControlling && pendingAction === "cancel" ? "CANCELLING..." : "CANCEL" }}
          </button>
        </div>
      </div>

      <div class="action-area">
        <p v-if="isPlanning" class="hint">Planning route...</p>
        <p v-else-if="planningError" class="hint hint-error">{{ planningError }}</p>
        <p v-else-if="waypoints.length === 0" class="hint">Click map to auto-plan route</p>
        <p v-else class="hint">Planned route: {{ waypoints.length }} nodes</p>

        <div class="btn-group">
          <button
            @click="uploadMission"
            :disabled="waypoints.length === 0 || isUploading || isPlanning || isControlling"
          >
            {{ isUploading ? "UPLOADING..." : "UPLOAD MISSION" }}
          </button>
          <button @click="clearMission" class="btn-danger">
            CLEAR
          </button>
        </div>
      </div>

      <div class="history-card">
        <div class="section-head">
          <span>Recent Missions</span>
          <span class="history-count">{{ missionHistory.length }}</span>
        </div>
        <div v-if="selectedReplayMissionId" class="replay-banner">
          <span>Replay: {{ shortId(selectedReplayMissionId) }}</span>
          <button class="btn-ghost" @click="clearReplay">CLEAR REPLAY</button>
        </div>
        <div v-if="replayWaypoints.length > 0" class="replay-controls">
          <div class="replay-meta">
            <span>{{ replayPlaybackLabel }}</span>
            <span>{{ replayProgress }} / {{ replayWaypoints.length - 1 }}</span>
          </div>
          <input
            v-model="replayProgress"
            class="timeline"
            type="range"
            min="0"
            :max="Math.max(replayWaypoints.length - 1, 0)"
            step="1"
          >
          <div class="btn-row replay-actions">
            <button class="btn-secondary" @click="toggleReplayPlayback">
              {{ isReplayPlaying ? "PAUSE PLAYBACK" : "PLAY REPLAY" }}
            </button>
            <button class="btn-ghost" @click="stepReplayBackward" :disabled="replayProgress <= 0">
              BACK
            </button>
            <button
              class="btn-ghost"
              @click="stepReplayForward"
              :disabled="replayProgress >= replayWaypoints.length - 1"
            >
              NEXT
            </button>
          </div>
        </div>
        <div v-if="missionHistory.length === 0" class="history-empty">No mission history yet.</div>
        <div v-else class="history-list">
          <button
            v-for="mission in missionHistory.slice(0, 6)"
            :key="mission.id"
            class="history-item"
            :class="{ selected: selectedReplayMissionId === mission.id }"
            @click="loadMissionDetail(mission.id)"
          >
            <span class="history-name">{{ mission.name }}</span>
            <span class="history-meta">{{ mission.status }} · {{ formatTime(mission.timestamp) }}</span>
          </button>
        </div>
      </div>
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
          <strong>Replay Cursor</strong><br>
          Step: {{ replayProgress }}
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
          <strong>Drone Live</strong><br>
          Alt: {{ droneState.alt }}m<br>
          Hdg: {{ droneState.heading }} deg
        </l-popup>
      </l-circle-marker>
    </l-map>
  </div>
</template>

<script setup>
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { LCircleMarker, LMap, LMarker, LPopup, LPolyline, LTileLayer } from "@vue-leaflet/vue-leaflet";

import { useTelemetry } from "../composables/useTelemetry";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080";
const { droneState, isConnected } = useTelemetry();

const zoom = ref(14);
const currentZoom = ref(14);
const waypoints = ref([]);
const replayWaypoints = ref([]);
const replayProgress = ref(0);
const isReplayPlaying = ref(false);
const selectedReplayMissionId = ref("");
const targetPoint = ref(null);
const routeType = ref("direct");
const dronePath = ref([]);
const missionHistory = ref([]);
const isUploading = ref(false);
const isPlanning = ref(false);
const isControlling = ref(false);
const isRefreshingHistory = ref(false);
const planningError = ref("");
const controlError = ref("");
const statusMessage = ref("");
const pendingAction = ref("");
const currentMissionId = ref("");
const currentExecutionId = ref("");
const currentMissionStatus = ref("IDLE");
const currentExecutionStatus = ref("NONE");

let replayTimer = null;

const plannedRoute = computed(() => waypoints.value.map((wp) => [wp.latitude, wp.longitude]));
const replayRoute = computed(() => replayWaypoints.value.map((wp) => [wp.latitude, wp.longitude]));
const replayPlaybackRoute = computed(() =>
  replayWaypoints.value.slice(0, replayProgress.value + 1).map((wp) => [wp.latitude, wp.longitude]),
);
const replayCursor = computed(() => replayWaypoints.value[replayProgress.value] || null);
const replayPlaybackLabel = computed(() => (isReplayPlaying.value ? "PLAYING" : "PAUSED"));
const routeTypeLabel = computed(() => routeType.value.toUpperCase());
const canPause = computed(() => currentExecutionStatus.value === "RUNNING");
const canResume = computed(() => currentExecutionStatus.value === "PAUSED");
const canCancel = computed(() => ["RUNNING", "PAUSED", "QUEUED"].includes(currentExecutionStatus.value));

const displayMarkers = computed(() => {
  const markers = [];

  if (waypoints.value.length > 0) {
    markers.push({
      latitude: waypoints.value[0].latitude,
      longitude: waypoints.value[0].longitude,
      label: "Route Start",
    });
  }

  if (targetPoint.value) {
    markers.push({
      latitude: targetPoint.value.latitude,
      longitude: targetPoint.value.longitude,
      label: "Target",
    });
  }

  if (replayWaypoints.value.length > 0) {
    markers.push({
      latitude: replayWaypoints.value[0].latitude,
      longitude: replayWaypoints.value[0].longitude,
      label: "Replay Start",
    });
    markers.push({
      latitude: replayWaypoints.value[replayWaypoints.value.length - 1].latitude,
      longitude: replayWaypoints.value[replayWaypoints.value.length - 1].longitude,
      label: "Replay End",
    });
  }

  return markers;
});

const shortId = (value) => value.slice(0, 8).toUpperCase();

const formatTime = (isoString) => {
  if (!isoString) {
    return "UNKNOWN";
  }
  return new Date(isoString).toLocaleTimeString();
};

const stopReplayPlayback = () => {
  if (replayTimer) {
    clearInterval(replayTimer);
    replayTimer = null;
  }
  isReplayPlaying.value = false;
};

const startReplayPlayback = () => {
  if (replayWaypoints.value.length < 2) {
    return;
  }

  if (replayProgress.value >= replayWaypoints.value.length - 1) {
    replayProgress.value = 0;
  }

  stopReplayPlayback();
  isReplayPlaying.value = true;
  replayTimer = setInterval(() => {
    if (replayProgress.value >= replayWaypoints.value.length - 1) {
      stopReplayPlayback();
      return;
    }
    replayProgress.value += 1;
  }, 450);
};

const toggleReplayPlayback = () => {
  if (isReplayPlaying.value) {
    stopReplayPlayback();
  } else {
    startReplayPlayback();
  }
};

const stepReplayForward = () => {
  stopReplayPlayback();
  if (replayProgress.value < replayWaypoints.value.length - 1) {
    replayProgress.value += 1;
  }
};

const stepReplayBackward = () => {
  stopReplayPlayback();
  if (replayProgress.value > 0) {
    replayProgress.value -= 1;
  }
};

const onMapReady = (map) => {
  L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);
  currentZoom.value = map.getZoom();
  map.on("zoom", () => {
    currentZoom.value = map.getZoom();
  });
};

watch(() => [droneState.value.lat, droneState.value.lon], ([newLat, newLon]) => {
  if (dronePath.value.length === 0) {
    dronePath.value.push([newLat, newLon]);
  } else {
    const last = dronePath.value[dronePath.value.length - 1];
    if (Math.abs(newLat - last[0]) > 0.00001 || Math.abs(newLon - last[1]) > 0.00001) {
      dronePath.value.push([newLat, newLon]);
    }
  }

  if (dronePath.value.length > 500) {
    dronePath.value.shift();
  }
});

watch(replayWaypoints, () => {
  replayProgress.value = 0;
  stopReplayPlayback();
});

const applyMissionSnapshot = (mission) => {
  currentMissionId.value = mission.id || "";
  currentMissionStatus.value = mission.status || "UNKNOWN";
  if (Array.isArray(mission.waypoints) && mission.waypoints.length > 0) {
    waypoints.value = mission.waypoints;
    replayWaypoints.value = mission.waypoints;
    selectedReplayMissionId.value = mission.id || "";
    targetPoint.value = mission.waypoints[mission.waypoints.length - 1];
  }

  if (Array.isArray(mission.executions) && mission.executions.length > 0) {
    const latestExecution = mission.executions[mission.executions.length - 1];
    currentExecutionId.value = latestExecution.execution_id;
    currentExecutionStatus.value = latestExecution.status;
  } else {
    currentExecutionId.value = "";
    currentExecutionStatus.value = "NONE";
  }
};

const refreshHistory = async () => {
  isRefreshingHistory.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/missions/history`);
    if (!response.ok) {
      throw new Error("Failed to load mission history");
    }
    missionHistory.value = await response.json();
  } catch (error) {
    controlError.value = error.message;
  } finally {
    isRefreshingHistory.value = false;
  }
};

const loadMissionDetail = async (missionId) => {
  controlError.value = "";
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/missions/${missionId}`);
    if (!response.ok) {
      throw new Error("Failed to load mission detail");
    }
    const mission = await response.json();
    applyMissionSnapshot(mission);
    statusMessage.value = `Replay loaded for ${mission.name}`;
  } catch (error) {
    controlError.value = error.message;
  }
};

const clearReplay = () => {
  replayWaypoints.value = [];
  selectedReplayMissionId.value = "";
  statusMessage.value = "Replay cleared";
};

const onMapClick = async (event) => {
  const { lat, lng } = event.latlng;
  targetPoint.value = { latitude: lat, longitude: lng };
  planningError.value = "";
  isPlanning.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/navigation/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start_latitude: droneState.value.lat,
        start_longitude: droneState.value.lon,
        target_latitude: lat,
        target_longitude: lng,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.detail || "Route planning failed");
    }

    const result = await response.json();
    waypoints.value = result.waypoints;
    routeType.value = result.route_type;
    statusMessage.value = `Route planned via ${result.route_type.toUpperCase()}`;
  } catch (error) {
    waypoints.value = [];
    routeType.value = "direct";
    planningError.value = error.message;
  } finally {
    isPlanning.value = false;
  }
};

const clearMission = () => {
  stopReplayPlayback();
  waypoints.value = [];
  replayWaypoints.value = [];
  selectedReplayMissionId.value = "";
  targetPoint.value = null;
  routeType.value = "direct";
  planningError.value = "";
  controlError.value = "";
  statusMessage.value = "";
  dronePath.value = [];
  currentMissionId.value = "";
  currentExecutionId.value = "";
  currentMissionStatus.value = "IDLE";
  currentExecutionStatus.value = "NONE";
};

const uploadMission = async () => {
  if (waypoints.value.length === 0) {
    return;
  }

  isUploading.value = true;
  controlError.value = "";

  const missionPayload = {
    name: `Mission ${new Date().toLocaleTimeString()}`,
    waypoints: waypoints.value.map((wp) => ({
      latitude: wp.latitude,
      longitude: wp.longitude,
      relative_altitude: 50.0,
      speed_m_s: 10.0,
    })),
  };

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/missions/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(missionPayload),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.detail || "Upload failed");
    }

    const result = await response.json();
    currentMissionId.value = result.mission_id;
    currentExecutionId.value = result.execution_id;
    currentMissionStatus.value = result.mission_status;
    currentExecutionStatus.value = result.execution_status;
    replayWaypoints.value = waypoints.value;
    selectedReplayMissionId.value = result.mission_id;
    statusMessage.value = result.message;
    await refreshHistory();
  } catch (error) {
    controlError.value = error.message;
  } finally {
    isUploading.value = false;
  }
};

const sendExecutionAction = async (action) => {
  if (!currentExecutionId.value) {
    return;
  }

  isControlling.value = true;
  pendingAction.value = action;
  controlError.value = "";

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/v1/missions/executions/${currentExecutionId.value}/${action}`,
      { method: "POST" },
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.detail || `Failed to ${action} execution`);
    }

    const result = await response.json();
    currentMissionStatus.value = result.mission_status;
    currentExecutionStatus.value = result.execution_status;
    statusMessage.value = `Execution ${action} succeeded`;
    await refreshHistory();
  } catch (error) {
    controlError.value = error.message;
  } finally {
    isControlling.value = false;
    pendingAction.value = "";
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
  margin: 0 0 14px 0;
  font-size: 1.1rem;
  color: #7dd3fc;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  padding-bottom: 10px;
}

.status-box,
.mission-card,
.history-card {
  background: rgba(15, 23, 42, 0.74);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 14px;
}

.status-box,
.section-head,
.replay-banner,
.replay-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-box .value {
  font-weight: bold;
  font-family: "Courier New", monospace;
}

.status-box .value.connected {
  color: #4ade80;
}

.status-box .value.disconnected {
  color: #f87171;
}

.telemetry-grid,
.mission-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.telemetry-grid div,
.mission-grid div,
.hud-item {
  background: rgba(2, 6, 23, 0.45);
  padding: 8px;
  border-radius: 8px;
}

.hud-panel {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.hud-item {
  flex: 1;
  text-align: center;
}

.hud-item .value.warning,
.hint-error {
  color: #fca5a5;
}

.label {
  display: block;
  font-size: 0.68rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.value {
  display: block;
  font-size: 0.92rem;
  font-weight: 600;
}

.hint {
  font-size: 0.8rem;
  color: #94a3b8;
  margin: 0 0 10px 0;
  text-align: center;
}

.status-message {
  color: #7dd3fc;
}

.btn-group,
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.replay-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.replay-meta {
  color: #fcd34d;
  font-size: 0.74rem;
}

.timeline {
  width: 100%;
  accent-color: #f59e0b;
}

.replay-actions {
  grid-template-columns: 1.2fr 0.8fr 0.8fr;
}

button {
  padding: 11px;
  border: none;
  border-radius: 8px;
  background: #0ea5e9;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
}

button:hover:not(:disabled) {
  background: #0284c7;
  transform: translateY(-1px);
}

button:disabled {
  background: #334155;
  color: #64748b;
  cursor: not-allowed;
  transform: none;
}

.btn-danger {
  background: #ef4444;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-secondary {
  background: #1d4ed8;
}

.btn-secondary:hover:not(:disabled) {
  background: #1e40af;
}

.btn-ghost {
  background: transparent;
  color: #7dd3fc;
  border: 1px solid rgba(125, 211, 252, 0.3);
  padding: 6px 10px;
}

.btn-ghost:hover:not(:disabled) {
  background: rgba(14, 165, 233, 0.12);
}

.history-empty {
  color: #94a3b8;
  font-size: 0.8rem;
  text-align: center;
  padding: 8px 0 4px;
}

.history-item {
  text-align: left;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.history-item.selected {
  border-color: rgba(251, 191, 36, 0.65);
  box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.25);
}

.history-name,
.history-meta {
  display: block;
}

.history-name {
  font-size: 0.8rem;
  margin-bottom: 3px;
}

.history-meta,
.history-count {
  color: #94a3b8;
  font-size: 0.72rem;
}

.replay-banner {
  gap: 8px;
  margin-bottom: 10px;
  color: #fcd34d;
  font-size: 0.75rem;
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
