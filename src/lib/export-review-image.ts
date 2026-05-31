/** 将 DOM 节点导出为 PNG 并触发浏览器下载 */

const SCROLLABLE_SELECTORS = ".reviewCardsLayout, .reviewMdShell, .reviewSource";

export function buildReviewImageFilename(dateYmd?: string): string {
  const day = dateYmd?.trim() || new Date().toISOString().slice(0, 10);
  return `mybroker-复盘-${day}.png`;
}

function triggerDownload(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export async function downloadElementAsPng(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const { toPng } = await import("html-to-image");
  const scrollables = [
    element,
    ...element.querySelectorAll<HTMLElement>(SCROLLABLE_SELECTORS),
  ];
  const saved = scrollables.map((el) => ({
    el,
    maxHeight: el.style.maxHeight,
    overflow: el.style.overflow,
  }));

  for (const { el } of saved) {
    el.style.maxHeight = "none";
    el.style.overflow = "visible";
  }

  try {
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    triggerDownload(dataUrl, filename);
  } finally {
    for (const { el, maxHeight, overflow } of saved) {
      el.style.maxHeight = maxHeight;
      el.style.overflow = overflow;
    }
  }
}
