/**
 * 外观与窗口（命令实现见 pk-gui/src/tray.rs 与 background.rs）。
 * 设置本体存 localStorage，这里是需要 Rust 侧配合的部分。
 */
import { invoke } from "@tauri-apps/api/core";

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
