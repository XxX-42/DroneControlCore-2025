import { parseApiResponse } from "./apiClient";

export async function planNavigation(apiBaseUrl, payload, options = {}) {
  const response = await fetch(`${apiBaseUrl}/api/v1/navigation/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  return parseApiResponse(response, "Route planning failed");
}
