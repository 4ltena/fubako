"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 広い画面の左の列（デザイン案 1e）。箱の一覧と、じぶんの箱・宣言・たより。
 * 新着の点も件数も付けない（README「数えない・急かさない」）。
 */
export function SideRail({ circles }: { circles: { id: string; name: string }[] }) {
  const path = usePathname();
  const here = path.match(/^\/c\/([^/]+)/)?.[1];
  const item = (active: boolean) =>
    `overflow-hidden break-all rounded-full px-5 py-3.5 text-sm tracking-[0.1em] ${active ? "bg-card text-ink shadow-paper" : "text-ink-faint"}`;
  return (
    <nav className="hidden w-[264px] shrink-0 flex-col gap-[30px] px-6 py-10 lg:flex">
      <Link href="/" className="label text-[11px] tracking-[0.24em] text-ink-soft">ふばこ</Link>

      <div className="flex flex-col gap-1.5">
        {circles.map((c) => (
          <Link key={c.id} href={`/c/${c.id}`} className={item(here === c.id)}>{c.name}</Link>
        ))}
        {circles.length === 0 && <span className="px-5 text-sm text-ink-pale">まだどこにも入っていません</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Link href="/archive" className={item(path === "/archive")}>じぶんの箱</Link>
        <Link href="/settings/mutes" className={item(path.startsWith("/settings"))}>地雷宣言</Link>
      </div>

      {here && (
        <Link
          href={`/c/${here}/new`}
          className="label mt-auto rounded-full bg-accent px-6 py-4 text-center text-xs tracking-[0.3em] text-card shadow-lift"
        >
          投げる
        </Link>
      )}
    </nav>
  );
}
