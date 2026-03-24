import { buildGraphRuntime, computePreviewRoute } from "./hoverPreviewWorkerCore";

const graphStore = new Map();

self.onmessage = (event) => {
  const { type, payload } = event.data;

  if (type === "storeGraph") {
    graphStore.set(payload.tileKey, buildGraphRuntime(payload.tile));
    return;
  }

  if (type === "clearGraphs") {
    graphStore.clear();
    return;
  }

  if (type === "computeRoute") {
    const runtime = graphStore.get(payload.graphTileKey);
    const result = computePreviewRoute(runtime, payload.startPoint, payload.targetPoint);
    self.postMessage({
      type: "routeResult",
      payload: {
        requestId: payload.requestId,
        ...result,
      },
    });
  }
};
