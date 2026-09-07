import { describe, expect, it } from "vitest";
import { isCircleAction, mayLeaveCircle, memberNames } from "./circles";

describe("サークル管理の規則", () => {
  it("管理者は他の会員がいる間は引き継ぎなしで出られない", () => {
    expect(mayLeaveCircle(true, 2)).toBe(false);
    expect(mayLeaveCircle(true, 1)).toBe(true);
    expect(mayLeaveCircle(false, 12)).toBe(true);
  });

  it("参加者一覧には識別に必要な名前とIDだけを整える", () => {
    expect(memberNames([{ userId: "u1", user: { name: " りん " } }, { userId: "u2", user: { name: null } }])).toEqual([
      { id: "u1", name: "りん" },
      { id: "u2", name: "名前のない人" },
    ]);
  });

  it("管理操作を固定する", () => {
    expect(isCircleAction("revoke")).toBe(true);
    expect(isCircleAction("delete")).toBe(false);
  });
});
