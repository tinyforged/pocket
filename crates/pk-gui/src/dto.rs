//! core 类型 → 前端 JSON 的 DTO 适配。纯数据映射、无副作用，
//! 命名按 camelCase 序列化，risk / state 等枚举压平成字符串。

use pk_core::model::{PortEntry, ProcessInfo, Protocol, RiskLevel, TcpState};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProcessDto {
    pub pid: u32,
    pub name: String,
    pub user: Option<String>,
    pub exe: Option<String>,
    pub cmd: Vec<String>,
    pub cwd: Option<String>,
    pub start_time: u64,
    pub parent: Option<u32>,
    /// "safe" / "caution" / "critical"，前端据此渲染徽章与确认流程
    pub risk: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PortEntryDto {
    pub port: u16,
    /// "tcp" / "udp"
    pub protocol: &'static str,
    pub local_addr: String,
    /// "LISTEN" 等；UDP 无状态
    pub state: Option<&'static str>,
    pub process: Option<ProcessDto>,
}

pub(crate) fn process_dto(p: &ProcessInfo) -> ProcessDto {
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

pub(crate) fn entry_dto(e: &PortEntry) -> PortEntryDto {
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

/// 终止请求：pid + 查询时记录的启动时间（PID 复用保护）。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KillRequest {
    pub pid: u32,
    pub start_time: u64,
}

/// 单个目标的终止结果。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KillResultDto {
    pub pid: u32,
    pub ok: bool,
    /// 成功时的结局（"已退出（SIGTERM）" 等）；失败为 `None`
    pub outcome: Option<&'static str>,
    pub message: String,
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
    fn maps_risk_levels_to_frontend_strings() {
        // pid 1 恒为 Critical
        assert_eq!(process_dto(&process(1)).risk, "critical");
        assert_eq!(process_dto(&process(42)).risk, "safe");

        let mut root = process(42);
        root.user = Some("root".to_owned());
        assert_eq!(process_dto(&root).risk, "caution");
    }
}
