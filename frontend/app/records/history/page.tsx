"use client";

import { useEffect, useMemo, useState } from "react";
import { getJson } from "../../../lib/api";

type HistoryRecord = {
  id: number;
  date: string;
  summary: string;
  tags: string[];
};

type DashboardResponse = {
  days: number;
  total_records: number;
  latest_records: HistoryRecord[];
};

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export default function RecordsHistoryPage() {
  const [days, setDays] = useState(30);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const hasRecords = useMemo(() => records.length > 0, [records]);

  const loadHistory = async (targetDays: number) => {
    setError("");
    setIsLoading(true);
    try {
      const data = await getJson<DashboardResponse>(`/api/v2/dashboard?days=${targetDays}`);
      setRecords(data.latest_records ?? []);
      setTotalRecords(data.total_records ?? 0);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(days).catch((err) => setError(String(err)));
  }, [days]);

  return (
    <>
      <header className="pageHeader">
        <h2>历史日报列表</h2>
        <p>按最近天数查看历史日报摘要，快速回顾工作进展与关键标签。</p>
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
                  最近 {item} 天
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btnPrimary" onClick={() => loadHistory(days)} disabled={isLoading}>
            {isLoading ? "加载中..." : "刷新列表"}
          </button>
        </div>
        <div className="hint">当前记录数：{totalRecords}</div>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card result">
        <h3>历史日报</h3>
        {!hasRecords ? (
          <pre>{isLoading ? "正在加载历史日报..." : "暂无历史日报数据"}</pre>
        ) : (
          <div className="list">
            {records.map((item) => (
              <article key={item.id} className="listItem">
                <div className="listItemHead">
                  <strong>{item.date}</strong>
                  <span className="badge">#{item.id}</span>
                </div>
                <p>{item.summary || "暂无摘要"}</p>
                <div className="tagRow">
                  {(item.tags || []).length > 0 ? (
                    item.tags.map((tag) => (
                      <span key={`${item.id}-${tag}`} className="tag">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="hint">无标签</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
