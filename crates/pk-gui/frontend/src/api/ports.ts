/** 端口扫描与终止（命令实现见 pk-gui/src/ports.rs）。 */
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
