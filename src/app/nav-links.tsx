"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/records", label: "日报录入" },
  { href: "/records/history", label: "日报列表" },
  { href: "/dashboard", label: "数据看板" },
  { href: "/action-items", label: "待办" },
  { href: "/notifications", label: "每日推送" },
  { href: "/analysis", label: "日报分析" },
  { href: "/reports", label: "周月报表" },
  { href: "/projects", label: "项目判断" },
];

/** 最长路径优先，避免 `/records` 抢走 `/records/history` 的高亮 */
function resolveActiveHref(pathname: string): string | null {
  const sorted = [...links].sort((a, b) => b.href.length - a.href.length);
  return (
    sorted.find((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))?.href ?? null
  );
}

export default function NavLinks() {
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname);

  return (
    <nav className="nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`navLink${link.href === activeHref ? " active" : ""}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
