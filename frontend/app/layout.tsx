import "./globals.css";
import type { ReactNode } from "react";
import NavLinks from "./nav-links";

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
