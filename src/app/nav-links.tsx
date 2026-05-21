"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/today", label: "今天" },
  { href: "/history", label: "历史" },
  { href: "/settings", label: "设置" },
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
