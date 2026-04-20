"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/records", label: "日报录入" },
  { href: "/records/history", label: "日报列表" },
  { href: "/analysis", label: "日报分析" },
  { href: "/reports", label: "周月报表" },
  { href: "/projects", label: "项目判断" }
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`navLink${pathname === link.href ? " active" : ""}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
