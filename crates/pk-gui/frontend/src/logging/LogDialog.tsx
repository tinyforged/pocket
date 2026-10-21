import { FileDown, Trash2 } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { clearLogs, exportLogs, getRecentLogs } from "@/api/logging";
import type { LogEntryDto } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const LEVEL_STYLE: Record<LogEntryDto["level"], string> = {
  info: "text-foreground",
  warn: "text-amber-500",
  error: "text-red-500",
};

const FILTERS = ["全部", "信息", "警告", "错误"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_MATCH: Record<Filter, (l: LogEntryDto["level"]) => boolean> = {
  全部: () => true,
  信息: (l) => l === "info",
  警告: (l) => l === "warn",
  错误: (l) => l === "error",
};

interface LogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 实时日志：打开时先取存量，再订阅 pk://log 追加；跟随滚动 + 导出 + 清空。 */
export default function LogDialog({ open, onOpenChange }: LogDialogProps) {
  const [logs, setLogs] = useState<LogEntryDto[]>([]);
  const [filter, setFilter] = useState<Filter>("全部");
  const [follow, setFollow] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // 打开时取存量 + 订阅实时事件
  useEffect(() => {
    if (!open) return;
    void getRecentLogs().then(setLogs);
    const un = listen<LogEntryDto>("pk://log", (e) =>
      setLogs((prev) => [...prev.slice(-999), e.payload]),
    );
    return () => {
      void un.then((f) => f());
    };
  }, [open]);

  const visible = logs.filter((l) => FILTER_MATCH[filter](l.level));

  // 跟随滚动：新日志到来时贴底
  useEffect(() => {
    if (follow && open) listRef.current?.scrollTo({ top: 1e9 });
  }, [visible.length, follow, open]);

  const exportAll = async () => {
    try {
      const path = await exportLogs();
      if (path) toast.success(`日志已导出：${path}`);
    } catch (e) {
      toast.error(`导出失败：${e}`);
    }
  };

  const clear = async () => {
    try {
      await clearLogs();
      setLogs([]);
      toast.success("日志已清空");
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">实时日志</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              最新 1000 条实时滚动，完整记录已落盘（1MB 自动轮转）。
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void exportAll()}>
              <FileDown className="size-3.5" />
              导出…
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void clear()}>
              <Trash2 className="size-3.5" />
              清空
            </Button>
          </div>
        </header>

        <div className="flex items-center gap-1.5 border-b border-border px-6 py-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                filter === f
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) => setFollow(e.target.checked)}
              className="accent-primary"
            />
            跟随滚动
          </label>
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4 font-mono text-[11.5px] leading-relaxed"
        >
          {visible.length === 0 ? (
            <p className="grid place-items-center py-10 font-sans text-xs text-muted-foreground">
              暂无日志
            </p>
          ) : (
            visible.map((l, i) => (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 text-muted-foreground">{l.time}</span>
                <span className={`shrink-0 ${LEVEL_STYLE[l.level]}`}>
                  [{l.level.toUpperCase().padEnd(5)}]
                </span>
                <span className="break-all whitespace-pre-wrap text-foreground/90">
                  {l.message}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
