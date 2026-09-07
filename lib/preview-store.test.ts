import { afterEach, describe, expect, it } from "vitest";
import { getPreviewState, previewFetch, resetPreview, timelineForPreview } from "@/preview/store";
import { jstMonth } from "@/lib/stamp";

afterEach(() => resetPreview());

describe("プレビュー用ストア", () => {
  it("メモリ内の操作だけを反映し、未知のAPIへは到達しない", async () => {
    const before = getPreviewState().posts.length;
    const fd = new FormData();
    fd.set("circleId", "preview-room");
    fd.set("body", "確認用の紙");
    fd.set("tags", "確認");
    fd.set("days", "7");
    fd.set("clientRequestId", "local-retry-1");
    await expect(previewFetch("/api/posts", { method: "POST", body: fd })).resolves.toMatchObject({ status: 200 });
    await previewFetch("/api/posts", { method: "POST", body: fd });
    expect(getPreviewState().posts).toHaveLength(before + 1);
    await expect(previewFetch("/api/not-real")).resolves.toMatchObject({ status: 404 });
  });

  it("伏せ判定は実際のveilForを通し、後書きと非表示語をタイムラインへ出さない", async () => {
    const timeline = timelineForPreview("preview-room");
    expect(timeline.find((post) => post.id === "preview-other-muted")).toMatchObject({ veiled: true, kind: "mute" });
    expect(timeline.find((post) => post.id === "preview-other-self-veiled")).toMatchObject({ veiled: true, kind: "self" });
    expect(JSON.stringify(timeline)).not.toContain("明日ももう一度聴こう");
    expect(JSON.stringify(timeline)).not.toContain("preview-mute-spoiler");
  });

  it("初期状態へ戻せる", async () => {
    await previewFetch("/api/me/digest", { method: "POST", body: JSON.stringify({ enabled: "false" }) });
    expect(getPreviewState().digestEnabled).toBe(false);
    resetPreview();
    expect(getPreviewState().digestEnabled).toBe(true);
    expect(getPreviewState().path).toBe("/c/preview-room");
  });

  it("招待を止めると参加できず、再発行で新しい言葉だけを使える", async () => {
    const original = getPreviewState().circles[0]!.inviteCode;
    await previewFetch("/api/circles/invites", { method: "POST", body: JSON.stringify({ circleId: "preview-room", action: "disable" }) });
    expect(getPreviewState().circles[0]!.invitesEnabled).toBe(false);
    await expect(previewFetch("/api/circles/join", { method: "POST", body: JSON.stringify({ inviteCode: original }) })).resolves.toMatchObject({ status: 404 });
    await previewFetch("/api/circles/invites", { method: "POST", body: JSON.stringify({ circleId: "preview-room", action: "regenerate" }) });
    const reissued = getPreviewState().circles[0]!.inviteCode;
    expect(reissued).not.toBe(original);
    await expect(previewFetch("/api/circles/join", { method: "POST", body: JSON.stringify({ inviteCode: original }) })).resolves.toMatchObject({ status: 404 });
    await expect(previewFetch("/api/circles/join", { method: "POST", body: JSON.stringify({ inviteCode: reissued }) })).resolves.toMatchObject({ status: 200 });
  });

  it("自分だけの保存は明示的に作られ、箱のタイムラインには出ない", async () => {
    const fd = new FormData();
    fd.set("circleId", "preview-room");
    fd.set("body", "自分だけの確認用の記録");
    fd.set("visibility", "private");
    fd.set("clientRequestId", "private-record-1");
    await expect(previewFetch("/api/posts", { method: "POST", body: fd })).resolves.toMatchObject({ status: 200 });
    const saved = getPreviewState().posts.find((post) => post.id === "request-private-record-1");
    expect(saved).toMatchObject({ visibility: "private" });
    expect(timelineForPreview("preview-room").map((post) => post.id)).not.toContain("request-private-record-1");
  });

  it("箱ごとの話題語と説明、本人の月別書き出しを扱う", async () => {
    await expect(previewFetch("/api/me/topic-mutes", { method: "POST", body: JSON.stringify({ circleId: "preview-room", word: "衣装" }) })).resolves.toMatchObject({ status: 200 });
    expect(timelineForPreview("preview-room").find((post) => post.id === "preview-other-open")).toMatchObject({ veiled: true, kind: "mute" });
    await expect(previewFetch("/api/circles/preview-room/description", { method: "PUT", body: JSON.stringify({ description: "配信を聴いた夜のための箱" }) })).resolves.toMatchObject({ status: 200 });
    expect(getPreviewState().circles[0]!.description).toBe("配信を聴いた夜のための箱");

    const month = jstMonth(new Date(getPreviewState().posts.find((post) => post.id === "preview-mine-private")!.createdAt));
    const exported = await previewFetch(`/api/me/export?month=${month}`);
    const text = await exported.text();
    expect(exported.headers.get("content-disposition")).toContain("attachment");
    expect(text).toContain("自分だけに表示");
    expect(text).toContain("まだ誰にも見せず");
    expect(text).not.toContain("他人の後書き");
    expect(text).not.toContain("preview-image-1");
  });
});
