"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RedirectClient({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);
  return <p className="hint">正在跳转…</p>;
}
