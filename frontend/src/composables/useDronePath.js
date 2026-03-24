import { computed, ref, watch } from "vue";

export function useDronePath(droneState) {
  const dronePath = ref([]);

  watch(() => [droneState.value.lat, droneState.value.lon], ([newLat, newLon]) => {
    if (dronePath.value.length === 0) {
      dronePath.value.push([newLat, newLon]);
    } else {
      const last = dronePath.value[dronePath.value.length - 1];
      if (Math.abs(newLat - last[0]) > 0.00001 || Math.abs(newLon - last[1]) > 0.00001) {
        dronePath.value.push([newLat, newLon]);
      }
    }

    if (dronePath.value.length > 500) {
      dronePath.value.shift();
    }
  });

  const resetDronePath = () => {
    dronePath.value = [];
  };

  const liveMarker = computed(() => [droneState.value.lat, droneState.value.lon]);

  return {
    dronePath,
    liveMarker,
    resetDronePath,
  };
}
