import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { archiveCursorWhere, type ArchiveCursor } from "@/lib/archive";
import { prisma } from "@/lib/db";
import { exportHeading, exportRecord } from "@/lib/export-records";
import { jstMonthRange } from "@/lib/stamp";

export const dynamic = "force-dynamic";

/** 月内の自分の記録だけを、100件ずつ読み出す。 */
export async function GET(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const month = new URL(req.url).searchParams.get("month") ?? "";
  const range = jstMonthRange(month);
  if (!range) return NextResponse.json({ error: "month" }, { status: 400 });
  const cutoff = new Date();
  const readBatch = (cursor: ArchiveCursor | null) => prisma.post.findMany({
    where: {
      authorId: userId,
      deletedAt: null,
      createdAt: { gte: range.start, lt: range.end, lte: cutoff },
      ...archiveCursorWhere(cursor, "older"),
    },
    select: { id: true, body: true, cw: true, tags: true, afterword: true, createdAt: true, expiresAt: true, visibility: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  let first;
  try { first = await readBatch(null); }
  catch {
    return NextResponse.json({ error: "export unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
  async function* textChunks() {
    yield exportHeading(month);
    let batch = first!;
    for (;;) {
      for (const post of batch) yield exportRecord(post, cutoff);
      if (batch.length < 100) return;
      const last = batch[batch.length - 1];
      batch = await readBatch({ createdAt: last.createdAt, id: last.id });
    }
  }
  const iterator = textChunks();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch {
        // ファイル全体の受信に失敗させ、クライアントが未完成の記録を保存しないようにする。
        controller.error(new Error("書き出しを完了できませんでした。"));
      }
    },
    async cancel() { await iterator.return(); },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="fubako-${month}.txt"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
