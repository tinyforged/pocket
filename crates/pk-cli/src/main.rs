//! `pk`：pocket 工具箱命令行入口。
//!
//! 命令结构（已定死，兼容性最难改）：
//! - `pk port <n>` / `pk <n>`：查看端口占用（`-v` 附进程详情）
//! - `pk port kill <n>`：终止占用进程（受保护进程需 `--force`）

use std::io::Write;

use anyhow::{Context, Result};
use clap::{CommandFactory, Parser, Subcommand};

use pk_core::kill;
use pk_core::model::{KillTarget, ProcessInfo, RiskLevel};
use pk_core::scan;

#[derive(Debug, Parser)]
#[command(name = "pk", version, about = "pocket 工具箱：随身小工具集")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    /// 便捷形式：`pk <端口>` 等价于 `pk port <端口>`
    port: Option<u16>,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// 端口工具：查看占用 / 杀掉占用进程
    Port {
        #[command(subcommand)]
        action: Option<PortAction>,

        /// 端口号；省略则列出全部占用
        port: Option<u16>,

        /// 附带进程详情（exe / cwd / 完整命令行 / 父进程）
        #[arg(short, long)]
        verbose: bool,
    },
}

#[derive(Debug, Subcommand)]
enum PortAction {
    /// 杀掉占用指定端口的进程：先 SIGTERM，超时升级 SIGKILL
    Kill {
        /// 端口号
        port: u16,

        /// 允许终止受保护进程（数据库 / 系统组件 / Docker 等）
        #[arg(long)]
        force: bool,

        /// 跳过多进程确认（供脚本使用）
        #[arg(short = 'y', long)]
        yes: bool,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Some(Command::Port {
            action: Some(PortAction::Kill { port, force, yes }),
            ..
        }) => kill_port(port, force, yes),
        Some(Command::Port {
            action: None,
            port,
            verbose,
        }) => show_port(port, verbose),
        None => match cli.port {
            Some(port) => show_port(Some(port), false),
            None => {
                // 不带参数时打印帮助，而不是静默退出
                Cli::command().print_help()?;
                Ok(())
            }
        },
    }
}

/// 查看端口占用；`port` 为 `None` 时列出全部。
fn show_port(port: Option<u16>, verbose: bool) -> Result<()> {
    let entries = scan::scanner().scan().context("扫描端口失败")?;
    let entries: Vec<_> = entries
        .into_iter()
        .filter(|e| port.is_none_or(|p| e.port == p))
        .collect();

    if entries.is_empty() {
        match port {
            Some(port) => println!("端口 {port} 未被占用"),
            None => println!("当前没有端口占用"),
        }
        return Ok(());
    }

    // 地址列宽自适应：IPv6（含 zone id）可超过 15 字符，取最长地址与
    // 表头 ADDRESS 的较大者，避免对齐被撑破
    let addr_w = entries
        .iter()
        .map(|e| e.local_addr.to_string().len())
        .max()
        .unwrap_or(0)
        .max("ADDRESS".len());
    println!(
        "{:>5}  {:<4}  {:<addr_w$}  {:<11}  PROCESS",
        "PORT",
        "PROTO",
        "ADDRESS",
        "STATE",
        addr_w = addr_w
    );
    for entry in &entries {
        let state = entry
            .state
            .map(|s| s.to_string())
            .unwrap_or_else(|| "-".to_owned());
        let process = match &entry.process {
            Some(p) if p.risk() == RiskLevel::Critical => format!("⚠ {p}"),
            Some(p) => format!("{p}"),
            None => "（无法获取进程，可能需要提权）".to_owned(),
        };
        println!(
            "{:>5}  {:<4}  {:<addr_w$}  {:<11}  {}",
            entry.port,
            entry.protocol,
            entry.local_addr,
            state,
            process,
            addr_w = addr_w
        );
        if verbose {
            if let Some(p) = &entry.process {
                print_details(p);
            }
        }
    }
    Ok(())
}

/// `-v` 的进程详情块（树形缩进挂在主行下面）。
fn print_details(p: &ProcessInfo) {
    let mut lines: Vec<(&str, String)> = vec![];
    if let Some(exe) = &p.exe {
        lines.push(("exe", exe.clone()));
    }
    if let Some(cwd) = &p.cwd {
        lines.push(("cwd", cwd.clone()));
    }
    if !p.cmd.is_empty() {
        lines.push(("cmd", p.cmd.join(" ")));
    }
    if let Some(parent) = p.parent {
        lines.push(("ppid", parent.to_string()));
    }
    for (i, (label, value)) in lines.iter().enumerate() {
        let branch = if i + 1 == lines.len() {
            "└─"
        } else {
            "├─"
        };
        println!("      {branch} {label:<4} {value}");
    }
}

/// 杀掉占用指定端口的进程。
///
/// 谨慎默认：单进程一键直杀；多进程先列表再总确认（`--yes` 跳过，供脚本）；
/// 受保护进程（[`RiskLevel::Critical`]）默认拒绝，需 `--force`。
fn kill_port(port: u16, force: bool, yes: bool) -> Result<()> {
    let entries = scan::scanner()
        .scan()
        .context("扫描端口失败")?
        .into_iter()
        .filter(|e| e.port == port)
        .collect::<Vec<_>>();

    if entries.is_empty() {
        println!("端口 {port} 未被占用，无需处理");
        return Ok(());
    }
    if entries.iter().any(|e| e.process.is_none()) {
        println!("端口 {port}：部分占用无法获取进程（可能需要提权），将跳过这些");
    }

    // 同一进程可能双栈监听（v4 / v6 各一条），按 pid 去重
    let mut targets: Vec<&ProcessInfo> =
        entries.iter().filter_map(|e| e.process.as_ref()).collect();
    targets.sort_by_key(|p| p.pid);
    targets.dedup_by_key(|p| p.pid);

    if targets.is_empty() {
        return Ok(());
    }

    // 多进程批量杀的代价不可控（可能混进无关服务），必须过一道确认
    if targets.len() > 1 && !yes {
        println!("端口 {port} 被 {} 个进程占用：", targets.len());
        for p in &targets {
            println!("  · {p}");
        }
        print!("将全部终止，继续？[y/N] ");
        std::io::stdout().flush()?;
        let mut answer = String::new();
        std::io::stdin().read_line(&mut answer)?;
        if !matches!(answer.trim().to_lowercase().as_str(), "y" | "yes") {
            println!("已取消");
            return Ok(());
        }
    }

    let killer = kill::killer();
    let mut terminated = Vec::new();
    for p in &targets {
        match p.risk() {
            RiskLevel::Critical if !force => {
                println!(
                    "⚠ 拒绝终止 {p}：受保护进程（数据库 / 系统组件 / Docker 等），确认无误请加 --force"
                );
                continue;
            }
            RiskLevel::Caution => {
                println!(
                    "⚠ pid {}（{}）运行在系统账户下，继续终止",
                    p.pid,
                    p.user.as_deref().unwrap_or("?")
                );
            }
            _ => {}
        }

        // 查询与终止之间可能隔了几秒：带上启动时间，防 PID 复用误杀
        let target = KillTarget {
            pid: p.pid,
            expect_start_time: Some(p.start_time),
        };
        match killer.terminate(&target) {
            Ok(outcome) => {
                println!("端口 {port}：{p} → {outcome}");
                terminated.push(p.pid);
            }
            Err(e) => println!("端口 {port}：{p} → 失败：{e}"),
        }
    }

    if !terminated.is_empty() {
        print_manual_hint(&terminated);
    }
    Ok(())
}

/// 复制等效命令：把操作权留给用户，下次可以直接用系统工具。
fn print_manual_hint(pids: &[u32]) {
    #[cfg(unix)]
    println!(
        "等效手动命令：kill -9 {}",
        pids.iter()
            .map(u32::to_string)
            .collect::<Vec<_>>()
            .join(" ")
    );
    #[cfg(windows)]
    println!(
        "等效手动命令：taskkill /F {}",
        pids.iter()
            .map(|p| format!("/PID {p}"))
            .collect::<Vec<_>>()
            .join(" ")
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bare_port_is_alias_of_port_subcommand() {
        let cli = Cli::try_parse_from(["pk", "8080"]).unwrap();
        assert_eq!(cli.port, Some(8080));
        assert!(cli.command.is_none());
    }

    #[test]
    fn port_subcommand_takes_optional_port() {
        let cli = Cli::try_parse_from(["pk", "port", "8080"]).unwrap();
        let Some(Command::Port { action, port, .. }) = cli.command else {
            panic!("应解析出 port 子命令");
        };
        assert_eq!(port, Some(8080));
        assert!(action.is_none());
    }

    #[test]
    fn port_kill_is_nested_subcommand() {
        let cli = Cli::try_parse_from(["pk", "port", "kill", "8080"]).unwrap();
        let Some(Command::Port {
            action: Some(PortAction::Kill { port, .. }),
            ..
        }) = cli.command
        else {
            panic!("应解析出 port kill 子命令");
        };
        assert_eq!(port, 8080);
    }

    #[test]
    fn port_kill_takes_force_and_yes_flags() {
        let cli = Cli::try_parse_from(["pk", "port", "kill", "8080", "--force", "--yes"]).unwrap();
        let Some(Command::Port {
            action: Some(PortAction::Kill { port, force, yes }),
            ..
        }) = cli.command
        else {
            panic!("应解析出 port kill 子命令");
        };
        assert_eq!((port, force, yes), (8080, true, true));
    }

    #[test]
    fn port_takes_verbose_flag() {
        let cli = Cli::try_parse_from(["pk", "port", "-v"]).unwrap();
        let Some(Command::Port { verbose, .. }) = cli.command else {
            panic!("应解析出 port 子命令");
        };
        assert!(verbose);
    }
}
