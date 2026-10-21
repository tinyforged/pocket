import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PortEntryDto } from "@/api/types";

/** 行内详情：exe / cwd / 命令行 / 父进程 + 复制等效 kill 命令。 */
export default function PortDetail({ entry: e }: { entry: PortEntryDto }) {
  const p = e.process;

  if (!p) {
    return (
      <div className="ml-14 mb-1.5 rounded-r-xl border-l-2 border-primary/50 bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        进程信息不可见：root / 其他用户的进程需要以提权方式运行才能看到
        （右上角"提权重启"，或终端里 <code className="font-mono">sudo pk port</code>）。
      </div>
    );
  }

  const lines: [string, string][] = [
    ["exe", p.exe],
    ["cwd", p.cwd],
    ["cmd", p.cmd.length ? p.cmd.join(" ") : null],
    ["ppid", p.parent != null ? String(p.parent) : null],
  ].filter(([, v]) => v != null) as [string, string][];

  return (
    <div className="ml-14 mb-1.5 flex flex-col items-start gap-1.5 rounded-r-xl border-l-2 border-primary/50 bg-muted px-4 py-3">
      {lines.length === 0 ? (
        <span className="text-xs text-muted-foreground">无更多信息</span>
      ) : (
        lines.map(([k, v]) => (
          <div key={k} className="flex w-full gap-3 text-xs">
            <span className="w-10 shrink-0 font-mono text-primary">{k}</span>
            <span className="min-w-0 break-all font-mono text-foreground select-text">
              {v}
            </span>
          </div>
        ))
      )}
      <Button
        variant="ghost"
        size="xs"
        className="mt-1 font-mono"
        onClick={() => {
          void navigator.clipboard.writeText(`kill -9 ${p.pid}`);
        }}
      >
        <Copy /> 复制 kill -9 {p.pid}
      </Button>
    </div>
  );
}
