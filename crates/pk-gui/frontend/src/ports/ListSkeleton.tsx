/** 首次扫描进行中的骨架屏（列对齐 PortTable 的 GRID）。 */
import { GRID } from "./PortTable";

export default function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`${GRID} py-1.5 ${i > 0 ? "border-t border-border" : ""}`}
        >
          <div
            className="h-4 animate-pulse rounded bg-muted"
            style={{ animationDelay: `${i * 70}ms` }}
          />
          <div
            className="h-4 w-7 animate-pulse rounded bg-muted"
            style={{ animationDelay: `${i * 70 + 50}ms` }}
          />
          <div
            className="h-3.5 w-24 animate-pulse rounded bg-muted"
            style={{ animationDelay: `${i * 70 + 100}ms` }}
          />
          <div
            className="h-3.5 w-12 animate-pulse rounded bg-muted"
            style={{ animationDelay: `${i * 70 + 150}ms` }}
          />
          <div
            className="h-3.5 max-w-56 animate-pulse rounded bg-muted"
            style={{ animationDelay: `${i * 70 + 200}ms` }}
          />
          <div />
        </div>
      ))}
    </div>
  );
}
