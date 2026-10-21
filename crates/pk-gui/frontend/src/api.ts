/** pk-core 能力的 invoke 封装（命令实现见 pk-gui/src/main.rs）。 */
import { invoke } from "@tauri-apps/api/core";

import type { KillResultDto, PortEntryDto } from "./types";

export function scanPorts(): Promise<PortEntryDto[]> {
  return invoke("scan_ports", { port: null });
}

export function killProcesses(
  requests: { pid: number; startTime: number }[],
  force: boolean,
): Promise<KillResultDto[]> {
  return invoke("kill_processes", { requests, force });
}

/** 当前是否以管理员 / root 运行（决定"提权重启"入口是否显示）。 */
export function isElevated(): Promise<boolean> {
  return invoke("is_elevated");
}

/** 以管理员权限重启应用，当前实例随后退出。 */
export function relaunchElevated(): Promise<void> {
  return invoke("relaunch_elevated");
}

/** 显示 / 隐藏系统托盘图标（macOS 为菜单栏图标）。 */
export function setTrayVisible(visible: boolean): Promise<void> {
  return invoke("set_tray_visible", { visible });
}

/** 关闭窗口时：退出程序（true）或隐藏到托盘（false，需托盘开启）。 */
export function setCloseToQuit(quit: boolean): Promise<void> {
  return invoke("set_close_to_quit", { quit });
}

/** 打开文件选择器选背景图；返回 data URL，用户取消返回 null。 */
export function pickBackgroundImage(): Promise<string | null> {
  return invoke("pick_background_image");
}

/** 读取已保存的背景图（data URL）；未设置返回 null。 */
export function loadBackgroundImage(): Promise<string | null> {
  return invoke("load_background_image");
}

/** 删除已保存的背景图。 */
export function clearBackgroundImage(): Promise<void> {
  return invoke("clear_background_image");
}
