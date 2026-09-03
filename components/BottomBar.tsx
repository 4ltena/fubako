"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 下の帯。いま / じぶんの箱 / 宣言 と、書く。
 * サークルを見ているときだけ右端に「書く」を出し、本文に重ならないようにする。
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
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-5 pb-6">
      <div className="label pointer-events-auto mx-auto flex max-w-md items-center gap-1.5 rounded-full bg-card p-2 text-xs shadow-lift">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex-1 rounded-full py-3.5 text-center ${i.active ? "bg-accent-pale text-accent-deep" : "text-ink-soft"}`}
          >
            {i.label}
          </Link>
        ))}
        {circleId !== undefined && !writing && (
          <Link href={`/c/${circleId}/new`} className="shrink-0 rounded-full bg-accent px-5 py-3.5 tracking-[0.2em] text-card">書く</Link>
        )}
      </div>
    </nav>
  );
}
