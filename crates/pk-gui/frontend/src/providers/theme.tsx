/**
 * 主题系统：system / light / dark 三态。
 * - 存储在 localStorage("pk.theme")
 * - system 模式跟随 prefers-color-scheme 并监听系统切换
 * - 实际生效值（resolved）供 Toaster 等第三方组件同步
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { writeFrontendLog } from "@/api/logging";

export type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "pk.theme";

const ThemeContext = createContext<{
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (t: ThemePreference) => void;
}>({
  preference: "system",
  resolved: "dark",
  setPreference: () => {},
});

function readStored(): ThemePreference {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readStored);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    preference === "system" ? systemTheme() : preference,
  );

  // 系统主题变化时，system 模式下即时跟随
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStored() === "system") setResolved(systemTheme());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const next: ResolvedTheme =
      preference === "system" ? systemTheme() : preference;
    setResolved(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, [preference]);

  const setPreference = useCallback((t: ThemePreference) => {
    if (t === preference) return;
    localStorage.setItem(STORAGE_KEY, t);
    setPreferenceState(t);
    const label = t === "system" ? "跟随系统" : t === "light" ? "亮色" : "暗色";
    void writeFrontendLog("info", `主题模式调整为${label}`);
  }, [preference]);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
