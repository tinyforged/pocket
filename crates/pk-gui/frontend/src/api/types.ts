/** 与 pk-gui/src/dto.rs 的 DTO 一一对应（serde rename_all = "camelCase"）。 */

export type RiskLevel = "safe" | "caution" | "critical";

export interface ProcessDto {
  pid: number;
  name: string;
  user: string | null;
  exe: string | null;
  cmd: string[];
  cwd: string | null;
  startTime: number;
  parent: number | null;
  /** 常驻内存（字节，RSS） */
  memory: number;
  risk: RiskLevel;
}

export interface PortEntryDto {
  port: number;
  protocol: "tcp" | "udp";
  localAddr: string;
  state: string | null;
  process: ProcessDto | null;
}

export interface KillResultDto {
  pid: number;
  ok: boolean;
  outcome: string | null;
  message: string;
}

/** 应用日志条目（pk-gui/src/logging.rs） */
export interface LogEntryDto {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}

/** 数据目录信息（pk-gui/src/storage.rs） */
export interface StorageInfoDto {
  dir: string;
  defaultDir: string;
  backgroundBytes: number;
  logsBytes: number;
}
