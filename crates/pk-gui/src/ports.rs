//! 端口扫描与终止命令——工具的主业务，其余模块都是外围设施。
//! 终止策略与 CLI 完全一致（见 ADR-005），由 pk-core 分级、这里执行。
//!
//! 两个命令的底层都是阻塞调用（netstat2 / sysinfo 的系统级枚举，终止
//! 还带最长 3 秒的宽限轮询），统一放进 spawn_blocking 执行：async 命令
//! 里直接跑会占住 tokio worker，批量终止串行最坏能阻塞十几秒。

use pk_core::kill::{self, KillOutcome};
use pk_core::model::{KillTarget, RiskLevel};
use pk_core::scan;

use crate::dto::{KillRequest, KillResultDto, PortEntryDto, entry_dto};
use crate::logging;

/// 扫描端口占用；`port` 为 `None` 时返回全部。
#[tauri::command]
pub async fn scan_ports(port: Option<u16>) -> Result<Vec<PortEntryDto>, String> {
    let entries = tauri::async_runtime::spawn_blocking(|| scan::scanner().scan())
        .await
        .map_err(|e| format!("扫描任务异常退出：{e}"))?
        .map_err(|e| {
            logging::error(format!("扫描失败：{e}"));
            e.to_string()
        })?;
    let invisible = entries.iter().filter(|e| e.process.is_none()).count();
    logging::info(format!(
        "扫描完成：{} 条占用，{} 个进程，{} 条不可见",
        entries.len(),
        entries.iter().filter_map(|e| e.process.as_ref()).count(),
        invisible
    ));
    Ok(entries
        .iter()
        .filter(|e| port.is_none_or(|p| e.port == p))
        .map(entry_dto)
        .collect())
}

/// 终止进程。
#[tauri::command]
pub async fn kill_processes(
    requests: Vec<KillRequest>,
    force: bool,
) -> Result<Vec<KillResultDto>, String> {
    tauri::async_runtime::spawn_blocking(move || kill_all(requests, force))
        .await
        .map_err(|e| format!("终止任务异常退出：{e}"))?
}

/// 终止逻辑本体（阻塞执行，见模块注释）。杀前重扫一次：既执行与 CLI
/// 相同的受保护名单闸（Critical 未带 `force` 拒绝），也让 PID 复用校验
/// 多一道最新数据。
fn kill_all(requests: Vec<KillRequest>, force: bool) -> Result<Vec<KillResultDto>, String> {
    let killer = kill::killer();
    let entries = scan::scanner().scan().map_err(|e| e.to_string())?;

    let mut results = Vec::with_capacity(requests.len());
    for r in requests {
        // 重扫后找不到 = 已退出（消息层面对齐 CLI 的 AlreadyExited 语义）
        let Some(p) = entries
            .iter()
            .find_map(|e| e.process.as_ref().filter(|p| p.pid == r.pid))
        else {
            results.push(KillResultDto {
                pid: r.pid,
                ok: false,
                outcome: None,
                message: "进程已不存在（可能刚好退出）".to_owned(),
            });
            continue;
        };

        if p.risk() == RiskLevel::Critical && !force {
            logging::warn(format!("拒绝终止受保护进程 pid {}（{}）", r.pid, p.name));
            results.push(KillResultDto {
                pid: r.pid,
                ok: false,
                outcome: None,
                message: "受保护进程已拒绝终止（需在界面完成二次确认）".to_owned(),
            });
            continue;
        }

        let target = KillTarget {
            pid: r.pid,
            expect_start_time: Some(r.start_time),
        };
        match killer.terminate(&target) {
            Ok(outcome) => {
                logging::info(format!(
                    "终止 pid {}（{}）：{}",
                    r.pid,
                    p.name,
                    match outcome {
                        KillOutcome::Terminated => "已退出（SIGTERM）",
                        KillOutcome::ForceKilled => "已强制终止（SIGKILL）",
                        KillOutcome::AlreadyExited => "终止前已退出",
                    }
                ));
                results.push(KillResultDto {
                    pid: r.pid,
                    ok: true,
                    outcome: Some(match outcome {
                        KillOutcome::Terminated => "已退出（SIGTERM）",
                        KillOutcome::ForceKilled => "已强制终止（SIGKILL）",
                        KillOutcome::AlreadyExited => "终止前已退出",
                    }),
                    message: String::new(),
                })
            }
            Err(e) => {
                logging::error(format!("终止 pid {}（{}）失败：{e}", r.pid, p.name));
                results.push(KillResultDto {
                    pid: r.pid,
                    ok: false,
                    outcome: None,
                    message: e.to_string(),
                })
            }
        }
    }
    Ok(results)
}
