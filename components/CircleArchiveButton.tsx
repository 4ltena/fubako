export function CircleArchiveButton({ circleId, archived }: { circleId: string; archived: boolean }) {
  return (
    <form method="post" action="/api/circles/archive">
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
      <button className="label min-h-11 rounded-full border border-line-2 px-4 py-2 text-[11px] text-ink-dim">
        {archived ? "しまった箱を戻す" : "この箱をしまう"}
      </button>
    </form>
  );
}
