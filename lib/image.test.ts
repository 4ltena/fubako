import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage } from "./image";

/** 横 300×縦 200 の赤い JPEG に、EXIF の向き 6（右に 90 度回して表示）と GPS を付ける */
async function jpegWithOrientation6(): Promise<Buffer> {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: "#e03030" } })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Software: "fubako-test" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "35/1 40/1 0/1" } },
    })
    .toBuffer();
}

describe("processImage", () => {
  it("入力には EXIF（向きと GPS）が入っている", async () => {
    const meta = await sharp(await jpegWithOrientation6()).metadata();
    expect(meta.orientation).toBe(6);
    expect(meta.exif).toBeDefined();
    expect(meta.exif!.toString("latin1")).toContain("fubako-test");
  });

  it("EXIF を落とし、向きを画素に焼き込む（300×200 が 200×300 になる）", async () => {
    const out = await processImage(await jpegWithOrientation6());
    expect(out.width).toBe(200);
    expect(out.height).toBe(300);
    const meta = await sharp(out.webp).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(out.webp.toString("latin1")).not.toContain("fubako-test");
  });

  it("blurhash を返す", async () => {
    const out = await processImage(await jpegWithOrientation6());
    expect(out.blurhash.length).toBeGreaterThan(6);
  });

  it("長辺 2048px に収める", async () => {
    const big = await sharp({ create: { width: 4000, height: 1000, channels: 3, background: "#3060e0" } }).png().toBuffer();
    const out = await processImage(big);
    expect(out.width).toBe(2048);
    expect(out.height).toBe(512);
  });

  it("画像でなければ投げる", async () => {
    await expect(processImage(Buffer.from("not an image"))).rejects.toThrow();
  });

  it("展開後の画素数が大きすぎる画像（展開爆弾）は投げる", async () => {
    const bomb = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: "#fff" } }).png().toBuffer();
    await expect(processImage(bomb)).rejects.toThrow();
  });

  it("対応していない画像形式（TIFF）は投げる", async () => {
    const tiff = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).tiff().toBuffer();
    await expect(processImage(tiff)).rejects.toThrow("対応していない画像形式");
  });
});
