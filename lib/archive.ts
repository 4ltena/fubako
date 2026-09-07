/** 自分の箱で使う年月とカーソル。保存日時そのものは UTC のまま扱う。 */
export const ARCHIVE_PAGE_SIZE = 30;

export type ArchiveCursor = { createdAt: Date; id: string };
export type ArchiveDirection = "older" | "newer";

const MONTH = /^(\d{4})-(\d{2})$/;

/** URL の年月を JST の月として受け付ける。存在しない月は選ばせない。 */
export function archiveMonth(value: string | undefined): string | null {
  if (!value) return null;
  const match = MONTH.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? value : null;
}

/** 同じ createdAt の紙も飛ばさないよう、ID と組にして URL に入れる。 */
export function encodeArchiveCursor(cursor: ArchiveCursor): string {
  return Buffer.from(JSON.stringify({ at: cursor.createdAt.toISOString(), id: cursor.id }), "utf8").toString("base64url");
}

/** 壊れた URL は先頭ページとして扱い、DB の検索条件には渡さない。 */
export function decodeArchiveCursor(value: string | undefined): ArchiveCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { at?: unknown; id?: unknown };
    const createdAt = typeof parsed.at === "string" ? new Date(parsed.at) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime()) || typeof parsed.id !== "string" || parsed.id.length === 0) return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

/** 降順 (createdAt, id) の次ページだけを取る条件。 */
export function archiveDirection(value: string | undefined): ArchiveDirection {
  return value === "newer" ? "newer" : "older";
}

/** 降順の「前」と昇順の「次」を同じキーで比べる。 */
export function archiveCursorWhere(cursor: ArchiveCursor | null, direction: ArchiveDirection) {
  if (!cursor) return {};
  const comparator = direction === "newer" ? "gt" : "lt";
  return {
    OR: [
      { createdAt: { [comparator]: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { [comparator]: cursor.id } },
    ],
  };
}
