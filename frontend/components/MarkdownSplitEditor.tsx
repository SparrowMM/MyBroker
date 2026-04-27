"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownSplitEditorProps = {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** 源码区最小高度（px） */
  sourceMinHeight?: number;
};

export function MarkdownSplitEditor({
  id,
  label,
  value,
  onChange,
  sourceMinHeight = 300,
}: MarkdownSplitEditorProps) {
  return (
    <div className="mdSplit">
      <label className="mdSplitLabel" htmlFor={id}>
        {label}
      </label>
      <div className="mdSplitGrid">
        <div className="mdSplitCol">
          <div className="mdSplitColTitle">Markdown 源码</div>
          <textarea
            id={id}
            className="mdSplitSource"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            style={{ minHeight: sourceMinHeight }}
          />
        </div>
        <div className="mdSplitCol mdSplitCol--preview">
          <div className="mdSplitColTitle">实时预览</div>
          <div className="mdPreview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {value.trim() ? value : "*（暂无内容，可在左侧输入）*"}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
