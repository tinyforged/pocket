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
