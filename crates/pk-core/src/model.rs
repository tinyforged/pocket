//! 核心数据模型。
//!
//! 类型面向能力而非面向端口：未来的进程清理、磁盘工具直接复用
//! `ProcessInfo` / `KillTarget` / `Privilege`，不用改 core。

use std::fmt;
use std::net::IpAddr;

/// 进程详情。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessInfo {
    /// 进程 ID
    pub pid: u32,
    /// 进程名（如 `node`）
    pub name: String,
    /// 进程属主用户名；无法确定时为 `None`
    pub user: Option<String>,
    /// 可执行文件完整路径
    pub exe: Option<String>,
    /// 完整命令行
    pub cmd: Vec<String>,
    /// 工作目录——定位"是哪个项目占的端口"，往往比进程名更有用
    pub cwd: Option<String>,
    /// 启动时间（epoch 秒）：杀进程前的 PID 复用校验依据
    pub start_time: u64,
    /// 父进程 pid：进程树 / 定位"谁拉起的它"
    pub parent: Option<u32>,
    /// 常驻内存（字节，RSS）：帮判断"哪个进程值得动"
    pub memory: u64,
}

impl fmt::Display for ProcessInfo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.user {
            Some(user) => write!(f, "{} (pid {}, {})", self.name, self.pid, user),
            None => write!(f, "{} (pid {})", self.name, self.pid),
        }
    }
}

/// 终止风险评级：上层（CLI / TUI / GUI）据此决定要不要二次确认。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RiskLevel {
    /// 普通进程，可直接终止
    Safe,
    /// 系统账户 / root 的进程，终止前值得多看一眼
    Caution,
    /// 受保护进程（系统核心 / 数据库 / Docker 后端）：误杀代价极高
    Critical,
}

/// 受保护进程名单（按可执行名匹配，均为小写）。
///
/// 误杀一个 dev server 重启就好；误杀 mysqld / com.docker.backend
/// 可能丢数据、废掉整套开发环境——这类必须显式确认。
const CRITICAL_PROCESS_NAMES: &[&str] = &[
    // 系统核心
    "launchd",
    "systemd",
    "init",
    "kernel_task",
    "loginwindow",
    "windowserver",
    "svchost",
    "lsass",
    "csrss",
    "services",
    "wininit",
    "winlogon",
    // 数据库 / 缓存
    "mysqld",
    "mysqld_safe",
    "postgres",
    "postmaster",
    "redis-server",
    "redis-sentinel",
    "mongod",
    "mongos",
    "sqlservr",
    "memcached",
    // Docker / 容器
    "dockerd",
    "containerd",
    "docker-proxy",
    "com.docker.backend",
    "vpnkit",
    "docker desktop",
];

/// 系统账户名单：属主是这些时至少标 Caution。
const PRIVILEGED_USERS: &[&str] = &[
    "root",
    "_mysql",
    "_postgres",
    "SYSTEM",
    "LOCAL SERVICE",
    "NETWORK SERVICE",
];

impl ProcessInfo {
    /// 危险进程白名单评级。
    pub fn risk(&self) -> RiskLevel {
        // 优先按可执行文件名匹配：sysinfo 的 name 可能被进程自己改过
        let base = match self
            .exe
            .as_deref()
            .and_then(|exe| std::path::Path::new(exe).file_name())
        {
            Some(file) => file.to_string_lossy().into_owned(),
            None => self.name.clone(),
        };
        // 统一小写并剥掉 Windows 的 .exe 后缀
        let base = base.to_lowercase();
        let base = base.strip_suffix(".exe").unwrap_or(&base);

        if self.pid == 1 || CRITICAL_PROCESS_NAMES.contains(&base) {
            return RiskLevel::Critical;
        }
        if self
            .user
            .as_deref()
            .is_some_and(|u| PRIVILEGED_USERS.contains(&u))
        {
            return RiskLevel::Caution;
        }
        RiskLevel::Safe
    }
}

/// 传输层协议。
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
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

/// TCP 连接状态（只保留端口工具关心的几种）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TcpState {
    Listen,
    Established,
    TimeWait,
    CloseWait,
    Other,
}

impl fmt::Display for TcpState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            TcpState::Listen => "LISTEN",
            TcpState::Established => "ESTABLISHED",
            TcpState::TimeWait => "TIME_WAIT",
            TcpState::CloseWait => "CLOSE_WAIT",
            TcpState::Other => "OTHER",
        })
    }
}

/// 一条端口占用记录。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PortEntry {
    pub port: u16,
    pub protocol: Protocol,
    /// 绑定的本地地址：区分 `0.0.0.0`（所有网卡）与 `127.0.0.1`（仅本机回环）
    pub local_addr: IpAddr,
    /// TCP 状态；UDP 无状态概念，为 `None`
    pub state: Option<TcpState>,
    /// 占用端口的进程；权限不足或内核占用时为 `None`
    pub process: Option<ProcessInfo>,
}

impl fmt::Display for PortEntry {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:>5} {} {} ", self.port, self.protocol, self.local_addr)?;
        match self.state {
            Some(state) => write!(f, "{state} ")?,
            None => f.write_str("- ")?,
        }
        match &self.process {
            Some(process) => write!(f, "{process}"),
            None => f.write_str("（无法获取进程，可能需要提权）"),
        }
    }
}

/// 杀掉进程的目标描述。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KillTarget {
    pub pid: u32,
    /// 查询时记录的进程启动时间（epoch 秒）：杀之前用它校验 PID 未被复用。
    /// `None` 表示跳过校验（调用方自行负责）。
    pub expect_start_time: Option<u64>,
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

    fn process(name: &str) -> ProcessInfo {
        ProcessInfo {
            pid: 42,
            name: name.to_owned(),
            user: None,
            exe: None,
            cmd: vec![],
            cwd: None,
            start_time: 0,
            parent: None,
            memory: 0,
        }
    }

    #[test]
    fn port_entry_display_contains_port_and_process() {
        let entry = PortEntry {
            port: 8080,
            protocol: Protocol::Tcp,
            local_addr: "127.0.0.1".parse().unwrap(),
            state: Some(TcpState::Listen),
            process: Some(process("node")),
        };
        // process("node") 无 user，显示为 "node (pid 42)"
        assert_eq!(
            entry.to_string(),
            " 8080 tcp 127.0.0.1 LISTEN node (pid 42)"
        );
    }

    #[test]
    fn port_entry_display_without_process() {
        let entry = PortEntry {
            port: 53,
            protocol: Protocol::Udp,
            local_addr: "0.0.0.0".parse().unwrap(),
            state: None,
            process: None,
        };
        assert_eq!(
            entry.to_string(),
            "   53 udp 0.0.0.0 - （无法获取进程，可能需要提权）"
        );
    }

    #[test]
    fn risk_marks_databases_and_docker_as_critical() {
        assert_eq!(process("node").risk(), RiskLevel::Safe);
        assert_eq!(process("mysqld").risk(), RiskLevel::Critical);
        assert_eq!(process("redis-server").risk(), RiskLevel::Critical);
        assert_eq!(process("com.docker.backend").risk(), RiskLevel::Critical);
        assert_eq!(process("launchd").risk(), RiskLevel::Critical);
    }

    #[test]
    fn risk_matches_executable_path_and_strips_exe_suffix() {
        let mut p = process("whatever");
        p.exe = Some("/usr/local/mysql/bin/mysqld".to_owned());
        assert_eq!(p.risk(), RiskLevel::Critical);

        // Windows 的 `\` 分隔符只有 Windows 自己才认，对应断言只在 Windows 上跑
        #[cfg(windows)]
        {
            let mut p = process("whatever");
            p.exe = Some(r"C:\Program Files\PostgreSQL\postgres.exe".to_owned());
            assert_eq!(p.risk(), RiskLevel::Critical);
        }
    }

    #[test]
    fn risk_marks_privileged_users_as_caution() {
        let mut p = process("some-server");
        p.user = Some("root".to_owned());
        assert_eq!(p.risk(), RiskLevel::Caution);

        let mut p = process("some-service");
        p.user = Some("SYSTEM".to_owned());
        assert_eq!(p.risk(), RiskLevel::Caution);
    }

    #[test]
    fn risk_marks_pid_1_as_critical() {
        let mut p = process("mystery");
        p.pid = 1;
        assert_eq!(p.risk(), RiskLevel::Critical);
    }
}
