import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Toaster, toast } from "sonner";

import {
  isElevated,
  killProcesses,
  loadBackgroundImage,
  relaunchElevated,
  scanPorts,
  setCloseToQuit,
  setTrayVisible,
} from "@/api";
import { applyAccent } from "@/accent";
import { bgLayerStyle } from "@/bg";
import ElevationBanner from "@/components/ElevationBanner";
import KillDialog from "@/components/KillDialog";
import PortTable, { rowKey, type RowResult } from "@/components/PortTable";
import SettingsDialog from "@/components/SettingsDialog";
import TopBar from "@/components/TopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings } from "@/settings";
import { useTheme } from "@/theme";
import type { PortEntryDto, ProcessDto } from "@/types";

export default function App() {
  const [entries, setEntries] = useState<PortEntryDto[]>([]);
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [killing, setKilling] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<Map<number, RowResult>>(new Map());
  const [killTarget, setKillTarget] = useState<ProcessDto | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [elevConfirmOpen, setElevConfirmOpen] = useState(false);
  const [elevated, setElevated] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  const { settings } = useSettings();
  const { resolved } = useTheme();

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setEntries(await scanPorts());
    } catch (e) {
      toast.error(`扫描失败：${e}`);
    } finally {
      setRefreshing(false);
    }
  }, []);

  /** 重新读取背景图（选择 / 移除 / 恢复默认后由设置窗口调用）。 */
  const reloadBg = useCallback(async () => {
    try {
      setBgUrl(await loadBackgroundImage());
    } catch {
      setBgUrl(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void isElevated().then(setElevated, () => setElevated(false));
    void reloadBg();
  }, [refresh, reloadBg]);

  // 主题色：内联覆盖 --primary，跟随明暗切换取对应档位
  useEffect(() => {
    applyAccent(settings.accent, resolved);
  }, [settings.accent, resolved]);

  // 托盘与关闭行为同步到 Rust 侧；托盘关闭时强制"关闭即退出"，
  // 否则窗口隐藏后没有任何入口可以唤回
  useEffect(() => {
    void setTrayVisible(settings.showTrayIcon).catch(() => {});
  }, [settings.showTrayIcon]);
  useEffect(() => {
    const quit = settings.closeToQuit || !settings.showTrayIcon;
    void setCloseToQuit(quit).catch(() => {});
  }, [settings.closeToQuit, settings.showTrayIcon]);

  // 自动刷新：开关与频率都来自设置
  useEffect(() => {
    if (!settings.autoRefresh) return;
    const timer = setInterval(() => void refresh(), settings.intervalMs);
    return () => clearInterval(timer);
  }, [settings.autoRefresh, settings.intervalMs, refresh]);

  // "/" 聚焦搜索框
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const input = document.querySelector<HTMLInputElement>("[data-search]");
        if (input && document.activeElement !== input) {
          e.preventDefault();
          input.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const visibleEntries = useMemo(() => {
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
  }, [entries, keyword]);

  const invisibleCount = useMemo(
    () => entries.filter((e) => !e.process).length,
    [entries],
  );

  const stats = useMemo(() => {
    const pids = new Set(
      entries.map((e) => e.process?.pid).filter(Boolean) as number[],
    );
    const critical = entries.filter(
      (e) => e.process?.risk === "critical",
    ).length;
    return { total: entries.length, pids: pids.size, critical };
  }, [entries]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const confirmKill = async (p: ProcessDto, force: boolean) => {
    setKillTarget(null);
    setKilling((prev) => new Set(prev).add(p.pid));
    results.delete(p.pid);
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
      void refresh();
    }
  };

  const doRelaunch = async () => {
    setElevConfirmOpen(false);
    try {
      await relaunchElevated();
      toast.info("正在请求管理员权限，当前窗口将关闭…");
    } catch (e) {
      toast.error(`提权重启失败：${e}`);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* 背景图：垫在内容与光晕之下，卡片 / 对话框保持不透明以保证可读性 */}
      {bgUrl && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={bgLayerStyle(bgUrl, settings.bg)}
        />
      )}

      <TopBar
        keyword={keyword}
        onKeyword={setKeyword}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {!elevated && (
        <ElevationBanner
          invisibleCount={invisibleCount}
          onRelaunch={() => setElevConfirmOpen(true)}
        />
      )}

      <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {/* 有背景图时列表垫一张不透明卡片，保证可读性 */}
        <div
          className={
            bgUrl
              ? "rounded-2xl border border-border bg-card px-3 py-1 shadow-lg"
              : ""
          }
        >
          {visibleEntries.length > 0 ? (
            <PortTable
              entries={visibleEntries}
              expanded={expanded}
              onToggle={toggle}
              killing={killing}
              results={results}
              onKill={setKillTarget}
            />
          ) : (
            <div className="grid place-items-center py-24 text-muted-foreground">
              <div className="text-5xl">🎉</div>
              <p className="mt-3 text-sm">
                {keyword ? "没有匹配的端口占用" : "当前没有端口被占用"}
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="flex items-center justify-between border-t border-border bg-card/40 px-5 py-2 text-[11.5px] text-muted-foreground backdrop-blur-xl">
        <span className="flex items-center gap-2">
          {stats.total} 条占用 · {stats.pids} 个进程
          {stats.critical > 0 && ` · 受保护 ${stats.critical}`}
          {elevated && <Badge variant="warn">管理员模式</Badge>}
        </span>
        <span>终止顺序：SIGTERM → 3s 宽限 → SIGKILL</span>
      </footer>

      <KillDialog
        target={killTarget}
        onClose={() => setKillTarget(null)}
        onConfirm={(p, force) => void confirmKill(p, force)}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        bgSet={bgUrl !== null}
        onBgChanged={() => reloadBg()}
      />

      <Dialog
        open={elevConfirmOpen}
        onOpenChange={setElevConfirmOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warn">
              <ShieldAlert className="size-4.5" />
              以管理员权限重启？
            </DialogTitle>
            <DialogDescription>
              将请求系统管理员授权并重启应用。提权后<b>所有</b>进程可见、可终止
              ——包括系统组件，误操作的破坏面也会变大；root / 其他用户的进程
              也只有这样才能看到。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setElevConfirmOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void doRelaunch()}>
              授权并重启
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster
        theme={resolved}
        richColors
        position="bottom-center"
        toastOptions={{ style: { userSelect: "none" } }}
      />
    </div>
  );
}

// rowKey 从 PortTable 复导出给测试/未来模块使用
export { rowKey };
