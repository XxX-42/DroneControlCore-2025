<template>
  <div>
    <div class="panel-card">
      <div class="section-head">
        <span>{{ labels.currentMission }}</span>
        <button class="btn-ghost" @click="$emit('refresh-history')" :disabled="isRefreshingHistory">
          {{ isRefreshingHistory ? labels.syncing : labels.sync }}
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
        <button class="btn-secondary" @click="$emit('stop')" :disabled="!canPause || isControlling">
          {{ isControlling && pendingAction === "pause" ? labels.stopping : labels.stop }}
        </button>
        <button class="btn-secondary" @click="$emit('resume')" :disabled="!canResume || isControlling">
          {{ isControlling && pendingAction === "resume" ? labels.resuming : labels.resume }}
        </button>
        <button class="btn-danger" @click="$emit('cancel')" :disabled="!canCancel || isControlling">
          {{ isControlling && pendingAction === "cancel" ? labels.cancelling : labels.cancel }}
        </button>
      </div>
    </div>

    <div class="action-area panel-card">
      <p v-if="isPlanning" class="hint">{{ labels.planning }}</p>
      <p v-else-if="planningError" class="hint hint-error">{{ planningError }}</p>
      <p v-else-if="waypointCount === 0" class="hint">{{ labels.clickMap }}</p>
      <p v-else class="hint">{{ labels.plannedRoute(waypointCount) }}</p>

      <details v-if="taskTargets.length > 0" class="task-details">
        <summary class="task-details-summary">{{ labels.more }}</summary>
        <div class="task-details-list">
          <div v-for="target in taskTargets" :key="target.sequence" class="task-details-item">
            <span class="task-details-title">{{ target.label }}</span>
            <span class="task-details-coordinates">{{ target.coordinateLabel }}</span>
          </div>
        </div>
      </details>

      <div class="btn-group">
        <button
          @click="handlePrimaryAction"
          :disabled="isPrimaryActionDisabled"
        >
          {{ primaryActionLabel }}
        </button>
        <button class="btn-danger" @click="$emit('clear-mission')">
          {{ labels.clear }}
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
  taskTargets: {
    type: Array,
    default: () => [],
  },
  isUploading: {
    type: Boolean,
    required: true,
  },
  locale: {
    type: String,
    default: "zh",
  },
});

const emit = defineEmits(["refresh-history", "stop", "resume", "cancel", "upload-mission", "resume-mission", "clear-mission"]);

const I18N = {
  zh: {
    currentMission: "\u5f53\u524d\u4efb\u52a1",
    sync: "\u540c\u6b65",
    syncing: "\u540c\u6b65\u4e2d...",
    stop: "\u505c\u6b62",
    stopping: "\u505c\u6b62\u4e2d...",
    resume: "\u7ee7\u7eed",
    resuming: "\u7ee7\u7eed\u4e2d...",
    cancel: "\u53d6\u6d88",
    cancelling: "\u53d6\u6d88\u4e2d...",
    planning: "\u6b63\u5728\u89c4\u5212\u8def\u7ebf...",
    clickMap: "\u70b9\u51fb\u5730\u56fe\u81ea\u52a8\u89c4\u5212\u8def\u7ebf",
    plannedRoute: (count) => `\u5df2\u89c4\u5212\u8def\u7ebf\uff1a${count} \u4e2a\u8282\u70b9`,
    more: "More",
    uploading: "\u4e0a\u4f20\u4e2d...",
    uploadMission: "\u4e0a\u4f20\u4efb\u52a1",
    continueMission: "\u7ee7\u7eed\u4efb\u52a1",
    clear: "\u6e05\u7a7a",
    mission: "\u4efb\u52a1",
    execution: "\u6267\u884c",
    missionState: "\u4efb\u52a1\u72b6\u6001",
    execState: "\u6267\u884c\u72b6\u6001",
  },
  en: {
    currentMission: "Current Mission",
    sync: "SYNC",
    syncing: "SYNC...",
    stop: "STOP",
    stopping: "STOPPING...",
    resume: "RESUME",
    resuming: "RESUMING...",
    cancel: "CANCEL",
    cancelling: "CANCELLING...",
    planning: "Planning route...",
    clickMap: "Click map to auto-plan route",
    plannedRoute: (count) => `Planned route: ${count} nodes`,
    more: "More",
    uploading: "UPLOADING...",
    uploadMission: "UPLOAD MISSION",
    continueMission: "CONTINUE MISSION",
    clear: "CLEAR",
    mission: "Mission",
    execution: "Execution",
    missionState: "Mission State",
    execState: "Exec State",
  },
};

const labels = computed(() => I18N[props.locale] || I18N.zh);
const statusLabelMap = {
  IDLE: "\u7a7a\u95f2",
  NONE: "\u65e0",
  EXECUTING: "\u6267\u884c\u4e2d",
  RUNNING: "\u8fd0\u884c\u4e2d",
  PAUSED: "\u5df2\u6682\u505c",
  QUEUED: "\u5df2\u6392\u961f",
  COMPLETED: "\u5df2\u5b8c\u6210",
  FAILED: "\u5931\u8d25",
  CANCELLED: "\u5df2\u53d6\u6d88",
};
const formatMissionValue = (label, value) => {
  if (props.locale !== "zh") {
    return value;
  }

  if (label === labels.value.missionState || label === labels.value.execState) {
    return statusLabelMap[value] || value;
  }

  return value;
};

const missionItems = computed(() => [
  { label: labels.value.mission, value: formatMissionValue(labels.value.mission, props.currentMissionIdLabel) },
  { label: labels.value.execution, value: formatMissionValue(labels.value.execution, props.currentExecutionIdLabel) },
  { label: labels.value.missionState, value: formatMissionValue(labels.value.missionState, props.currentMissionStatus) },
  { label: labels.value.execState, value: formatMissionValue(labels.value.execState, props.currentExecutionStatus) },
]);

const isResumePrimary = computed(() => props.canResume);
const isPrimaryActionDisabled = computed(() => {
  if (isResumePrimary.value) {
    return props.isControlling || !props.canResume;
  }
  return props.waypointCount === 0 || props.isUploading || props.isPlanning || props.isControlling;
});
const primaryActionLabel = computed(() => {
  if (isResumePrimary.value) {
    return props.isControlling && props.pendingAction === "resume"
      ? labels.value.resuming
      : labels.value.continueMission;
  }
  return props.isUploading ? labels.value.uploading : labels.value.uploadMission;
});
const handlePrimaryAction = () => {
  if (isResumePrimary.value) {
    emit("resume-mission");
    return;
  }
  emit("upload-mission");
};
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

.task-details {
  margin-bottom: 10px;
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.35);
  border: 1px solid rgba(56, 189, 248, 0.16);
  overflow: hidden;
}

.task-details-summary {
  padding: 8px 10px;
  cursor: pointer;
  color: #7dd3fc;
  font-size: 0.78rem;
  font-weight: 700;
  list-style: none;
}

.task-details-summary::-webkit-details-marker {
  display: none;
}

.task-details-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 10px 10px;
}

.task-details-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.82);
}

.task-details-title {
  color: #f8fafc;
  font-size: 0.76rem;
  font-weight: 700;
}

.task-details-coordinates {
  color: #7dd3fc;
  font-size: 0.74rem;
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
