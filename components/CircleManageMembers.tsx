type Person = { id: string; name: string };

export function CircleManageMembers({ circleId, members, bans, managerId }: { circleId: string; members: Person[]; bans: Person[]; managerId: string }) {
  return (
    <section className="space-y-4 border-t border-line pt-4">
      <p className="label text-[11px] text-ink-faint">参加者</p>
      <ul className="divide-y divide-line">
        {members.map((member) => (
          <li key={member.id} className="py-3">
            <p className="text-[15px] text-ink">{member.name}{member.id === managerId ? "（管理）" : ""}</p>
            {member.id !== managerId && (
              <div className="mt-2 flex flex-wrap gap-2">
                <MemberAction circleId={circleId} targetUserId={member.id} action="transfer" label="管理を引き継ぐ" />
                <MemberAction circleId={circleId} targetUserId={member.id} action="revoke" label="参加を取り消す" />
              </div>
            )}
          </li>
        ))}
      </ul>
      {bans.length > 0 && (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="label text-[11px] text-ink-faint">参加を取り消した人</p>
          {bans.map((person) => <div key={person.id} className="flex min-h-11 items-center justify-between gap-3 text-[13px] text-ink-dim"><span>{person.name}</span><MemberAction circleId={circleId} targetUserId={person.id} action="unban" label="もう一度招待できるようにする" /></div>)}
        </div>
      )}
    </section>
  );
}

function MemberAction({ circleId, targetUserId, action, label }: { circleId: string; targetUserId: string; action: "revoke" | "unban" | "transfer"; label: string }) {
  return <form method="post" action={`/api/circles/${circleId}/members`}><input type="hidden" name="action" value={action} /><input type="hidden" name="targetUserId" value={targetUserId} /><button className="label min-h-11 rounded-full border border-line-2 px-3 py-2 text-[10px] text-ink-dim">{label}</button></form>;
}
