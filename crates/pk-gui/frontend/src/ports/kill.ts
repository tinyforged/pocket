/** 终止流程：目标选择、执行中状态、行内结果与 toast。 */
import { useState } from "react";
import { toast } from "sonner";

import { killProcesses } from "@/api/ports";
import type { ProcessDto } from "@/api/types";

export interface RowResult {
  ok: boolean;
  text: string;
}

export function useKill(onSettled: () => void | Promise<void>) {
  const [target, setTarget] = useState<ProcessDto | null>(null);
  const [killing, setKilling] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<Map<number, RowResult>>(new Map());

  const confirm = async (p: ProcessDto, force: boolean) => {
    setTarget(null);
    setKilling((prev) => new Set(prev).add(p.pid));
    setResults((prev) => {
      const next = new Map(prev);
      next.delete(p.pid);
      return next;
    });
    try {
      const list = await killProcesses(
        [{ pid: p.pid, startTime: p.startTime }],
        force,
      );
      const r = list[0]!;
      const text = r.outcome ?? r.message;
      setResults((prev) => new Map(prev).set(p.pid, { ok: r.ok, text }));
      if (r.ok) toast.success(`pid ${p.pid}：${text}`);
      else toast.error(`pid ${p.pid}：${text}`);
    } catch (e) {
      toast.error(`终止失败：${e}`);
    } finally {
      setKilling((prev) => {
        const next = new Set(prev);
        next.delete(p.pid);
        return next;
      });
      await onSettled();
    }
  };

  return { target, setTarget, killing, results, confirm };
}
