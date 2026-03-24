import { parseApiResponse } from "./apiClient";

export async function fetchMissionHistory(apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl}/api/v1/missions/history`);
  return parseApiResponse(response, "Failed to load mission history");
}

export async function fetchMissionDetail(apiBaseUrl, missionId) {
  const response = await fetch(`${apiBaseUrl}/api/v1/missions/${missionId}`);
  return parseApiResponse(response, "Failed to load mission detail");
}

export async function uploadMission(apiBaseUrl, payload) {
  const response = await fetch(`${apiBaseUrl}/api/v1/missions/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse(response, "Upload failed");
}

export async function sendMissionExecutionAction(apiBaseUrl, executionId, action) {
  const response = await fetch(
    `${apiBaseUrl}/api/v1/missions/executions/${executionId}/${action}`,
    { method: "POST" },
  );

  return parseApiResponse(response, `Failed to ${action} execution`);
}
