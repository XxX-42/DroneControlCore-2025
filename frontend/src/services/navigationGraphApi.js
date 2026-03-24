import { parseApiResponse } from "./apiClient";

export async function fetchNavigationGraphTile(apiBaseUrl, payload, options = {}) {
  const response = await fetch(`${apiBaseUrl}/api/v1/navigation/graph`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  return parseApiResponse(response, "Preview graph loading failed");
}
