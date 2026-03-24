<template>
  <div class="panel-card">
    <div class="section-head">
      <span>Recent Missions</span>
      <span class="history-count">{{ missionCount }}</span>
    </div>

    <div class="filter-row">
      <button
        v-for="option in missionFilterOptions"
        :key="`mission-${option}`"
        class="filter-chip"
        :class="{ active: missionHistoryFilter === option }"
        @click="$emit('update:mission-history-filter', option)"
      >
        {{ option }}
      </button>
    </div>

    <div v-if="replayBannerLabel" class="replay-banner">
      <span>{{ replayBannerLabel }}</span>
      <button class="btn-ghost" @click="$emit('clear-replay')">CLEAR REPLAY</button>
    </div>

    <div v-if="selectedReplayMission.executions.length > 0" class="execution-picker">
      <span class="label">Replay Execution</span>
      <div class="filter-row compact">
        <button
          v-for="option in executionFilterOptions"
          :key="`execution-${option}`"
          class="filter-chip"
          :class="{ active: replayExecutionFilter === option }"
          @click="$emit('update:replay-execution-filter', option)"
        >
          {{ option }}
        </button>
      </div>

      <div class="execution-list">
        <button
          v-for="execution in replayExecutionCards"
          :key="execution.id"
          class="execution-item"
          :class="{ selected: selectedReplayExecutionId === execution.id }"
          @click="$emit('select-replay-execution', execution.id)"
        >
          <span class="history-name">{{ execution.title }}</span>
          <span class="history-meta">{{ execution.summary }}</span>
          <span class="history-meta">{{ execution.detail }}</span>
        </button>
      </div>
    </div>

    <div v-if="replayTraceLength > 0" class="replay-controls">
      <div class="replay-meta">
        <span>{{ replayPlaybackLabel }}</span>
        <span>{{ replayProgress }} / {{ replayTraceLength - 1 }}</span>
      </div>
      <div class="replay-meta replay-stats">
        <span>Points: {{ replayTraceLength }}</span>
        <span>Span: {{ replayDurationLabel }}</span>
      </div>
      <input
        :value="replayProgress"
        class="timeline"
        type="range"
        min="0"
        :max="Math.max(replayTraceLength - 1, 0)"
        step="1"
        @input="$emit('update:replay-progress', Number($event.target.value))"
      >
      <div class="btn-row replay-actions">
        <button class="btn-secondary" @click="$emit('toggle-replay')">
          {{ isReplayPlaying ? "PAUSE PLAYBACK" : "PLAY REPLAY" }}
        </button>
        <button class="btn-ghost" @click="$emit('step-replay-backward')" :disabled="replayProgress <= 0">
          BACK
        </button>
        <button
          class="btn-ghost"
          @click="$emit('step-replay-forward')"
          :disabled="replayProgress >= replayTraceLength - 1"
        >
          NEXT
        </button>
      </div>
    </div>

    <div v-if="historyCards.length === 0" class="history-empty">No mission history yet.</div>
    <div v-else class="history-list">
      <button
        v-for="mission in historyCards"
        :key="mission.id"
        class="history-item"
        :class="{ selected: selectedReplayMissionId === mission.id }"
        @click="$emit('load-mission-detail', mission.id)"
      >
        <span class="history-name">{{ mission.name }}</span>
        <span class="history-meta">{{ mission.statusLine }}</span>
        <span class="history-meta">{{ mission.timeLine }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  missionCount: {
    type: Number,
    required: true,
  },
  missionFilterOptions: {
    type: Array,
    required: true,
  },
  missionHistoryFilter: {
    type: String,
    required: true,
  },
  replayBannerLabel: {
    type: String,
    default: "",
  },
  selectedReplayMission: {
    type: Object,
    required: true,
  },
  executionFilterOptions: {
    type: Array,
    required: true,
  },
  replayExecutionFilter: {
    type: String,
    required: true,
  },
  replayExecutionCards: {
    type: Array,
    required: true,
  },
  selectedReplayExecutionId: {
    type: String,
    default: "",
  },
  replayTraceLength: {
    type: Number,
    required: true,
  },
  replayPlaybackLabel: {
    type: String,
    required: true,
  },
  replayProgress: {
    type: Number,
    required: true,
  },
  replayDurationLabel: {
    type: String,
    required: true,
  },
  isReplayPlaying: {
    type: Boolean,
    required: true,
  },
  historyCards: {
    type: Array,
    required: true,
  },
  selectedReplayMissionId: {
    type: String,
    default: "",
  },
});

defineEmits([
  "update:mission-history-filter",
  "clear-replay",
  "update:replay-execution-filter",
  "select-replay-execution",
  "update:replay-progress",
  "toggle-replay",
  "step-replay-backward",
  "step-replay-forward",
  "load-mission-detail",
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

.section-head,
.replay-banner,
.replay-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  display: block;
  font-size: 0.68rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}

.filter-row.compact {
  margin: 8px 0;
}

.execution-picker {
  margin-bottom: 10px;
}

.history-list,
.execution-list {
  display: flex;
  flex-direction: column;
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

.replay-stats {
  color: #fde68a;
}

.timeline {
  width: 100%;
  accent-color: #f59e0b;
}

.btn-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
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

.filter-chip {
  background: rgba(15, 23, 42, 0.8);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 6px 9px;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
}

.filter-chip.active {
  background: rgba(14, 165, 233, 0.18);
  color: #7dd3fc;
  border-color: rgba(56, 189, 248, 0.42);
}

.history-empty {
  color: #94a3b8;
  font-size: 0.8rem;
  text-align: center;
  padding: 8px 0 4px;
}

.history-item,
.execution-item {
  text-align: left;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.history-item.selected,
.execution-item.selected {
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
</style>
