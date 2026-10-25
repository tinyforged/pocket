/** 终止流程：目标选择（单个 / 端口组批量）、执行中状态、行内结果与 toast。 */
import { useState } from "react";
import { toast } from "sonner";

import { killProcesses } from "@/api/ports";
import type { ProcessDto } from "@/api/types";

export interface RowResult {
  ok: boolean;
  text: string;
}

/** 行内结果展示时长：toast 已留档，行内文字只作即时反馈，到期让位给最新数据 */
const RESULT_TTL_MS = 8000;

export function useKill(onSettled: () => void | Promise<void>) {
  /** 待确认的进程列表：行内"终止"给 1 个，端口组"全部终止"给多个 */
  const [pending, setPending] = useState<ProcessDto[] | null>(null);
  const [killing, setKilling] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<Map<number, RowResult>>(new Map());

  /** 到期清除某 pid 的行内结果（成功的目标行随刷新消失，通常走不到这里）。 */
  const clearLater = (pid: number) => {
    setTimeout(() => {
      setResults((prev) => {
        if (!prev.has(pid)) return prev;
        const next = new Map(prev);
        next.delete(pid);
        return next;
      });
    }, RESULT_TTL_MS);
  };

  const confirm = async (targets: ProcessDto[], force: boolean) => {
    setPending(null);
    for (const p of targets) {
      setKilling((prev) => new Set(prev).add(p.pid));
      setResults((prev) => {
        const next = new Map(prev);
        next.delete(p.pid);
        return next;
      });
    }
    try {
      const list = await killProcesses(
        targets.map((p) => ({ pid: p.pid, startTime: p.startTime })),
        force,
      );
      let ok = 0;
      for (const r of list) {
        const text = r.outcome ?? r.message;
        if (r.ok) ok++;
        setResults((prev) => new Map(prev).set(r.pid, { ok: r.ok, text }));
        clearLater(r.pid);
      }
      if (targets.length > 1) {
        if (ok === list.length) toast.success(`批量终止完成：${ok}/${list.length} 成功`);
        else toast.error(`批量终止：${ok}/${list.length} 成功，其余见行内提示`);
      } else {
        const r = list[0]!;
        const text = r.outcome ?? r.message;
        if (r.ok) toast.success(`pid ${r.pid}：${text}`);
        else toast.error(`pid ${r.pid}：${text}`);
      }
    } catch (e) {
      toast.error(`终止失败：${e}`);
    } finally {
      for (const p of targets) {
        setKilling((prev) => {
          const next = new Set(prev);
          next.delete(p.pid);
          return next;
        });
      }
      await onSettled();
    }
  };

  return { pending, setPending, killing, results, confirm };
}
