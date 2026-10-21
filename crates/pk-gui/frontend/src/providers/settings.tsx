/**
 * 应用设置：外观（主题色 / 背景图参数）、窗口与托盘、刷新策略。
 * 存 localStorage("pk.settings")；需要 Rust 侧配合的部分由
 * appearance/useAppearanceSync 在设置变化时同步过去。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { AccentKey } from "@/appearance/accents";

/** 背景图显示方式 */
export type BgFit = "fill" | "fit" | "stretch" | "center" | "tile";

export interface BgSettings {
  fit: BgFit;
  /** 图片不透明度 0~1（默认 0.2，保证内容可读） */
  opacity: number;
  /** 模糊半径 px */
  blur: number;
}

export interface Settings {
  autoRefresh: boolean;
  /** 自动刷新间隔（毫秒） */
  intervalMs: number;
  /** 配色主题（主题色） */
  accent: AccentKey;
  /** 显示系统托盘 / 菜单栏图标 */
  showTrayIcon: boolean;
  /** 关闭窗口时退出程序；false = 隐藏到托盘（需托盘开启） */
  closeToQuit: boolean;
  /** 背景图参数（图片本体由 Rust 侧存应用数据目录） */
  bg: BgSettings;
}

const STORAGE_KEY = "pk.settings";

/** 可选的刷新频率（毫秒）。 */
export const INTERVAL_OPTIONS = [
  { value: 2000, label: "2 秒" },
  { value: 4000, label: "4 秒" },
  { value: 8000, label: "8 秒" },
  { value: 30000, label: "30 秒" },
  { value: 60000, label: "60 秒" },
] as const;

export const BG_FIT_OPTIONS: { value: BgFit; label: string }[] = [
  { value: "fill", label: "填充" },
  { value: "fit", label: "适应" },
  { value: "stretch", label: "拉伸" },
  { value: "center", label: "居中" },
  { value: "tile", label: "平铺" },
];

export const DEFAULTS: Settings = {
  autoRefresh: false,
  intervalMs: 4000,
  accent: "ocean",
  showTrayIcon: false,
  closeToQuit: true,
  bg: { fit: "fill", opacity: 0.2, blur: 0 },
};

const SettingsContext = createContext<{
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}>({ settings: DEFAULTS, update: () => {} });

function readStored(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // 深合并 bg：旧版本存储没有该字段也能拿到完整默认值
    return {
      ...DEFAULTS,
      ...parsed,
      bg: { ...DEFAULTS.bg, ...(parsed.bg ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(readStored);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
