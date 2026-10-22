import { Loader, Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import PortFilters, { type ProtocolFilter } from "@/ports/PortFilters";
import { portRangeHint } from "@/ports/scan";

interface QueryLandingProps {
  keyword: string;
  onKeyword: (value: string) => void;
  /** 首次扫描是否完成 */
  loaded: boolean;
  stats: { total: number; pids: number; critical: number };
  /** 匹配条数（keyword 非空时展示结果区） */
  matchCount: number;
  /** 有背景图时垫不透明卡片保证可读性 */
  bgSet: boolean;
  searchEntries: { protocol: "tcp" | "udp"; state: string | null }[];
  protocol: ProtocolFilter;
  listeningOnly: boolean;
  onProtocolChange: (value: ProtocolFilter) => void;
  onListeningChange: (value: boolean) => void;
  hasRefinement: boolean;
  onBrowseAll: () => void;
  /** keyword 非空时的匹配列表（PortTable） */
  results: ReactNode;
}

/** 常用端口速达：点击即搜，悬停看全称，short 上屏。 */
const COMMON_PORTS: Array<{ port: number; label: string; short: string }> = [
  { port: 80, label: "HTTP", short: "HTTP" },
  { port: 443, label: "HTTPS", short: "HTTPS" },
  { port: 3000, label: "Node / React 开发服务器", short: "开发" },
  { port: 3306, label: "MySQL", short: "MySQL" },
  { port: 5000, label: "Flask", short: "Flask" },
  { port: 5432, label: "PostgreSQL", short: "Postgres" },
  { port: 6379, label: "Redis", short: "Redis" },
  { port: 8080, label: "代理 / 备用 HTTP", short: "代理" },
  { port: 8888, label: "Jupyter", short: "Jupyter" },
  { port: 27017, label: "MongoDB", short: "Mongo" },
];

/**
 * 速查模式落地页：一句口号定调 + 搜索优先。打开软件最常见的动作是
 * "拿着一个端口号来杀进程"，全表浏览是次要路径——口号给身份，搜
 * 索框承接动作，常用端口兜底。
 */
export default function QueryLanding({
  keyword,
  onKeyword,
  loaded,
  stats,
  matchCount,
  bgSet,
  searchEntries,
  protocol,
  listeningOnly,
  onProtocolChange,
  onListeningChange,
  hasRefinement,
  onBrowseAll,
  results,
}: QueryLandingProps) {
  const hint = portRangeHint(keyword);

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-xl pt-[15vh]">
        <div className={cn(bgSet && "rounded-xl border bg-card p-6 shadow-sm")}>
          {/* 口号：页面唯一的"内容"，其余都是动作 */}
          <div className="text-center">
            <h2 className="text-lg font-semibold">端口终结者</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              看清端口被谁占用，一键终结
            </p>
          </div>

          {/* 大搜索框：/ 聚焦 · Esc 清空 · 有词时给匹配数与清空按钮 */}
          <div className="mt-6 flex h-11 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 shadow-sm transition-colors focus-within:border-primary/60">
            <Search className="size-4 shrink-0 text-muted-foreground" />
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
              placeholder="端口 / 地址 / PID / 进程名 / 用户，如 8080"
              aria-label="搜索端口、地址、PID、进程或用户"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
            {keyword ? (
              <>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {matchCount} 条
                </span>
                <button
                  type="button"
                  onClick={() => onKeyword("")}
                  title="清空搜索（Esc）"
                  className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <kbd className="pointer-events-none shrink-0 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                /
              </kbd>
            )}
          </div>

          {hasRefinement ? (
            <div className="mt-3">
              <PortFilters
                protocol={protocol}
                listeningOnly={listeningOnly}
                onProtocolChange={onProtocolChange}
                onListeningChange={onListeningChange}
                entries={searchEntries}
              />
            </div>
          ) : (
            /* 常用端口速达：只在空态出现，点了直接当搜索词 */
            <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
              <span className="px-0.5 text-[11px] text-muted-foreground/80">
                常用
              </span>
              {COMMON_PORTS.map(({ port, label, short }) => (
                <button
                  key={port}
                  type="button"
                  title={label}
                  onClick={() => onKeyword(String(port))}
                  className="flex cursor-pointer items-baseline gap-1.5 rounded-md border border-border bg-card px-2 py-1 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="font-mono text-xs font-semibold tabular-nums">
                    {port}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {short}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {hasRefinement ? (
        <div className="mt-6">
          <div className="flex items-center justify-between px-1 pb-2 text-[11px] text-muted-foreground">
            {hint ? (
              <span className="text-warn">{hint}</span>
            ) : (
              <span>
                找到 <b className="font-mono text-foreground">{matchCount}</b>{" "}
                条匹配
              </span>
            )}
            <button
              type="button"
              onClick={onBrowseAll}
              className="cursor-pointer text-primary transition-colors hover:underline"
            >
              浏览全部 {stats.total} 条 →
            </button>
          </div>
          <div className="overflow-x-auto">{results}</div>
        </div>
      ) : !loaded ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader className="size-3 animate-spin" />
          正在扫描本机端口…
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-2 text-[11px] text-muted-foreground">
          <span>
            {stats.total > 0
              ? `共 ${stats.total} 个端口占用 · ${stats.pids} 个进程${
                  stats.critical > 0 ? ` · 受保护 ${stats.critical}` : ""
                }`
              : "当前没有端口占用"}
          </span>
          <button
            type="button"
            onClick={onBrowseAll}
            title="切换到列表模式，浏览全部端口占用"
            className="cursor-pointer text-primary transition-colors hover:underline"
          >
            浏览全部 →
          </button>
        </div>
      )}
    </div>
  );
}
