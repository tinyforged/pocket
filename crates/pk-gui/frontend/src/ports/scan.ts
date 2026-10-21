/**
 * 端口扫描：数据获取 + 派生计算（过滤 / 汇总）。
 * 自动刷新的开关与频率来自设置（只读操作，不会自动终止任何进程）。
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { scanPorts } from "@/api/ports";
import type { PortEntryDto } from "@/api/types";
import { useSettings } from "@/providers/settings";

export function usePortScan() {
  const { settings } = useSettings();
  const [entries, setEntries] = useState<PortEntryDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  /** 首次扫描是否完成（区分"加载中"与"真的无占用"） */
  const [loaded, setLoaded] = useState(false);
  /** 最近一次成功扫描的时间戳（页脚相对时间用） */
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setEntries(await scanPorts());
      setLoaded(true);
      setLastScanAt(Date.now());
    } catch (e) {
      toast.error(`扫描失败：${e}`);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!settings.autoRefresh) return;
    const timer = setInterval(() => void refresh(), settings.intervalMs);
    return () => clearInterval(timer);
  }, [settings.autoRefresh, settings.intervalMs, refresh]);

  return { entries, refreshing, refresh, loaded, lastScanAt };
}

/** 按关键字过滤：端口号 / 进程名 / 用户。 */
export function filterEntries(
  entries: PortEntryDto[],
  keyword: string,
): PortEntryDto[] {
  const k = keyword.trim().toLowerCase();
  if (!k) return entries;
  return entries.filter((e) => {
    const p = e.process;
    return (
      String(e.port).includes(k) ||
      (p?.name.toLowerCase().includes(k) ?? false) ||
      (p?.user?.toLowerCase().includes(k) ?? false)
    );
  });
}

/** 列表统计（页脚 / 提权横幅用）。 */
export function summarize(entries: PortEntryDto[]) {
  const pids = new Set(
    entries.map((e) => e.process?.pid).filter(Boolean) as number[],
  );
  return {
    total: entries.length,
    pids: pids.size,
    critical: entries.filter((e) => e.process?.risk === "critical").length,
    invisibleCount: entries.filter((e) => !e.process).length,
  };
}
