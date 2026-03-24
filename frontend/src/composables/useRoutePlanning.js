import { computed, ref } from "vue";
import { planNavigation } from "../services/navigationApi";

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
      const result = await planNavigation(apiBaseUrl, {
        start_latitude: droneState.value.lat,
        start_longitude: droneState.value.lon,
        target_latitude: targetLatitude,
        target_longitude: targetLongitude,
      });
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
