import { describe, expect, it } from "vitest";
import { normalizeHandle } from "./handle";

// 見えない文字はエスケープで書く（エディタや端末で落ちないように）
const ZWSP = "\u200b";
const ZWJ = "\u200d";

describe("normalizeHandle", () => {
  it("ゼロ幅空白と制御文字を落とす", () => {
    expect(normalizeHandle(`alice${ZWSP}`).key).toBe("alice");
    expect(normalizeHandle(`ali${ZWJ}ce`).display).toBe("alice");
  });
  it("全角英数を半角に寄せ、大文字小文字を一意キーでは区別しない", () => {
    expect(normalizeHandle("Ａlice").key).toBe("alice");
    expect(normalizeHandle("Alice").display).toBe("Alice");
    expect(normalizeHandle("Alice").key).toBe(normalizeHandle("alice").key);
  });
  it("前後の空白を落とし、日本語はそのまま", () => {
    expect(normalizeHandle("　ひなた ")).toEqual({ key: "ひなた", display: "ひなた" });
  });
});
