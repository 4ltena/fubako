import type { Metadata, Viewport } from "next";
import { Noto_Serif_JP, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

// 本文は明朝、ラベルはゴシック（デザイン案の指定）。next/font が自前で配るので
// 外部への font リクエストは出ない。
const serif = Noto_Serif_JP({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-noto-serif-jp", display: "swap" });
const label = Zen_Kaku_Gothic_New({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-zen-kaku", display: "swap" });

// OGP は出さない。外部に本文も存在も漏らさない。
export const metadata: Metadata = {
  title: "ふばこ",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "ふばこ" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5ead8" },
    { media: "(prefers-color-scheme: dark)", color: "#2a231d" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`h-full antialiased ${serif.variable} ${label.variable}`}>
      <body className="min-h-full flex flex-col text-ink">{children}</body>
    </html>
  );
}
