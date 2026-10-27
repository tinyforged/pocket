/**
 * 托盘菜单动作（菜单构建见 pk-gui/src/tray.rs）。
 * Rust 侧已先行显示 / 聚焦窗口并推来动作 id，这里只分发到各领域。
 */
import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

export type TrayAction = "lookup" | "scan" | "settings" | "logs" | "update";

type TrayActions = Record<TrayAction, () => void>;

/** 订阅托盘菜单动作并分发；处理函数经 ref 承接，重渲染不重新订阅。 */
export function useTrayMenu(actions: TrayActions) {
  const ref = useRef(actions);
  ref.current = actions;

  useEffect(() => {
    const done = listen<TrayAction>("pk://tray", (event) => {
      ref.current[event.payload]?.();
    });
    return () => {
      void done.then((stop) => stop());
    };
  }, []);
}
