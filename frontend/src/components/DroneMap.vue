<template>
  <div style="height: 100vh; width: 100%; position: relative;">
    <l-map 
      ref="map" 
      v-model:zoom="zoom" 
      :center="[30.598, 103.991]"
      :use-global-leaflet="false"
      @click="onMapClick"
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
      <!-- Using CircleMarker for targets to easily distinguish color without custom icons -->
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

    <!-- Floating Mission Controls -->
    <div class="mission-controls">
      <h3>Mission Planner</h3>
      <div class="stats">
        Waypoints: {{ waypoints.length }}
      </div>
      <button @click="uploadMission" :disabled="waypoints.length === 0">
        Upload Mission
      </button>
      <button @click="clearMission" v-if="waypoints.length > 0" style="background-color: #dc3545;">
        Clear
      </button>
      
      <!-- Vision Recon -->
      <input type="file" ref="fileInput" @change="analyzeImage" style="display: none" accept="image/*">
      <button @click="triggerUpload" style="background-color: #6f42c1;">
        👁️ Vision Recon
      </button>

      <!-- Telemetry Stats -->
      <div v-if="dronePos" class="telemetry-stats">
        <h4>Telemetry</h4>
        <p>Lat: {{ dronePos.lat.toFixed(5) }}</p>
        <p>Lon: {{ dronePos.lon.toFixed(5) }}</p>
        <p>Hdg: {{ dronePos.heading.toFixed(1) }}°</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LMap, LTileLayer, LMarker, LPolyline, LCircleMarker, LPopup } from "@vue-leaflet/vue-leaflet";
import { ref, computed, onMounted, onUnmounted } from "vue";

const zoom = ref(13);
const waypoints = ref([]);
const dronePos = ref(null);
const detectedObjects = ref([]);
const fileInput = ref(null);
let socket = null;

// Compute path for polyline
const pathCoordinates = computed(() => {
  return waypoints.value.map(wp => [wp.latitude, wp.longitude]);
});

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
    // Using port 8080 as per backend logs
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
    alert("Network Error: Check console. (Likely CORS or Backend Offline)");
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

.mission-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000; /* Ensure it's above the map */
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
}

.mission-controls h3, .mission-controls h4 {
  margin: 0 0 5px 0;
  font-size: 1.1rem;
  color: #333;
}

.stats, .telemetry-stats p {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 5px;
  margin-top: 0;
}

.telemetry-stats {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

button {
  padding: 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}
</style>