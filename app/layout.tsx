import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Golf Secretary | 골프 라운드 기록",
  description: "라운드와 샷 기록을 저장하고 내 플레이를 분석하는 골프 플랫폼",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
