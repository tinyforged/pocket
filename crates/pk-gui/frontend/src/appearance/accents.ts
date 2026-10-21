/**
 * 配色主题（主题色）预设：切换即覆盖 CSS 变量 --primary。
 * 光晕 --glow-1 由 CSS color-mix 从 --primary 派生，无需单独处理。
 * 每个主题色给出亮 / 暗两档，保证两种外观下都有足够对比度。
 */
export const ACCENTS = {
  ocean: { label: "海洋蓝", light: "#3d6fe0", dark: "#5b8cff" },
  violet: { label: "星紫", light: "#7c5ce0", dark: "#a78bfa" },
  emerald: { label: "翡翠绿", light: "#0f9d5b", dark: "#34d399" },
  rose: { label: "玫瑰红", light: "#e0446c", dark: "#fb7185" },
  amber: { label: "琥珀橙", light: "#d97706", dark: "#fbbf24" },
} as const;

export type AccentKey = keyof typeof ACCENTS;

export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];

/** 把主题色写到 <html> 的内联样式上（内联优先级高于 .dark 类）。 */
export function applyAccent(key: AccentKey, resolved: "light" | "dark"): void {
  const preset = ACCENTS[key] ?? ACCENTS.ocean;
  document.documentElement.style.setProperty(
    "--primary",
    resolved === "dark" ? preset.dark : preset.light,
  );
}
