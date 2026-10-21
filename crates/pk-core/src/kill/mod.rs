//! 进程终止能力：trait 定义与实现分发。
//!
//! 终止策略"先礼后兵"：unix 先 SIGTERM，给 3 秒体面退出的时间，
//! 超时升级 SIGKILL；Windows 无优雅信号可用，直接 TerminateProcess。
//! 杀前用启动时间校验 PID 未被复用。

mod sys;

use std::fmt;

use crate::model::KillTarget;

/// 进程终止器：面向能力的抽象。
pub trait ProcessKiller {
    /// 终止目标进程。
    ///
    /// `KillTarget::expect_start_time` 与实际不符时返回 [`KillError::PidReused`]，
    /// 拒绝执行——防止误杀复用了同一 PID 的新进程。
    fn terminate(&self, target: &KillTarget) -> Result<KillOutcome, KillError>;
}

/// 终止结果。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KillOutcome {
    /// 优雅信号（SIGTERM）后进程已退出
    Terminated,
    /// 优雅信号超时，已升级为强杀（SIGKILL / TerminateProcess）
    ForceKilled,
    /// 进程在终止前已自行退出
    AlreadyExited,
}

impl fmt::Display for KillOutcome {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            KillOutcome::Terminated => "已退出",
            KillOutcome::ForceKilled => "已强制终止",
            KillOutcome::AlreadyExited => "终止前已退出",
        })
    }
}

/// 终止错误。
#[derive(Debug, thiserror::Error)]
pub enum KillError {
    /// 没有权限终止目标进程
    #[error("没有权限终止 pid {pid}，请提权后重试（如 sudo）")]
    PermissionDenied { pid: u32 },
    /// PID 已被其他进程复用
    #[error("pid {pid} 已被其他进程复用，已中止；请重新查询后操作")]
    PidReused { pid: u32 },
}

/// 当前平台的终止器实例。
pub fn killer() -> Box<dyn ProcessKiller> {
    Box::new(sys::Killer)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 不存在的 pid 视作"已退出"而非报错：调用方刚扫描过，
    /// 消失只能说明它自己先退了，两者本来就无法区分。
    #[test]
    fn terminate_missing_pid_reports_already_exited() {
        let outcome = killer()
            .terminate(&KillTarget {
                pid: u32::MAX,
                expect_start_time: None,
            })
            .unwrap();
        assert_eq!(outcome, KillOutcome::AlreadyExited);
    }
}
