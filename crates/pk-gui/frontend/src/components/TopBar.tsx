import {
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
import { cn } from "@/lib/utils";
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

const MODES: Array<{ value: ViewMode; label: string }> = [
  { value: "query", label: "速查" },
  { value: "list", label: "浏览全部" },
];

/** 应用顶栏：品牌 / 模式切换 / 搜索 / 刷新与外观入口（跨领域的应用级组件）。 */
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
    <header className="sticky top-0 z-20 flex h-11 shrink-0 items-center justify-between gap-3 border-b bg-card px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Zap className="size-3.5" strokeWidth={2.5} />
        </div>
        <h1 className="shrink-0 text-[13px] font-semibold">Pocket</h1>

        {/* 分段式模式切换：两个模式始终可见，当前项即所见 */}
        <div className="ml-1.5 flex items-center rounded-lg bg-muted p-0.5">
          {MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onMode(value)}
              aria-pressed={mode === value}
              title={
                value === "query"
                  ? "按端口号 / 进程名直接定位"
                  : "列表浏览全部端口占用"
              }
              className={cn(
                "h-6 cursor-pointer rounded-md px-2.5 text-[11px] font-medium transition-colors",
                mode === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {mode === "list" && (
          <div className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 transition-colors focus-within:border-primary/60">
            <Search className="size-3 shrink-0 text-muted-foreground" />
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
              placeholder="端口 / PID / 进程 / 用户"
              aria-label="搜索端口、地址、PID、进程或用户"
              className="w-44 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            {keyword && (
              <>
                <span
                  className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground"
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
                  <X className="size-3" />
                </button>
              </>
            )}
          </div>
        )}

        <label
          className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground"
          title="自动刷新开关"
        >
          <Switch
            checked={settings.autoRefresh}
            onCheckedChange={(v) => update({ autoRefresh: v })}
          />
          <button
            onClick={onOpenSettings}
            className="cursor-pointer rounded px-0.5 font-mono tabular-nums hover:bg-muted hover:text-foreground"
            title="在设置中调整刷新频率"
          >
            {settings.intervalMs / 1000}s
          </button>
        </label>

        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onRefresh}
          disabled={refreshing}
          title="刷新"
        >
          {refreshing ? <Loader className="animate-spin" /> : <RefreshCw />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={cycleTheme}
          title={`主题：${THEME_META[preference].label}（点击切换）`}
        >
          <ThemeIcon />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onOpenSettings}
          title="设置"
        >
          <Settings />
        </Button>
      </div>
    </header>
  );
}
