//! 诊断探针：对照 netstat2 给出的 pid 与 sysinfo 能否查到该进程。
//! 用法：cargo run -p pk-core --example probe（提权前后各跑一次对比）。

use netstat2::{AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use sysinfo::{Pid, ProcessesToUpdate, System};

fn main() {
    let sockets = netstat2::get_sockets_info(
        AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6,
        ProtocolFlags::TCP | ProtocolFlags::UDP,
    )
    .expect("netstat2 失败");

    // 与 scan/sys.rs 完全一致的姿势：每个套接字条目一个 pid（含重复）
    let mut pids: Vec<Pid> = Vec::new();
    for s in &sockets {
        for p in &s.associated_pids {
            if *p != 0 {
                pids.push(Pid::from_u32(*p));
            }
        }
    }
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::Some(&pids), true);

    for s in &sockets {
        let (port, proto, addr) = match &s.protocol_socket_info {
            ProtocolSocketInfo::Tcp(t) => (t.local_port, "tcp", t.local_addr.to_string()),
            ProtocolSocketInfo::Udp(u) => (u.local_port, "udp", u.local_addr.to_string()),
        };
        if port == 0 {
            continue;
        }
        let owned: Vec<_> = s
            .associated_pids
            .iter()
            .copied()
            .filter(|p| *p != 0)
            .collect();
        if owned.is_empty() {
            println!("{port:>5}/{proto} {addr:<15} netstat2:无pid");
        } else {
            for p in owned {
                let found = sys.process(Pid::from_u32(p)).is_some();
                println!("{port:>5}/{proto} {addr:<15} netstat2:pid={p} sysinfo:{found}");
            }
        }
    }
}
