//! 进程终止能力：trait 定义与平台实现分发。

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

use std::fmt;

use crate::model::KillTarget;

/// 进程终止器：面向能力的抽象。
pub trait ProcessKiller {
    /// 终止目标进程。
    fn terminate(&self, target: &KillTarget) -> Result<KillOutcome, KillError>;
}

/// 终止结果。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KillOutcome {
    /// 已发出终止信号，进程已退出（或即将退出）
    Terminated,
    /// 进程在终止前已自行退出
    AlreadyExited,
}

impl fmt::Display for KillOutcome {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            KillOutcome::Terminated => "已终止",
            KillOutcome::AlreadyExited => "终止前已退出",
        })
    }
}

/// 终止错误。
#[derive(Debug, thiserror::Error)]
pub enum KillError {
    /// 平台实现尚未落地
    #[error("尚未实现：{0}")]
    NotImplemented(&'static str),
    /// 目标进程不存在
    #[error("进程不存在：pid {pid}")]
    NotFound { pid: u32 },
    /// 没有权限终止目标进程
    #[error("没有权限终止 pid {pid}，请提权后重试")]
    PermissionDenied { pid: u32 },
}

/// 当前平台的终止器实例。
#[cfg(target_os = "linux")]
pub fn killer() -> Box<dyn ProcessKiller> {
    Box::new(linux::Killer)
}

/// 当前平台的终止器实例。
#[cfg(target_os = "macos")]
pub fn killer() -> Box<dyn ProcessKiller> {
    Box::new(macos::Killer)
}

/// 当前平台的终止器实例。
#[cfg(target_os = "windows")]
pub fn killer() -> Box<dyn ProcessKiller> {
    Box::new(windows::Killer)
}
