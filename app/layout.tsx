import type { Metadata, Viewport } from "next";
import "./globals.css";

// OGP は出さない。外部に本文も存在も漏らさない。
export const metadata: Metadata = {
  title: "ふばこ",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "ふばこ" },
};

export const viewport: Viewport = { themeColor: "#f6f3ee", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
