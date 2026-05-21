"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getJson } from "@/lib/api";
import { daysAgoLocalYmd, todayLocalYmd } from "@/lib/local-date";
import type { DailyRecordDto } from "@/app/records/_components/types";
import type { BrokerDailyReview } from "@/lib/broker-types";

type DayGroup = {
  date: string;
  records: DailyRecordDto[];
};

type WeeklyReport = {
  summary: string;
  highlights: string[];
  risks: string[];
  suggestions: string[];
  start_date: string;
  end_date: string;
  total_records: number;
};

function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

export default function HistoryPage() {
  const [days, setDays] = useState(30);
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [expandedReview, setExpandedReview] = useState<Record<string, string>>({});
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [reviewLoadingDate, setReviewLoadingDate] = useState<string | null>(null);

  const startDate = useMemo(() => daysAgoLocalYmd(days - 1), [days]);
  const endDate = todayLocalYmd();

  const exportHref = `/api/v2/records/export?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&format=csv`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        limit: "500",
      });
      const rows = await getJson<DailyRecordDto[]>(`/api/v2/records?${qs.toString()}`);
      const map = new Map<string, DailyRecordDto[]>();
      for (const r of rows) {
        const list = map.get(r.record_date) ?? [];
        list.push(r);
        map.set(r.record_date, list);
      }
      const sorted = [...map.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([date, records]) => ({ date, records: records.sort((x, y) => y.id - x.id) }));
      setGroups(sorted);
    } catch (e) {
      setError(String(e));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const loadWeekly = async () => {
    setWeeklyLoading(true);
    setError("");
    try {
      const { year, week } = isoWeek(new Date());
      const data = await getJson<WeeklyReport>(`/api/v2/reports/weekly?year=${year}&week=${week}`);
      setWeekly(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setWeeklyLoading(false);
    }
  };

  const loadReviewForDay = async (date: string, refresh = false) => {
    setReviewLoadingDate(date);
    setError("");
    try {
      const path = refresh
        ? `/api/v2/broker/daily-review?date=${date}&refresh=1`
        : `/api/v2/broker/daily-review?date=${date}`;
      const res = await getJson<{ review: BrokerDailyReview }>(path);
      setExpandedReview((prev) => ({ ...prev, [date]: res.review.markdown }));
    } catch (e) {
      setError(String(e));
    } finally {
      setReviewLoadingDate(null);
    }
  };

  return (
    <>
      <header className="pageHeader">
        <h2>历史</h2>
        <p>按天查看记录与复盘；需要补记请去 <Link href="/today" className="inlineLink">今天</Link>。</p>
      </header>

      <section className="card">
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="hist-days">查看最近</label>
            <select id="hist-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} 天
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btnPrimary" onClick={() => void load()} disabled={loading}>
            {loading ? "加载中…" : "刷新列表"}
          </button>
          <button type="button" className="btnSecondary" onClick={() => void loadWeekly()} disabled={weeklyLoading}>
            {weeklyLoading ? "生成中…" : "本周小结"}
          </button>
          <a className="btnSecondary exportLink" href={exportHref} target="_blank" rel="noreferrer">
            导出 CSV
          </a>
        </div>
        {error && <div className="error">{error}</div>}
      </section>

      {weekly && (
        <section className="card brokerCard">
          <h3 className="sectionTitle">
            本周小结（{weekly.start_date} ~ {weekly.end_date}，{weekly.total_records} 条记录）
          </h3>
          <p>{weekly.summary}</p>
          <ul className="bulletList">
            {weekly.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <p className="mutedLabel">风险</p>
          <ul className="bulletList">
            {weekly.risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mutedLabel">建议</p>
          <ul className="bulletList">
            {weekly.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {!groups.length ? (
        <section className="card">
          <p className="hint">{loading ? "加载中…" : "该时间范围内暂无记录。"}</p>
        </section>
      ) : (
        groups.map((g) => (
          <section key={g.date} className="card dayHistoryCard">
            <div className="cardHead">
              <h3 className="sectionTitle">{g.date}</h3>
              <span className="badge">{g.records.length} 条</span>
            </div>
            <ul className="historyRecordList">
              {g.records.map((r) => (
                <li key={r.id}>
                  <p className="historySummary">{r.analysis_summary || r.raw_text.slice(0, 160)}</p>
                  {r.tags.length > 0 && (
                    <div className="tagRow">
                      {r.tags.map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {expandedReview[g.date] ? (
              <pre className="reviewMarkdown">{expandedReview[g.date]}</pre>
            ) : null}
            <div className="actions">
              <button
                type="button"
                className="btnSecondary"
                disabled={reviewLoadingDate === g.date}
                onClick={() => void loadReviewForDay(g.date, !!expandedReview[g.date])}
              >
                {reviewLoadingDate === g.date
                  ? "加载复盘…"
                  : expandedReview[g.date]
                    ? "重新生成日复盘"
                    : "查看日复盘"}
              </button>
            </div>
          </section>
        ))
      )}
    </>
  );
}
