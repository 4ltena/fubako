import { describe, expect, it } from "vitest";
import { inferForm, SENTENCE_MAX_CHARS, VERSE_MAX_CHARS_PER_LINE } from "./form";

const long = (n: number) => "あ".repeat(n);

describe("inferForm", () => {
  it("画像があって本文が空なら一枚", () => {
    expect(inferForm("", 1)).toBe("picture");
    expect(inferForm("   \n  ", 2)).toBe("picture");
  });

  it("改行が無く短ければ一文", () => {
    expect(inferForm("配信の最後に手を振った", 0)).toBe("sentence");
  });

  it("3行で各行が短ければ一句", () => {
    expect(inferForm("夜が明ける\n推しの声\nまだ耳に", 0)).toBe("verse");
  });

  it("それ以外は通常", () => {
    expect(inferForm(`${long(50)}\n${long(50)}`, 0)).toBe("text");
    expect(inferForm("一行目\n二行目", 0)).toBe("text");
  });
});

describe("境界値", () => {
  it("ちょうど40文字は一文、41文字は通常", () => {
    expect(inferForm(long(SENTENCE_MAX_CHARS), 0)).toBe("sentence");
    expect(inferForm(long(SENTENCE_MAX_CHARS + 1), 0)).toBe("text");
  });

  it("画像があっても本文があれば画像で判定しない", () => {
    expect(inferForm("短い本文", 1)).toBe("sentence");
    expect(inferForm(long(SENTENCE_MAX_CHARS + 1), 1)).toBe("text");
  });

  it("画像が無く本文も空なら一枚にはならない", () => {
    expect(inferForm("", 0)).toBe("sentence");
  });

  it("一句は各行ちょうど10文字まで、1文字でも超えれば通常", () => {
    const ok = [long(VERSE_MAX_CHARS_PER_LINE), long(1), long(VERSE_MAX_CHARS_PER_LINE)].join("\n");
    const ng = [long(VERSE_MAX_CHARS_PER_LINE + 1), long(1), long(1)].join("\n");
    expect(inferForm(ok, 0)).toBe("verse");
    expect(inferForm(ng, 0)).toBe("text");
  });

  it("行数が3でなければ一句にならない", () => {
    expect(inferForm("あ\nい\nう\nえ", 0)).toBe("text");
  });

  it("絵文字（サロゲートペア）は1文字として数える", () => {
    expect(inferForm("🎤".repeat(SENTENCE_MAX_CHARS), 0)).toBe("sentence");
    expect(inferForm("🎤".repeat(SENTENCE_MAX_CHARS + 1), 0)).toBe("text");
  });
});
