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
import { useSettings } from "@/providers/settings";
import { useTheme, type ThemePreference } from "@/providers/theme";

interface TopBarProps {
  keyword: string;
  onKeyword: (value: string) => void;
  /** 过滤后的条数（有关键字时显示"匹配/总数"） */
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
    <header className="flex items-center justify-between gap-4 border-b border-border bg-card/40 px-5 py-3.5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl border border-primary/35 bg-linear-to-br from-primary/30 to-primary/5 shadow-[0_0_24px_var(--glow-1)]">
          <Zap className="size-5 text-primary" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="text-[17px] font-bold tracking-wide">端口终结者</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            pk · 谁占了端口，一眼看清，一键送走
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
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
            placeholder="端口 / 进程名 / 用户，按 / 聚焦"
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

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
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
