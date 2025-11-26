<template>
  <div style="height: 100vh; width: 100%; position: relative;">
    <l-map 
      ref="map" 
      v-model:zoom="zoom" 
      :center="[30.598, 103.991]"
      :use-global-leaflet="false"
      @click="onMapClick"
      @zoomend="updateZoom"
    >
      <l-tile-layer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        layer-type="base"
        name="OpenStreetMap"
      ></l-tile-layer>

      <!-- Waypoint Markers (Blue) -->
      <l-marker
        v-for="(wp, index) in waypoints"
        :key="'wp-'+index"
        :lat-lng="[wp.latitude, wp.longitude]"
      ></l-marker>

      <!-- Flight Path -->
      <l-polyline
        :lat-lngs="pathCoordinates"
        color="blue"
      ></l-polyline>

      <!-- AI Targets (Orange) -->
      <l-circle-marker
        v-for="(obj, index) in detectedObjects"
        :key="'target-'+index"
        :lat-lng="[obj.geo_location.lat, obj.geo_location.lon]"
        :radius="8"
        color="orange"
        fill-color="#ff9800"
        :fill-opacity="0.9"
      >
        <l-popup>
          <div style="text-align: center;">
            <strong>Target: {{ obj.label }}</strong><br/>
            <small>Conf: {{ (obj.confidence * 100).toFixed(1) }}%</small><br/>
            <small>Dist: {{ obj.geo_location.distance_m.toFixed(1) }}m</small><br/>
            <button 
              @click="setTargetAsWaypoint(obj)" 
              style="margin-top:5px; background-color: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
            >
              Fly Here
            </button>
          </div>
        </l-popup>
      </l-circle-marker>

      <!-- Drone Position Marker (Red) -->
      <l-circle-marker
        v-if="dronePos"
        :lat-lng="[dronePos.lat, dronePos.lon]"
        :radius="10"
        color="red"
        fill-color="#f03"
        :fill-opacity="0.8"
      >
        <l-popup>Drone Live</l-popup>
      </l-circle-marker>
    </l-map>

    <!-- Dashboard Panel (Sidebar) -->
    <div class="dashboard-panel">
      <h3>Drone Control</h3>
      
      <!-- Map Info -->
      <div class="panel-section">
        <strong>Map Info</strong>
        <div>Zoom Level: {{ currentZoom }}</div>
      </div>

      <!-- Telemetry -->
      <div class="panel-section" v-if="dronePos">
        <strong>Telemetry</strong>
        <div>Lat: {{ dronePos.lat.toFixed(5) }}</div>
        <div>Lon: {{ dronePos.lon.toFixed(5) }}</div>
        <div>Hdg: {{ dronePos.heading.toFixed(1) }}°</div>
        <div>Alt: {{ dronePos.alt.toFixed(1) }}m</div>
      </div>

      <!-- Speed Control -->
      <div class="panel-section">
        <strong>Sim Speed: {{ speedFactor }}x</strong>
        <input 
          type="range" 
          min="1" 
          max="100" 
          v-model="speedFactor" 
          @input="changeSpeed"
          style="width: 100%;"
        >
      </div>

      <!-- Mission Control -->
      <div class="panel-section">
        <strong>Mission</strong>
        <div class="button-group">
          <button @click="uploadMission" :disabled="waypoints.length === 0">Upload</button>
          <button @click="clearMission" class="btn-danger" :disabled="waypoints.length === 0">Clear</button>
        </div>
        <div style="margin-top: 5px;">
           <input type="file" ref="fileInput" @change="analyzeImage" style="display: none" accept="image/*">
           <button @click="triggerUpload" class="btn-purple" style="width: 100%;">👁️ Vision Recon</button>
        </div>
      </div>

      <!-- Waypoint List -->
      <div class="panel-section waypoint-list" v-if="waypoints.length > 0">
        <strong>Waypoints ({{ waypoints.length }})</strong>
        <div v-for="(wp, i) in waypoints" :key="i" class="waypoint-item">
          WP {{ i+1 }}: [{{ wp.latitude.toFixed(4) }}, {{ wp.longitude.toFixed(4) }}]
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LMap, LTileLayer, LMarker, LPolyline, LCircleMarker, LPopup } from "@vue-leaflet/vue-leaflet";
import { ref, computed, onMounted, onUnmounted, watch } from "vue";

const zoom = ref(13);
const currentZoom = ref(13);
const waypoints = ref([]);
const dronePos = ref(null);
const detectedObjects = ref([]);
const fileInput = ref(null);
const speedFactor = ref(5);
let socket = null;

// Compute path for polyline
const pathCoordinates = computed(() => {
  return waypoints.value.map(wp => [wp.latitude, wp.longitude]);
});

const updateZoom = (e) => {
  currentZoom.value = e.target.getZoom();
};

// Handle map clicks to add waypoints
const onMapClick = (e) => {
  waypoints.value.push({
    latitude: e.latlng.lat,
    longitude: e.latlng.lng,
    relative_altitude: 20.0, // Default altitude 20m
    speed_m_s: 5.0 // Default speed 5m/s
  });
};

const clearMission = () => {
  waypoints.value = [];
};

const uploadMission = async () => {
  const missionData = {
    name: `Mission ${new Date().toLocaleTimeString()}`,
    waypoints: waypoints.value
  };

  try {
    const response = await fetch('http://127.0.0.1:8080/api/v1/missions/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(missionData)
    });

    if (response.ok) {
      const result = await response.json();
      alert(`Success: ${result.message}`);
    } else {
      const error = await response.json();
      alert(`Error: ${error.detail || 'Upload failed'}`);
    }
  } catch (err) {
    console.error(err);
    alert("Network Error: Check console.");
  }
};

const changeSpeed = async () => {
  try {
    await fetch('http://127.0.0.1:8080/api/v1/telemetry/speed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ speed: parseFloat(speedFactor.value) })
    });
  } catch (err) {
    console.error("Failed to update speed:", err);
  }
};

const triggerUpload = () => {
  fileInput.value.click();
};

const analyzeImage = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('http://127.0.0.1:8080/vision/analyze', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const result = await response.json();
      const detections = result.detections;
      
      detectedObjects.value = []; // Clear old detections
      
      if (detections.length === 0) {
        alert("Vision Recon: No objects detected.");
        return;
      }

      // Filter and store detections with geolocation
      let targetsFound = 0;
      detections.forEach(d => {
        if (d.geo_location) {
          detectedObjects.value.push(d);
          targetsFound++;
        }
      });

      // Summarize detections
      const summary = {};
      detections.forEach(d => {
        summary[d.label] = (summary[d.label] || 0) + 1;
      });
      
      const summaryStr = Object.entries(summary)
        .map(([label, count]) => `${count} ${label}`)
        .join(", ");

      alert(`Vision Recon Results:\nFound: ${summaryStr}\n\n${targetsFound} Targets plotted on map.`);
    } else {
      const error = await response.json();
      alert(`Vision Error: ${error.detail || 'Analysis failed'}`);
    }
  } catch (err) {
    console.error(err);
    alert("Vision Network Error: Check console.");
  }
};

const setTargetAsWaypoint = (target) => {
  if (!target.geo_location) return;
  
  // Clear existing waypoints and set target as the single waypoint
  waypoints.value = [{
    latitude: target.geo_location.lat,
    longitude: target.geo_location.lon,
    relative_altitude: 20.0,
    speed_m_s: 5.0
  }];
  
  // Automatically upload mission
  uploadMission();
};

onMounted(() => {
  // Connect to Telemetry WebSocket
  socket = new WebSocket('ws://127.0.0.1:8080/ws/telemetry');

  socket.onopen = () => {
    console.log("Telemetry Connected");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      dronePos.value = data;
    } catch (e) {
      console.error("Error parsing telemetry:", e);
    }
  };

  socket.onclose = () => {
    console.log("Telemetry Disconnected");
  };
  
  socket.onerror = (error) => {
    console.error("WebSocket Error:", error);
  };
});

onUnmounted(() => {
  if (socket) {
    socket.close();
  }
});
</script>

<style>
/* Ensure map tiles render correctly */
.leaflet-pane { z-index: 1 !important; }

.dashboard-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  bottom: 10px;
  width: 250px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.dashboard-panel h3 {
  margin: 0;
  text-align: center;
  color: #333;
  border-bottom: 2px solid #007bff;
  padding-bottom: 10px;
}

.panel-section {
  background: rgba(255, 255, 255, 0.5);
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #eee;
}

.panel-section strong {
  display: block;
  margin-bottom: 5px;
  color: #555;
  font-size: 0.9rem;
}

.button-group {
  display: flex;
  gap: 5px;
}

button {
  flex: 1;
  padding: 8px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
  font-size: 0.85rem;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-danger {
  background-color: #dc3545;
}
.btn-danger:hover:not(:disabled) {
  background-color: #bd2130;
}

.btn-purple {
  background-color: #6f42c1;
}
.btn-purple:hover:not(:disabled) {
  background-color: #59359a;
}

.waypoint-list {
  max-height: 150px;
  overflow-y: auto;
}

.waypoint-item {
  font-size: 0.8rem;
  padding: 2px 0;
  border-bottom: 1px solid #eee;
}
</style>