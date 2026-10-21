/**
 * 配色主题（主题色）预设：切换即覆盖 CSS 变量 --primary。
 * 光晕 --glow-1 由 CSS color-mix 从 --primary 派生，无需单独处理。
 * 每个主题色给出亮 / 暗两档，保证两种外观下都有足够对比度。
 */
export const ACCENTS = {
  ocean: { label: "海洋蓝", light: "#3d6fe0", dark: "#5b8cff" },
  indigo: { label: "靛蓝", light: "#4f46e5", dark: "#818cf8" },
  cyan: { label: "青碧", light: "#0891b2", dark: "#22d3ee" },
  teal: { label: "沧青", light: "#0d9488", dark: "#2dd4bf" },
  emerald: { label: "翡翠绿", light: "#0f9d5b", dark: "#34d399" },
  amber: { label: "琥珀橙", light: "#d97706", dark: "#fbbf24" },
  orange: { label: "落日橙", light: "#ea580c", dark: "#fb923c" },
  ruby: { label: "绯红", light: "#dc2626", dark: "#f87171" },
  rose: { label: "玫瑰红", light: "#e0446c", dark: "#fb7185" },
  pink: { label: "桃粉", light: "#db2777", dark: "#f472b6" },
  violet: { label: "星紫", light: "#7c5ce0", dark: "#a78bfa" },
  slate: { label: "石墨灰", light: "#475569", dark: "#94a3b8" },
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
