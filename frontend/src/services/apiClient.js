export async function parseApiResponse(response, fallbackMessage) {
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.detail || fallbackMessage);
  }

  return response.json();
}
