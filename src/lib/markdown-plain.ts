/** Markdown 转简短纯文本（推送预览 / 飞书纯文本等） */
export function markdownToPlain(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+\[ ]\s+/gm, "· ")
    .replace(/^\s*[-*]\s+/gm, "· ")
    .replace(/\*\*(.*?)\*\*/g, "$1");
}
