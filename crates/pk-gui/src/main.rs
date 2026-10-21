//! pk-gui：端口终结者的 GUI 前端（Tauri 2 + Vite/React）。
//!
//! 本 crate 只做两件事：把 pk-core 的能力暴露成 Tauri 命令、把 core
//! 类型适配成前端 DTO——界面全部在 `frontend/` 的 React 里实现。
//! 依赖铁律不变：这里依赖 pk-core，core 不反向依赖任何 UI。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine as _;
use pk_core::kill::{self, KillOutcome};
use pk_core::model::{KillTarget, PortEntry, ProcessInfo, Protocol, RiskLevel, TcpState};
use pk_core::scan;
use serde::{Deserialize, Serialize};
use tauri::Manager; // app.path / app.state / get_webview_window

// ---------- DTO：core 类型 → 前端 JSON ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessDto {
    pid: u32,
    name: String,
    user: Option<String>,
    exe: Option<String>,
    cmd: Vec<String>,
    cwd: Option<String>,
    start_time: u64,
    parent: Option<u32>,
    /// "safe" / "caution" / "critical"，前端据此渲染徽章与确认流程
    risk: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PortEntryDto {
    port: u16,
    /// "tcp" / "udp"
    protocol: &'static str,
    local_addr: String,
    /// "LISTEN" 等；UDP 无状态
    state: Option<&'static str>,
    process: Option<ProcessDto>,
}

fn process_dto(p: &ProcessInfo) -> ProcessDto {
    ProcessDto {
        pid: p.pid,
        name: p.name.clone(),
        user: p.user.clone(),
        exe: p.exe.clone(),
        cmd: p.cmd.clone(),
        cwd: p.cwd.clone(),
        start_time: p.start_time,
        parent: p.parent,
        risk: match p.risk() {
            RiskLevel::Safe => "safe",
            RiskLevel::Caution => "caution",
            RiskLevel::Critical => "critical",
        },
    }
}

fn entry_dto(e: &PortEntry) -> PortEntryDto {
    PortEntryDto {
        port: e.port,
        protocol: match e.protocol {
            Protocol::Tcp => "tcp",
            Protocol::Udp => "udp",
        },
        local_addr: e.local_addr.to_string(),
        state: e.state.map(|s| match s {
            TcpState::Listen => "LISTEN",
            TcpState::Established => "ESTABLISHED",
            TcpState::TimeWait => "TIME_WAIT",
            TcpState::CloseWait => "CLOSE_WAIT",
            TcpState::Other => "OTHER",
        }),
        process: e.process.as_ref().map(process_dto),
    }
}

// ---------- Tauri 命令 ----------

/// 扫描端口占用；`port` 为 `None` 时返回全部。
#[tauri::command]
async fn scan_ports(port: Option<u16>) -> Result<Vec<PortEntryDto>, String> {
    let entries = scan::scanner().scan().map_err(|e| e.to_string())?;
    Ok(entries
        .iter()
        .filter(|e| port.is_none_or(|p| e.port == p))
        .map(entry_dto)
        .collect())
}

/// 终止请求：pid + 查询时记录的启动时间（PID 复用保护）。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct KillRequest {
    pid: u32,
    start_time: u64,
}

/// 单个目标的终止结果。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct KillResultDto {
    pid: u32,
    ok: bool,
    /// 成功时的结局（"已退出（SIGTERM）" 等）；失败为 `None`
    outcome: Option<&'static str>,
    message: String,
}

/// 终止进程。杀前重扫一次：既执行与 CLI 相同的受保护名单闸
/// （Critical 未带 `force` 拒绝），也让 PID 复用校验多一道最新数据。
#[tauri::command]
async fn kill_processes(
    requests: Vec<KillRequest>,
    force: bool,
) -> Result<Vec<KillResultDto>, String> {
    let killer = kill::killer();
    let entries = scan::scanner().scan().map_err(|e| e.to_string())?;

    let mut results = Vec::with_capacity(requests.len());
    for r in requests {
        // 重扫后找不到 = 已退出（消息层面对齐 CLI 的 AlreadyExited 语义）
        let Some(p) = entries
            .iter()
            .find_map(|e| e.process.as_ref().filter(|p| p.pid == r.pid))
        else {
            results.push(KillResultDto {
                pid: r.pid,
                ok: false,
                outcome: None,
                message: "进程已不存在（可能刚好退出）".to_owned(),
            });
            continue;
        };

        if p.risk() == RiskLevel::Critical && !force {
            results.push(KillResultDto {
                pid: r.pid,
                ok: false,
                outcome: None,
                message: "受保护进程已拒绝终止（需在界面完成二次确认）".to_owned(),
            });
            continue;
        }

        let target = KillTarget {
            pid: r.pid,
            expect_start_time: Some(r.start_time),
        };
        match killer.terminate(&target) {
            Ok(outcome) => results.push(KillResultDto {
                pid: r.pid,
                ok: true,
                outcome: Some(match outcome {
                    KillOutcome::Terminated => "已退出（SIGTERM）",
                    KillOutcome::ForceKilled => "已强制终止（SIGKILL）",
                    KillOutcome::AlreadyExited => "终止前已退出",
                }),
                message: String::new(),
            }),
            Err(e) => results.push(KillResultDto {
                pid: r.pid,
                ok: false,
                outcome: None,
                message: e.to_string(),
            }),
        }
    }
    Ok(results)
}

/// 当前是否以管理员 / root 运行（决定前端"提权重启"入口是否显示）。
#[cfg(unix)]
#[allow(unsafe_code)] // libc::geteuid 是 FFI，无 safe 封装可用
#[tauri::command]
fn is_elevated() -> bool {
    let euid = unsafe { libc::geteuid() };
    euid == 0
}

/// 当前是否以管理员 / root 运行（Windows 令牌检测暂未实现，恒 false）。
#[cfg(windows)]
#[tauri::command]
fn is_elevated() -> bool {
    false
}

/// 以管理员权限重启应用：拉起提权启动器后退出当前实例。
///
/// - macOS：`osascript` 弹出系统授权对话框后以 root 启动本程序
/// - Linux：`pkexec`（Polkit）授权
/// - Windows：PowerShell `Start-Process -Verb RunAs`（UAC）
#[tauri::command]
async fn relaunch_elevated(app: tauri::AppHandle) -> Result<(), String> {
    use std::process::Command;
    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .display()
        .to_string();

    #[cfg(target_os = "macos")]
    // AppleScript 里对 shell 命令整体加引号，路径带空格也安全
    let mut cmd = {
        let script = format!("do shell script \"\\\"{exe}\\\"\" with administrator privileges");
        let mut c = Command::new("osascript");
        c.arg("-e").arg(script);
        c
    };
    #[cfg(target_os = "linux")]
    let mut cmd = {
        let mut c = Command::new("pkexec");
        c.arg(&exe);
        c
    };
    #[cfg(target_os = "windows")]
    // PS 单引号字符串按字面解析，路径带空格安全
    let mut cmd = {
        let mut c = Command::new("powershell");
        c.args([
            "-Command",
            &format!("Start-Process -FilePath '{exe}' -Verb RunAs"),
        ]);
        c
    };

    cmd.spawn()
        .map_err(|e| format!("提权启动器拉起失败：{e}"))?;
    app.exit(0);
    Ok(())
}

// ---------- 托盘与窗口行为 ----------

/// 关闭窗口时是否直接退出程序；false = 隐藏到托盘（需托盘图标开启）。
struct CloseToQuit(std::sync::RwLock<bool>); // 初始 true

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// 显示 / 隐藏系统托盘图标（macOS 为菜单栏图标）。初始隐藏，
/// 前端启动后按设置同步。
#[tauri::command]
fn set_tray_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    app.state::<tauri::tray::TrayIcon>()
        .set_visible(visible)
        .map_err(|e| e.to_string())
}

/// 设置关闭窗口时的行为（true 退出 / false 隐藏到托盘）。
#[tauri::command]
fn set_close_to_quit(app: tauri::AppHandle, quit: bool) -> Result<(), String> {
    *app.state::<CloseToQuit>()
        .0
        .write()
        .map_err(|e| e.to_string())? = quit;
    Ok(())
}

// ---------- 背景图片 ----------

/// 背景图存应用数据目录（localStorage 放不下几张照片），前端只拿 data URL。
fn bg_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("background.img"))
        .map_err(|e| e.to_string())
}

/// 魔数嗅探 MIME；不认识返回 None（当作不支持的图片拒绝）。
fn mime_of(b: &[u8]) -> Option<&'static str> {
    Some(match () {
        _ if b.starts_with(&[0x89, b'P', b'N', b'G']) => "image/png",
        _ if b.starts_with(&[0xFF, 0xD8, 0xFF]) => "image/jpeg",
        _ if b.starts_with(b"GIF8") => "image/gif",
        _ if b.len() > 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" => "image/webp",
        _ => return None,
    })
}

fn encode_data_url(bytes: Vec<u8>) -> Result<String, String> {
    let mime = mime_of(&bytes).ok_or("不支持的图片格式（png / jpg / webp / gif）")?;
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&bytes)
    ))
}

/// 打开系统文件选择器选背景图，保存到应用数据目录；
/// 返回 data URL 供前端立即渲染；用户取消返回 None。
#[tauri::command]
async fn pick_background_image(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let picked = rfd::AsyncFileDialog::new()
        .set_title("选择背景图片")
        .add_filter("图片", &["png", "jpg", "jpeg", "webp", "gif"])
        .pick_file()
        .await;
    let Some(picked) = picked else {
        return Ok(None);
    };

    let bytes = std::fs::read(picked.path()).map_err(|e| e.to_string())?;
    let url = encode_data_url(bytes.clone())?;
    let dest = bg_path(&app)?;
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(dest, bytes).map_err(|e| e.to_string())?;
    Ok(Some(url))
}

/// 启动时读取已保存的背景图；未设置返回 None。
#[tauri::command]
async fn load_background_image(app: tauri::AppHandle) -> Result<Option<String>, String> {
    match std::fs::read(bg_path(&app)?) {
        Ok(bytes) => Ok(Some(encode_data_url(bytes)?)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// 删除已保存的背景图（恢复默认背景）。
#[tauri::command]
async fn clear_background_image(app: tauri::AppHandle) -> Result<(), String> {
    match std::fs::remove_file(bg_path(&app)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

            app.manage(CloseToQuit(std::sync::RwLock::new(true)));

            let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let tray = TrayIconBuilder::with_id("pk-main")
                .icon(
                    app.default_window_icon()
                        .cloned()
                        .ok_or("缺少应用图标（检查 bundle.icon）")?,
                )
                .tooltip("端口终结者 · pk")
                .menu(&menu)
                // 左键点图标 = 显示窗口，菜单只在右键弹出
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            tray.set_visible(false)?; // 初始隐藏，前端按设置同步
            app.manage(tray);
            Ok(())
        })
        // "关闭窗口时隐藏到托盘"：拦下关闭事件改为隐藏
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let quit = window
                    .state::<CloseToQuit>()
                    .0
                    .read()
                    .map(|v| *v)
                    .unwrap_or(true);
                if !quit {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            scan_ports,
            kill_processes,
            is_elevated,
            relaunch_elevated,
            set_tray_visible,
            set_close_to_quit,
            pick_background_image,
            load_background_image,
            clear_background_image
        ])
        .run(tauri::generate_context!())
        .expect("pk-gui 运行失败");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn process(pid: u32) -> ProcessInfo {
        ProcessInfo {
            pid,
            name: "m".to_owned(),
            user: None,
            exe: None,
            cmd: vec![],
            cwd: None,
            start_time: 0,
            parent: None,
        }
    }

    #[test]
    fn dto_maps_risk_levels_to_frontend_strings() {
        // pid 1 恒为 Critical
        assert_eq!(process_dto(&process(1)).risk, "critical");
        assert_eq!(process_dto(&process(42)).risk, "safe");

        let mut root = process(42);
        root.user = Some("root".to_owned());
        assert_eq!(process_dto(&root).risk, "caution");
    }
}
