import { ArrowDown, ArrowUp, ChevronRight, Loader } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import type { PortEntryDto, ProcessDto } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { RowResult } from "./kill";
import PortDetail from "./PortDetail";

/** 列布局（骨架屏也用） */
export const GRID =
  "grid grid-cols-[72px_60px_140px_100px_minmax(0,1fr)_92px] items-center gap-2.5 px-3";

/** 行标识：同 (port, proto, addr) 的多隐形条目靠调用方追加序号兜底。 */
export function rowKey(e: PortEntryDto): string {
  return `${e.port}/${e.protocol}/${e.localAddr}/${e.process?.pid ?? "x"}`;
}

interface Sort {
  key: "port" | "name";
  dir: "asc" | "desc";
}

interface PortTableProps {
  entries: PortEntryDto[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  killing: Set<number>;
  results: Map<number, RowResult>;
  onKill: (process: ProcessDto) => void;
}

export default function PortTable({
  entries,
  expanded,
  onToggle,
  killing,
  results,
  onKill,
}: PortTableProps) {
  // 排序仅重排显示，不影响 App 层的过滤与统计
  const [sort, setSort] = useState<Sort | null>(null);

  const cycle = (key: Sort["key"]) =>
    setSort((prev) =>
      prev?.key !== key
        ? { key, dir: "asc" }
        : prev.dir === "asc"
          ? { key, dir: "desc" }
          : null,
    );

  const sorted = useMemo(() => {
    if (!sort) return entries;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...entries].sort((a, b) => {
      if (sort.key === "port") return (a.port - b.port) * dir;
      // 隐形条目始终排最后，不受方向影响
      if (!a.process || !b.process) return a.process ? -1 : b.process ? 1 : 0;
      return a.process.name.localeCompare(b.process.name, "zh") * dir;
    });
  }, [entries, sort]);

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={`${GRID} sticky top-0 z-10 pb-2 pt-3 text-[11px] tracking-widest text-muted-foreground bg-card/95 backdrop-blur-md`}
      >
        <SortHeader label="端口" active={sort?.key === "port"} dir={sort?.dir} onClick={() => cycle("port")} />
        <span>协议</span>
        <span>地址</span>
        <span>状态</span>
        <SortHeader label="进程" active={sort?.key === "name"} dir={sort?.dir} onClick={() => cycle("name")} />
        <span />
      </div>
      {sorted.map((e, i) => {
        // 同 (port, proto, addr) 可能有多条"无法获取进程"的记录：
        // 用该 rowKey 的第 n 次出现做后缀，排序重排后身份仍稳定
        const base = rowKey(e);
        const dup = sorted.slice(0, i).filter((x) => rowKey(x) === base).length;
        const key = dup === 0 ? base : `${base}~${dup}`;
        return (
          <PortRow
            key={key}
            entry={e}
            open={expanded.has(key)}
            onToggle={() => onToggle(key)}
            killing={killing.has(e.process?.pid ?? -1)}
            result={e.process ? results.get(e.process.pid) : undefined}
            onKill={onKill}
          />
        );
      })}
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir?: Sort["dir"];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="点击排序（再点切换方向）"
      className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
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

function PortRow({
  entry: e,
  open,
  onToggle,
  killing,
  result,
  onKill,
}: {
  entry: PortEntryDto;
  open: boolean;
  onToggle: () => void;
  killing: boolean;
  result?: RowResult;
  onKill: (process: ProcessDto) => void;
}) {
  const p = e.process;

  return (
    <Fragment>
      <div
        onClick={onToggle}
        title="点击行展开详情"
        className={`${GRID} cursor-pointer rounded-[10px] border-b border-border/60 py-2.5 transition-colors hover:bg-muted/50 ${
          p?.risk === "critical" ? "bg-danger/6" : ""
        }`}
      >
        <span
          title="点击复制端口号"
          onClick={(ev) => copy(ev, String(e.port), "端口")}
          className="cursor-copy font-mono text-[15px] font-bold text-primary hover:underline"
        >
          {e.port}
        </span>
        <span>
          <Badge
            variant={e.protocol === "tcp" ? "protoTcp" : "protoUdp"}
            className="uppercase"
          >
            {e.protocol}
          </Badge>
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {e.localAddr}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
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
            className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          />
          {p ? (
            <>
              <span className="max-w-64 truncate text-[13px] font-semibold">
                {p.name}
              </span>
              <span
                title="点击复制 pid"
                onClick={(ev) => copy(ev, String(p.pid), "pid")}
                className="cursor-copy font-mono text-[11.5px] text-muted-foreground hover:text-foreground hover:underline"
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
            <span className="text-xs text-muted-foreground">
              无法获取（可能需要提权）
            </span>
          )}
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
          className={`py-1 pl-[100px] font-mono text-xs ${result.ok ? "text-ok" : "text-danger"}`}
        >
          {result.ok ? "✓" : "✕"} {result.text}
        </div>
      )}

      {open && <PortDetail entry={e} />}
    </Fragment>
  );
}
