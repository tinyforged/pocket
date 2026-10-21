//! 基于 sysinfo 的跨平台终止实现。
//!
//! unix：SIGTERM → 轮询等待（宽限 3 秒）→ SIGKILL；
//! Windows：TerminateProcess 一步到位（没有可用的优雅信号）。

// 优雅退出流程（SIGTERM + 轮询）仅 unix 存在；Windows 走 TerminateProcess
#[cfg(not(target_os = "windows"))]
use std::thread::sleep;
#[cfg(not(target_os = "windows"))]
use std::time::{Duration, Instant};

use sysinfo::{ProcessStatus, ProcessesToUpdate, System};

use super::{KillError, KillOutcome, ProcessKiller};
use crate::model::KillTarget;

/// SIGTERM 后留给进程的体面退出时间。
#[cfg(not(target_os = "windows"))]
const GRACE: Duration = Duration::from_secs(3);
/// 轮询间隔。
#[cfg(not(target_os = "windows"))]
const POLL: Duration = Duration::from_millis(100);

pub struct Killer;

/// 单次探查结论。
enum Probe {
    /// 进程已消失（僵尸态也算：已无法运行，只等父进程收尸）
    Gone,
    /// 仍在运行，且启动时间与预期一致
    Alive,
    /// PID 还在，但启动时间对不上——被复用了
    Reused,
}

impl ProcessKiller for Killer {
    fn terminate(&self, target: &KillTarget) -> Result<KillOutcome, KillError> {
        let mut sys = System::new();

        // 杀前校验：存在 + 未被复用
        match probe(&mut sys, target) {
            Probe::Gone => return Ok(KillOutcome::AlreadyExited),
            Probe::Reused => return Err(KillError::PidReused { pid: target.pid }),
            Probe::Alive => {}
        }

        // Windows 没有 SIGTERM 这类优雅信号，TerminateProcess 一步到位
        #[cfg(target_os = "windows")]
        {
            force_kill(&mut sys, target.pid)?;
            Ok(KillOutcome::ForceKilled)
        }

        #[cfg(not(target_os = "windows"))]
        {
            let pid = sysinfo::Pid::from_u32(target.pid);

            // 1. 先礼：SIGTERM
            match sys
                .process(pid)
                .and_then(|p| p.kill_with(sysinfo::Signal::Term))
            {
                Some(true) => {}
                // 发不出去且进程还在，基本就是权限问题
                Some(false) => return Err(KillError::PermissionDenied { pid: target.pid }),
                // 探查与发信号之间刚好退出，视为已终止
                None => return Ok(KillOutcome::AlreadyExited),
            }

            // 2. 宽限期内轮询，等它体面退出
            let deadline = Instant::now() + GRACE;
            loop {
                sleep(POLL);
                match probe(&mut sys, target) {
                    Probe::Gone => return Ok(KillOutcome::Terminated),
                    Probe::Reused => return Err(KillError::PidReused { pid: target.pid }),
                    Probe::Alive if Instant::now() < deadline => continue,
                    Probe::Alive => break,
                }
            }

            // 3. 后兵：SIGKILL
            force_kill(&mut sys, target.pid)?;
            Ok(KillOutcome::ForceKilled)
        }
    }
}

/// 强杀目标进程；进程已消失视为成功（目标本来就是让它消失）。
fn force_kill(sys: &mut System, pid: u32) -> Result<(), KillError> {
    match sys.process(sysinfo::Pid::from_u32(pid)).map(|p| p.kill()) {
        Some(true) | None => Ok(()),
        Some(false) => Err(KillError::PermissionDenied { pid }),
    }
}

/// 刷新并探查目标进程状态。
fn probe(sys: &mut System, target: &KillTarget) -> Probe {
    let pid = sysinfo::Pid::from_u32(target.pid);
    sys.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
    match sys.process(pid) {
        None => Probe::Gone,
        Some(p) if matches!(p.status(), ProcessStatus::Zombie) => Probe::Gone,
        Some(p)
            if target
                .expect_start_time
                .is_some_and(|t| t != p.start_time()) =>
        {
            Probe::Reused
        }
        Some(_) => Probe::Alive,
    }
}
