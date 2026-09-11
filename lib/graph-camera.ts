export type GraphCamera = { x: number; y: number; zoom: number };
export type CameraPoint = { x: number; y: number };
export const MIN_GRAPH_ZOOM = .35;
export const MAX_GRAPH_ZOOM = 3;

/** 指の中点にある紙を保ったまま、倍率と移動を同時に反映する。 */
export function zoomGraphAt(camera: GraphCamera, factor: number, anchor: CameraPoint, movedAnchor: CameraPoint = anchor): GraphCamera {
  if (!Number.isFinite(factor) || factor <= 0) return camera;
  const zoom = Math.max(MIN_GRAPH_ZOOM, Math.min(MAX_GRAPH_ZOOM, camera.zoom * factor));
  const ratio = zoom / camera.zoom;
  return { zoom, x: movedAnchor.x - (anchor.x - camera.x) * ratio, y: movedAnchor.y - (anchor.y - camera.y) * ratio };
}
