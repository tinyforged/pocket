import { Check, Copy, FileDown, Trash2 } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  clearLogs,
  describeError,
  exportLogs,
  getRecentLogs,
  writeFrontendLog,
} from "@/api/logging";
import type { LogEntryDto } from "@/api/types";
import { copyText } from "@/lib/clipboard";
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

const logKey = (entry: LogEntryDto) =>
  `${entry.time}\0${entry.level}\0${entry.message}`;

/** 与屏幕所见一致的单行文本（级别补齐到 5 字符对齐）。 */
const formatLine = (l: LogEntryDto) =>
  `${l.time} [${l.level.toUpperCase().padEnd(5)}] ${l.message}`;

interface LogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 实时日志：打开时先取存量，再订阅 pk://log 追加；跟随滚动 + 导出 + 清空。 */
export default function LogDialog({ open, onOpenChange }: LogDialogProps) {
  const [logs, setLogs] = useState<LogEntryDto[]>([]);
  const [filter, setFilter] = useState<Filter>("全部");
  const [follow, setFollow] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 打开时取存量 + 订阅实时事件
  useEffect(() => {
    if (!open) return;
    let active = true;
    let initialLoaded = false;
    const incoming: LogEntryDto[] = [];
    let unlisten: (() => void) | undefined;

    const receive = (entry: LogEntryDto) => {
      if (!initialLoaded) {
        incoming.push(entry);
        return;
      }
      setLogs((prev) => [...prev.slice(-999), entry]);
    };

    void (async () => {
      try {
        const stop = await listen<LogEntryDto>("pk://log", (event) =>
          receive(event.payload),
        );
        if (!active) {
          stop();
          return;
        }
        unlisten = stop;
      } catch (error) {
        if (active) toast.error(`订阅实时日志失败：${error}`);
      }

      try {
        const recent = await getRecentLogs();
        if (!active) return;
        const known = new Set(recent.map(logKey));
        setLogs(
          [...recent, ...incoming.filter((entry) => !known.has(logKey(entry)))].slice(-1000),
        );
        initialLoaded = true;
      } catch (error) {
        if (active) {
          setLogs(incoming.slice(-1000));
          toast.error(`读取日志失败：${error}`);
        }
        initialLoaded = true;
      }
    })();

    return () => {
      active = false;
      unlisten?.();
    };
  }, [open]);

  const visible = logs.filter((l) => FILTER_MATCH[filter](l.level));

  // 跟随滚动：新日志到来时贴底
  useEffect(() => {
    if (follow && open) listRef.current?.scrollTo({ top: 1e9 });
  }, [visible.length, follow, open]);

  const exportAll = async () => {
    await writeFrontendLog("info", "开始导出应用日志");
    try {
      const path = await exportLogs();
      if (path) {
        await writeFrontendLog("info", `日志已导出：${path}`);
        toast.success(`日志已导出：${path}`);
      }
    } catch (e) {
      await writeFrontendLog("error", `导出日志失败：${describeError(e)}`);
      toast.error(`导出失败：${e}`);
    }
  };

  const clear = async () => {
    try {
      await clearLogs();
      setLogs([]);
      toast.success("日志已清空");
    } catch (e) {
      await writeFrontendLog("error", `清空日志失败：${describeError(e)}`);
      toast.error(String(e));
    }
  };

  // 复制当前筛选下的可见日志（与"导出"分工：复制跟筛选、限内存缓冲；导出走完整落盘历史）。
  // 纯瞬时 UI 操作，不写应用日志，toast 反馈即可。
  const copyAll = async () => {
    if (visible.length === 0) return;
    if (await copyText(visible.map(formatLine).join("\n"))) {
      toast.success(`已复制 ${visible.length} 条日志`);
    } else {
      toast.error("复制失败");
    }
  };

  // 单行复制：就地 ✓ 反馈，不弹 toast（连续复制时不吵）
  const copyOne = async (l: LogEntryDto) => {
    if (!(await copyText(formatLine(l)))) {
      toast.error("复制失败");
      return;
    }
    const key = logKey(l);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-140 max-h-[80vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">实时日志</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              最新 1000 条实时滚动，完整记录已落盘（1MB 自动轮转）。
            </p>
          </div>
          {/* 右上角留给弹窗自带的关闭按钮 */}
          <div className="mr-10 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={visible.length === 0}
              onClick={() => void copyAll()}
            >
              <Copy className="size-3.5" />
              复制
            </Button>
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
              <div key={i} className="group relative flex gap-2">
                <span className="shrink-0 text-muted-foreground">{l.time}</span>
                <span className={`shrink-0 ${LEVEL_STYLE[l.level]}`}>
                  [{l.level.toUpperCase().padEnd(5)}]
                </span>
                <span className="break-all whitespace-pre-wrap text-foreground/90">
                  {l.message}
                </span>
                <button
                  type="button"
                  title="复制此行"
                  onClick={() => void copyOne(l)}
                  className="absolute right-0 top-0 rounded-sm bg-muted/90 p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  {copiedKey === logKey(l) ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
