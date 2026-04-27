"use client";

import { useEffect, useMemo, useState } from "react";
import { getJson } from "../../../lib/api";

type HistoryRecord = {
  id: number;
  record_date: string;
  raw_text: string;
  chat_text: string;
  screenshot_notes: string;
  analysis_summary: string;
  tags: string[];
  screenshot_paths: string[];
};

type DashboardResponse = {
  days: number;
  total_records: number;
  records: HistoryRecord[];
};

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export default function RecordsHistoryPage() {
  const [days, setDays] = useState(30);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const groupedRecords = useMemo(() => {
    const groups: Record<string, HistoryRecord[]> = {};
    for (const item of records) {
      const key = item.record_date;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }
    return groups;
  }, [records]);

  const groupedDates = useMemo(() => Object.keys(groupedRecords), [groupedRecords]);
  const hasRecords = useMemo(() => groupedDates.length > 0, [groupedDates]);

  const loadHistory = async (targetDays: number) => {
    setError("");
    setIsLoading(true);
    try {
      const data = await getJson<DashboardResponse>(`/api/v2/records?days=${targetDays}`);
      setRecords(data.records ?? []);
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
        <p>按每日存储格式展示历史日报，包含原始内容、AI 标准内容与分析信息。</p>
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
            {groupedDates.map((recordDate) => (
              <article key={recordDate} className="listItem">
                <div className="listItemHead">
                  <strong>{recordDate}</strong>
                  <span className="badge">{groupedRecords[recordDate].length} 条</span>
                </div>
                <div className="list">
                  {groupedRecords[recordDate].map((item) => (
                    <div key={item.id} className="recordBlock">
                      <div className="listItemHead">
                        <strong>记录 #{item.id}</strong>
                      </div>
                      <p>
                        <strong>分析摘要：</strong>
                        {item.analysis_summary || "暂无摘要"}
                      </p>
                      <p>
                        <strong>原始内容：</strong>
                        {item.raw_text || "待补充"}
                      </p>
                      <p>
                        <strong>AI 标准内容：</strong>
                        {item.chat_text || "待补充"}
                      </p>
                      <p>
                        <strong>补充备注：</strong>
                        {item.screenshot_notes || "无"}
                      </p>
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
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
