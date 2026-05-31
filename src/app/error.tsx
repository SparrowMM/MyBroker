"use client";

import { useEffect } from "react";

export default function Error({
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
      : "页面出现异常，请稍后重试。";

  return (
    <div className="errorPanel">
      <div className="pageHeader">
        <h2>出错了</h2>
        <p>{detail}</p>
      </div>
      <div className="tightActions">
        <button type="button" className="btnPrimary" onClick={() => reset()}>
          重试
        </button>
      </div>
    </div>
  );
}
