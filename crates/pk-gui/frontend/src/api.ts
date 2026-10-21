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
