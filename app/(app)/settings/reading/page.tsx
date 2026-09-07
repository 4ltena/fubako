import Link from "next/link";
import { ReadingPreferences } from "@/components/ReadingPreferences";

export default function ReadingPage() {
  return <div><ReadingPreferences /><Link href="/settings/mutes" className="label mt-7 flex min-h-11 items-center px-1 text-[12px] text-ink-dim underline underline-offset-4">見たくない語へ</Link></div>;
}
