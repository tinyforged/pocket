import { Loader } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AppToaster from "@/components/AppToaster";
import SettingsDialog from "@/settings/SettingsDialog";
import BackgroundLayer from "@/appearance/BackgroundLayer";
import { useAppearanceSync } from "@/appearance/useAppearanceSync";
import { Badge } from "@/components/ui/badge";
import TopBar from "@/components/TopBar";
import ElevationBanner from "@/elevation/ElevationBanner";
import RelaunchDialog from "@/elevation/RelaunchDialog";
import { useElevation } from "@/elevation/useElevation";
import LogDialog from "@/logging/LogDialog";
import KillDialog from "@/ports/KillDialog";
import { useKill } from "@/ports/kill";
import ListSkeleton from "@/ports/ListSkeleton";
import PortTable from "@/ports/PortTable";
import PortFilters, { type ProtocolFilter } from "@/ports/PortFilters";
import QueryLanding from "@/ports/QueryLanding";
import ScanTime from "@/ports/ScanTime";
import { filterEntries, portRangeHint, summarize, usePortScan } from "@/ports/scan";
import type { ViewMode } from "@/components/TopBar";

const MODE_KEY = "pk.mode";

function readMode(): ViewMode {
  return localStorage.getItem(MODE_KEY) === "list" ? "list" : "query";
}

/**
 * 页面骨架：领域模块（ports / elevation / appearance）在此拼装，
 * 自身只保留与布局绑定的少量本地状态。
 */
export default function App() {
  const [keyword, setKeyword] = useState("");
  const [protocolFilter, setProtocolFilter] = useState<ProtocolFilter>("all");
  const [listeningOnly, setListeningOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [elevConfirmOpen, setElevConfirmOpen] = useState(false);
  /** 速查（首页）= 搜索优先；列表 = 浏览全部。记忆上次选择 */
  const [mode, setMode] = useState<ViewMode>(readMode);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const { entries, refreshing, refresh, loaded, lastScanAt } = usePortScan();
  const kill = useKill(refresh);
  const elevated = useElevation();
  const { bgUrl, reloadBg } = useAppearanceSync();

  const searchEntries = useMemo(
    () => filterEntries(entries, keyword),
    [entries, keyword],
  );
  const visibleEntries = useMemo(
    () => searchEntries.filter((entry) =>
      (protocolFilter === "all" || entry.protocol === protocolFilter) &&
      (!listeningOnly || entry.state === "LISTEN"),
    ),
    [searchEntries, protocolFilter, listeningOnly],
  );
  const hasRefinement = Boolean(
    keyword || protocolFilter !== "all" || listeningOnly,
  );
  const stats = useMemo(() => summarize(entries), [entries]);

  // "/" 聚焦搜索框；正在任何输入元素上打字时让位，不抢焦点
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey) return;
      const active = document.activeElement;
      const typing =
        active instanceof HTMLElement &&
        (active.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName));
      if (typing) return;
      const input = document.querySelector<HTMLInputElement>("[data-search]");
      if (input && active !== input) {
        e.preventDefault();
        input.focus();
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
        mode={mode}
        onMode={setMode}
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

      {/* 横纵滚动统一由 main 承担：内层再包 overflow-x-auto 会变成独立滚动盒，
          表头 sticky 的最近滚动容器就不再是 main，吸顶随之失效 */}
      <main className="min-h-0 flex-1 overflow-auto px-4 pb-3">
        {mode === "query" ? (
          <QueryLanding
            keyword={keyword}
            onKeyword={setKeyword}
            loaded={loaded}
            stats={stats}
            matchCount={visibleEntries.length}
            bgSet={bgUrl !== null}
            searchEntries={searchEntries}
            protocol={protocolFilter}
            listeningOnly={listeningOnly}
            onProtocolChange={setProtocolFilter}
            onListeningChange={setListeningOnly}
            hasRefinement={hasRefinement}
            onBrowseAll={() => setMode("list")}
            results={
              <>
                {visibleEntries.length > 0 ? (
                  <PortTable
                    entries={visibleEntries}
                    expanded={expanded}
                    onToggle={toggle}
                    killing={kill.killing}
                    results={kill.results}
                    onKill={(p) => kill.setPending([p])}
                    onKillGroup={(ps) => kill.setPending(ps)}
                  />
                ) : (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <p>
                      {hasRefinement
                        ? "没有符合条件的端口占用"
                        : "没有匹配的端口占用"}
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                      {keyword
                        ? "试试端口号、地址、PID、进程名或用户，Esc 清空搜索"
                        : "可以调整协议或监听状态筛选"}
                    </p>
                  </div>
                )}
              </>
            }
          />
        ) : (
          /* 有背景图时列表垫一张不透明卡片，保证可读性 */
          <div className={bgUrl ? "rounded-xl bg-card p-3" : undefined}>
            <PortFilters
              protocol={protocolFilter}
              listeningOnly={listeningOnly}
              onProtocolChange={setProtocolFilter}
              onListeningChange={setListeningOnly}
              entries={searchEntries}
            />
            {!loaded ? (
              <ListSkeleton />
            ) : visibleEntries.length > 0 ? (
              <PortTable
                entries={visibleEntries}
                expanded={expanded}
                onToggle={toggle}
                killing={kill.killing}
                results={kill.results}
                onKill={(p) => kill.setPending([p])}
                onKillGroup={(ps) => kill.setPending(ps)}
              />
            ) : (
              <div className="py-14 text-center text-xs text-muted-foreground">
                <p>
                  {portRangeHint(keyword) ??
                    (hasRefinement
                      ? "没有符合条件的端口占用"
                      : "当前没有端口被占用")}
                </p>
                {hasRefinement && !portRangeHint(keyword) && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                    {keyword
                      ? "试试端口号、地址、PID、进程名或用户，Esc 清空搜索"
                      : "可以调整协议或监听状态筛选"}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="flex items-center border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-2">
          {stats.total} 条占用 · {stats.pids} 个进程
          {stats.critical > 0 && ` · 受保护 ${stats.critical}`}
          {elevated && <Badge variant="warn">管理员模式</Badge>}
          {refreshing && <Loader className="size-3 animate-spin" />}
          <ScanTime at={lastScanAt} />
        </span>
      </footer>

      <KillDialog
        targets={kill.pending}
        onClose={() => kill.setPending(null)}
        onConfirm={(ps, force) => void kill.confirm(ps, force)}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        bgSet={bgUrl !== null}
        onBgChanged={reloadBg}
        onOpenLogs={() => setLogOpen(true)}
      />

      <LogDialog open={logOpen} onOpenChange={setLogOpen} />

      <RelaunchDialog open={elevConfirmOpen} onOpenChange={setElevConfirmOpen} />

      <AppToaster />
    </div>
  );
}
