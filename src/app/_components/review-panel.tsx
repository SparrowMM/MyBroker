"use client";

import { useMemo, useRef, useState } from "react";
import {
  buildReviewImageFilename,
  downloadElementAsPng,
} from "@/lib/export-review-image";
import {
  parseReviewDocument,
  type ParsedReviewSection,
  type WorkbenchLanes,
} from "@/lib/review-parse";

type ViewMode = "cards" | "preview" | "source";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMd(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function sectionIcon(kind: ParsedReviewSection["kind"]): string {
  switch (kind) {
    case "slice":
      return "◈";
    case "workbench":
      return "◇";
    case "life":
      return "○";
    case "pending":
      return "□";
    case "closing":
      return "✦";
    default:
      return "·";
  }
}

function hasWorkbenchContent(wb: WorkbenchLanes): boolean {
  return wb.light.length + wb.fog.length + wb.lamp.length > 0;
}

function WorkbenchCards({ section }: { section: ParsedReviewSection }) {
  const wb = section.workbench ?? { light: [], fog: [], lamp: [] };
  const lanes = [
    { key: "light" as const, label: "闪过的光", items: wb.light, tone: "light" },
    { key: "fog" as const, label: "未散的雾", items: wb.fog, tone: "fog" },
    { key: "lamp" as const, label: "明日的一盏灯", items: wb.lamp, tone: "lamp" },
  ];

  return (
    <div className="reviewWorkbenchGrid">
      {lanes.map((lane) => (
        <div key={lane.key} className={`reviewLane reviewLane--${lane.tone}`}>
          <h4 className="reviewLaneTitle">{lane.label}</h4>
          {lane.items.length ? (
            <ul className="reviewLaneList">
              {lane.items.map((item, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
              ))}
            </ul>
          ) : (
            <p className="reviewLaneEmpty">（本节暂无）</p>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionCard({ section }: { section: ParsedReviewSection }) {
  return (
    <section className={`reviewSectionCard reviewSectionCard--${section.kind}`}>
      <header className="reviewSectionHead">
        <span className="reviewSectionIcon" aria-hidden>
          {sectionIcon(section.kind)}
        </span>
        <h4 className="reviewSectionTitle">{section.title}</h4>
      </header>
      <div className="reviewSectionBody">
        {section.kind === "workbench" &&
        section.workbench &&
        hasWorkbenchContent(section.workbench) ? (
          <WorkbenchCards section={section} />
        ) : (
          <>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="reviewCardPara" dangerouslySetInnerHTML={{ __html: inlineMd(p) }} />
            ))}
            {section.bullets.length > 0 && (
              <ul className="reviewCardList">
                {section.bullets.map((b, i) => (
                  <li
                    key={i}
                    className={b.startsWith("□") ? "reviewCheckItem" : undefined}
                    dangerouslySetInnerHTML={{ __html: inlineMd(b) }}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    const lines = markdown.split(/\n/);
    const out: string[] = [];
    let inList = false;

    const closeList = () => {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
    };

    for (const raw of lines) {
      const t = raw.trim();
      if (!t) {
        closeList();
        continue;
      }
      if (t.startsWith("## ")) {
        closeList();
        out.push(`<h2 class="mdH2">${inlineMd(t.slice(3))}</h2>`);
        continue;
      }
      if (t.startsWith("### ")) {
        closeList();
        out.push(`<h3 class="mdH3">${inlineMd(t.slice(4))}</h3>`);
        continue;
      }
      if (t.startsWith("> ")) {
        closeList();
        out.push(`<blockquote class="mdQuote">${inlineMd(t.slice(2))}</blockquote>`);
        continue;
      }
      if (/^[-*•]\s+/.test(t) || /^□\s+/.test(t)) {
        if (!inList) {
          out.push('<ul class="mdList">');
          inList = true;
        }
        const item = t.replace(/^[-*•]\s+/, "").replace(/^□\s+/, "");
        const cls = t.startsWith("□") ? ' class="mdCheck"' : "";
        out.push(`<li${cls}>${inlineMd(item)}</li>`);
        continue;
      }
      if (/^\*\*.+\*\*$/.test(t)) {
        closeList();
        out.push(`<p class="mdLabel">${inlineMd(t)}</p>`);
        continue;
      }
      closeList();
      out.push(`<p class="mdP">${inlineMd(t)}</p>`);
    }
    closeList();
    return out.join("");
  }, [markdown]);

  return (
    <div className="reviewMdShell">
      <div className="reviewMdPaper" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function ReviewPanel({
  markdown,
  exportDate,
}: {
  markdown: string;
  /** YYYY-MM-DD，用于导出图片文件名 */
  exportDate?: string;
}) {
  const [mode, setMode] = useState<ViewMode>("cards");
  const [savingImage, setSavingImage] = useState(false);
  const [saveError, setSaveError] = useState("");
  const captureRef = useRef<HTMLDivElement>(null);
  const doc = useMemo(() => parseReviewDocument(markdown), [markdown]);

  const handleSaveImage = async () => {
    const el = captureRef.current;
    if (!el) return;
    setSavingImage(true);
    setSaveError("");
    try {
      await downloadElementAsPng(el, buildReviewImageFilename(exportDate));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "导出失败，请换一视图后重试");
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <div className="reviewPanel">
      <div className="reviewPanelToolbar">
        <button
          type="button"
          className="btnSecondary reviewSaveImageBtn"
          disabled={savingImage}
          onClick={() => void handleSaveImage()}
        >
          {savingImage ? "生成图片…" : "保存为图片"}
        </button>
        <div className="reviewModeTabs" role="tablist" aria-label="复盘视图">
          {(
            [
              ["cards", "卡片"],
              ["preview", "预览"],
              ["source", "原文"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? "reviewTab reviewTabActive" : "reviewTab"}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {saveError ? <p className="hint reviewSaveError">{saveError}</p> : null}

      <div ref={captureRef} className="reviewCaptureRoot">
        {mode === "cards" && (
          <div className="reviewCardsLayout">
            <header className="reviewDocHead">
              <h2 className="reviewDocTitle">{doc.docTitle}</h2>
              {doc.quote ? <p className="reviewDocQuote">{doc.quote}</p> : null}
            </header>
            <div className="reviewCardsStack">
              {doc.sections.map((s) => (
                <SectionCard key={s.key} section={s} />
              ))}
            </div>
          </div>
        )}

        {mode === "preview" && <MarkdownPreview markdown={markdown} />}
        {mode === "source" && <pre className="reviewSource">{markdown}</pre>}
      </div>
    </div>
  );
}
