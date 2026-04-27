"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownSplitEditor } from "../../components/MarkdownSplitEditor";
import { postFormData, postJson } from "../../lib/api";

const STEPS = [
  { id: 1, title: "准备内容", hint: "选择日期并录入原始信息" },
  { id: 2, title: "AI 标准化", hint: "按需补充提示词并生成预览" },
  { id: 3, title: "确认录入", hint: "核对终稿后保存到系统" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function RecordsPage() {
  const [step, setStep] = useState<StepId>(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [inputMode, setInputMode] = useState<"paste" | "image">("paste");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [promptHint, setPromptHint] = useState("");
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const [previewFallback, setPreviewFallback] = useState(false);
  const [previewNotice, setPreviewNotice] = useState("");
  const [saveResult, setSaveResult] = useState("");
  const [error, setError] = useState("");
  const [isImageParsing, setIsImageParsing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const flowStepperRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    flowStepperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const rawLen = rawInput.trim().length;
  const canGoStep2 = rawLen > 0;
  const canGoStep3 = previewMarkdown.trim().length > 0;

  const stepStatus = useMemo(() => {
    const s = step;
    return {
      1: s === 1 ? "current" : s > 1 ? "done" : "upcoming",
      2: s === 2 ? "current" : s > 2 ? "done" : "upcoming",
      3: s === 3 ? "current" : "upcoming",
    } as Record<StepId, "current" | "done" | "upcoming">;
  }, [step]);

  const goToStep = useCallback(
    (target: StepId) => {
      setError("");
      if (target === 2 && !canGoStep2) {
        setError("请先填写或从截图提取原始日报内容，再进入下一步。");
        return;
      }
      if (target === 3 && !canGoStep3) {
        setError("请先在「AI 标准化」步骤生成预览，再进入确认。");
        return;
      }
      setStep(target);
    },
    [canGoStep2, canGoStep3]
  );

  const onDateChange = (next: string) => {
    setDate(next);
    setPreviewMarkdown("");
    setPreviewFallback(false);
    setPreviewNotice("");
    setSaveResult("");
    if (step > 1) {
      setStep(1);
    }
  };

  const parseImage = async () => {
    setError("");
    if (!selectedFile) {
      setError("请先选择本地截图。");
      return;
    }
    setIsImageParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const data = await postFormData<{ markdown?: string }>(
        `/api/v2/records/markdown-from-image?record_date=${encodeURIComponent(date)}`,
        fd
      );
      setRawInput(data.markdown || "");
      setPreviewMarkdown("");
      setPreviewFallback(false);
      setPreviewNotice("");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsImageParsing(false);
    }
  };

  const generatePreview = async () => {
    setError("");
    setSaveResult("");
    if (!rawInput.trim()) {
      setError("原始内容为空，无法标准化。");
      return;
    }
    setIsPreviewing(true);
    try {
      const data = await postJson<{
        markdown?: string;
        fallback?: boolean;
        message?: string;
      }>("/api/v2/records/normalize", {
        record_date: date,
        raw_input: rawInput,
        prompt_hint: promptHint,
      });
      setPreviewMarkdown(data.markdown || "");
      setPreviewFallback(Boolean(data.fallback));
      setPreviewNotice(data.message || "");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsPreviewing(false);
    }
  };

  const saveRecord = async () => {
    setError("");
    if (!previewMarkdown.trim()) {
      setError("标准格式内容为空，无法录入。");
      return;
    }
    setIsSaving(true);
    try {
      const data = await postJson<{ ok?: boolean; record?: { id: number } }>("/api/v2/records", {
        record_date: date,
        raw_text: rawInput,
        chat_text: previewMarkdown,
        screenshot_notes: promptHint,
        screenshot_paths: [],
      });
      const recordId = data?.record?.id;
      setSaveResult(recordId ? `已保存，记录编号 ${recordId}` : "已保存");
      setStep(3);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const startAnother = () => {
    setStep(1);
    setRawInput("");
    setPromptHint("");
    setPreviewMarkdown("");
    setPreviewFallback(false);
    setPreviewNotice("");
    setSelectedFile(null);
    setSaveResult("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <header className="pageHeader">
        <h2>日报录入</h2>
        <p>按三步完成：准备内容 → AI 标准化 → 确认录入。每步只做一件事，减少分心。</p>
      </header>

      <section className="card recordFlow">
        <nav ref={flowStepperRef} className="flowStepper" aria-label="录入步骤">
          {STEPS.map((s, index) => {
            const status = stepStatus[s.id];
            const isLast = index === STEPS.length - 1;
            return (
              <div key={s.id} className="flowStepperItem">
                <button
                  type="button"
                  className={`flowStepBtn flowStepBtn--${status}`}
                  onClick={() => goToStep(s.id)}
                  aria-current={status === "current" ? "step" : undefined}
                >
                  <span className="flowStepCircle" aria-hidden>
                    {status === "done" ? "✓" : s.id}
                  </span>
                  <span className="flowStepMeta">
                    <span className="flowStepTitle">{s.title}</span>
                    <span className="flowStepHint">{s.hint}</span>
                  </span>
                </button>
                {!isLast && <span className="flowStepRail" aria-hidden />}
              </div>
            );
          })}
        </nav>

        {step === 1 && (
          <div className="flowPanel">
            <h3 className="flowPanelTitle">第 1 步 · 准备内容</h3>
            <p className="flowPanelLead">先选定日期，再用键盘粘贴或本地截图提取原始日报。本步结束前无需关心格式。</p>

            <div className="fieldRow">
              <div className="field">
                <label htmlFor="record-date">日报日期</label>
                <input id="record-date" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
              </div>
            </div>

            <div className="field flowFieldTight">
              <span className="fieldLabelLike">内容来源</span>
              <div className="segmented" role="tablist" aria-label="内容来源">
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === "paste"}
                  className={`segmentedItem ${inputMode === "paste" ? "isActive" : ""}`}
                  onClick={() => setInputMode("paste")}
                >
                  键盘粘贴
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inputMode === "image"}
                  className={`segmentedItem ${inputMode === "image" ? "isActive" : ""}`}
                  onClick={() => setInputMode("image")}
                >
                  截图识别
                </button>
              </div>
            </div>

            {inputMode === "image" && (
              <div className="field">
                <label htmlFor="screenshot-file">本地截图（不上传云端）</label>
                <input
                  ref={fileInputRef}
                  id="screenshot-file"
                  type="file"
                  accept="image/*"
                  className="hiddenInput"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      setError("");
                    }
                  }}
                />
                <button
                  type="button"
                  className={`dropzone flowDropzone ${isDragOver ? "dragOver" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      setError("");
                    }
                  }}
                >
                  <span className="flowDropzoneMain">
                    {isImageParsing ? "正在识别截图…" : "点击或拖拽图片到此处"}
                  </span>
                  <span className="flowDropzoneSub">
                    {selectedFile ? `已选：${selectedFile.name}` : "支持常见图片格式，仅用于当前浏览器会话解析"}
                  </span>
                </button>
                <div className="actions flowInlineActions">
                  <button className="btnSecondary" type="button" onClick={parseImage} disabled={isImageParsing}>
                    {isImageParsing ? "识别中…" : "识别截图并填入下方"}
                  </button>
                </div>
              </div>
            )}

            <div className="field">
              <label htmlFor="raw-input">原始日报（草稿）</label>
              <textarea
                id="raw-input"
                rows={inputMode === "image" ? 7 : 10}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={
                  inputMode === "paste"
                    ? "粘贴今日工作要点、对话摘要、零散笔记均可，不必排版。"
                    : "识别结果会出现在这里，也可继续手工补充。"
                }
              />
              <div className="flowCharHint">{rawLen > 0 ? `已输入约 ${rawLen} 字` : "尚未输入内容"}</div>
            </div>

            <div className="flowFooter flowFooter--single">
              <button type="button" className="btnPrimary" onClick={() => goToStep(2)} disabled={!canGoStep2}>
                下一步：AI 标准化
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flowPanel">
            <h3 className="flowPanelTitle">第 2 步 · AI 标准化</h3>
            <p className="flowPanelLead">
              可选填提示词后点击生成。生成后会在<strong>下方双栏</strong>同时展示 Markdown 源码与实时预览，可直接改源码；满意后再进入「确认录入」保存。
            </p>

            <div className="flowContextBox">
              <div className="flowContextHead">
                <div className="flowContextLabel">原始内容（完整）</div>
                <button type="button" className="flowContextEditLink" onClick={() => goToStep(1)}>
                  修改原文
                </button>
              </div>
              <pre className="flowContextPre">{rawInput.trim() ? rawInput : "（空）"}</pre>
            </div>

            <div className="field">
              <label htmlFor="prompt-hint">提示词（可选）</label>
              <textarea
                id="prompt-hint"
                rows={3}
                value={promptHint}
                onChange={(e) => setPromptHint(e.target.value)}
                placeholder="例如：突出客户跟进与报价进展；风险请标高/中/低。"
              />
            </div>

            <div className="actions flowStackActions flowGenerateRow">
              <button
                type="button"
                className="btnPrimary"
                onClick={generatePreview}
                disabled={isPreviewing || !canGoStep2}
              >
                {isPreviewing ? "正在生成预览…" : previewMarkdown.trim() ? "重新生成预览" : "生成标准格式预览"}
              </button>
              {previewMarkdown.trim() ? (
                <span className="flowGenerateHint">已生成过预览，可随时重新生成覆盖当前结果。</span>
              ) : null}
            </div>

            {previewMarkdown.trim() ? (
              <div className={`flowBanner ${previewFallback ? "flowBanner--warn" : "flowBanner--ok"}`}>
                <strong>{previewFallback ? "当前为兜底模板" : "预览已就绪"}</strong>
                <span>
                  {previewFallback
                    ? previewNotice ||
                      "模型未返回有效内容时，已用本地模板：原文完整保留在「今日进展」，其余小节为占位，可在下方双栏继续编辑。"
                    : "可在下方左侧改源码，右侧会即时渲染；无需等到第 3 步才能看到预览。"}
                </span>
              </div>
            ) : null}

            {previewMarkdown.trim() ? (
              <MarkdownSplitEditor
                id="preview-md-step2"
                label="标准格式（双栏：源码 · 预览）"
                value={previewMarkdown}
                onChange={setPreviewMarkdown}
                sourceMinHeight={280}
              />
            ) : (
              <div className="flowPreviewPlaceholder">
                <strong>双栏编辑区</strong>
                点击「生成标准格式预览」后，将在此处显示 Markdown 源码与实时渲染，无需先点「确认录入」。
              </div>
            )}

            <div className="flowFooter">
              <button type="button" className="btnSecondary" onClick={() => goToStep(1)}>
                上一步
              </button>
              <button type="button" className="btnPrimary" onClick={() => goToStep(3)} disabled={!canGoStep3}>
                下一步：确认录入
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flowPanel">
            <h3 className="flowPanelTitle">第 3 步 · 确认录入</h3>
            <p className="flowPanelLead">
              最后一遍核对：左侧源码、右侧预览与第 2 步一致。保存内容包含<strong>标准格式终稿</strong>与第 1 步原始草稿。
            </p>

            {previewFallback ? (
              <div className="flowBanner flowBanner--warn">
                <strong>兜底生成提示</strong>
                <span>{previewNotice || "若需完全由模型润色，可返回上一步重新生成，或检查 API 配置。"}</span>
              </div>
            ) : null}

            <MarkdownSplitEditor
              id="preview-md-step3"
              label="标准格式终稿（双栏）"
              value={previewMarkdown}
              onChange={setPreviewMarkdown}
              sourceMinHeight={320}
            />

            {saveResult ? (
              <div className="flowSuccess">
                <span className="flowSuccessIcon" aria-hidden>
                  ✓
                </span>
                <div>
                  <strong>{saveResult}</strong>
                  <p className="flowSuccessHint">需要继续录入时，可点击「录入下一条」清空表单并回到第 1 步。</p>
                </div>
              </div>
            ) : null}

            <div className="flowFooter">
              <button type="button" className="btnSecondary" onClick={() => goToStep(2)} disabled={isSaving}>
                上一步
              </button>
              <div className="flowFooterRight">
                {saveResult ? (
                  <button type="button" className="btnSecondary" onClick={startAnother}>
                    录入下一条
                  </button>
                ) : null}
                <button type="button" className="btnPrimary" onClick={saveRecord} disabled={isSaving || !canGoStep3}>
                  {isSaving ? "保存中…" : "确认并保存"}
                </button>
              </div>
            </div>
          </div>
        )}

        {error ? <div className="error flowError">{error}</div> : null}
      </section>
    </>
  );
}
