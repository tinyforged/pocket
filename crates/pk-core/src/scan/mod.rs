//! 端口扫描能力：trait 定义与平台实现分发。
//!
//! 平台差异用 `#[cfg(target_os)]` 切换，不用 feature flag。

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

use crate::model::PortEntry;

/// 端口扫描器：面向能力的抽象，CLI / TUI / GUI 复用同一实现。
pub trait PortScanner {
    /// 扫描当前系统的端口占用。
    fn scan(&self) -> Result<Vec<PortEntry>, ScanError>;
}

/// 扫描错误。
#[derive(Debug, thiserror::Error)]
pub enum ScanError {
    /// 平台实现尚未落地
    #[error("尚未实现：{0}")]
    NotImplemented(&'static str),
    /// 底层命令执行 / 文件读取失败
    #[error("io 错误：{0}")]
    Io(#[from] std::io::Error),
}

/// 当前平台的扫描器实例。
#[cfg(target_os = "linux")]
pub fn scanner() -> Box<dyn PortScanner> {
    Box::new(linux::Scanner)
}

/// 当前平台的扫描器实例。
#[cfg(target_os = "macos")]
pub fn scanner() -> Box<dyn PortScanner> {
    Box::new(macos::Scanner)
}

/// 当前平台的扫描器实例。
#[cfg(target_os = "windows")]
pub fn scanner() -> Box<dyn PortScanner> {
    Box::new(windows::Scanner)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 骨架阶段各平台实现均为 NotImplemented；落地后改为断言真实行为。
    #[test]
    fn scan_reports_not_implemented_on_stubs() {
        let err = scanner().scan().unwrap_err();
        assert!(matches!(err, ScanError::NotImplemented(_)));
    }
}
