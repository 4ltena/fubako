"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject, type MouseEvent } from "react";
import { zoomGraphAt, type GraphCamera, type CameraPoint } from "@/lib/graph-camera";

type Gesture = { points: CameraPoint[]; camera: GraphCamera };
const initialCamera: GraphCamera = { x: 0, y: 0, zoom: 1 };
const midpoint = (points: CameraPoint[]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const distance = (points: CameraPoint[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);

export function useGraphGestures(fieldRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [camera, setCamera] = useState(initialCamera);
  const current = useRef(camera);
  const pointers = useRef(new Map<number, CameraPoint>());
  const gesture = useRef<Gesture | null>(null);
  const suppressUntil = useRef(0);

  function update(next: GraphCamera) { current.current = next; setCamera(next); }
  function reset() {
    pointers.current.clear(); gesture.current = null;
    update(initialCamera);
  }
  function point(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.button !== 0 || pointers.current.size >= 2) return;
    pointers.current.set(event.pointerId, point(event));
    gesture.current = { points: [...pointers.current.values()], camera: current.current };
    if (pointers.current.size === 2) {
      suppressUntil.current = Infinity;
      for (const id of pointers.current.keys()) event.currentTarget.setPointerCapture(id);
    }
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || !pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, point(event));
    const start = gesture.current, next = [...pointers.current.values()];
    if (next.length === 2 && start.points.length === 2) {
      update(zoomGraphAt(start.camera, distance(next) / Math.max(1, distance(start.points)), midpoint(start.points), midpoint(next)));
    } else {
      const dx = next[0].x - start.points[0].x, dy = next[0].y - start.points[0].y;
      if (Math.hypot(dx, dy) < 6 && suppressUntil.current !== Infinity) return;
      suppressUntil.current = Infinity;
      event.currentTarget.setPointerCapture(event.pointerId);
      update({ ...start.camera, x: start.camera.x + dx, y: start.camera.y + dy });
    }
  }
  const end = useCallback((event: { pointerId: number }) => {
    if (!pointers.current.delete(event.pointerId)) return;
    gesture.current = pointers.current.size ? { points: [...pointers.current.values()], camera: current.current } : null;
    if (!pointers.current.size && suppressUntil.current === Infinity) suppressUntil.current = Date.now() + 250;
  }, []);
  function captureClick(event: MouseEvent<HTMLDivElement>) {
    if (Date.now() < suppressUntil.current) { event.preventDefault(); event.stopPropagation(); }
  }

  useEffect(() => {
    // タップを保つため開始直後はcaptureしない。領域外で離した指もここで破棄する。
    const clear = () => { pointers.current.clear(); gesture.current = null; suppressUntil.current = 0; };
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("blur", clear);
    };
  }, [end]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || !enabled) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = field.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const next = zoomGraphAt(current.current, Math.exp(-event.deltaY * unit * .01), { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 });
      current.current = next;
      setCamera(next);
    };
    field.addEventListener("wheel", wheel, { passive: false });
    return () => field.removeEventListener("wheel", wheel);
  }, [fieldRef, enabled]);

  return {
    camera, reset,
    zoomBy: (factor: number) => update(zoomGraphAt(current.current, factor, { x: 0, y: 0 })),
    events: { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end, onClickCapture: captureClick },
  };
}
