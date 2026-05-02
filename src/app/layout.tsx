import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getSiteOrigin } from "@/lib/site-url";
import NavLinks from "./nav-links";

const defaultDescription =
  "经纪人后台与私人助理：日报录入、分析洞察、周期报表与项目归类建议。";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: { default: "MyBroker 智能工作台", template: "%s · MyBroker" },
  description: defaultDescription,
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "MyBroker",
    title: "MyBroker 智能工作台",
    description: defaultDescription,
  },
  twitter: {
    card: "summary",
    title: "MyBroker 智能工作台",
    description: defaultDescription,
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="layout">
          <div className="hero">
            <h1>MyBroker 智能工作台</h1>
            <p>统一录入日报、生成分析洞察、查看周期报表与项目归类建议，提升日常经营管理效率。</p>
            <NavLinks />
          </div>
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
