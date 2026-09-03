import { describe, expect, it } from "vitest";
import { clearDraft, DRAFT_TTL_MS, draftKey, loadDraft, saveDraft, type DraftStore } from "./draft";

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
    saveDraft("c1", "書きかけの本文", s, NOW);
    expect(loadDraft("c1", s, NOW)).toBe("書きかけの本文");
  });

  it("サークルごとに分かれる", () => {
    const s = fakeStore();
    saveDraft("c1", "こっち", s, NOW);
    saveDraft("c2", "あっち", s, NOW);
    expect(loadDraft("c1", s, NOW)).toBe("こっち");
    expect(loadDraft("c2", s, NOW)).toBe("あっち");
  });

  it("24時間を過ぎたら返さず、その場で捨てる", () => {
    const s = fakeStore();
    saveDraft("c1", "古い本文", s, NOW);
    expect(loadDraft("c1", s, NOW + DRAFT_TTL_MS)).toBe("古い本文");
    expect(loadDraft("c1", s, NOW + DRAFT_TTL_MS + 1)).toBe("");
    expect(s.data[draftKey("c1")]).toBeUndefined();
  });

  it("空になったら鍵ごと消す", () => {
    const s = fakeStore();
    saveDraft("c1", "書いた", s, NOW);
    saveDraft("c1", "   ", s, NOW);
    expect(s.data[draftKey("c1")]).toBeUndefined();
    expect(loadDraft("c1", s, NOW)).toBe("");
  });

  it("投げ終わったら消せる", () => {
    const s = fakeStore();
    saveDraft("c1", "投げる本文", s, NOW);
    clearDraft("c1", s);
    expect(loadDraft("c1", s, NOW)).toBe("");
  });

  it("壊れた中身でも落ちない", () => {
    const s = fakeStore({ [draftKey("c1")]: "{壊れている" });
    expect(loadDraft("c1", s, NOW)).toBe("");
    const s2 = fakeStore({ [draftKey("c1")]: JSON.stringify({ body: 123 }) });
    expect(loadDraft("c1", s2, NOW)).toBe("");
  });

  it("保管庫が無くても・触れなくても落ちない（private モード）", () => {
    expect(loadDraft("c1", null, NOW)).toBe("");
    expect(() => saveDraft("c1", "本文", null, NOW)).not.toThrow();
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
    expect(loadDraft("c1", angry, NOW)).toBe("");
    expect(() => saveDraft("c1", "本文", angry, NOW)).not.toThrow();
    expect(() => clearDraft("c1", angry)).not.toThrow();
  });
});
