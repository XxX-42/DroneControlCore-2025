import { computed, ref, watch } from "vue";
import { fetchMissionDetail } from "../services/missionsApi";

export function useReplayHistory({
  apiBaseUrl,
  missionHistory,
  setStatusMessage,
  setControlError,
}) {
  const replayWaypoints = ref([]);
  const replayTrace = ref([]);
  const replayProgress = ref(0);
  const isReplayPlaying = ref(false);
  const selectedReplayMissionId = ref("");
  const selectedReplayExecutionId = ref("");
  const selectedReplayMission = ref({ id: "", executions: [] });
  const missionFilterOptions = ["ALL", "ACTIVE", "COMPLETED", "FAILED", "CANCELLED"];
  const executionFilterOptions = ["ALL", "ACTIVE", "COMPLETED", "FAILED", "CANCELLED"];
  const missionHistoryFilter = ref("ALL");
  const replayExecutionFilter = ref("ALL");

  let replayTimer = null;

  const shortId = (value) => value.slice(0, 8).toUpperCase();

  const formatTime = (isoString) => {
    if (!isoString) {
      return "UNKNOWN";
    }
    return new Date(isoString).toLocaleTimeString();
  };

  const formatDateTime = (isoString) => {
    if (!isoString) {
      return "UNKNOWN";
    }
    return new Date(isoString).toLocaleString();
  };

  const isActiveStatus = (status) => ["RUNNING", "PAUSED", "QUEUED", "EXECUTING"].includes(status || "");
  const matchesStatusFilter = (status, filter) => {
    if (filter === "ALL") {
      return true;
    }
    if (filter === "ACTIVE") {
      return isActiveStatus(status);
    }
    return status === filter;
  };

  const normalizeReplayTrace = (trace, fallbackWaypoints = []) => (
    Array.isArray(trace) && trace.length > 0 ? trace : fallbackWaypoints
  );

  const replayPlaybackLabel = computed(() => (isReplayPlaying.value ? "PLAYING" : "PAUSED"));
  const replayDurationLabel = computed(() => {
    if (replayTrace.value.length < 2) {
      return "0s";
    }
    const start = new Date(replayTrace.value[0].timestamp).getTime();
    const end = new Date(replayTrace.value[replayTrace.value.length - 1].timestamp).getTime();
    const seconds = Math.max(0, Math.round((end - start) / 1000));
    return `${seconds}s`;
  });
  const replayBannerLabel = computed(() => {
    if (!selectedReplayMissionId.value) {
      return "";
    }
    return selectedReplayExecutionId.value
      ? `Replay: ${shortId(selectedReplayMissionId.value)} / ${shortId(selectedReplayExecutionId.value)}`
      : `Replay: ${shortId(selectedReplayMissionId.value)}`;
  });

  const replayExecutions = computed(() => [...selectedReplayMission.value.executions]
    .filter((execution) => matchesStatusFilter(execution.status, replayExecutionFilter.value))
    .sort((left, right) => {
      const leftTime = new Date(left.started_at || left.ended_at || 0).getTime();
      const rightTime = new Date(right.started_at || right.ended_at || 0).getTime();
      return rightTime - leftTime;
    }));

  const historyPreview = computed(() => [...missionHistory.value]
    .filter((mission) => {
      const latestExecution = mission.latest_execution || null;
      const filterTarget = latestExecution?.status || mission.status;
      return matchesStatusFilter(filterTarget, missionHistoryFilter.value);
    })
    .sort((left, right) => {
      const leftTime = new Date((left.latest_execution && left.latest_execution.started_at) || left.timestamp || 0).getTime();
      const rightTime = new Date((right.latest_execution && right.latest_execution.started_at) || right.timestamp || 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 6));

  const executionSummaryLabel = (execution) => {
    const endLabel = execution.ended_at ? `End ${formatTime(execution.ended_at)}` : "Active";
    const tracePoints = Array.isArray(execution.trace) ? execution.trace.length : 0;
    return `${endLabel} · ${tracePoints} pts`;
  };

  const missionHistoryStatus = (mission) => {
    const latestExecution = mission.latest_execution || null;
    if (!latestExecution) {
      return mission.status || "UNKNOWN";
    }
    return `${mission.status} · ${latestExecution.status} · ${String(latestExecution.mode || "unknown").toUpperCase()}`;
  };

  const missionHistoryTime = (mission) => {
    const latestExecution = mission.latest_execution || null;
    return latestExecution?.started_at
      ? `Last run ${formatDateTime(latestExecution.started_at)}`
      : formatDateTime(mission.timestamp);
  };

  const replayExecutionCards = computed(() => replayExecutions.value.map((execution) => ({
    id: execution.execution_id,
    title: shortId(execution.execution_id),
    summary: executionSummaryLabel(execution),
    detail: `${execution.status} · ${String(execution.mode || "unknown").toUpperCase()} · ${formatTime(execution.started_at)}`,
  })));

  const historyCards = computed(() => historyPreview.value.map((mission) => ({
    id: mission.id,
    name: mission.name,
    statusLine: missionHistoryStatus(mission),
    timeLine: missionHistoryTime(mission),
  })));

  const stopReplayPlayback = () => {
    if (replayTimer) {
      clearInterval(replayTimer);
      replayTimer = null;
    }
    isReplayPlaying.value = false;
  };

  const startReplayPlayback = () => {
    if (replayTrace.value.length < 2) {
      return;
    }

    if (replayProgress.value >= replayTrace.value.length - 1) {
      replayProgress.value = 0;
    }

    stopReplayPlayback();
    isReplayPlaying.value = true;
    replayTimer = setInterval(() => {
      if (replayProgress.value >= replayTrace.value.length - 1) {
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
    if (replayProgress.value < replayTrace.value.length - 1) {
      replayProgress.value += 1;
    }
  };

  const stepReplayBackward = () => {
    stopReplayPlayback();
    if (replayProgress.value > 0) {
      replayProgress.value -= 1;
    }
  };

  const updateReplayProgress = (value) => {
    stopReplayPlayback();
    replayProgress.value = value;
  };

  const applyReplayExecution = (executionId) => {
    const execution = selectedReplayMission.value.executions.find(
      (item) => item.execution_id === executionId,
    );
    if (!execution) {
      return;
    }
    selectedReplayExecutionId.value = execution.execution_id;
    replayTrace.value = normalizeReplayTrace(execution.trace, replayWaypoints.value);
    setStatusMessage(`Replay execution ${shortId(execution.execution_id)} loaded`);
  };

  const applyMissionSnapshot = (mission) => {
    selectedReplayMission.value = {
      id: mission.id || "",
      executions: Array.isArray(mission.executions) ? mission.executions : [],
    };
    selectedReplayMissionId.value = mission.id || "";

    if (Array.isArray(mission.waypoints) && mission.waypoints.length > 0) {
      replayWaypoints.value = mission.waypoints;
    } else {
      replayWaypoints.value = [];
    }

    if (Array.isArray(mission.executions) && mission.executions.length > 0) {
      const latestExecution = [...mission.executions].sort((left, right) => {
        const leftTime = new Date(left.started_at || left.ended_at || 0).getTime();
        const rightTime = new Date(right.started_at || right.ended_at || 0).getTime();
        return rightTime - leftTime;
      })[0];
      selectedReplayExecutionId.value = latestExecution.execution_id;
      replayTrace.value = normalizeReplayTrace(latestExecution.trace, mission.waypoints);
    } else {
      selectedReplayExecutionId.value = "";
      replayTrace.value = mission.waypoints;
    }
  };

  const loadMissionDetail = async (missionId) => {
    setControlError("");
    try {
      const mission = await fetchMissionDetail(apiBaseUrl, missionId);
      applyMissionSnapshot(mission);
      setStatusMessage(`Replay loaded for ${mission.name}`);
      return mission;
    } catch (error) {
      setControlError(error.message);
      return null;
    }
  };

  const selectReplayExecution = (executionId) => {
    stopReplayPlayback();
    applyReplayExecution(executionId);
  };

  const clearReplay = () => {
    replayWaypoints.value = [];
    replayTrace.value = [];
    selectedReplayMissionId.value = "";
    selectedReplayExecutionId.value = "";
    selectedReplayMission.value = { id: "", executions: [] };
    setStatusMessage("Replay cleared");
  };

  const primeReplayFromUpload = ({ missionId, executionId, waypoints }) => {
    replayWaypoints.value = waypoints;
    replayTrace.value = waypoints;
    selectedReplayMissionId.value = missionId;
    selectedReplayExecutionId.value = executionId;
  };

  const resetReplayHistory = () => {
    stopReplayPlayback();
    replayWaypoints.value = [];
    replayTrace.value = [];
    replayProgress.value = 0;
    selectedReplayMissionId.value = "";
    selectedReplayExecutionId.value = "";
    selectedReplayMission.value = { id: "", executions: [] };
  };

  watch(replayTrace, () => {
    replayProgress.value = 0;
    stopReplayPlayback();
  });

  watch(replayExecutions, (executions) => {
    if (executions.length === 0) {
      selectedReplayExecutionId.value = "";
      replayTrace.value = replayWaypoints.value;
      return;
    }

    const stillSelected = executions.some((execution) => execution.execution_id === selectedReplayExecutionId.value);
    if (!stillSelected) {
      applyReplayExecution(executions[0].execution_id);
    }
  });

  return {
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
    updateReplayProgress,
    toggleReplayPlayback,
    stepReplayBackward,
    stepReplayForward,
    stopReplayPlayback,
    resetReplayHistory,
    primeReplayFromUpload,
  };
}
