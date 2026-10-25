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

/// 当前是否以管理员运行：查当前进程令牌的 TokenElevation（UAC 提权后为真）。
#[cfg(windows)]
#[allow(unsafe_code)] // Win32 FFI：OpenProcessToken / GetTokenInformation
#[tauri::command]
pub fn is_elevated() -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::Security::{
        GetTokenInformation, TOKEN_ELEVATION, TOKEN_QUERY, TokenElevation,
    };
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token: HANDLE = core::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut len = 0u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut TOKEN_ELEVATION as *mut core::ffi::c_void,
            core::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut len,
        ) != 0;
        CloseHandle(token);
        ok && elevation.TokenIsElevated != 0
    }
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
