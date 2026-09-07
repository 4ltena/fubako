import { describe, expect, it } from "vitest";
import { clearDraft, DRAFT_TTL_MS, draftKey, EMPTY_DRAFT, loadDraft, saveDraft, type DraftStore } from "./draft";

function fakeStore(initial: Record<string, string> = {}): DraftStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const NOW = 1_800_000_000_000;

describe("下書き", () => {
  it("残して、取り出せる", () => {
    const s = fakeStore();
    saveDraft("c1", { body: "書きかけの本文", cw: "注意", tags: "推し 新曲", days: 3, visibility: "private" }, s, NOW);
    expect(loadDraft("c1", s, NOW)).toEqual({ body: "書きかけの本文", cw: "注意", tags: "推し 新曲", days: 3, visibility: "private" });
  });

  it("人ごと・箱ごとに分かれる（同じ端末を別の人が使っても混ざらない）", () => {
    const s = fakeStore();
    saveDraft("u1:c1", { ...EMPTY_DRAFT, body: "こっち" }, s, NOW);
    saveDraft("u1:c2", { ...EMPTY_DRAFT, body: "あっち" }, s, NOW);
    saveDraft("u2:c1", { ...EMPTY_DRAFT, body: "べつの人" }, s, NOW);
    expect(loadDraft("u1:c1", s, NOW).body).toBe("こっち");
    expect(loadDraft("u1:c2", s, NOW).body).toBe("あっち");
    expect(loadDraft("u2:c1", s, NOW).body).toBe("べつの人");
  });

  it("24時間を過ぎたら返さず、その場で捨てる", () => {
    const s = fakeStore();
    saveDraft("c1", { ...EMPTY_DRAFT, body: "古い本文" }, s, NOW);
    expect(loadDraft("c1", s, NOW + DRAFT_TTL_MS).body).toBe("古い本文");
    expect(loadDraft("c1", s, NOW + DRAFT_TTL_MS + 1)).toEqual(EMPTY_DRAFT);
    expect(s.data[draftKey("c1")]).toBeUndefined();
  });

  it("空になったら鍵ごと消す", () => {
    const s = fakeStore();
    saveDraft("c1", { ...EMPTY_DRAFT, body: "書いた" }, s, NOW);
    saveDraft("c1", { ...EMPTY_DRAFT, body: "   " }, s, NOW);
    expect(s.data[draftKey("c1")]).toBeUndefined();
    expect(loadDraft("c1", s, NOW)).toEqual(EMPTY_DRAFT);
  });

  it("投げ終わったら消せる", () => {
    const s = fakeStore();
    saveDraft("c1", { ...EMPTY_DRAFT, body: "投げる本文" }, s, NOW);
    clearDraft("c1", s);
    expect(loadDraft("c1", s, NOW)).toEqual(EMPTY_DRAFT);
  });

  it("壊れた中身でも落ちない", () => {
    const s = fakeStore({ [draftKey("c1")]: "{壊れている" });
    expect(loadDraft("c1", s, NOW)).toEqual(EMPTY_DRAFT);
    const s2 = fakeStore({ [draftKey("c1")]: JSON.stringify({ body: 123 }) });
    expect(loadDraft("c1", s2, NOW)).toEqual(EMPTY_DRAFT);
  });

  it("保管庫が無くても・触れなくても落ちない（private モード）", () => {
    expect(loadDraft("c1", null, NOW)).toEqual(EMPTY_DRAFT);
    expect(() => saveDraft("c1", { ...EMPTY_DRAFT, body: "本文" }, null, NOW)).not.toThrow();
    expect(() => clearDraft("c1", null)).not.toThrow();
    const angry: DraftStore = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadDraft("c1", angry, NOW)).toEqual(EMPTY_DRAFT);
    expect(saveDraft("c1", { ...EMPTY_DRAFT, body: "本文" }, angry, NOW)).toBe(false);
    expect(() => clearDraft("c1", angry)).not.toThrow();
  });
  it("古い本文だけの形式を読み、注意文などを空にする", () => {
    const s = fakeStore({ [draftKey("c1")]: JSON.stringify({ body: "以前の本文", at: NOW }) });
    expect(loadDraft("c1", s, NOW)).toEqual({ ...EMPTY_DRAFT, body: "以前の本文" });
  });

  it("保存先のない旧下書きは箱への公開として戻す", () => {
    const s = fakeStore({ [draftKey("c1")]: JSON.stringify({ body: "以前の本文", at: NOW }) });
    expect(loadDraft("c1", s, NOW).visibility).toBe("circle");
  });

  it("壊れた保存先は公開せず自分だけの保存として戻す", () => {
    const s = fakeStore({ [draftKey("c1")]: JSON.stringify({ body: "以前の本文", visibility: "everywhere", at: NOW }) });
    expect(loadDraft("c1", s, NOW).visibility).toBe("private");
  });
});
