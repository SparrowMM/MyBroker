"use client";

import { useEffect, useState } from "react";
import { todayLocalYmd } from "@/lib/local-date";

/** 随本地日历日更新（跨日、切回标签页时同步），避免「今天」页仍停留在昨天 */
export function useTodayYmd(): string {
  const [today, setToday] = useState(() => todayLocalYmd());

  useEffect(() => {
    const sync = () => {
      const next = todayLocalYmd();
      setToday((prev) => (prev === next ? prev : next));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    const timer = window.setInterval(sync, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
      window.clearInterval(timer);
    };
  }, []);

  return today;
}
