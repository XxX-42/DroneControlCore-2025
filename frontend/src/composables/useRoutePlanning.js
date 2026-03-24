import { computed, ref } from "vue";
import { planNavigation } from "../services/navigationApi";

const PLAN_TIMEOUT_MS = 20000;

export function useRoutePlanning({ apiBaseUrl, droneState, setStatusMessage }) {
  const waypoints = ref([]);
  const targetPoint = ref(null);
  const routeType = ref("direct");
  const isPlanning = ref(false);
  const planningError = ref("");

  let activePlanController = null;
  let activePlanTimer = null;

  const plannedRoute = computed(() => waypoints.value.map((wp) => [wp.latitude, wp.longitude]));
  const routeTypeLabel = computed(() => routeType.value.toUpperCase());

  const normalizeStartPoint = (startPoint) => ({
    latitude: startPoint?.latitude ?? startPoint?.lat ?? droneState.value.lat,
    longitude: startPoint?.longitude ?? startPoint?.lon ?? droneState.value.lon,
  });

  const clearActivePlan = (controller) => {
    if (activePlanController === controller) {
      activePlanController = null;
    }
    if (activePlanTimer) {
      clearTimeout(activePlanTimer);
      activePlanTimer = null;
    }
  };

  const abortActivePlan = (reason = "superseded") => {
    if (activePlanController) {
      activePlanController.abort(reason);
      clearActivePlan(activePlanController);
    }
  };

  const planRouteToTarget = async (
    targetLatitude,
    targetLongitude,
    options = {},
  ) => {
    const { startPoint = null, append = false } = options;
    const preserveExistingRoute = append && waypoints.value.length > 0;
    const normalizedStart = normalizeStartPoint(startPoint);

    abortActivePlan();

    targetPoint.value = { latitude: targetLatitude, longitude: targetLongitude };
    planningError.value = "";
    isPlanning.value = true;

    const controller = new AbortController();
    activePlanController = controller;
    activePlanTimer = setTimeout(() => {
      controller.abort("timeout");
    }, PLAN_TIMEOUT_MS);

    try {
      const result = await planNavigation(
        apiBaseUrl,
        {
          start_latitude: normalizedStart.latitude,
          start_longitude: normalizedStart.longitude,
          target_latitude: targetLatitude,
          target_longitude: targetLongitude,
        },
        { signal: controller.signal },
      );

      const nextWaypoints = preserveExistingRoute
        ? [...waypoints.value, ...result.waypoints.slice(1)]
        : result.waypoints;

      waypoints.value = nextWaypoints;
      routeType.value = result.route_type;
      setStatusMessage(
        preserveExistingRoute
          ? `任务路线已追加（${result.route_type.toUpperCase()}）`
          : `路线规划完成（${result.route_type.toUpperCase()}）`,
      );

      return {
        ...result,
        waypoints: nextWaypoints,
      };
    } catch (error) {
      if (error.name === "AbortError") {
        if (controller.signal.reason === "timeout") {
          planningError.value = "规划超时，请缩小范围后重试";
        }
        if (controller.signal.reason !== "timeout") {
          return null;
        }
      } else {
        if (!preserveExistingRoute) {
          waypoints.value = [];
          routeType.value = "direct";
        }
        planningError.value = error.message;
      }

      return null;
    } finally {
      clearActivePlan(controller);
      if (activePlanController === null) {
        isPlanning.value = false;
      }
    }
  };

  const resetRoutePlanning = () => {
    abortActivePlan("reset");
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
