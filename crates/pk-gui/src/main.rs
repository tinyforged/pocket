//! pk-gui：端口终结者的 GUI 前端（Tauri 2 + 静态页面）。
//!
//! 本 crate 只做两件事：把 pk-core 的能力暴露成 Tauri 命令、把 core
//! 类型适配成前端 DTO——颜值全部在 `dist/` 的 HTML/CSS/JS 里实现。
//! 依赖铁律不变：这里依赖 pk-core，core 不反向依赖任何 UI。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use pk_core::kill::{self, KillOutcome};
use pk_core::model::{KillTarget, PortEntry, ProcessInfo, Protocol, RiskLevel, TcpState};
use pk_core::scan;
use serde::{Deserialize, Serialize};

// ---------- DTO：core 类型 → 前端 JSON ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessDto {
    pid: u32,
    name: String,
    user: Option<String>,
    exe: Option<String>,
    cmd: Vec<String>,
    cwd: Option<String>,
    start_time: u64,
    parent: Option<u32>,
    /// "safe" / "caution" / "critical"，前端据此渲染徽章与确认流程
    risk: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PortEntryDto {
    port: u16,
    /// "tcp" / "udp"
    protocol: &'static str,
    local_addr: String,
    /// "LISTEN" 等；UDP 无状态
    state: Option<&'static str>,
    process: Option<ProcessDto>,
}

fn process_dto(p: &ProcessInfo) -> ProcessDto {
    ProcessDto {
        pid: p.pid,
        name: p.name.clone(),
        user: p.user.clone(),
        exe: p.exe.clone(),
        cmd: p.cmd.clone(),
        cwd: p.cwd.clone(),
        start_time: p.start_time,
        parent: p.parent,
        risk: match p.risk() {
            RiskLevel::Safe => "safe",
            RiskLevel::Caution => "caution",
            RiskLevel::Critical => "critical",
        },
    }
}

fn entry_dto(e: &PortEntry) -> PortEntryDto {
    PortEntryDto {
        port: e.port,
        protocol: match e.protocol {
            Protocol::Tcp => "tcp",
            Protocol::Udp => "udp",
        },
        local_addr: e.local_addr.to_string(),
        state: e.state.map(|s| match s {
            TcpState::Listen => "LISTEN",
            TcpState::Established => "ESTABLISHED",
            TcpState::TimeWait => "TIME_WAIT",
            TcpState::CloseWait => "CLOSE_WAIT",
            TcpState::Other => "OTHER",
        }),
        process: e.process.as_ref().map(process_dto),
    }
}

// ---------- Tauri 命令 ----------

/// 扫描端口占用；`port` 为 `None` 时返回全部。
#[tauri::command]
async fn scan_ports(port: Option<u16>) -> Result<Vec<PortEntryDto>, String> {
    let entries = scan::scanner().scan().map_err(|e| e.to_string())?;
    Ok(entries
        .iter()
        .filter(|e| port.is_none_or(|p| e.port == p))
        .map(entry_dto)
        .collect())
}

/// 终止请求：pid + 查询时记录的启动时间（PID 复用保护）。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct KillRequest {
    pid: u32,
    start_time: u64,
}

/// 单个目标的终止结果。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct KillResultDto {
    pid: u32,
    ok: bool,
    /// 成功时的结局（"已退出（SIGTERM）" 等）；失败为 `None`
    outcome: Option<&'static str>,
    message: String,
}

/// 终止进程。杀前重扫一次：既执行与 CLI 相同的受保护名单闸
/// （Critical 未带 `force` 拒绝），也让 PID 复用校验多一道最新数据。
#[tauri::command]
async fn kill_processes(
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

/// 当前是否以管理员 / root 运行（决定前端"提权重启"入口是否显示）。
#[cfg(unix)]
#[allow(unsafe_code)] // libc::geteuid 是 FFI，无 safe 封装可用
#[tauri::command]
fn is_elevated() -> bool {
    let euid = unsafe { libc::geteuid() };
    euid == 0
}

/// 当前是否以管理员 / root 运行（Windows 令牌检测暂未实现，恒 false）。
#[cfg(windows)]
#[tauri::command]
fn is_elevated() -> bool {
    false
}

/// 以管理员权限重启应用：拉起提权启动器后退出当前实例。
///
/// - macOS：`osascript` 弹出系统授权对话框后以 root 启动本程序
/// - Linux：`pkexec`（Polkit）授权
/// - Windows：PowerShell `Start-Process -Verb RunAs`（UAC）
#[tauri::command]
async fn relaunch_elevated(app: tauri::AppHandle) -> Result<(), String> {
    use std::process::Command;
    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .display()
        .to_string();

    #[cfg(target_os = "macos")]
    // AppleScript 里对 shell 命令整体加引号，路径带空格也安全
    let mut cmd = {
        let script = format!("do shell script \"\\\"{exe}\\\"\" with administrator privileges");
        let mut c = Command::new("osascript");
        c.arg("-e").arg(script);
        c
    };
    #[cfg(target_os = "linux")]
    let mut cmd = {
        let mut c = Command::new("pkexec");
        c.arg(&exe);
        c
    };
    #[cfg(target_os = "windows")]
    // PS 单引号字符串按字面解析，路径带空格安全
    let mut cmd = {
        let mut c = Command::new("powershell");
        c.args([
            "-Command",
            &format!("Start-Process -FilePath '{exe}' -Verb RunAs"),
        ]);
        c
    };

    cmd.spawn()
        .map_err(|e| format!("提权启动器拉起失败：{e}"))?;
    app.exit(0);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_ports,
            kill_processes,
            is_elevated,
            relaunch_elevated
        ])
        .run(tauri::generate_context!())
        .expect("pk-gui 运行失败");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn process(pid: u32) -> ProcessInfo {
        ProcessInfo {
            pid,
            name: "m".to_owned(),
            user: None,
            exe: None,
            cmd: vec![],
            cwd: None,
            start_time: 0,
            parent: None,
        }
    }

    #[test]
    fn dto_maps_risk_levels_to_frontend_strings() {
        // pid 1 恒为 Critical
        assert_eq!(process_dto(&process(1)).risk, "critical");
        assert_eq!(process_dto(&process(42)).risk, "safe");

        let mut root = process(42);
        root.user = Some("root".to_owned());
        assert_eq!(process_dto(&root).risk, "caution");
    }
}
