//! 端口扫描能力：trait 定义与实现分发。
//!
//! 实现基于 netstat2（端口↔PID 映射）+ sysinfo（进程详情），天然跨三平台。
//! 若某平台日后需要特化（如 macOS 换 libproc 直连），再拆出
//! `#[cfg(target_os)]` 分支——ADR-002 的规则不变，只是暂时用不上。

mod sys;

use crate::model::PortEntry;

/// 端口扫描器：面向能力的抽象，CLI / TUI / GUI 复用同一实现。
pub trait PortScanner {
    /// 扫描当前系统的端口占用（TCP LISTEN 与 UDP 绑定）。
    fn scan(&self) -> Result<Vec<PortEntry>, ScanError>;
}

/// 扫描错误。
#[derive(Debug, thiserror::Error)]
pub enum ScanError {
    /// 底层套接字信息获取失败
    #[error("获取套接字信息失败：{0}")]
    Netstat(#[from] netstat2::error::Error),
    /// 底层命令执行 / 文件读取失败
    #[error("io 错误：{0}")]
    Io(#[from] std::io::Error),
}

/// 当前平台的扫描器实例。
pub fn scanner() -> Box<dyn PortScanner> {
    Box::new(sys::Scanner)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::TcpState;

    /// 真实扫描冒烟：能成功返回，且 TCP 条目都处于 LISTEN。
    #[test]
    fn scan_smoke() {
        let entries = scanner().scan().expect("扫描应成功");
        assert!(entries.iter().all(|e| e.port != 0));
        assert!(
            entries
                .iter()
                .all(|e| e.state.is_none_or(|s| s == TcpState::Listen))
        );
    }
}
