import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "页面未找到",
};

export default function NotFound() {
  return (
    <>
      <div className="pageHeader">
        <h2>页面未找到</h2>
        <p>路径不存在或已调整。</p>
      </div>
      <p className="mutedLinks">
        <Link href="/dashboard">数据看板</Link>
        {" · "}
        <Link href="/records">日报录入</Link>
        {" · "}
        <Link href="/">首页</Link>
      </p>
    </>
  );
}
