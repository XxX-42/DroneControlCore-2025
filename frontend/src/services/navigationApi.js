import { parseApiResponse } from "./apiClient";

export async function planNavigation(apiBaseUrl, payload) {
  const response = await fetch(`${apiBaseUrl}/api/v1/navigation/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse(response, "Route planning failed");
}
