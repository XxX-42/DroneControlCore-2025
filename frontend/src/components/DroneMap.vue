<template>
  <div style="height: 100vh; width: 100%">
    <div class="control-panel">
      <h3>L3 Autonomous Nav</h3>
      <div class="status-box">
        <span class="label">State:</span>
        <span class="value" :class="flightState">{{ flightState }}</span>
      </div>
      
      <div class="telemetry-grid">
        <div>
          <span class="label">Dist to Target</span>
          <span class="value">{{ distanceToTarget.toFixed(1) }} m</span>
        </div>
        <div>
          <span class="label">Spiral Radius</span>
          <span class="value">{{ spiralRadius.toFixed(1) }} m</span>
        </div>
        <div>
          <span class="label">Altitude</span>
          <span class="value">100.0 m</span>
        </div>
        <div>
          <span class="label">Speed</span>
          <span class="value">{{ (speed * 100000).toFixed(1) }} kts</span>
        </div>
      </div>

      <div class="action-area">
        <p v-if="waypoints.length === 0" class="hint">Click map to set Target</p>
        <p v-else class="hint">Target: WP {{ currentTargetIndex + 1 }} / {{ waypoints.length }}</p>
        
        <div class="btn-group">
          <button @click="uploadMission" :disabled="waypoints.length === 0 || flightState !== 'IDLE'">
            {{ flightState === 'IDLE' ? '▶ EXECUTE MISSION' : 'MISSION RUNNING...' }}
          </button>
          <button @click="clearMission" class="btn-danger">
            ✖ ABORT
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
    >
      <l-tile-layer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        layer-type="base"
        name="OpenStreetMap"
      ></l-tile-layer>

      <!-- User Target (Blue Marker) -->
      <l-marker 
        v-for="(wp, index) in waypoints" 
        :key="'wp-'+index" 
        :lat-lng="[wp.latitude, wp.longitude]"
      >
        <l-popup>Target {{ index + 1 }}</l-popup>
      </l-marker>

      <!-- PHASE 1: Road Path (Green Polyline) -->
      <l-polyline
        v-if="roadWaypoints.length > 0"
        :lat-lngs="roadWaypoints"
        color="#00ff00"
        :weight="4"
        :opacity="0.8"
      >
        <l-popup>Phase 1: Road Network Approach</l-popup>
      </l-polyline>

      <!-- PHASE 2: Off-Road Dash (Yellow Dashed) -->
      <l-polyline
        v-if="roadWaypoints.length > 0 && waypoints.length > 0"
        :lat-lngs="[roadWaypoints[roadWaypoints.length-1], [waypoints[currentTargetIndex].latitude, waypoints[currentTargetIndex].longitude]]"
        color="#ffcc00"
        :weight="3"
        dash-array="10, 10"
      >
        <l-popup>Phase 2: Last Mile Off-Road</l-popup>
      </l-polyline>

      <!-- Drone History (Red Trail) -->
      <l-polyline
        :lat-lngs="dronePath"
        color="red"
        :weight="2"
      ></l-polyline>

      <!-- Drone Icon (Red Circle) -->
      <l-circle-marker
        :lat-lng="[dronePos.lat, dronePos.lng]"
        :radius="8"
        color="red"
        fill-color="#f03"
        :fill-opacity="1"
      >
         <l-popup>
           <strong>Drone Live</strong><br>
           State: {{ flightState }}
         </l-popup>
      </l-circle-marker>

    </l-map>
  </div>
</template>

<script setup>
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LMap, LTileLayer, LMarker, LPolyline, LCircleMarker, LPopup } from "@vue-leaflet/vue-leaflet";
import { ref } from "vue";

// --- State ---
const zoom = ref(14);
const waypoints = ref([]);
const dronePos = ref({ lat: 30.598, lng: 103.991 }); // Start pos
const dronePath = ref([]);

// Navigation Data
const roadWaypoints = ref([]); // [lat, lng] array from OSRM
const currentRoadIndex = ref(0);
const currentTargetIndex = ref(0); // Track which waypoint we are targeting

// Flight Logic State Machine
const flightState = ref('IDLE'); // IDLE, PLANNING, FOLLOW_ROAD, OFF_ROAD_APPROACH, SPIRAL_ENTRY, SPIRAL_DESCENT, COMPLETED
const distanceToTarget = ref(0);
const spiralRadius = ref(0);
const orbitAngle = ref(0);
const speed = 0.00010; // Simulation speed factor

// --- Interactions ---
const onMapClick = (e) => {
  if (flightState.value !== 'IDLE') return;
  const { lat, lng } = e.latlng;
  waypoints.value.push({ latitude: lat, longitude: lng });
};

const clearMission = () => {
  waypoints.value = [];
  dronePath.value = [];
  roadWaypoints.value = [];
  flightState.value = 'IDLE';
  currentRoadIndex.value = 0;
  currentTargetIndex.value = 0;
  spiralRadius.value = 0;
};

const uploadMission = async () => {
  if (waypoints.value.length === 0) return;
  
  // Trigger Planning for First Leg
  flightState.value = 'PLANNING';
  currentTargetIndex.value = 0;
  
  // 1. Fetch Route from OSRM
  const start = dronePos.value;
  const end = waypoints.value[currentTargetIndex.value];
  
  await fetchRoute(start, end);
};

// --- OSRM Integration ---
const fetchRoute = async (start, end) => {
  // OSRM expects {lng},{lat}
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates;
      // Flip [lng, lat] -> [lat, lng] for Leaflet
      roadWaypoints.value = coords.map(c => [c[1], c[0]]);
      
      console.log(`Path Found: ${roadWaypoints.value.length} nodes.`);
      
      // Start Execution
      currentRoadIndex.value = 0;
      flightState.value = 'FOLLOW_ROAD';
      requestAnimationFrame(animate);
      
    } else {
      console.warn("No road path found! Flying direct.");
      roadWaypoints.value = [];
      flightState.value = 'OFF_ROAD_APPROACH';
      requestAnimationFrame(animate);
    }
  } catch (e) {
    console.error("OSRM Error:", e);
    alert("Routing Failed. Check Console.");
    flightState.value = 'IDLE';
  }
};

// --- Physics Engine ---
const getDistance = (p1, p2) => {
  const R = 6371e3; 
  const φ1 = p1.lat * Math.PI/180;
  const φ2 = p2.lat * Math.PI/180;
  const Δφ = (p2.lat-p1.lat) * Math.PI/180;
  const Δλ = (p2.lng-p1.lng) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const animate = () => {
  // Stop animation loop if we are waiting for planning or idle/completed
  if (flightState.value === 'COMPLETED' || flightState.value === 'IDLE' || flightState.value === 'PLANNING') return;

  const target = waypoints.value[currentTargetIndex.value];
  const targetLat = target.latitude;
  const targetLng = target.longitude;
  
  // Global Dist to Final Target
  distanceToTarget.value = getDistance(dronePos.value, { lat: targetLat, lng: targetLng });

  // --- STATE MACHINE ---
  
  // STATE: FOLLOW_ROAD
  if (flightState.value === 'FOLLOW_ROAD') {
    if (currentRoadIndex.value >= roadWaypoints.value.length) {
      // End of road
      flightState.value = 'OFF_ROAD_APPROACH';
    } else {
      const roadNode = roadWaypoints.value[currentRoadIndex.value];
      const nodeLat = roadNode[0];
      const nodeLng = roadNode[1];
      
      const distToNode = getDistance(dronePos.value, { lat: nodeLat, lng: nodeLng });
      
      if (distToNode < 10) { // 10m tolerance
        currentRoadIndex.value++;
      } else {
        // Fly to Node
        const angle = Math.atan2(nodeLng - dronePos.value.lng, nodeLat - dronePos.value.lat);
        dronePos.value.lat += Math.cos(angle) * speed;
        dronePos.value.lng += Math.sin(angle) * speed;
      }
    }
  }
  
  // STATE: OFF_ROAD_APPROACH
  else if (flightState.value === 'OFF_ROAD_APPROACH') {
    // Fly straight to Final Target
    if (distanceToTarget.value <= 100) {
      flightState.value = 'SPIRAL_ENTRY';
    } else {
      const angle = Math.atan2(targetLng - dronePos.value.lng, targetLat - dronePos.value.lat);
      dronePos.value.lat += Math.cos(angle) * speed;
      dronePos.value.lng += Math.sin(angle) * speed;
    }
  }
  
  // STATE: SPIRAL_ENTRY
  else if (flightState.value === 'SPIRAL_ENTRY') {
    // Calculate smooth entry
    orbitAngle.value = Math.atan2(dronePos.value.lng - targetLng, dronePos.value.lat - targetLat);
    spiralRadius.value = distanceToTarget.value;
    flightState.value = 'SPIRAL_DESCENT';
  }
  
  // STATE: SPIRAL_DESCENT
  else if (flightState.value === 'SPIRAL_DESCENT') {
    orbitAngle.value += 0.05; 
    
    if (spiralRadius.value > 20) {
      spiralRadius.value -= 0.1;
    } else {
      // Spiral Complete
      console.log(`Waypoint ${currentTargetIndex.value + 1} Reached.`);
      
      // Check for Next Waypoint
      if (currentTargetIndex.value < waypoints.value.length - 1) {
        // Prepare Next Leg
        currentTargetIndex.value++;
        flightState.value = 'PLANNING';
        
        // Trigger Planning for Next Leg
        const start = dronePos.value;
        const end = waypoints.value[currentTargetIndex.value];
        fetchRoute(start, end);
        return; // Exit animate loop, fetchRoute will restart it
      } else {
        // All Done
        console.log("Mission Complete.");
        flightState.value = 'COMPLETED';
        alert("All Targets Reached! Mission Complete.");
        return;
      }
    }

    // Orbit Logic
    const latOffset = (spiralRadius.value * Math.cos(orbitAngle.value)) / 111320;
    const lngOffset = (spiralRadius.value * Math.sin(orbitAngle.value)) / 96000;

    dronePos.value.lat = targetLat + latOffset;
    dronePos.value.lng = targetLng + lngOffset;
  }

  // Record History
  if (dronePath.value.length === 0 || 
      getDistance({lat: dronePath.value[dronePath.value.length-1][0], lng: dronePath.value[dronePath.value.length-1][1]}, dronePos.value) > 2) {
      dronePath.value.push([dronePos.value.lat, dronePos.value.lng]);
  }

  requestAnimationFrame(animate);
};
</script>

<style scoped>
.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.95); /* Dark Slate */
  color: #e2e8f0;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  font-family: 'Inter', sans-serif;
  width: 280px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
}

h3 {
  margin: 0 0 15px 0;
  font-size: 1.2rem;
  color: #38bdf8; /* Sky Blue */
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 10px;
}

.status-box {
  background: rgba(255,255,255,0.05);
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-box .value {
  font-weight: bold;
  font-family: 'Courier New', monospace;
}

.status-box .value.FOLLOW_ROAD { color: #4ade80; }
.status-box .value.OFF_ROAD_APPROACH { color: #facc15; }
.status-box .value.SPIRAL_DESCENT { color: #f472b6; }

.telemetry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}

.telemetry-grid div {
  background: rgba(0,0,0,0.2);
  padding: 8px;
  border-radius: 4px;
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