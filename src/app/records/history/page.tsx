"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getJson } from "@/lib/api";
import { rangeLastNDaysLocal } from "@/lib/local-date";
import { RecordCard } from "../_components/record-card";
import type { DailyRecordDto } from "../_components/types";

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export default function RecordsHistoryPage() {
  const [days, setDays] = useState(30);
  const [keyword, setKeyword] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [records, setRecords] = useState<DailyRecordDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const exportCsvHref = useMemo(() => {
    const { start, end } = rangeLastNDaysLocal(days);
    return `/api/v2/records/export?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&format=csv`;
  }, [days]);

  const loadHistory = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const { start, end } = rangeLastNDaysLocal(days);
      const qs = new URLSearchParams({ start_date: start, end_date: end, limit: "2000" });
      const rows = await getJson<DailyRecordDto[]>(`/api/v2/records?${qs.toString()}`);
      setRecords(rows);
    } catch (err) {
      setError(String(err));
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadHistory().catch(() => undefined);
  }, [loadHistory]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) {
      for (const t of r.tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [records]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return records.filter((r) => {
      if (tagFilter && !r.tags.includes(tagFilter)) return false;
      if (!kw) return true;
      return (
        r.analysis_summary.toLowerCase().includes(kw) ||
        r.raw_text.toLowerCase().includes(kw) ||
        r.chat_text.toLowerCase().includes(kw) ||
        r.screenshot_notes.toLowerCase().includes(kw) ||
        String(r.id).includes(kw) ||
        r.record_date.includes(kw)
      );
    });
  }, [records, keyword, tagFilter]);

  /** 按 YYYY-MM 分组 */
  const grouped = useMemo(() => {
    const map = new Map<string, DailyRecordDto[]>();
    for (const r of filtered) {
      const month = r.record_date.slice(0, 7);
      const arr = map.get(month) ?? [];
      arr.push(r);
      map.set(month, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const handleChange = (record: DailyRecordDto) => {
    setRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)));
  };

  const handleDelete = (id: number) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <>
      <header className="pageHeader">
        <h2>日报列表</h2>
        <p>
          按区间查询全部日报，支持<strong>关键词搜索</strong>、<strong>标签筛选</strong>，并可
          <strong>就地编辑、重新分析、删除</strong>。新建请回到 <Link href="/records" className="inlineLink">日报工作台</Link>。
        </p>
      </header>

      <section className="card">
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="history-days">查询范围</label>
            <select
              id="history-days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              disabled={isLoading}
            >
              {DAY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  最近 {item} 天（日历）
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="history-kw">关键词</label>
            <input
              id="history-kw"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="日期 / 摘要 / 内容 / #ID"
            />
          </div>
          <div className="field">
            <label htmlFor="history-tag">标签筛选</label>
            <select
              id="history-tag"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              disabled={!allTags.length}
            >
              <option value="">全部标签</option>
              {allTags.map(([tag, n]) => (
                <option key={tag} value={tag}>
                  {tag}（{n}）
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btnPrimary" onClick={() => void loadHistory()} disabled={isLoading}>
            {isLoading ? "加载中..." : "刷新"}
          </button>
          <a className="btnSecondary exportLink" href={exportCsvHref} target="_blank" rel="noreferrer">
            导出 CSV（最近 {days} 天）
          </a>
          {(keyword || tagFilter) && (
            <button
              type="button"
              className="btnSecondary"
              onClick={() => {
                setKeyword("");
                setTagFilter("");
              }}
            >
              清除筛选
            </button>
          )}
        </div>
        <div className="hint">
          区间内共 {records.length} 条；当前筛选后 {filtered.length} 条
          {(keyword || tagFilter) && "（已应用筛选）"}。
        </div>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card">
        {filtered.length === 0 ? (
          <div className="emptyState">
            <p className="emptyStateTitle">
              {isLoading ? "正在加载..." : records.length === 0 ? "区间内暂无日报" : "没有匹配的日报"}
            </p>
            {!isLoading && records.length > 0 && (
              <p className="hint">尝试调整关键词或清除筛选。</p>
            )}
          </div>
        ) : (
          <div className="historyGroups">
            {grouped.map(([month, items]) => (
              <div key={month} className="historyGroup">
                <div className="historyGroupHead">
                  <strong>{month}</strong>
                  <span className="hint">{items.length} 条</span>
                </div>
                <div className="recordList">
                  {items.map((r) => (
                    <RecordCard
                      key={r.id}
                      record={r}
                      onChange={handleChange}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
