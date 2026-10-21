/**
 * 外观设置的副作用同步：把 localStorage 里的偏好落到真实世界——
 * CSS 变量（主题色）、Rust 侧托盘与关闭行为、背景图 data URL。
 * App 只消费返回的 bgUrl / reloadBg。
 */
import { useCallback, useEffect, useState } from "react";

import {
  loadBackgroundImage,
  setCloseToQuit,
  setTrayVisible,
} from "@/api/appearance";
import { useSettings } from "@/providers/settings";
import { useTheme } from "@/providers/theme";

import { applyAccent } from "./accents";

export function useAppearanceSync() {
  const { settings } = useSettings();
  const { resolved } = useTheme();
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  const reloadBg = useCallback(async () => {
    try {
      setBgUrl(await loadBackgroundImage());
    } catch {
      setBgUrl(null);
    }
  }, []);

  useEffect(() => {
    void reloadBg();
  }, [reloadBg]);

  // 主题色：内联覆盖 --primary，亮暗各取一档
  useEffect(() => {
    applyAccent(settings.accent, resolved);
  }, [settings.accent, resolved]);

  // 托盘可见性同步；关闭行为——托盘关闭时强制"关闭即退出"，
  // 否则窗口隐藏后没有任何入口可以唤回
  useEffect(() => {
    void setTrayVisible(settings.showTrayIcon).catch(() => {});
  }, [settings.showTrayIcon]);

  useEffect(() => {
    const quit = settings.closeToQuit || !settings.showTrayIcon;
    void setCloseToQuit(quit).catch(() => {});
  }, [settings.closeToQuit, settings.showTrayIcon]);

  return { bgUrl, reloadBg };
}
