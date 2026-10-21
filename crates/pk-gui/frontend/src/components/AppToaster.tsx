import { CheckCircle2, Info, Loader2, TriangleAlert, XCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { Toaster as SonnerToaster } from "sonner";

import { useTheme } from "@/providers/theme";

/**
 * 通知配色走 sonner 的 CSS 变量：底色统一为卡片色、描边按级别取
 * 主题色 40% 透明混合——不与默认样式打架，也天然跟随亮暗主题与
 * 主题色切换。
 */
const LEVEL_VARS = {
  "--normal-bg": "var(--card)",
  "--normal-border": "var(--border)",
  "--normal-text": "var(--foreground)",
  "--success-bg": "var(--card)",
  "--success-border": "color-mix(in srgb, var(--ok) 40%, transparent)",
  "--success-text": "var(--foreground)",
  "--error-bg": "var(--card)",
  "--error-border": "color-mix(in srgb, var(--danger) 40%, transparent)",
  "--error-text": "var(--foreground)",
  "--warning-bg": "var(--card)",
  "--warning-border": "color-mix(in srgb, var(--warn) 40%, transparent)",
  "--warning-text": "var(--foreground)",
  "--info-bg": "var(--card)",
  "--info-border": "color-mix(in srgb, var(--primary) 40%, transparent)",
  "--info-text": "var(--foreground)",
  // 圆角也走变量，避免和默认样式互相覆盖
  "--border-radius": "1rem",
} as CSSProperties;

/**
 * 应用级通知中心：把 sonner 统一到设计令牌（卡片底 / 主题描边 /
 * lucide 图标），贴底悬浮但不压页脚。
 */
export default function AppToaster() {
  const { resolved } = useTheme();

  return (
    <SonnerToaster
      theme={resolved}
      position="bottom-center"
      offset={48}
      gap={8}
      duration={4000}
      style={LEVEL_VARS}
      icons={{
        success: <CheckCircle2 className="size-4.5 text-ok" strokeWidth={2.2} />,
        warning: <TriangleAlert className="size-4.5 text-warn" strokeWidth={2.2} />,
        error: <XCircle className="size-4.5 text-danger" strokeWidth={2.2} />,
        info: <Info className="size-4.5 text-primary" strokeWidth={2.2} />,
        loading: (
          <Loader2 className="size-4.5 animate-spin text-muted-foreground" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "select-none text-[13px] font-medium backdrop-blur-xl shadow-lg",
          title: "text-[13px] font-medium",
          description: "text-xs text-muted-foreground",
          actionButton:
            "rounded-lg bg-primary font-medium text-primary-foreground",
          cancelButton:
            "rounded-lg border border-border bg-muted text-muted-foreground",
        },
      }}
    />
  );
}
