import { ChevronRight, Loader } from "lucide-react";
import { Fragment } from "react";

import type { PortEntryDto, ProcessDto } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { RowResult } from "./kill";
import PortDetail from "./PortDetail";

/** 行标识：同 (port, proto, addr) 的多隐形条目靠调用方追加索引兜底。 */
export function rowKey(e: PortEntryDto): string {
  return `${e.port}/${e.protocol}/${e.localAddr}/${e.process?.pid ?? "x"}`;
}

interface PortTableProps {
  entries: PortEntryDto[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  killing: Set<number>;
  results: Map<number, RowResult>;
  onKill: (process: ProcessDto) => void;
}

const GRID =
  "grid grid-cols-[72px_60px_140px_100px_minmax(0,1fr)_92px] items-center gap-2.5 px-3";

export default function PortTable({
  entries,
  expanded,
  onToggle,
  killing,
  results,
  onKill,
}: PortTableProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className={`${GRID} pb-2 pt-3 text-[11px] tracking-widest text-muted-foreground`}>
        <span>端口</span>
        <span>协议</span>
        <span>地址</span>
        <span>状态</span>
        <span>进程</span>
        <span />
      </div>
      {entries.map((e, i) => {
        // 同 (port, proto, addr) 可能有多条"无法获取进程"的记录（不同
        // pid 但都不可见），用索引兜底保证 key 唯一
        const key = `${rowKey(e)}#${i}`;
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
        title="点击展开详情"
        className={`${GRID} cursor-pointer rounded-[10px] border-b border-border/60 py-2.5 transition-colors hover:bg-muted/50 ${
          p?.risk === "critical" ? "bg-danger/6" : ""
        }`}
      >
        <span className="font-mono text-[15px] font-bold text-primary">
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
          {e.state ?? "—"}
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
              <span className="font-mono text-[11.5px] text-muted-foreground">
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
