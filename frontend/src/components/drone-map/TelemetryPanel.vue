<template>
  <div>
    <div class="status-box panel-card">
      <span class="label">{{ labels.telemetry }}</span>
      <span class="value" :class="{ connected: isConnected, disconnected: !isConnected }">
        {{ isConnected ? labels.online : labels.offline }}
      </span>
    </div>

    <div class="panel-card telemetry-card">
      <div class="telemetry-grid">
        <div v-for="item in telemetryItems" :key="item.label" class="metric-card">
          <span class="label">{{ item.label }}</span>
          <span class="value">{{ item.value }}</span>
        </div>
      </div>

      <div class="hud-panel">
        <div class="hud-item">
          <span class="label">{{ labels.pitch }}</span>
          <span class="value" :class="{ warning: Math.abs(droneState.pitch) > 10 }">
            {{ droneState.pitch.toFixed(1) }} deg
          </span>
        </div>
        <div class="hud-item">
          <span class="label">{{ labels.roll }}</span>
          <span class="value">{{ droneState.roll.toFixed(1) }} deg</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  droneState: {
    type: Object,
    required: true,
  },
  isConnected: {
    type: Boolean,
    required: true,
  },
  currentZoom: {
    type: Number,
    required: true,
  },
  routeTypeLabel: {
    type: String,
    required: true,
  },
  locale: {
    type: String,
    default: "zh",
  },
});

const I18N = {
  zh: {
    telemetry: "\u9065\u6d4b",
    online: "\u5728\u7ebf",
    offline: "\u79bb\u7ebf",
    pitch: "\u4fef\u4ef0",
    roll: "\u6a2a\u6eda",
    lat: "\u7eac\u5ea6",
    lon: "\u7ecf\u5ea6",
    altitude: "\u9ad8\u5ea6",
    heading: "\u822a\u5411",
    zoom: "\u7f29\u653e",
    route: "\u8def\u7ebf",
  },
  en: {
    telemetry: "Telemetry",
    online: "ONLINE",
    offline: "OFFLINE",
    pitch: "Pitch",
    roll: "Roll",
    lat: "Lat",
    lon: "Lon",
    altitude: "Altitude",
    heading: "Heading",
    zoom: "Zoom",
    route: "Route",
  },
};

const labels = computed(() => I18N[props.locale] || I18N.zh);

const telemetryItems = computed(() => [
  { label: labels.value.lat, value: props.droneState.lat.toFixed(5) },
  { label: labels.value.lon, value: props.droneState.lon.toFixed(5) },
  { label: labels.value.altitude, value: `${props.droneState.alt.toFixed(1)} m` },
  { label: labels.value.heading, value: `${props.droneState.heading.toFixed(0)} deg` },
  { label: labels.value.zoom, value: props.currentZoom.toFixed(1) },
  { label: labels.value.route, value: props.routeTypeLabel },
]);
</script>

<style scoped>
.panel-card {
  background: rgba(15, 23, 42, 0.74);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 14px;
}

.status-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.telemetry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.metric-card,
.hud-item {
  background: rgba(2, 6, 23, 0.45);
  padding: 8px;
  border-radius: 8px;
}

.hud-panel {
  display: flex;
  gap: 10px;
}

.hud-item {
  flex: 1;
  text-align: center;
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

.status-box .value {
  font-family: "Courier New", monospace;
}

.connected {
  color: #4ade80;
}

.disconnected,
.warning {
  color: #fca5a5;
}
</style>
