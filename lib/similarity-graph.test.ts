import { describe, expect, it } from "vitest";
import { relatedPosts, similarityStrength } from "./similarity-graph";
import { expandGraph, layoutGraph } from "./graph-layout";

describe("投稿の類似グラフ", () => {
  it("共通語の重みが強いほど線も強くなり、空・無関係なら結ばない", () => {
    expect(similarityStrength([], [])).toBe(0);
    expect(similarityStrength(["舞台"], ["料理"])).toBe(0);
    expect(similarityStrength(["舞台", "歌声"], ["舞台", "歌声"])).toBe(1);
    expect(similarityStrength(["舞台", "歌声"], ["舞台", "歌声"])).toBeGreaterThan(similarityStrength(["舞台", "歌声"], ["舞台", "庭"]));
  });
  it("伏せた投稿・同一筆者・自分自身への線を返さず、上位の関連を返す", () => {
    const base = { id: "a", authorId: "one", terms: ["舞台"], veiled: false };
    const links = relatedPosts(base, [base, { ...base, id: "same" }, { ...base, id: "secret", authorId: "two", veiled: true }, { ...base, id: "b", authorId: "two" }]);
    expect(links).toEqual([{ postId: "b", strength: 1 }]);
    expect(relatedPosts({ ...base, veiled: true }, [{ ...base, id: "b", authorId: "two" }])).toEqual([]);
  });
  it("点を選ぶたびに隣接先が広がり、既存の点を保持して上限を守る", () => {
    const nodes = [{ id: "a", related: [{ postId: "b", strength: 1 }] }, { id: "b", related: [{ postId: "c", strength: .5 }] }, { id: "c", related: [] }];
    expect(expandGraph([], "a", nodes)).toEqual(["a", "b"]);
    expect(expandGraph(["a", "b"], "b", nodes)).toEqual(["a", "b", "c"]);
    expect(expandGraph(["a", "b"], "b", nodes, 2)).toEqual(["a", "b"]);
    expect(expandGraph(["deleted", "a"], "a", nodes)).toEqual(["a", "b"]);
  });
  it("中心は原点で、強い近傍を近く配置し、孤立点も有限の座標を持つ", () => {
    const layout = layoutGraph(["a", "b", "c"], "a", [{ source: "a", target: "b", strength: .9 }, { source: "a", target: "c", strength: .2 }]);
    expect(layout[0]).toMatchObject({ id: "a", x: 0, y: 0 });
    expect(Math.hypot(layout[1].x, layout[1].y)).toBeLessThan(Math.hypot(layout[2].x, layout[2].y));
    expect(layoutGraph(["a"], "a", [])).toEqual([{ id: "a", x: 0, y: 0 }]);
  });
});
