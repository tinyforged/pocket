import { Loader } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";

import SettingsDialog from "@/appearance/settings/SettingsDialog";
import BackgroundLayer from "@/appearance/BackgroundLayer";
import { useAppearanceSync } from "@/appearance/useAppearanceSync";
import { Badge } from "@/components/ui/badge";
import TopBar from "@/components/TopBar";
import ElevationBanner from "@/elevation/ElevationBanner";
import RelaunchDialog from "@/elevation/RelaunchDialog";
import { useElevation } from "@/elevation/useElevation";
import KillDialog from "@/ports/KillDialog";
import { useKill } from "@/ports/kill";
import ListSkeleton from "@/ports/ListSkeleton";
import PortTable from "@/ports/PortTable";
import ScanTime from "@/ports/ScanTime";
import { filterEntries, summarize, usePortScan } from "@/ports/scan";
import { useTheme } from "@/providers/theme";

/**
 * 页面骨架：领域模块（ports / elevation / appearance）在此拼装，
 * 自身只保留与布局绑定的少量本地状态。
 */
export default function App() {
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [elevConfirmOpen, setElevConfirmOpen] = useState(false);

  const { resolved } = useTheme();
  const { entries, refreshing, refresh, loaded, lastScanAt } = usePortScan();
  const kill = useKill(refresh);
  const elevated = useElevation();
  const { bgUrl, reloadBg } = useAppearanceSync();

  const visibleEntries = useMemo(
    () => filterEntries(entries, keyword),
    [entries, keyword],
  );
  const stats = useMemo(() => summarize(entries), [entries]);

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

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* 背景图：垫在内容与光晕之下，卡片 / 对话框保持不透明以保证可读性 */}
      <BackgroundLayer url={bgUrl} />

      <TopBar
        keyword={keyword}
        onKeyword={setKeyword}
        matchCount={visibleEntries.length}
        totalCount={entries.length}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {!elevated && (
        <ElevationBanner
          invisibleCount={stats.invisibleCount}
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
          {!loaded ? (
            <ListSkeleton />
          ) : visibleEntries.length > 0 ? (
            <PortTable
              entries={visibleEntries}
              expanded={expanded}
              onToggle={toggle}
              killing={kill.killing}
              results={kill.results}
              onKill={kill.setTarget}
            />
          ) : (
            <div className="grid place-items-center py-24 text-muted-foreground">
              <div className="text-5xl">{keyword ? "🔍" : "🎉"}</div>
              <p className="mt-3 text-sm">
                {keyword
                  ? "没有匹配的端口占用（Esc 清空搜索）"
                  : "当前没有端口被占用"}
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
          {refreshing && <Loader className="size-3 animate-spin" />}
          <ScanTime at={lastScanAt} />
        </span>
        <span>终止顺序：SIGTERM → 3s 宽限 → SIGKILL</span>
      </footer>

      <KillDialog
        target={kill.target}
        onClose={() => kill.setTarget(null)}
        onConfirm={(p, force) => void kill.confirm(p, force)}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        bgSet={bgUrl !== null}
        onBgChanged={reloadBg}
      />

      <RelaunchDialog open={elevConfirmOpen} onOpenChange={setElevConfirmOpen} />

      <Toaster
        theme={resolved}
        richColors
        position="bottom-center"
        toastOptions={{ style: { userSelect: "none" } }}
      />
    </div>
  );
}
