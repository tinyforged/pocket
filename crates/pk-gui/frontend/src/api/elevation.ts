/** 提权链路（命令实现见 pk-gui/src/elevation.rs）。 */
import { invoke } from "@tauri-apps/api/core";

/** 当前是否以管理员 / root 运行（决定"提权重启"入口是否显示）。 */
export function isElevated(): Promise<boolean> {
  return invoke("is_elevated");
}

/** 以管理员权限重启应用，当前实例随后退出。 */
export function relaunchElevated(): Promise<void> {
  return invoke("relaunch_elevated");
}
