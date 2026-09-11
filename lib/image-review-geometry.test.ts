import { describe, expect, it } from "vitest";
import { constrainReview, fitReview, reviewImageSize, zoomReview } from "./image-review-geometry";

describe("写真と矩形の共通座標", () => {
  it("縦長・横長写真を余白込みで中央に収める", () => {
    expect(fitReview({ width: 400, height: 800 }, { width: 320, height: 400 })).toEqual({ zoom: 1, x: 60, y: 0 });
    expect(reviewImageSize({ width: 800, height: 400 }, { width: 320, height: 400 })).toEqual({ width: 320, height: 160 });
    expect(fitReview({ width: 800, height: 400 }, { width: 320, height: 400 })).toEqual({ zoom: 1, x: 0, y: 120 });
  });
  it("ピンチ中点にある画像の位置を動いた指の中点へ保つ", () => {
    const image = { width: 640, height: 640 }, view = { width: 400, height: 400 };
    const camera = { zoom: 2, x: -200, y: -200 }, anchor = { x: 150, y: 180 }, moved = { x: 160, y: 190 };
    const next = zoomReview(camera, 1.5, anchor, image, view, moved);
    expect((anchor.x - camera.x) / camera.zoom).toBeCloseTo((moved.x - next.x) / next.zoom);
    expect((anchor.y - camera.y) / camera.zoom).toBeCloseTo((moved.y - next.y) / next.zoom);
  });
  it("画面外への移動と倍率を制限し、全体表示へ戻せる", () => {
    const image = { width: 200, height: 400 }, view = { width: 320, height: 400 };
    expect(constrainReview({ zoom: 2, x: 1000, y: -5000 }, image, view)).toEqual({ zoom: 2, x: 0, y: -400 });
    expect(constrainReview({ zoom: .1, x: -50, y: -10 }, image, view)).toEqual(fitReview(image, view));
    expect(zoomReview(fitReview(image, view), 100, { x: 160, y: 200 }, image, view).zoom).toBe(6);
  });
});
