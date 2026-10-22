import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CornerDownRight,
  Loader,
  ZapOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PortEntryDto, ProcessDto } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtBytes } from "@/lib/format";

import type { RowResult } from "./kill";
import PortDetail from "./PortDetail";

/** 列布局（骨架屏也用）；组成员行沿用同一网格，列与外部平铺行对齐 */
export const GRID =
  "grid min-w-[760px] grid-cols-[64px_52px_128px_88px_minmax(0,1fr)_64px_80px] items-center gap-2 px-3";

/** 行标识：同 (port, proto, addr) 的多隐形条目靠调用方追加序号兜底。 */
export function rowKey(e: PortEntryDto): string {
  return `${e.port}/${e.protocol}/${e.localAddr}/${e.process?.pid ?? "x"}`;
}

interface Sort {
  key: "port" | "name" | "memory";
  dir: "asc" | "desc";
}

interface PortTableProps {
  entries: PortEntryDto[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  killing: Set<number>;
  results: Map<number, RowResult>;
  onKill: (process: ProcessDto) => void;
  /** 多进程共用同一端口时的"全部终止"入口 */
  onKillGroup: (processes: ProcessDto[]) => void;
}

/** 单进程端口 = 平铺行；多进程共用端口 = 组（横条头 + 成员行）。 */
type Item =
  | { kind: "flat"; entry: PortEntryDto }
  | {
      kind: "group";
      port: number;
      protocol: "tcp" | "udp";
      members: PortEntryDto[];
      /** 可见且去重后的进程（"全部终止"的目标） */
      processes: ProcessDto[];
    };

/** 按 (port, protocol) 聚合；去重 pid ≥ 2 才成组（SO_REUSEPORT 等）。 */
function buildItems(entries: PortEntryDto[]): Item[] {
  const byKey = new Map<string, PortEntryDto[]>();
  for (const e of entries) {
    const arr = byKey.get(`${e.port}/${e.protocol}`) ?? [];
    arr.push(e);
    byKey.set(`${e.port}/${e.protocol}`, arr);
  }

  const items: Item[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const key = `${e.port}/${e.protocol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const members = byKey.get(key)!;
    const processes: ProcessDto[] = [];
    for (const m of members) {
      if (m.process && !processes.some((p) => p.pid === m.process!.pid))
        processes.push(m.process);
    }
    if (processes.length >= 2) {
      items.push({
        kind: "group",
        port: e.port,
        protocol: e.protocol,
        members,
        processes,
      });
    } else {
      items.push({ kind: "flat", entry: e });
    }
  }
  return items;
}

/** 成员行排序键：进程名（隐形排最后）。 */
const nameOf = (e: PortEntryDto): string => e.process?.name ?? "￿";

export default function PortTable({
  entries,
  expanded,
  onToggle,
  killing,
  results,
  onKill,
  onKillGroup,
}: PortTableProps) {
  // 排序仅重排显示，不影响 App 层的过滤与统计
  const [sort, setSort] = useState<Sort | null>(null);

  const cycle = (key: Sort["key"]) =>
    setSort((prev) => {
      if (prev?.key !== key)
        // 内存默认从大到小：点一下就是"谁最吃内存"，反向意义不大
        return { key, dir: key === "memory" ? "desc" : "asc" };
      if (key === "memory") return prev.dir === "desc" ? { key, dir: "asc" } : null;
      return prev.dir === "asc" ? { key, dir: "desc" } : null;
    });

  const items = useMemo(() => {
    const items = buildItems(entries);
    if (!sort) return items;
    const dir = sort.dir === "asc" ? 1 : -1;
    const sorted = [...items];
    if (sort.key === "port") {
      const portOf = (it: Item) => (it.kind === "flat" ? it.entry.port : it.port);
      sorted.sort((a, b) => (portOf(a) - portOf(b)) * dir);
    } else if (sort.key === "memory") {
      // 组按其最大成员定位（用户找的是"哪个端口上有大内存进程"）
      const memOf = (it: Item) =>
        it.kind === "flat"
          ? (it.entry.process?.memory ?? 0)
          : Math.max(...it.members.map((m) => m.process?.memory ?? 0));
      sorted.sort((a, b) => (memOf(a) - memOf(b)) * dir);
      for (const it of sorted) {
        if (it.kind === "group")
          it.members.sort(
            (x, y) =>
              ((x.process?.memory ?? 0) - (y.process?.memory ?? 0)) * dir,
          );
      }
    } else {
      // 组按其最早成员名定位；隐形条目始终垫底，不受方向影响
      const keyOf = (it: Item) =>
        it.kind === "flat"
          ? nameOf(it.entry)
          : it.members.map(nameOf).sort()[0] ?? "￿";
      sorted.sort((a, b) => {
        const ka = keyOf(a);
        const kb = keyOf(b);
        if (ka === "￿" && kb === "￿") return 0;
        if (ka === "￿") return 1;
        if (kb === "￿") return -1;
        return ka.localeCompare(kb, "zh") * dir;
      });
      // 组内成员同名序
      for (const it of sorted) {
        if (it.kind === "group")
          it.members.sort((a, b) => nameOf(a).localeCompare(nameOf(b), "zh") * dir);
      }
    }
    return sorted;
  }, [entries, sort]);

  // 展开集合的键以"当前渲染顺序下的出现序号"去重，先摊平再回填
  const keyOf = useMemo(() => {
    const m = new Map<PortEntryDto, string>();
    const count = new Map<string, number>();
    for (const e of items.flatMap((it) =>
      it.kind === "group" ? it.members : [it.entry],
    )) {
      const base = rowKey(e);
      const n = count.get(base) ?? 0;
      count.set(base, n + 1);
      m.set(e, n === 0 ? base : `${base}~${n}`);
    }
    return m;
  }, [items]);

  return (
    <div className="rounded-lg border bg-card">
      <div
        className={`${GRID} sticky top-0 z-10 h-8 bg-card text-[10px] font-medium text-muted-foreground`}
      >
        <SortHeader label="端口" active={sort?.key === "port"} dir={sort?.dir} onClick={() => cycle("port")} />
        <span>协议</span>
        <span>地址</span>
        <span>状态</span>
        <SortHeader label="进程" active={sort?.key === "name"} dir={sort?.dir} onClick={() => cycle("name")} />
        <SortHeader label="内存" active={sort?.key === "memory"} dir={sort?.dir} className="justify-end" onClick={() => cycle("memory")} />
        <span />
      </div>
      <div className="divide-y divide-border">
        {items.map((it) =>
          it.kind === "flat" ? (
            <PortRow
              key={keyOf.get(it.entry)}
              entry={it.entry}
              open={expanded.has(keyOf.get(it.entry)!)}
              onToggle={() => onToggle(keyOf.get(it.entry)!)}
              killing={killing.has(it.entry.process?.pid ?? -1)}
              result={
                it.entry.process ? results.get(it.entry.process.pid) : undefined
              }
              onKill={onKill}
            />
          ) : (
            <GroupCard
              key={`g${it.port}/${it.protocol}`}
              group={it}
              busy={it.processes.some((p) => killing.has(p.pid))}
              keyOf={keyOf}
              expanded={expanded}
              onToggle={onToggle}
              killing={killing}
              results={results}
              onKill={onKill}
              onKillGroup={onKillGroup}
            />
          ),
        )}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  className = "",
  onClick,
}: {
  label: string;
  active: boolean;
  dir?: Sort["dir"];
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="点击排序（再点切换方向）"
      className={`flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground ${className}`}
    >
      {label}
      {active &&
        (dir === "asc" ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        ))}
    </button>
  );
}

/** 行内点击复制（不触发行的展开）。 */
function copy(ev: { stopPropagation: () => void }, text: string, what: string) {
  ev.stopPropagation();
  void navigator.clipboard.writeText(text);
  toast.success(`已复制${what}：${text}`);
}

/** 组：底色横条头（端口号 + 概要 + 全部终止），成员行沿用数据网格。 */
function GroupCard({
  group,
  busy,
  keyOf,
  expanded,
  onToggle,
  killing,
  results,
  onKill,
  onKillGroup,
}: {
  group: Extract<Item, { kind: "group" }>;
  busy: boolean;
  keyOf: Map<PortEntryDto, string>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  killing: Set<number>;
  results: Map<number, RowResult>;
  onKill: (process: ProcessDto) => void;
  onKillGroup: (processes: ProcessDto[]) => void;
}) {
  const invisible = group.members.filter((m) => !m.process).length;
  const mem = group.processes.reduce((s, p) => s + p.memory, 0);
  const meta = [
    "SO_REUSEPORT",
    mem > 0 ? `合计 ${fmtBytes(mem)}` : null,
    invisible > 0 ? `+${invisible} 条不可见` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="bg-muted/30">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-1.5">
        <span
          title="点击复制端口号"
          onClick={(ev) => copy(ev, String(group.port), "端口")}
          className="cursor-copy font-mono text-[13px] font-bold text-primary hover:underline"
        >
          {group.port}
        </span>
        <span
          className={`font-mono text-[10px] font-bold uppercase ${
            group.protocol === "tcp" ? "text-tcp" : "text-udp"
          }`}
        >
          {group.protocol}
        </span>
        <span className="text-[11px] font-medium">
          {group.processes.length} 个进程共用
        </span>
        <span className="text-[10px] text-muted-foreground">
          {meta.join(" · ")}
        </span>
        <span className="ml-auto">
          <Button
            size="xs"
            variant="dangerGhost"
            disabled={busy}
            onClick={() => onKillGroup(group.processes)}
          >
            {busy ? <Loader className="animate-spin" /> : <ZapOff />}
            全部终止
          </Button>
        </span>
      </div>
      <div className="divide-y divide-border/60 border-t border-border/60 bg-card">
        {group.members.map((m) => (
          <PortRow
            key={keyOf.get(m)}
            entry={m}
            member
            open={expanded.has(keyOf.get(m)!)}
            onToggle={() => onToggle(keyOf.get(m)!)}
            killing={killing.has(m.process?.pid ?? -1)}
            result={m.process ? results.get(m.process.pid) : undefined}
            onKill={onKill}
          />
        ))}
      </div>
    </div>
  );
}

function PortRow({
  entry: e,
  member,
  open,
  onToggle,
  killing,
  result,
  onKill,
}: {
  entry: PortEntryDto;
  /** 组内成员行：首格以折角箭头示意从属，协议列并入组头 */
  member?: boolean;
  open: boolean;
  onToggle: () => void;
  killing: boolean;
  result?: RowResult;
  onKill: (process: ProcessDto) => void;
}) {
  const p = e.process;

  return (
    <div>
      <div
        onClick={onToggle}
        title="点击行展开详情"
        className={`${GRID} cursor-pointer py-1.5 transition-colors hover:bg-muted/40 ${
          p?.risk === "critical" ? "bg-danger/4" : ""
        }`}
      >
        <span className="flex items-center">
          {member ? (
            <CornerDownRight className="size-3 text-muted-foreground/60" />
          ) : (
            <span
              title="点击复制端口号"
              onClick={(ev) => copy(ev, String(e.port), "端口")}
              className="cursor-copy font-mono text-[13px] font-semibold text-primary hover:underline"
            >
              {e.port}
            </span>
          )}
        </span>
        <span>
          {!member && (
            <span
              className={`font-mono text-[10px] font-bold uppercase ${
                e.protocol === "tcp" ? "text-tcp" : "text-udp"
              }`}
            >
              {e.protocol}
            </span>
          )}
        </span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {e.localAddr}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {e.state === "LISTEN" ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-ok" />
              LISTEN
            </span>
          ) : (
            (e.state ?? "—")
          )}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <ChevronRight
            className={`size-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          />
          {p ? (
            <>
              <span className="max-w-64 truncate text-xs font-medium">
                {p.name}
              </span>
              <span
                title="点击复制 pid"
                onClick={(ev) => copy(ev, String(p.pid), "pid")}
                className="cursor-copy font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              >
                pid {p.pid}
                {p.user ? ` · ${p.user}` : ""}
              </span>
              {p.risk === "critical" && (
                <Badge variant="crit">⚠ 受保护</Badge>
              )}
              {p.risk === "caution" && <Badge variant="warn">系统账户</Badge>}
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              无法获取（可能需要提权）
            </span>
          )}
        </span>
        <span
          title="常驻内存（RSS），点表头可按内存排序"
          className="text-right font-mono text-[11px] tabular-nums text-muted-foreground"
        >
          {p && p.memory > 0 ? fmtBytes(p.memory) : "—"}
        </span>
        <span className="text-right">
          {p && (
            <Button
              variant="dangerGhost"
              size="xs"
              disabled={killing}
              onClick={(ev) => {
                ev.stopPropagation();
                onKill(p);
              }}
            >
              {killing ? (
                <>
                  <Loader className="animate-spin" /> 终止中
                </>
              ) : (
                "终止"
              )}
            </Button>
          )}
        </span>
      </div>

      {result && (
        <div
          className={`py-1 pl-16 font-mono text-[11px] ${result.ok ? "text-ok" : "text-danger"}`}
        >
          {result.ok ? "✓" : "✕"} {result.text}
        </div>
      )}

      {open && <PortDetail entry={e} />}
    </div>
  );
}
