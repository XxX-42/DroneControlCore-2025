<template>
  <div style="height: 100vh; width: 100%">
    <div class="control-panel">
      <h3>L3 Autonomous Nav</h3>
      <div class="status-box">
        <span class="label">Telemetry:</span>
        <span class="value" :class="{ connected: isConnected, disconnected: !isConnected }">
          {{ isConnected ? 'ONLINE' : 'OFFLINE' }}
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
          <span class="value">
            {{ droneState.roll.toFixed(1) }} deg
          </span>
        </div>
      </div>

      <div class="action-area">
        <p v-if="waypoints.length === 0" class="hint">Click map to set Target</p>
        <p v-else class="hint">Mission: {{ waypoints.length }} Waypoints</p>

        <div class="btn-group">
          <button @click="uploadMission" :disabled="waypoints.length === 0 || isUploading">
            {{ isUploading ? 'UPLOADING...' : 'UPLOAD MISSION' }}
          </button>
          <button @click="clearMission" class="btn-danger">
            CLEAR
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
        v-for="(wp, index) in waypoints"
        :key="'wp-' + index"
        :lat-lng="[wp.latitude, wp.longitude]"
      >
        <l-popup>Waypoint {{ index + 1 }}</l-popup>
      </l-marker>

      <l-polyline
        :lat-lngs="dronePath"
        color="red"
        :weight="2"
      />

      <l-circle-marker
        :lat-lng="[droneState.lat, droneState.lon]"
        :radius="8"
        color="red"
        fill-color="#f03"
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
import { LMap, LTileLayer, LMarker, LPolyline, LCircleMarker, LPopup } from "@vue-leaflet/vue-leaflet";
import { ref, watch } from "vue";
import { useTelemetry } from "../composables/useTelemetry";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080";
const { droneState, isConnected } = useTelemetry();

const zoom = ref(14);
const currentZoom = ref(14);
const waypoints = ref([]);
const dronePath = ref([]);
const isUploading = ref(false);

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

const onMapClick = (event) => {
  const { lat, lng } = event.latlng;
  waypoints.value.push({ latitude: lat, longitude: lng });
};

const clearMission = () => {
  waypoints.value = [];
  dronePath.value = [];
};

const uploadMission = async () => {
  if (waypoints.value.length === 0) {
    return;
  }

  isUploading.value = true;

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
    console.log(`[MISSION] Uploading to ${apiBaseUrl}...`);
    const response = await fetch(`${apiBaseUrl}/api/v1/missions/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(missionPayload),
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const result = await response.json();
    alert(`Success: ${result.message}`);
  } catch (error) {
    console.error(error);
    alert("Mission Upload Failed: " + error.message);
  } finally {
    isUploading.value = false;
  }
};
</script>

<style scoped>
.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.95);
  color: #e2e8f0;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  font-family: "Inter", sans-serif;
  width: 280px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

h3 {
  margin: 0 0 15px 0;
  font-size: 1.2rem;
  color: #38bdf8;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 10px;
}

.status-box {
  background: rgba(255, 255, 255, 0.05);
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 15px;
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
  color: #ef4444;
}

.telemetry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 15px;
}

.telemetry-grid div {
  background: rgba(0, 0, 0, 0.2);
  padding: 8px;
  border-radius: 4px;
}

.hud-panel {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 15px;
}

.hud-item {
  flex: 1;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  padding: 8px;
  border-radius: 4px;
}

.hud-item .value.warning {
  color: #ef4444;
}

.label {
  display: block;
  font-size: 0.7rem;
  color: #94a3b8;
  text-transform: uppercase;
}

.value {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
}

.hint {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-bottom: 10px;
  text-align: center;
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

button {
  padding: 12px;
  border: none;
  border-radius: 6px;
  background: #0ea5e9;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 0.5px;
}

button:hover:not(:disabled) {
  background: #0284c7;
  transform: translateY(-1px);
}

button:disabled {
  background: #334155;
  color: #64748b;
  cursor: not-allowed;
}

.btn-danger {
  background: #ef4444;
}

.btn-danger:hover {
  background: #dc2626;
}
</style>
