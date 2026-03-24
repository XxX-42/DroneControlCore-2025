import { computed, ref } from "vue";

export function useMissionControl(apiBaseUrl) {
  const missionHistory = ref([]);
  const isUploading = ref(false);
  const isControlling = ref(false);
  const isRefreshingHistory = ref(false);
  const controlError = ref("");
  const statusMessage = ref("");
  const pendingAction = ref("");
  const currentMissionId = ref("");
  const currentExecutionId = ref("");
  const currentMissionStatus = ref("IDLE");
  const currentExecutionStatus = ref("NONE");

  const canPause = computed(() => currentExecutionStatus.value === "RUNNING");
  const canResume = computed(() => currentExecutionStatus.value === "PAUSED");
  const canCancel = computed(() => ["RUNNING", "PAUSED", "QUEUED"].includes(currentExecutionStatus.value));

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

  const uploadMission = async (waypoints) => {
    if (waypoints.length === 0) {
      return null;
    }

    isUploading.value = true;
    controlError.value = "";

    const missionPayload = {
      name: `Mission ${new Date().toLocaleTimeString()}`,
      waypoints: waypoints.map((wp) => ({
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
      statusMessage.value = result.message;
      await refreshHistory();
      return result;
    } catch (error) {
      controlError.value = error.message;
      return null;
    } finally {
      isUploading.value = false;
    }
  };

  const sendExecutionAction = async (action) => {
    if (!currentExecutionId.value) {
      return null;
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
      return result;
    } catch (error) {
      controlError.value = error.message;
      return null;
    } finally {
      isControlling.value = false;
      pendingAction.value = "";
    }
  };

  const resetMissionControl = () => {
    controlError.value = "";
    statusMessage.value = "";
    pendingAction.value = "";
    currentMissionId.value = "";
    currentExecutionId.value = "";
    currentMissionStatus.value = "IDLE";
    currentExecutionStatus.value = "NONE";
  };

  return {
    missionHistory,
    isUploading,
    isControlling,
    isRefreshingHistory,
    controlError,
    statusMessage,
    pendingAction,
    currentMissionId,
    currentExecutionId,
    currentMissionStatus,
    currentExecutionStatus,
    canPause,
    canResume,
    canCancel,
    refreshHistory,
    uploadMission,
    sendExecutionAction,
    resetMissionControl,
  };
}
