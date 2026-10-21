import { Search, Zap } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface QueryLandingProps {
  keyword: string;
  onKeyword: (value: string) => void;
  /** 首次扫描是否完成 */
  loaded: boolean;
  stats: { total: number; pids: number };
  /** 匹配条数（keyword 非空时展示结果区） */
  matchCount: number;
  /** 有背景图时垫不透明卡片保证可读性 */
  bgSet: boolean;
  onBrowseAll: () => void;
  /** keyword 非空时的匹配列表（PortTable） */
  results: ReactNode;
}

/**
 * 速查模式落地页：搜索优先。打开软件最常见的动作是"拿着一个端口号
 * 来杀进程"，全表浏览反而是次要路径——列表模式的入口只留一个链接。
 */
export default function QueryLanding({
  keyword,
  onKeyword,
  loaded,
  stats,
  matchCount,
  bgSet,
  onBrowseAll,
  results,
}: QueryLandingProps) {
  return (
    <div
      className={cn(
        "mx-auto mt-12 w-full max-w-2xl",
        bgSet && "rounded-2xl border border-border bg-card px-8 py-10 shadow-lg",
      )}
    >
      <div className="flex items-center gap-3.5">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-primary/35 bg-linear-to-br from-primary/30 to-primary/5 shadow-[0_0_28px_var(--glow-1)]">
          <Zap className="size-6 text-primary" strokeWidth={2.2} />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-wide">端口终结者</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            输入端口号或进程名，直接定位占用，一键送走
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-3 transition-all focus-within:border-primary/60 focus-within:shadow-[0_0_0_4px] focus-within:shadow-primary/15">
        <Search className="size-4.5 shrink-0 text-muted-foreground" />
        <input
          data-search
          autoFocus
          value={keyword}
          onChange={(e) => onKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && keyword) {
              onKeyword("");
              e.currentTarget.blur();
            }
          }}
          placeholder="端口号 / 进程名 / 用户，如 8080"
          className="w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground/70"
        />
        {keyword && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {matchCount} 条
          </span>
        )}
      </div>

      {keyword ? (
        <>
          <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              找到 <b className="font-mono text-foreground">{matchCount}</b> 条匹配
            </span>
            <button
              type="button"
              onClick={onBrowseAll}
              className="cursor-pointer text-primary transition-colors hover:underline"
            >
              浏览全部 {stats.total} 条 →
            </button>
          </div>
          <div className="mt-2">{results}</div>
        </>
      ) : (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          {loaded ? (
            <span>
              本机 <b className="font-mono text-foreground">{stats.total}</b> 条端口占用
              · <b className="font-mono text-foreground">{stats.pids}</b> 个进程
            </span>
          ) : (
            <span>正在扫描本机端口…</span>
          )}
          <span className="text-border">|</span>
          <button
            type="button"
            onClick={onBrowseAll}
            className="cursor-pointer text-primary transition-colors hover:underline"
          >
            浏览全部 →
          </button>
        </div>
      )}
    </div>
  );
}
