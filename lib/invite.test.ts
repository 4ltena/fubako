import { describe, expect, it } from "vitest";
import { INVITE_ALPHABET, INVITE_LENGTH, makeInvite, normalizeInvite } from "./invite";

describe("招待の言葉", () => {
  it("ひらがな10文字で作る", () => {
    const word = makeInvite(() => 0);
    expect(word).toBe("あ".repeat(INVITE_LENGTH));
    expect([...word].every((c) => INVITE_ALPHABET.includes(c))).toBe(true);
  });

  it("紛らわしい字を使わない（ん・を・小書き・濁点）", () => {
    for (const c of ["ん", "を", "ぁ", "っ", "が", "ぱ"]) expect(INVITE_ALPHABET.includes(c)).toBe(false);
    expect([...INVITE_ALPHABET].length).toBe(44);
  });

  it("渡された乱数の並びどおりに拾う", () => {
    const seq = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    let i = 0;
    expect(makeInvite(() => seq[i++])).toBe("あいうえおかきくけこ");
  });
});

describe("normalizeInvite", () => {
  it("カタカナをひらがなに寄せる", () => {
    expect(normalizeInvite("アイウエオ")).toBe("あいうえお");
  });

  it("空白・改行・区切りを落とす", () => {
    expect(normalizeInvite(" あい うえ　お\nか ")).toBe("あいうえおか");
    expect(normalizeInvite("あい・うえ　お")).toBe("あいうえお");
  });

  it("全角の英数字は半角に寄せる", () => {
    expect(normalizeInvite("ＡＢＣ123")).toBe("ABC123");
  });

  it("既存の base64url コードをそのまま通す（大小も - も _ も潰さない）", () => {
    for (const code of ["Ab3-_xYz9QkL", "seed-invite-code", "AbCdEf"]) {
      expect(normalizeInvite(code)).toBe(code);
    }
  });
});
