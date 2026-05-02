"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getJson } from "@/lib/api";
import { daysAgoLocalYmd, todayLocalYmd } from "@/lib/local-date";

type Overview = {
  start_date: string;
  end_date: string;
  total_records: number;
  distinct_days: number;
  tags_top: Record<string, number>;
};

type Trends = {
  days: number;
  window_start: string;
  window_end: string;
  total_records: number;
  by_date: { date: string; record_count: number }[];
  by_week_start: { week_start_monday: string; record_count: number }[];
};

type DailyReport = {
  report_date: string;
  total_records: number;
  records: unknown[];
};

export default function DashboardPage() {
  const [startDate, setStartDate] = useState(() => daysAgoLocalYmd(30));
  const [endDate, setEndDate] = useState(() => todayLocalYmd());
  const [trendDays, setTrendDays] = useState(30);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [todayBrief, setTodayBrief] = useState<DailyReport | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setError("");
    const data = await getJson<Overview>(
      `/api/v2/dashboard/overview?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
    );
    setOverview(data);
  }, [startDate, endDate]);

  const loadTrends = useCallback(async () => {
    setError("");
    const data = await getJson<Trends>(`/api/v2/dashboard/trends?days=${trendDays}`);
    setTrends(data);
  }, [trendDays]);

  const loadToday = useCallback(async () => {
    const today = todayLocalYmd();
    try {
      const data = await getJson<DailyReport>(`/api/v2/reports/daily?report_date=${encodeURIComponent(today)}`);
      setTodayBrief(data);
    } catch {
      setTodayBrief(null);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    const errs: string[] = [];
    try {
      await loadOverview();
    } catch (e) {
      errs.push(`区间总览: ${String(e)}`);
      setOverview(null);
    }
    try {
      await loadTrends();
    } catch (e) {
      errs.push(`趋势: ${String(e)}`);
      setTrends(null);
    }
    await loadToday();
    if (errs.length) {
      setError(errs.join("\n"));
    }
    setLoading(false);
  }, [loadOverview, loadTrends, loadToday]);

  useEffect(() => {
    refreshAll().catch(() => undefined);
  }, [refreshAll]);

  const maxCount = useMemo(() => {
    if (!trends?.by_date.length) {
      return 1;
    }
    return Math.max(1, ...trends.by_date.map((d) => d.record_count));
  }, [trends]);

  const tagEntries = useMemo(() => {
    if (!overview?.tags_top) {
      return [];
    }
    return Object.entries(overview.tags_top);
  }, [overview]);

  const exportCsvHref = useMemo(
    () =>
      `/api/v2/records/export?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&format=csv`,
    [startDate, endDate],
  );

  return (
    <>
      <header className="pageHeader">
        <h2>数据看板</h2>
        <p>按日期区间统计日报量与标签，并查看近 N 天每日条数与按周汇总（数据来自已保存的日报）。</p>
      </header>

      <section className="card">
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="dash-start">区间起</label>
            <input
              id="dash-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="field">
            <label htmlFor="dash-end">区间止</label>
            <input
              id="dash-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="field">
            <label htmlFor="trend-days">趋势天数</label>
            <select
              id="trend-days"
              value={trendDays}
              onChange={(e) => setTrendDays(Number(e.target.value))}
              disabled={loading}
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  最近 {d} 天
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btnPrimary" onClick={() => void refreshAll()} disabled={loading}>
            {loading ? "加载中…" : "刷新"}
          </button>
          <a className="btnSecondary exportLink" href={exportCsvHref} target="_blank" rel="noreferrer">
            导出 CSV（当前区间）
          </a>
        </div>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card">
        <h3 className="sectionTitle">今日日报快照</h3>
        <div className="hint">
          {todayBrief
            ? `今日 ${todayBrief.report_date} 共 ${todayBrief.total_records} 条记录。`
            : "暂无今日日报或未加载。"}
        </div>
      </section>

      <section className="card">
        <h3 className="sectionTitle">区间总览</h3>
        {overview ? (
          <>
            <div className="metricRow">
              <div className="metric">
                <span className="metricVal">{overview.total_records}</span>
                <span className="metricLabel">日报条数</span>
              </div>
              <div className="metric">
                <span className="metricVal">{overview.distinct_days}</span>
                <span className="metricLabel">有记录天数</span>
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <span className="mutedLabel">标签 Top（区间内出现次数）</span>
              <div className="tagRow" style={{ marginTop: 8 }}>
                {tagEntries.length ? (
                  tagEntries.map(([name, n]) => (
                    <span key={name} className="tag">
                      {name} · {n}
                    </span>
                  ))
                ) : (
                  <span className="hint">暂无标签</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <pre>{loading ? "加载中…" : "暂无数据"}</pre>
        )}
      </section>

      <section className="card">
        <h3 className="sectionTitle">
          每日条数（{trends?.window_start ?? "—"} ~ {trends?.window_end ?? "—"}）
        </h3>
        {trends?.by_date?.length ? (
          <div className="trendWrap" aria-label="每日日报条数趋势">
            <div className="trendBars">
              {trends.by_date.map((row) => (
                <div key={row.date} className="trendCol" title={`${row.date}: ${row.record_count}`}>
                  <div
                    className="trendBar"
                    style={{ height: `${Math.max(8, (row.record_count / maxCount) * 100)}%` }}
                  />
                  <span className="trendDay">{row.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <pre>{loading ? "加载中…" : "暂无趋势数据"}</pre>
        )}
      </section>

      <section className="card result">
        <h3 className="sectionTitle">按周汇总（周一为周起始）</h3>
        {!trends?.by_week_start?.length ? (
          <pre>{loading ? "加载中…" : "暂无"}</pre>
        ) : (
          <ul className="weekList">
            {trends.by_week_start.map((w) => (
              <li key={w.week_start_monday}>
                <strong>{w.week_start_monday}</strong> 起一周：<span>{w.record_count}</span> 条
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
