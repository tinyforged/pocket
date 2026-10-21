//! Windows 进程终止实现。

use super::{KillError, KillOutcome, ProcessKiller};
use crate::model::KillTarget;

/// Windows 终止器。
pub struct Killer;

impl ProcessKiller for Killer {
    fn terminate(&self, _target: &KillTarget) -> Result<KillOutcome, KillError> {
        // TODO: TerminateProcess（或 sysinfo 的 kill）；
        // 需要 unsafe 时用 #[allow(unsafe_code)] 局部豁免，让 unsafe 显式可见
        Err(KillError::NotImplemented("windows 进程终止"))
    }
}
