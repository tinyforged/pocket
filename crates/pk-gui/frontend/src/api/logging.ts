/** 应用日志（命令实现见 pk-gui/src/logging.rs）。 */
import { invoke } from "@tauri-apps/api/core";

import type { LogEntryDto } from "./types";

/** 最近日志（实时视图的初始数据，增量靠 "pk://log" 事件推送）。 */
export function getRecentLogs(): Promise<LogEntryDto[]> {
  return invoke("get_recent_logs");
}

/** 导出完整日志到用户选择的位置；取消返回 null。 */
export function exportLogs(): Promise<string | null> {
  return invoke("export_logs");
}

/** 清空日志（文件 + 内存缓冲）。 */
export function clearLogs(): Promise<void> {
  return invoke("clear_logs");
}

/** Write frontend operation logs into the same native log stream as Rust actions. */
export async function writeFrontendLog(
  level: LogEntryDto["level"],
  message: string,
): Promise<void> {
  try {
    await invoke("write_frontend_log", { level, message });
  } catch (error) {
    // Logging must never replace the original operation error.
    console.error("写入应用日志失败", error);
  }
}

/** Preserve useful details for plugin errors, including the stack when available. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}
