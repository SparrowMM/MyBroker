export default function Loading() {
  return (
    <div className="loadingRoot" aria-busy="true" aria-live="polite" aria-label="页面加载中">
      <div className="loadingBar" />
      <div className="loadingLines">
        <div className="loadingLine loadingLineFull" />
        <div className="loadingLine loadingLineMid" />
        <div className="loadingLine loadingLineShort" />
      </div>
    </div>
  );
}
