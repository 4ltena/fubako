import type { Metadata, Viewport } from "next";
import { M_PLUS_1_Code, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

// 「白い箱」。字は Zen Kaku Gothic New 一種、時刻だけ M PLUS 1 Code。
// next/font が自前で配るので外部への font リクエストは出ない。
const label = Zen_Kaku_Gothic_New({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-zen-kaku", display: "swap" });
const mono = M_PLUS_1_Code({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mplus-code", display: "swap" });

// OGP は出さない。外部に本文も存在も漏らさない。
export const metadata: Metadata = {
  title: "ふばこ",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "ふばこ" },
};

export const viewport: Viewport = {
  themeColor: "#fbfbfa",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`h-full antialiased ${label.variable} ${mono.variable}`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
