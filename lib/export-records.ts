/** 自分の記録をテキストへ整形する。画像や反応などの関連情報は受け取らない。 */
export type ExportRecord = {
  body: string;
  cw: string | null;
  tags: string[];
  afterword: string;
  createdAt: Date;
  expiresAt: Date;
  visibility: "circle" | "private";
};

export function exportHeading(month: string): string {
  return `ふばこ — ${month} のじぶんの記録\n日時は日本時間です。画像は含まれません。\n\n`;
}

export function exportRecord(post: ExportRecord, at: Date): string {
  const date = new Date(post.createdAt.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ");
  const state = post.visibility === "circle" && post.expiresAt > at ? "箱で公開中" : "自分だけに表示";
  return [
    "────────────────────",
    `${date}（日本時間）　${state}`,
    ...(post.cw ? [`注意文：${post.cw}`] : []),
    "", post.body,
    ...(post.tags.length ? ["", `タグ：${post.tags.join("、")}`] : []),
    ...(post.afterword ? ["", "後書き（自分だけ）", post.afterword] : []),
    "", "",
  ].join("\n");
}
