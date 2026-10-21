//! macOS 进程终止实现。

use super::{KillError, KillOutcome, ProcessKiller};
use crate::model::KillTarget;

/// macOS 终止器。
pub struct Killer;

impl ProcessKiller for Killer {
    fn terminate(&self, _target: &KillTarget) -> Result<KillOutcome, KillError> {
        // TODO: kill(2)，先 SIGTERM 再 SIGKILL；
        // 两个 unix 平台大概率共用实现，落地时可合并为 unix.rs
        Err(KillError::NotImplemented("macos 进程终止"))
    }
}
