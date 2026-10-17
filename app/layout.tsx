import type { Metadata } from "next";
import Script from "next/script";
import AppShell from "@/components/layout/AppShell";
import ServiceWorkerRegister from "@/components/layout/ServiceWorkerRegister";
import { EARLY_ERROR_BUFFER_SCRIPT } from "@/components/layout/earlyErrorBuffer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Golf Secretary | 골프 라운드 기록",
    template: "%s | Golf Secretary",
  },
  description: "라운드와 샷 기록을 저장하고 내 플레이를 분석하는 골프 플랫폼",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegister />
        {/* 화면이 준비되기 전에 생긴 오류도 놓치지 않도록 가장 먼저 실행해 모아 둔다. */}
        <Script id="early-error-buffer" strategy="beforeInteractive">{EARLY_ERROR_BUFFER_SCRIPT}</Script>
      </body>
    </html>
  );
}
