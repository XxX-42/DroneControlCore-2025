const EARTH_RADIUS_M = 6_371_000;

const toRadians = (value) => (value * Math.PI) / 180;

export const haversineDistance = (start, end) => {
  const startLat = toRadians(start.latitude);
  const endLat = toRadians(end.latitude);
  const latDelta = toRadians(end.latitude - start.latitude);
  const lonDelta = toRadians(end.longitude - start.longitude);

  const a = (
    Math.sin(latDelta / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDelta / 2) ** 2
  );

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const buildGraphRuntime = (tile) => {
  const nodes = new Map();
  const adjacency = new Map();

  for (const node of tile.nodes || []) {
    nodes.set(node.id, {
      id: node.id,
      latitude: node.lat,
      longitude: node.lon,
    });
    adjacency.set(node.id, []);
  }

  for (const edge of tile.edges || []) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      continue;
    }
    adjacency.get(edge.from).push({
      to: edge.to,
      cost: edge.cost,
    });
  }

  return {
    tileKey: tile.tile_key,
    nodes,
    adjacency,
  };
};

export const findNearestNodeId = (runtime, point) => {
  let nearestId = null;
  let nearestDistance = Infinity;

  for (const [nodeId, node] of runtime.nodes.entries()) {
    const distance = haversineDistance(point, node);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = nodeId;
    }
  }

  return nearestId;
};

export const computePreviewRoute = (runtime, startPoint, targetPoint) => {
  if (!runtime || runtime.nodes.size === 0) {
    return {
      status: "missing-graph",
      previewWaypoints: [],
      fallbackReason: "empty-graph",
    };
  }

  const startNodeId = findNearestNodeId(runtime, startPoint);
  const targetNodeId = findNearestNodeId(runtime, targetPoint);

  if (!startNodeId || !targetNodeId) {
    return {
      status: "missing-graph",
      previewWaypoints: [],
      fallbackReason: "missing-endpoint-node",
    };
  }

  const openSet = new Set([startNodeId]);
  const cameFrom = new Map();
  const gScore = new Map([[startNodeId, 0]]);
  const fScore = new Map([[
    startNodeId,
    haversineDistance(runtime.nodes.get(startNodeId), runtime.nodes.get(targetNodeId)),
  ]]);

  while (openSet.size > 0) {
    let current = null;
    let bestScore = Infinity;

    for (const candidate of openSet) {
      const score = fScore.get(candidate) ?? Infinity;
      if (score < bestScore) {
        bestScore = score;
        current = candidate;
      }
    }

    if (current === targetNodeId) {
      const nodePath = [current];
      while (cameFrom.has(current)) {
        current = cameFrom.get(current);
        nodePath.unshift(current);
      }

      const previewWaypoints = [
        startPoint,
        ...nodePath.map((nodeId) => runtime.nodes.get(nodeId)),
        targetPoint,
      ].map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      }));

      return {
        status: "ok",
        previewWaypoints,
        fallbackReason: "",
      };
    }

    openSet.delete(current);
    const neighbors = runtime.adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      const tentativeG = (gScore.get(current) ?? Infinity) + neighbor.cost;
      if (tentativeG >= (gScore.get(neighbor.to) ?? Infinity)) {
        continue;
      }

      cameFrom.set(neighbor.to, current);
      gScore.set(neighbor.to, tentativeG);
      fScore.set(
        neighbor.to,
        tentativeG + haversineDistance(runtime.nodes.get(neighbor.to), runtime.nodes.get(targetNodeId)),
      );
      openSet.add(neighbor.to);
    }
  }

  return {
    status: "no-path",
    previewWaypoints: [],
    fallbackReason: "path-not-found",
  };
};
