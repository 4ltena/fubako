import { describe, expect, it } from "vitest";
import { zoomGraphAt } from "./graph-camera";

describe("グラフのピンチ", () => {
  it("拡大中も指の中点にある位置を保ち、指の移動分も反映する", () => {
    const start = { zoom: 1, x: 20, y: -10 }, anchor = { x: 100, y: 50 }, moved = { x: 120, y: 70 };
    const next = zoomGraphAt(start, 2, anchor, moved);
    expect(next.zoom).toBe(2);
    expect((moved.x - next.x) / next.zoom).toBe((anchor.x - start.x) / start.zoom);
    expect((moved.y - next.y) / next.zoom).toBe((anchor.y - start.y) / start.zoom);
  });
  it("拡大と縮小を往復でき、上限・下限と不正値を扱う", () => {
    const start = { zoom: 1, x: 0, y: 0 }, anchor = { x: 40, y: 20 };
    expect(zoomGraphAt(zoomGraphAt(start, 2, anchor), .5, anchor)).toEqual(start);
    expect(zoomGraphAt(start, 100, anchor).zoom).toBe(3);
    expect(zoomGraphAt(start, .01, anchor).zoom).toBe(.35);
    expect(zoomGraphAt(start, NaN, anchor)).toEqual(start);
  });
});
