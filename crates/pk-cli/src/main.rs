//! `pk`：pocket 工具箱命令行入口。
//!
//! 命令结构（现在定死，兼容性最难改）：
//! - `pk port <n>`：正式形式
//! - `pk <n>`：便捷别名
//! - `pk port kill <n>`：动作子命令

use anyhow::{Context, Result};
use clap::{CommandFactory, Parser, Subcommand};

use pk_core::kill;
use pk_core::model::KillTarget;
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
    },
}

#[derive(Debug, Subcommand)]
enum PortAction {
    /// 杀掉占用指定端口的进程
    Kill {
        /// 端口号
        port: u16,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Some(Command::Port {
            action: Some(PortAction::Kill { port }),
            ..
        }) => kill_port(port),
        Some(Command::Port { action: None, port }) => show_port(port),
        None => match cli.port {
            Some(port) => show_port(Some(port)),
            None => {
                // 不带参数时打印帮助，而不是静默退出
                Cli::command().print_help()?;
                Ok(())
            }
        },
    }
}

/// 查看端口占用；`port` 为 `None` 时列出全部。
fn show_port(port: Option<u16>) -> Result<()> {
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
    for entry in &entries {
        println!("{entry}");
    }
    Ok(())
}

/// 杀掉占用指定端口的进程。
fn kill_port(port: u16) -> Result<()> {
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

    let killer = kill::killer();
    for entry in &entries {
        let Some(process) = &entry.process else {
            continue;
        };
        let target = KillTarget { pid: process.pid };
        let outcome = killer
            .terminate(&target)
            .with_context(|| format!("终止 pid {}（{}）失败", process.pid, process.name))?;
        println!("端口 {port}：pid {} {outcome}", process.pid);
    }
    Ok(())
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
        let Some(Command::Port { action, port }) = cli.command else {
            panic!("应解析出 port 子命令");
        };
        assert_eq!(port, Some(8080));
        assert!(action.is_none());
    }

    #[test]
    fn port_kill_is_nested_subcommand() {
        let cli = Cli::try_parse_from(["pk", "port", "kill", "8080"]).unwrap();
        let Some(Command::Port {
            action: Some(PortAction::Kill { port }),
            ..
        }) = cli.command
        else {
            panic!("应解析出 port kill 子命令");
        };
        assert_eq!(port, 8080);
    }
}
