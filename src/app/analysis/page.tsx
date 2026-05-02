"use client";

import { useState } from "react";
import { getJson } from "@/lib/api";

export default function AnalysisPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const query = async () => {
    setError("");
    setIsLoading(true);
    try {
      const data = await getJson(`/api/v2/timeline?start_date=${date}&end_date=${date}`);
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
        <h2>日报分析查询</h2>
        <p>按日期查看当天时间线和智能分析结果。</p>
      </header>

      <section className="card">
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="analysis-date">日期</label>
            <input id="analysis-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="actions">
          <button className="btnPrimary" onClick={query} disabled={isLoading}>
            {isLoading ? "查询中..." : "查询当天分析"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card result">
        <h3>返回结果</h3>
        <pre>{result || "查询后将显示分析详情"}</pre>
      </section>
    </>
  );
}
