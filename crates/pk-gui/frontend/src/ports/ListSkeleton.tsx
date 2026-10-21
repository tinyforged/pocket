/** 首次扫描进行中的骨架屏（列对齐 PortTable 的 GRID）。 */
import { GRID } from "./PortTable";

export default function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 pb-2 pt-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${GRID} py-2.5`}>
          <div
            className="h-5 animate-pulse rounded bg-muted"
            style={{ animationDelay: `${i * 70}ms` }}
          />
          <div
            className="h-5 w-10 animate-pulse rounded bg-muted"
            style={{ animationDelay: `${i * 70 + 50}ms` }}
          />
          <div
            className="h-4 w-28 animate-pulse rounded bg-muted"
            style={{ animationDelay: `${i * 70 + 100}ms` }}
          />
          <div
            className="h-4 w-16 animate-pulse rounded bg-muted"
            style={{ animationDelay: `${i * 70 + 150}ms` }}
          />
          <div
            className="h-4 max-w-64 animate-pulse rounded bg-muted"
            style={{ animationDelay: `${i * 70 + 200}ms` }}
          />
          <div />
        </div>
      ))}
    </div>
  );
}
