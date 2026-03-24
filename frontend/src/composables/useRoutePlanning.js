import { computed, ref } from "vue";

export function useRoutePlanning({ apiBaseUrl, droneState, setStatusMessage }) {
  const waypoints = ref([]);
  const targetPoint = ref(null);
  const routeType = ref("direct");
  const isPlanning = ref(false);
  const planningError = ref("");

  const plannedRoute = computed(() => waypoints.value.map((wp) => [wp.latitude, wp.longitude]));
  const routeTypeLabel = computed(() => routeType.value.toUpperCase());

  const planRouteToTarget = async (targetLatitude, targetLongitude) => {
    targetPoint.value = { latitude: targetLatitude, longitude: targetLongitude };
    planningError.value = "";
    isPlanning.value = true;

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/navigation/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_latitude: droneState.value.lat,
          start_longitude: droneState.value.lon,
          target_latitude: targetLatitude,
          target_longitude: targetLongitude,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.detail || "Route planning failed");
      }

      const result = await response.json();
      waypoints.value = result.waypoints;
      routeType.value = result.route_type;
      setStatusMessage(`Route planned via ${result.route_type.toUpperCase()}`);
      return result;
    } catch (error) {
      waypoints.value = [];
      routeType.value = "direct";
      planningError.value = error.message;
      return null;
    } finally {
      isPlanning.value = false;
    }
  };

  const resetRoutePlanning = () => {
    waypoints.value = [];
    targetPoint.value = null;
    routeType.value = "direct";
    planningError.value = "";
    isPlanning.value = false;
  };

  return {
    waypoints,
    targetPoint,
    routeType,
    isPlanning,
    planningError,
    plannedRoute,
    routeTypeLabel,
    planRouteToTarget,
    resetRoutePlanning,
  };
}
