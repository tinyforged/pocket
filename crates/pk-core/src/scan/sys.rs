//! 跨平台扫描实现：netstat2 提供端口↔PID 映射，sysinfo 补全进程详情。
//!
//! 已知边界：非提权时，其他用户进程的 PID 可能拿不到（尤其 Linux 读
//! `/proc` 与 macOS 的 libproc 都受属主限制），此时 `process` 为 `None`
//! 而非报错——"看到端口但看不到进程"本身就是要呈现给用户的信息。

use std::collections::HashMap;
use std::net::IpAddr;

use netstat2::{AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use sysinfo::{ProcessesToUpdate, System, Users};

use super::{PortScanner, ScanError};
use crate::model::{PortEntry, ProcessInfo, Protocol, TcpState};

/// 套接字扫描结果与进程信息补全前的中间形态。
struct RawEntry {
    port: u16,
    protocol: Protocol,
    local_addr: IpAddr,
    state: Option<TcpState>,
    pid: Option<u32>,
}

pub struct Scanner;

impl PortScanner for Scanner {
    fn scan(&self) -> Result<Vec<PortEntry>, ScanError> {
        let sockets = netstat2::get_sockets_info(
            AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6,
            ProtocolFlags::TCP | ProtocolFlags::UDP,
        )?;

        // "端口被占用" 的语义：TCP 处于 LISTEN，或 UDP 已绑定；
        // 单纯的已建立出站连接不算占住端口。
        let raw: Vec<RawEntry> = sockets
            .into_iter()
            .filter_map(|socket| match socket.protocol_socket_info {
                ProtocolSocketInfo::Tcp(ref t) if matches!(t.state, netstat2::TcpState::Listen) => {
                    Some(RawEntry {
                        port: t.local_port,
                        protocol: Protocol::Tcp,
                        local_addr: t.local_addr,
                        state: Some(TcpState::Listen),
                        pid: first_pid(&socket.associated_pids),
                    })
                }
                ProtocolSocketInfo::Udp(ref u) => Some(RawEntry {
                    port: u.local_port,
                    protocol: Protocol::Udp,
                    local_addr: u.local_addr,
                    state: None,
                    pid: first_pid(&socket.associated_pids),
                }),
                _ => None,
            })
            // port 0 = 未绑定 / 尚未分配端口的套接字，对"端口占用"无意义
            .filter(|r| r.port != 0)
            .collect();

        let processes = load_processes(&raw);

        // 去重：同一进程可能对同一 (port, protocol, addr) 开多个套接字
        //（如 mDNS），对"端口占用"是纯噪音——pid 进键即可折叠。
        // 反过来，SO_REUSEPORT 下多个进程共享同一端口是真实占用，
        // 不能被折叠掉。
        let mut deduped: HashMap<(u16, Protocol, IpAddr, Option<u32>), PortEntry> = HashMap::new();
        for r in raw {
            let entry = PortEntry {
                port: r.port,
                protocol: r.protocol,
                local_addr: r.local_addr,
                state: r.state,
                process: r.pid.and_then(|pid| processes.get(&pid).cloned()),
            };
            deduped.insert((r.port, r.protocol, r.local_addr, r.pid), entry);
        }

        let mut entries: Vec<PortEntry> = deduped.into_values().collect();
        entries.sort_by_key(|e| (e.port, e.protocol));
        Ok(entries)
    }
}

/// netstat2 偶尔会给 pid 0（内核），过滤掉。
fn first_pid(pids: &[u32]) -> Option<u32> {
    pids.iter().copied().find(|&pid| pid != 0)
}

/// 用 sysinfo 一次性补全所有相关 PID 的进程详情。
fn load_processes(raw: &[RawEntry]) -> HashMap<u32, ProcessInfo> {
    // pid 必须去重：同一进程常开多个套接字（如 mDNS 的 5353），重复喂给
    // refresh_processes 会让该进程查不到（A/B 实测，见 examples/probe.rs）
    let mut seen = std::collections::HashSet::new();
    let pids: Vec<sysinfo::Pid> = raw
        .iter()
        .filter_map(|r| r.pid)
        .filter(|pid| seen.insert(*pid))
        .map(sysinfo::Pid::from_u32)
        .collect();
    let mut processes = HashMap::new();
    if pids.is_empty() {
        return processes;
    }

    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::Some(&pids), true);
    let users = Users::new_with_refreshed_list();

    for &pid in &pids {
        let Some(proc) = sys.process(pid) else {
            continue;
        };
        let user = proc
            .user_id()
            .and_then(|uid| users.get_user_by_id(uid))
            .map(|u| u.name().to_owned());
        processes.insert(
            pid.as_u32(),
            ProcessInfo {
                pid: pid.as_u32(),
                name: proc.name().to_string_lossy().into_owned(),
                user,
                exe: proc.exe().map(|p| p.display().to_string()),
                cmd: proc
                    .cmd()
                    .iter()
                    .map(|c| c.to_string_lossy().into_owned())
                    .collect(),
                cwd: proc.cwd().map(|p| p.display().to_string()),
                start_time: proc.start_time(),
                parent: proc.parent().map(|p| p.as_u32()),
                memory: proc.memory(),
            },
        );
    }
    processes
}
