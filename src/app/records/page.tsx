"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getJson, postJson } from "@/lib/api";
import { daysAgoLocalYmd, todayLocalYmd } from "@/lib/local-date";
import { HealthBanner } from "./_components/health-banner";
import { RecordCard } from "./_components/record-card";
import { RecordForm } from "./_components/record-form";
import { ScreenshotHelper } from "./_components/screenshot-helper";
import type { DailyRecordDto, RecordPayload } from "./_components/types";

const RECENT_DAYS = 7;

type DayChip = {
  date: string;
  label: string;
  count: number;
};

export default function RecordsPage() {
  const today = todayLocalYmd();
  const [date, setDate] = useState(today);
  const [recent, setRecent] = useState<DailyRecordDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [createError, setCreateError] = useState("");
  const [savedFlash, setSavedFlash] = useState("");

  const [externalRaw, setExternalRaw] = useState<{
    value: string;
    mode: "append" | "replace";
    nonce: number;
  } | null>(null);

  const loadRecent = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const start = daysAgoLocalYmd(RECENT_DAYS - 1);
      const end = todayLocalYmd();
      const qs = new URLSearchParams({ start_date: start, end_date: end, limit: "200" });
      const rows = await getJson<DailyRecordDto[]>(`/api/v2/records?${qs.toString()}`);
      setRecent(rows);
    } catch (err) {
      setListError(String(err));
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecent().catch(() => undefined);
  }, [loadRecent]);

  const dayChips: DayChip[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recent) {
      counts.set(r.record_date, (counts.get(r.record_date) ?? 0) + 1);
    }
    const arr: DayChip[] = [];
    for (let i = 0; i < RECENT_DAYS; i++) {
      const ymd = daysAgoLocalYmd(i);
      const label =
        i === 0 ? "今天" : i === 1 ? "昨天" : `${ymd.slice(5)} (${weekdayLabel(ymd)})`;
      arr.push({ date: ymd, label, count: counts.get(ymd) ?? 0 });
    }
    return arr;
  }, [recent]);

  const recordsForDate = useMemo(
    () => recent.filter((r) => r.record_date === date),
    [recent, date],
  );

  const handleCreate = async (payload: RecordPayload): Promise<boolean> => {
    setCreateError("");
    setSavedFlash("");
    try {
      const data = await postJson<{ ok?: boolean; record?: DailyRecordDto; message?: string }>(
        "/api/v2/records",
        payload,
      );
      if (data.ok && data.record) {
        setRecent((prev) => sortRecords([data.record!, ...prev]));
        setSavedFlash(`已保存 ${data.record.record_date} 日报（#${data.record.id}），AI 摘要已生成。`);
        setTimeout(() => setSavedFlash(""), 4000);
        return true;
      }
      setCreateError(data.message || "保存失败");
      return false;
    } catch (err) {
      setCreateError(String(err));
      return false;
    }
  };

  const handleCardChange = (record: DailyRecordDto) => {
    setRecent((prev) => sortRecords(prev.map((r) => (r.id === record.id ? record : r))));
  };

  const handleCardDelete = (id: number) => {
    setRecent((prev) => prev.filter((r) => r.id !== id));
  };

  const handleMergeMarkdown = (markdown: string) => {
    setExternalRaw({ value: markdown, mode: "append", nonce: Date.now() });
    setSavedFlash("已将解析结果合入下方「工作描述」，确认后点击保存。");
    setTimeout(() => setSavedFlash(""), 4000);
  };

  const isViewingToday = date === today;

  return (
    <>
      <header className="pageHeader">
        <h2>日报工作台</h2>
        <p>聚焦于「今日 / 选中日期」的日报：直接新建、就地编辑、重新分析或删除。完整历史请到 <Link href="/records/history" className="inlineLink">日报列表</Link>。</p>
      </header>

      <section className="card daySwitcher">
        <div className="daySwitcherHead">
          <div className="daySwitcherTitle">
            <strong>查看日期</strong>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="dateInputInline"
            />
          </div>
          <button
            type="button"
            className="btnSecondary"
            onClick={() => setDate(today)}
            disabled={isViewingToday}
          >
            跳到今天
          </button>
        </div>
        <div className="dayChips">
          {dayChips.map((chip) => (
            <button
              key={chip.date}
              type="button"
              className={`dayChip${chip.date === date ? " active" : ""}`}
              onClick={() => setDate(chip.date)}
            >
              <span className="dayChipLabel">{chip.label}</span>
              <span className={`dayChipCount${chip.count ? " has" : ""}`}>{chip.count}</span>
            </button>
          ))}
        </div>
      </section>

      {savedFlash && <div className="card flashHint successHint">{savedFlash}</div>}

      <section className="card">
        <div className="cardHead">
          <h3 className="sectionTitle">{date} 的日报</h3>
          <span className="badge">{recordsForDate.length} 条</span>
        </div>

        {loading && recordsForDate.length === 0 ? (
          <div className="hint">加载中...</div>
        ) : recordsForDate.length === 0 ? (
          <div className="emptyState">
            <p className="emptyStateTitle">{isViewingToday ? "今天还没有日报" : "该日期暂无日报"}</p>
            <p className="hint">在下方填写工作描述，点击保存即自动入库并生成 AI 摘要。</p>
          </div>
        ) : (
          <div className="recordList">
            {recordsForDate.map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                onChange={handleCardChange}
                onDelete={handleCardDelete}
                defaultExpand={recordsForDate.length === 1}
              />
            ))}
          </div>
        )}

        {listError && <div className="error">{listError}</div>}
      </section>

      <section className="card">
        <h3 className="sectionTitle">
          {recordsForDate.length === 0 ? "新建日报" : `为 ${date} 再加一条`}
        </h3>
        <RecordForm
          defaultDate={date}
          lockDate
          defaultExpanded={false}
          onSubmit={handleCreate}
          submitLabel="保存日报"
          pendingLabel="保存中（AI 摘要生成中）..."
          externalRawText={externalRaw ?? undefined}
          resetAfterSubmit
        />
        {createError && <div className="error">{createError}</div>}
        <p className="hint" style={{ marginTop: 12 }}>
          提示：保存时会自动调用 AI 生成摘要与标签；如需修改，保存后在上方卡片中点击「编辑 / 重新分析」。
        </p>
      </section>

      <ScreenshotHelper date={date} onMarkdown={handleMergeMarkdown} />

      <HealthBanner />
    </>
  );
}

function sortRecords(rows: DailyRecordDto[]): DailyRecordDto[] {
  return [...rows].sort((a, b) => {
    if (a.record_date !== b.record_date) {
      return a.record_date < b.record_date ? 1 : -1;
    }
    return b.id - a.id;
  });
}

function weekdayLabel(ymd: string): string {
  const map = ["日", "一", "二", "三", "四", "五", "六"];
  const d = new Date(`${ymd}T00:00:00`);
  return `周${map[d.getDay()]}`;
}
