import { describe, expect, it } from "vitest";
import { AFTERWORD_MAX_CHARS, validateAfterword } from "./afterword";

describe("後書き", () => {
  it("空文字を含む本文とは別の文字列を保存できる", () => {
    expect(validateAfterword("")).toEqual({ afterword: "" });
    expect(validateAfterword("あとから思い出したこと")).toEqual({ afterword: "あとから思い出したこと" });
  });

  it("型と長さを制限する", () => {
    expect(validateAfterword(null)).toEqual({ error: "afterword" });
    expect(validateAfterword("あ".repeat(AFTERWORD_MAX_CHARS))).toEqual({ afterword: "あ".repeat(AFTERWORD_MAX_CHARS) });
    expect(validateAfterword("あ".repeat(AFTERWORD_MAX_CHARS + 1))).toEqual({ error: "too_long" });
  });
});
