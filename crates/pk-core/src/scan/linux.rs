//! Linux 端口扫描实现。

use super::{PortScanner, ScanError};
use crate::model::PortEntry;

/// Linux 扫描器。
pub struct Scanner;

impl PortScanner for Scanner {
    fn scan(&self) -> Result<Vec<PortEntry>, ScanError> {
        // TODO: 解析 /proc/net/{tcp,udp}{,6}，或用 netstat2
        Err(ScanError::NotImplemented("linux 端口扫描"))
    }
}
