import {
  ListTree,
  Loader,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/providers/settings";
import { useTheme, type ThemePreference } from "@/providers/theme";

export type ViewMode = "query" | "list";

interface TopBarProps {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  keyword: string;
  onKeyword: (value: string) => void;
  /** 过滤后的条数（有关键字时显示"匹配/总数"；速查模式搜索在首页大框） */
  matchCount: number;
  totalCount: number;
  onRefresh: () => void;
  refreshing: boolean;
  onOpenSettings: () => void;
}

const THEME_CYCLE: ThemePreference[] = ["system", "light", "dark"];
const THEME_META: Record<
  ThemePreference,
  { icon: typeof Sun; label: string }
> = {
  system: { icon: Monitor, label: "跟随系统" },
  light: { icon: Sun, label: "亮色" },
  dark: { icon: Moon, label: "暗色" },
};

/** 应用顶栏：品牌 / 搜索 / 刷新与外观入口（跨领域的应用级组件）。 */
export default function TopBar({
  mode,
  onMode,
  keyword,
  onKeyword,
  matchCount,
  totalCount,
  onRefresh,
  refreshing,
  onOpenSettings,
}: TopBarProps) {
  const { settings, update } = useSettings();
  const { preference, setPreference } = useTheme();

  const cycleTheme = () => {
    const next =
      THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length]!;
    setPreference(next);
  };

  const ThemeIcon = THEME_META[preference].icon;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border/80 bg-card/80 px-5 py-3 backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div className="relative grid size-10 place-items-center overflow-hidden rounded-xl border border-primary/30 bg-linear-to-br from-primary/20 via-primary/8 to-transparent shadow-[0_0_24px_var(--glow-1)]">
          <span className="absolute -right-2 -top-2 size-6 rounded-full bg-primary/20 blur-md" />
          <Zap className="size-5 text-primary" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="text-[17px] font-bold tracking-wide">端口终结者</h1>
          <p className="mt-0.5 text-[11px] tracking-wide text-muted-foreground">
            PORT PROCESS MANAGER
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {mode === "query" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMode("list")}
            title="切换到列表模式，浏览全部端口占用"
          >
            <ListTree />
            浏览全部
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMode("query")}
            title="切换到速查模式，按端口号 / 进程名直接定位"
          >
            <Zap />
            速查
          </Button>
        )}

        {mode === "list" && (
          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-muted/50 px-3 py-1.5 transition-colors focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px] focus-within:shadow-primary/15">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            data-search
            value={keyword}
            onChange={(e) => onKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && keyword) {
                onKeyword("");
                e.currentTarget.blur();
              }
            }}
            placeholder="端口 / 地址 / PID / 进程 / 用户，按 / 聚焦"
            className="w-52 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          {keyword && (
            <>
              <span
                className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                title="匹配条数 / 总条数"
              >
                {matchCount}/{totalCount}
              </span>
              <button
                type="button"
                onClick={() => onKeyword("")}
                title="清空搜索（Esc）"
                className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </>
          )}
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70">
          <Switch
            checked={settings.autoRefresh}
            onCheckedChange={(v) => update({ autoRefresh: v })}
          />
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 rounded px-1 py-0.5 font-mono hover:bg-muted hover:text-foreground"
            title="在设置中调整刷新频率"
          >
            {settings.autoRefresh && (
              <span className="size-1.5 animate-pulse rounded-full bg-ok" />
            )}
            {settings.intervalMs / 1000}s
          </button>
        </label>

        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          刷新
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          title={`主题：${THEME_META[preference].label}（点击切换）`}
        >
          <ThemeIcon />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          title="设置"
        >
          <Settings />
        </Button>
      </div>
    </header>
  );
}
