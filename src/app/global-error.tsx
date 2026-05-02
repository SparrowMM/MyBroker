"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const detail =
    process.env.NODE_ENV === "development"
      ? error.message || String(error)
      : "根布局或全局资源出现异常，请刷新页面或稍后重试。";

  return (
    <html lang="zh-CN">
      <body>
        <div className="layout">
          <main className="page errorPanel">
            <div className="pageHeader">
              <h2>应用异常</h2>
              <p>{detail}</p>
            </div>
            <div className="tightActions">
              <button type="button" className="btnPrimary" onClick={() => reset()}>
                重试
              </button>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
