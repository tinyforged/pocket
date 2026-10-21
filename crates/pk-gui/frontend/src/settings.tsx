/**
 * 应用设置（v1 全部为前端本地设置，存 localStorage("pk.settings")）：
 * - autoRefresh：列表自动刷新开关
 * - intervalMs：自动刷新频率
 * 设置窗口（SettingsDialog）读写这里；后续若出现需要 Rust 侧感知的
 * 设置（如自定义受保护名单），再升级为 tauri 持久化命令。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface Settings {
  autoRefresh: boolean;
  /** 自动刷新间隔（毫秒） */
  intervalMs: number;
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

const DEFAULTS: Settings = { autoRefresh: false, intervalMs: 4000 };

const SettingsContext = createContext<{
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}>({ settings: DEFAULTS, update: () => {} });

function readStored(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
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
