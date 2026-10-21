import {
  Cpu,
  ListTree,
  Loader,
  Network,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
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
  onBrowseAll: () => void;
  /** keyword 非空时的匹配列表（PortTable） */
  results: ReactNode;
}

/** 常用端口速达：点击即搜，悬停看服务名。 */
const COMMON_PORTS: Array<{ port: number; label: string }> = [
  { port: 80, label: "HTTP" },
  { port: 443, label: "HTTPS" },
  { port: 3000, label: "Node / React 开发服务器" },
  { port: 3306, label: "MySQL" },
  { port: 5000, label: "Flask" },
  { port: 5432, label: "PostgreSQL" },
  { port: 6379, label: "Redis" },
  { port: 8080, label: "代理 / 备用 HTTP" },
  { port: 8888, label: "Jupyter" },
  { port: 27017, label: "MongoDB" },
];

/** 概览小胶囊：图标 + 指标名 + 等宽数字。 */
function StatChip({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: typeof Network;
  label: string;
  value: number;
  iconClass: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
      <Icon className={cn("size-3", iconClass)} />
      {label}
      <b className="font-mono text-[13px] font-semibold text-foreground">
        {value}
      </b>
    </span>
  );
}

/**
 * 速查模式落地页：搜索优先。打开软件最常见的动作是"拿着一个端口号
 * 来杀进程"，全表浏览反而是次要路径——居中大输入 + 概览胶囊，
 * 品牌留在顶栏，这里只聚焦动作本身。
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
        "mx-auto w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-500",
        bgSet
          ? "mt-8 rounded-3xl border border-border bg-card/95 px-7 py-8 shadow-xl shadow-black/5 sm:px-10"
          : "mt-10 px-1 sm:mt-14",
      )}
    >
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.16em] text-primary">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/50" />
            <span className="relative inline-flex size-2 rounded-full bg-ok" />
          </span>
          LOCAL SOCKETS · LIVE
        </div>
        <h2 className="text-3xl font-bold tracking-tight sm:text-[38px]">
          端口占用，快速定位
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          搜索端口、进程或用户，查看详情并安全释放
        </p>
      </div>

      {/* 大搜索框：/ 聚焦 · Esc 清空 · 有词时给匹配数与清空按钮 */}
      <div className="group mx-auto mt-7 max-w-3xl">
        <div className="flex h-14 items-center gap-3 rounded-2xl border border-border bg-muted/55 px-4 shadow-inner shadow-black/[0.02] transition-all focus-within:border-primary/65 focus-within:bg-card focus-within:shadow-[0_0_0_4px] focus-within:shadow-primary/15">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Search className="size-4 transition-transform group-focus-within:scale-110" />
          </div>
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
            aria-label="搜索端口、进程或用户"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70 sm:text-base"
          />
          {keyword ? (
            <>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {matchCount} 条
              </span>
              <button
                type="button"
                onClick={() => onKeyword("")}
                title="清空搜索（Esc）"
                className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <kbd className="pointer-events-none shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* 常用端口速达：只在空态出现，点了直接当搜索词 */}
      {!keyword && (
        <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold tracking-wider text-muted-foreground/80">
            快速筛选
          </span>
          {COMMON_PORTS.map(({ port, label }) => (
            <button
              key={port}
              type="button"
              title={label}
              onClick={() => onKeyword(String(port))}
              className="cursor-pointer rounded-lg border border-border/80 bg-card/70 px-2.5 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {port}
            </button>
          ))}
        </div>
      )}

      {keyword ? (
        <>
          <div className="mt-6 flex items-center justify-between border-t border-border/70 pt-4 text-xs text-muted-foreground">
            {portRangeHint(keyword) ? (
              <span className="text-warn">{portRangeHint(keyword)}</span>
            ) : (
              <span>
                找到 <b className="font-mono text-foreground">{matchCount}</b> 条匹配
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
          <div className="mt-3 animate-in fade-in duration-300 overflow-x-auto rounded-2xl border border-border/70 bg-card/50 p-2">{results}</div>
        </>
      ) : (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 border-t border-border/60 pt-5">
          {!loaded ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
              <Loader className="size-3 animate-spin" />
              正在扫描本机端口…
            </span>
          ) : (
            <>
              <StatChip
                icon={Network}
                label="端口占用"
                value={stats.total}
                iconClass="text-primary"
              />
              <StatChip
                icon={Cpu}
                label="进程"
                value={stats.pids}
                iconClass="text-tcp"
              />
              {stats.critical > 0 && (
                <StatChip
                  icon={ShieldAlert}
                  label="受保护"
                  value={stats.critical}
                  iconClass="text-warn"
                />
              )}
            </>
          )}
          <button
            type="button"
            onClick={onBrowseAll}
            title="切换到列表模式，浏览全部端口占用"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-primary"
          >
            <ListTree className="size-3" />
            浏览全部
          </button>
        </div>
      )}
    </div>
  );
}
