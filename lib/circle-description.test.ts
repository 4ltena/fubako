import { describe, expect, it } from "vitest";
import { CIRCLE_DESCRIPTION_MAX_LENGTH, validateCircleDescription } from "@/lib/circle-description";

describe("箱の説明の検証", () => {
  it("空文字と改行を含む500文字以内の平文を許可する", () => {
    expect(validateCircleDescription("")).toEqual({ ok: true, description: "" });
    expect(validateCircleDescription("ネタバレは\n見終えてからどうぞ")).toEqual({ ok: true, description: "ネタバレは\n見終えてからどうぞ" });
    expect(validateCircleDescription("あ".repeat(CIRCLE_DESCRIPTION_MAX_LENGTH))).toEqual({ ok: true, description: "あ".repeat(CIRCLE_DESCRIPTION_MAX_LENGTH) });
  });

  it("型違い、長すぎる内容、平文に含めない制御文字を拒否する", () => {
    expect(validateCircleDescription({ description: "説明" })).toEqual({ ok: false });
    expect(validateCircleDescription("あ".repeat(CIRCLE_DESCRIPTION_MAX_LENGTH + 1))).toEqual({ ok: false });
    expect(validateCircleDescription("説明\u0000" )).toEqual({ ok: false });
  });
});
