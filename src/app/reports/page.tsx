"use client";

import { useState } from "react";
import { getJson } from "@/lib/api";

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [week, setWeek] = useState(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const weekly = async () => {
    setError("");
    setIsLoading(true);
    try {
      const data = await getJson(`/api/v2/reports/weekly?year=${year}&week=${week}`);
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const monthly = async () => {
    setError("");
    setIsLoading(true);
    try {
      const data = await getJson(`/api/v2/reports/monthly?year=${year}&month=${month}`);
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <header className="pageHeader">
        <h2>周报 / 月报</h2>
        <p>快速生成周期汇总，支持按周或按月查询。</p>
      </header>

      <section className="card">
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="report-year">年份</label>
            <input
              id="report-year"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              placeholder="年"
            />
          </div>
          <div className="field">
            <label htmlFor="report-week">周次</label>
            <input
              id="report-week"
              type="number"
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              placeholder="周"
            />
          </div>
          <div className="field">
            <label htmlFor="report-month">月份</label>
            <input
              id="report-month"
              type="number"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              placeholder="月"
            />
          </div>
        </div>

        <div className="actions">
          <button className="btnPrimary" onClick={weekly} disabled={isLoading}>
            {isLoading ? "查询中..." : "查询周报"}
          </button>
          <button className="btnSecondary" onClick={monthly} disabled={isLoading}>
            {isLoading ? "查询中..." : "查询月报"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card result">
        <h3>返回结果</h3>
        <pre>{result || "查询后将显示报表内容"}</pre>
      </section>
    </>
  );
}
