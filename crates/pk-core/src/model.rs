//! 核心数据模型。
//!
//! 类型面向能力而非面向端口：未来的进程清理、磁盘工具直接复用
//! `ProcessInfo` / `KillTarget` / `Privilege`，不用改 core。

use std::fmt;

/// 进程摘要。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessInfo {
    /// 进程 ID
    pub pid: u32,
    /// 进程名（如 `node`）
    pub name: String,
    /// 进程属主用户名；无法确定时为 `None`
    pub user: Option<String>,
}

impl fmt::Display for ProcessInfo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.user {
            Some(user) => write!(f, "{} (pid {}, {})", self.name, self.pid, user),
            None => write!(f, "{} (pid {})", self.name, self.pid),
        }
    }
}

/// 传输层协议。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Protocol {
    Tcp,
    Udp,
}

impl fmt::Display for Protocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Protocol::Tcp => "tcp",
            Protocol::Udp => "udp",
        })
    }
}

/// 一条端口占用记录。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PortEntry {
    pub port: u16,
    pub protocol: Protocol,
    /// 占用端口的进程；内核占用等场景可能为 `None`
    pub process: Option<ProcessInfo>,
}

impl fmt::Display for PortEntry {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.process {
            Some(process) => write!(f, "{:>5} {} {}", self.port, self.protocol, process),
            None => write!(f, "{:>5} {} -", self.port, self.protocol),
        }
    }
}

/// 杀掉进程的目标描述。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KillTarget {
    pub pid: u32,
}

/// 权限级别：决定哪些操作可直接执行、哪些需要提权。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Privilege {
    /// 普通用户权限
    User,
    /// 已提权（Unix 的 root / sudo，Windows 的管理员）
    Elevated,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_entry_display_contains_port_and_process() {
        let entry = PortEntry {
            port: 8080,
            protocol: Protocol::Tcp,
            process: Some(ProcessInfo {
                pid: 42,
                name: "node".to_owned(),
                user: Some("dev".to_owned()),
            }),
        };
        assert_eq!(entry.to_string(), " 8080 tcp node (pid 42, dev)");
    }

    #[test]
    fn port_entry_display_without_process() {
        let entry = PortEntry {
            port: 53,
            protocol: Protocol::Udp,
            process: None,
        };
        assert_eq!(entry.to_string(), "   53 udp -");
    }
}
