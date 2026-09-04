"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 下の帯。いま / じぶんの箱 / 宣言 の丸い帯と、右に墨色の丸い「投げる」。
 * 白へのグラデーションで投稿を隠さない。
 */
export function BottomBar() {
  const path = usePathname();
  const circleId = path.match(/^\/c\/([^/]+)/)?.[1];
  const writing = path.endsWith("/new");
  const items = [
    { href: "/", label: "いま", active: path === "/" || (circleId !== undefined && !writing) },
    { href: "/archive", label: "じぶんの箱", active: path === "/archive" },
    { href: "/settings/mutes", label: "宣言", active: path.startsWith("/settings") },
  ];
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-paper via-paper/90 to-transparent px-5 pb-6 pt-10">
      <div className="label pointer-events-auto mx-auto flex max-w-[600px] items-center gap-1.5">
        <div className="flex flex-1 items-center gap-1 rounded-full bg-paper-2 p-1 text-xs">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`flex-1 rounded-full py-3 text-center ${i.active ? "bg-ink text-paper" : "text-ink-dim"}`}
            >
              {i.label}
            </Link>
          ))}
        </div>
        {circleId !== undefined && !writing && (
          <Link href={`/c/${circleId}/new`} aria-label="投げる" className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-ink text-[13px] tracking-[0.1em] text-paper">
            投げる
          </Link>
        )}
      </div>
    </nav>
  );
}
