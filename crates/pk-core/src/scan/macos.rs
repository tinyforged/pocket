//! macOS 端口扫描实现。

use super::{PortScanner, ScanError};
use crate::model::PortEntry;

/// macOS 扫描器。
pub struct Scanner;

impl PortScanner for Scanner {
    fn scan(&self) -> Result<Vec<PortEntry>, ScanError> {
        // TODO: 用 netstat2 / libproc 实现，`lsof -nP -i` 兜底
        Err(ScanError::NotImplemented("macos 端口扫描"))
    }
}
