export function CircleInviteControls({ circleId, enabled, inviteCode }: { circleId: string; enabled: boolean; inviteCode: string }) {
  return (
    <section className="space-y-3 border-t border-line pt-4">
      <p className="label text-[11px] text-ink-faint">招待</p>
      {enabled ? <p className="select-all text-[15px] tracking-[0.16em] text-ink">{inviteCode}</p> : <p className="text-[13px] text-ink-dim">招待は停止中です。</p>}
      <div className="flex flex-wrap gap-2">
        {enabled && (
          <form method="post" action="/api/circles/invites">
            <input type="hidden" name="circleId" value={circleId} />
            <input type="hidden" name="action" value="disable" />
            <button className="label min-h-11 rounded-full border border-line-2 px-4 py-2 text-[11px] text-ink-dim">招待を停止する</button>
          </form>
        )}
        <form method="post" action="/api/circles/invites">
          <input type="hidden" name="circleId" value={circleId} />
          <input type="hidden" name="action" value="regenerate" />
          <button className="label min-h-11 rounded-full border border-line-2 px-4 py-2 text-[11px] text-ink-dim">新しい言葉を発行する</button>
        </form>
      </div>
      <p className="text-[12px] leading-6 text-ink-faint">新しい言葉を発行すると、前の言葉は使えなくなります。</p>
    </section>
  );
}
