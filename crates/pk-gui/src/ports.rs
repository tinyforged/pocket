//! 端口扫描与终止命令——工具的主业务，其余模块都是外围设施。
//! 终止策略与 CLI 完全一致（见 ADR-005），由 pk-core 分级、这里执行。

use pk_core::kill::{self, KillOutcome};
use pk_core::model::{KillTarget, RiskLevel};
use pk_core::scan;

use crate::dto::{KillRequest, KillResultDto, PortEntryDto, entry_dto};

/// 扫描端口占用；`port` 为 `None` 时返回全部。
#[tauri::command]
pub async fn scan_ports(port: Option<u16>) -> Result<Vec<PortEntryDto>, String> {
    let entries = scan::scanner().scan().map_err(|e| e.to_string())?;
    Ok(entries
        .iter()
        .filter(|e| port.is_none_or(|p| e.port == p))
        .map(entry_dto)
        .collect())
}

/// 终止进程。杀前重扫一次：既执行与 CLI 相同的受保护名单闸
/// （Critical 未带 `force` 拒绝），也让 PID 复用校验多一道最新数据。
#[tauri::command]
pub async fn kill_processes(
    requests: Vec<KillRequest>,
    force: bool,
) -> Result<Vec<KillResultDto>, String> {
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
            Ok(outcome) => results.push(KillResultDto {
                pid: r.pid,
                ok: true,
                outcome: Some(match outcome {
                    KillOutcome::Terminated => "已退出（SIGTERM）",
                    KillOutcome::ForceKilled => "已强制终止（SIGKILL）",
                    KillOutcome::AlreadyExited => "终止前已退出",
                }),
                message: String::new(),
            }),
            Err(e) => results.push(KillResultDto {
                pid: r.pid,
                ok: false,
                outcome: None,
                message: e.to_string(),
            }),
        }
    }
    Ok(results)
}
