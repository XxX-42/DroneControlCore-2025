import { fetchNavigationGraphTile } from "./navigationGraphApi";

const DEFAULT_DRONE_BUFFER_M = 900;

const clampZoomBucket = (zoom) => Math.max(10, Math.min(20, Math.round(zoom || 14)));

const metersToLatDelta = (meters) => meters / 111_320;

const metersToLonDelta = (meters, latitude) => {
  const cosLat = Math.max(0.1, Math.cos((latitude * Math.PI) / 180));
  return meters / (111_320 * cosLat);
};

export const createEmptyBBox = () => ({
  left: Infinity,
  bottom: Infinity,
  right: -Infinity,
  top: -Infinity,
});

export const mergePointIntoBBox = (bbox, point, paddingM = 0) => {
  if (!point) {
    return bbox;
  }

  const latDelta = metersToLatDelta(paddingM);
  const lonDelta = metersToLonDelta(paddingM, point.latitude);

  return {
    left: Math.min(bbox.left, point.longitude - lonDelta),
    bottom: Math.min(bbox.bottom, point.latitude - latDelta),
    right: Math.max(bbox.right, point.longitude + lonDelta),
    top: Math.max(bbox.top, point.latitude + latDelta),
  };
};

export const mergeBBox = (base, next) => ({
  left: Math.min(base.left, next.left),
  bottom: Math.min(base.bottom, next.bottom),
  right: Math.max(base.right, next.right),
  top: Math.max(base.top, next.top),
});

export const sanitizeBBox = (bbox) => {
  if (
    !Number.isFinite(bbox.left)
    || !Number.isFinite(bbox.bottom)
    || !Number.isFinite(bbox.right)
    || !Number.isFinite(bbox.top)
  ) {
    return null;
  }

  return bbox;
};

export const roundBBox = (bbox, precision = 3) => {
  const factor = 10 ** precision;
  return {
    left: Math.round(bbox.left * factor) / factor,
    bottom: Math.round(bbox.bottom * factor) / factor,
    right: Math.round(bbox.right * factor) / factor,
    top: Math.round(bbox.top * factor) / factor,
  };
};

export const buildGraphTileKey = ({ zoomBucket, bbox }) => (
  `${zoomBucket}:${bbox.left}:${bbox.bottom}:${bbox.right}:${bbox.top}`
);

export const buildGraphTileRequest = ({
  mapBounds,
  zoom,
  dronePoint,
  startPoint,
  targetPoint,
  droneBufferM = DEFAULT_DRONE_BUFFER_M,
}) => {
  let bbox = createEmptyBBox();

  if (mapBounds) {
    bbox = mergeBBox(bbox, {
      left: mapBounds.left,
      bottom: mapBounds.bottom,
      right: mapBounds.right,
      top: mapBounds.top,
    });
  }

  bbox = mergePointIntoBBox(bbox, dronePoint, droneBufferM);
  bbox = mergePointIntoBBox(bbox, startPoint, droneBufferM / 2);
  bbox = mergePointIntoBBox(bbox, targetPoint, droneBufferM / 2);

  const sanitized = sanitizeBBox(bbox);
  if (!sanitized) {
    return null;
  }

  const zoomBucket = clampZoomBucket(zoom);
  const roundedBBox = roundBBox(sanitized);

  return {
    zoom_bucket: zoomBucket,
    ...roundedBBox,
  };
};

export function createPreviewGraphCache({ apiBaseUrl, maxEntries = 5 }) {
  const cache = new Map();
  const pending = new Map();

  const touchEntry = (key, value) => {
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    return value;
  };

  const ensureTile = async (request, options = {}) => {
    if (!request) {
      return null;
    }

    const key = buildGraphTileKey({
      zoomBucket: request.zoom_bucket,
      bbox: request,
    });

    if (cache.has(key)) {
      return touchEntry(key, cache.get(key));
    }

    if (pending.has(key)) {
      return pending.get(key);
    }

    const promise = fetchNavigationGraphTile(apiBaseUrl, request, options)
      .then((tile) => touchEntry(key, tile))
      .finally(() => {
        pending.delete(key);
      });

    pending.set(key, promise);
    return promise;
  };

  const clear = () => {
    cache.clear();
    pending.clear();
  };

  return {
    ensureTile,
    clear,
  };
}
