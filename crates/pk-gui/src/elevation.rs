//! 提权链路：检测当前是否已提权、以管理员权限重启应用。

use crate::logging;

/// 当前是否以管理员 / root 运行（决定前端"提权重启"入口是否显示）。
#[cfg(unix)]
#[allow(unsafe_code)] // libc::geteuid 是 FFI，无 safe 封装可用
#[tauri::command]
pub fn is_elevated() -> bool {
    let euid = unsafe { libc::geteuid() };
    euid == 0
}

/// 当前是否以管理员 / root 运行（Windows 令牌检测暂未实现，恒 false）。
#[cfg(windows)]
#[tauri::command]
pub fn is_elevated() -> bool {
    false
}

/// 以管理员权限重启应用：拉起提权启动器后退出当前实例。
///
/// - macOS：`osascript` 弹出系统授权对话框后以 root 启动本程序
/// - Linux：`pkexec`（Polkit）授权
/// - Windows：PowerShell `Start-Process -Verb RunAs`（UAC）
#[tauri::command]
pub async fn relaunch_elevated(app: tauri::AppHandle) -> Result<(), String> {
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
    logging::info("请求管理员权限并重启应用");
    app.exit(0);
    Ok(())
}
