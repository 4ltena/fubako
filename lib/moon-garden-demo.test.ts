import { beforeAll, describe, expect, it } from "vitest";
import { moonGardenDemo } from "../preview/moon-garden-demo";
import { extractTerms } from "./similar";
import { relatedPosts } from "./similarity-graph";
import { expandGraph } from "./graph-layout";

let candidates: { id: string; authorId: string; terms: string[]; veiled: boolean; topic: string }[];
beforeAll(async () => {
  const terms = [...new Set(moonGardenDemo.flatMap((post) => post.tags))];
  candidates = await Promise.all(moonGardenDemo.map(async (post) => ({ id: post.slug, authorId: post.handle, terms: await extractTerms(post.body, [], { terms }), veiled: false, topic: post.topic })));
});

describe("月舟の庭のデモ", () => {
  it("作品全体から10件がつながり、5つの人物・場面へ進める", () => {
    expect(candidates.every((post) => post.terms.length > 0)).toBe(true);
    const links = relatedPosts(candidates[0], candidates);
    expect(links).toHaveLength(10);
    expect(new Set(links.map((link) => candidates.find((post) => post.id === link.postId)!.topic))).toEqual(new Set(["灯里", "朔", "渡し場の再会", "庭の約束", "最後の歌"]));
  });
  it("人物や場面から新しい感想が増え、作品全体とのつながりも残る", () => {
    const nodes = candidates.map((post) => ({ ...post, related: relatedPosts(post, candidates) }));
    const initial = expandGraph([], "overview", nodes);
    for (const entry of candidates.filter((post) => post.id.endsWith("entrance-1"))) {
      const expanded = expandGraph(initial, entry.id, nodes);
      expect(expanded).toContain("overview");
      expect(expanded.length).toBeGreaterThan(initial.length);
      const children = expanded.filter((id) => id.includes("-letter-") && candidates.find((post) => post.id === id)?.topic === entry.topic);
      expect(children.length).toBeGreaterThanOrEqual(2);
    }
  });
});
