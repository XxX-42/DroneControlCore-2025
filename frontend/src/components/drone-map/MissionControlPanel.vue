<template>
  <div>
    <div class="panel-card">
      <div class="section-head">
        <span>Current Mission</span>
        <button class="btn-ghost" @click="$emit('refresh-history')" :disabled="isRefreshingHistory">
          {{ isRefreshingHistory ? "SYNC..." : "SYNC" }}
        </button>
      </div>

      <div class="mission-grid">
        <div v-for="item in missionItems" :key="item.label" class="metric-card">
          <span class="label">{{ item.label }}</span>
          <span class="value">{{ item.value }}</span>
        </div>
      </div>

      <p v-if="statusMessage" class="hint status-message">{{ statusMessage }}</p>
      <p v-if="controlError" class="hint hint-error">{{ controlError }}</p>

      <div class="btn-row">
        <button class="btn-secondary" @click="$emit('pause')" :disabled="!canPause || isControlling">
          {{ isControlling && pendingAction === "pause" ? "PAUSING..." : "PAUSE" }}
        </button>
        <button class="btn-secondary" @click="$emit('resume')" :disabled="!canResume || isControlling">
          {{ isControlling && pendingAction === "resume" ? "RESUMING..." : "RESUME" }}
        </button>
        <button class="btn-danger" @click="$emit('cancel')" :disabled="!canCancel || isControlling">
          {{ isControlling && pendingAction === "cancel" ? "CANCELLING..." : "CANCEL" }}
        </button>
      </div>
    </div>

    <div class="action-area panel-card">
      <p v-if="isPlanning" class="hint">Planning route...</p>
      <p v-else-if="planningError" class="hint hint-error">{{ planningError }}</p>
      <p v-else-if="waypointCount === 0" class="hint">Click map to auto-plan route</p>
      <p v-else class="hint">Planned route: {{ waypointCount }} nodes</p>

      <div class="btn-group">
        <button
          @click="$emit('upload-mission')"
          :disabled="waypointCount === 0 || isUploading || isPlanning || isControlling"
        >
          {{ isUploading ? "UPLOADING..." : "UPLOAD MISSION" }}
        </button>
        <button class="btn-danger" @click="$emit('clear-mission')">
          CLEAR
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  currentMissionIdLabel: {
    type: String,
    required: true,
  },
  currentExecutionIdLabel: {
    type: String,
    required: true,
  },
  currentMissionStatus: {
    type: String,
    required: true,
  },
  currentExecutionStatus: {
    type: String,
    required: true,
  },
  statusMessage: {
    type: String,
    default: "",
  },
  controlError: {
    type: String,
    default: "",
  },
  canPause: {
    type: Boolean,
    required: true,
  },
  canResume: {
    type: Boolean,
    required: true,
  },
  canCancel: {
    type: Boolean,
    required: true,
  },
  isControlling: {
    type: Boolean,
    required: true,
  },
  pendingAction: {
    type: String,
    default: "",
  },
  isRefreshingHistory: {
    type: Boolean,
    required: true,
  },
  isPlanning: {
    type: Boolean,
    required: true,
  },
  planningError: {
    type: String,
    default: "",
  },
  waypointCount: {
    type: Number,
    required: true,
  },
  isUploading: {
    type: Boolean,
    required: true,
  },
});

defineEmits(["refresh-history", "pause", "resume", "cancel", "upload-mission", "clear-mission"]);

const missionItems = computed(() => [
  { label: "Mission", value: props.currentMissionIdLabel },
  { label: "Execution", value: props.currentExecutionIdLabel },
  { label: "Mission State", value: props.currentMissionStatus },
  { label: "Exec State", value: props.currentExecutionStatus },
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

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mission-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 14px 0;
}

.metric-card {
  background: rgba(2, 6, 23, 0.45);
  padding: 8px;
  border-radius: 8px;
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

.hint-error {
  color: #fca5a5;
}

.btn-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
</style>
