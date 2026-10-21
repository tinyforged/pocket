//! Windows 端口扫描实现。

use super::{PortScanner, ScanError};
use crate::model::PortEntry;

/// Windows 扫描器。
pub struct Scanner;

impl PortScanner for Scanner {
    fn scan(&self) -> Result<Vec<PortEntry>, ScanError> {
        // TODO: 用 netstat2（IP Helper API 封装）
        Err(ScanError::NotImplemented("windows 端口扫描"))
    }
}
