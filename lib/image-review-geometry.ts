export type ReviewSize = { width: number; height: number };
export type ReviewPoint = { x: number; y: number };
export type ReviewCamera = ReviewPoint & { zoom: number };
export const REVIEW_MIN_ZOOM = 1, REVIEW_MAX_ZOOM = 6;

export function reviewImageSize(image: ReviewSize, viewport: ReviewSize): ReviewSize {
  const ratio = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { width: image.width * ratio, height: image.height * ratio };
}
export function constrainReview(camera: ReviewCamera, image: ReviewSize, viewport: ReviewSize): ReviewCamera {
  const zoom = Math.max(REVIEW_MIN_ZOOM, Math.min(REVIEW_MAX_ZOOM, camera.zoom));
  const fit = reviewImageSize(image, viewport);
  const axis = (offset: number, extent: number, view: number) => extent <= view ? (view - extent) / 2 : Math.max(view - extent, Math.min(0, offset));
  return { zoom, x: axis(camera.x, fit.width * zoom, viewport.width), y: axis(camera.y, fit.height * zoom, viewport.height) };
}
export function fitReview(image: ReviewSize, viewport: ReviewSize) { return constrainReview({ zoom: 1, x: 0, y: 0 }, image, viewport); }
export function zoomReview(camera: ReviewCamera, factor: number, anchor: ReviewPoint, image: ReviewSize, viewport: ReviewSize, moved = anchor): ReviewCamera {
  if (!Number.isFinite(factor) || factor <= 0) return camera;
  const zoom = Math.max(REVIEW_MIN_ZOOM, Math.min(REVIEW_MAX_ZOOM, camera.zoom * factor)), ratio = zoom / camera.zoom;
  return constrainReview({ zoom, x: moved.x - (anchor.x - camera.x) * ratio, y: moved.y - (anchor.y - camera.y) * ratio }, image, viewport);
}
