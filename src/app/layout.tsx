import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getSiteOrigin } from "@/lib/site-url";
import NavLinks from "./nav-links";

const defaultDescription =
  "个人工作记忆与 AI 经纪人：记录每天的事，排优先级、日终复盘与生活工作建议。";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: { default: "MyBroker", template: "%s · MyBroker" },
  description: defaultDescription,
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "MyBroker",
    title: "MyBroker",
    description: defaultDescription,
  },
  twitter: {
    card: "summary",
    title: "MyBroker",
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
            <h1>MyBroker</h1>
            <p>记下每天的事（文字或截图），由经纪人帮你排优先级、做日终复盘，并给出生活与工作建议。</p>
            <NavLinks />
          </div>
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
