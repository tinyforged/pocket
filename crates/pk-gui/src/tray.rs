//! 托盘图标、功能菜单与窗口关闭行为。
//!
//! 菜单除窗口管理（显示 / 退出）外还提供应用入口（速查 / 扫描 / 设置 /
//! 日志 / 更新）：Rust 侧只负责显示窗口并把动作 id 推给前端（"pk://tray"），
//! 真正行为由前端各领域模块执行。
//!
//! 左键行为按平台惯例：macOS 菜单栏图标左键弹菜单；Windows / Linux
//! 托盘左键显示窗口，菜单走右键。
//!
//! 关闭策略 `CloseToQuit`：true 直接退出（默认）；false 拦下关闭事件
//! 改为隐藏窗口，之后只能从托盘唤回——因此托盘关闭时前端会强制把
//! 该值同步回 true，避免窗口隐藏后没有任何入口。

use tauri::{Emitter, Manager};

const TRAY_EVENT: &str = "pk://tray";

/// 关闭窗口时是否直接退出程序；false = 隐藏到托盘（需托盘图标开启）。
struct CloseToQuit(std::sync::RwLock<bool>); // 初始 true

/// 建托盘图标与菜单、注册关闭行为状态。图标初始隐藏，前端按设置同步。
pub fn install(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::TrayIconBuilder;
    #[cfg(not(target_os = "macos"))]
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};

    app.manage(CloseToQuit(std::sync::RwLock::new(true)));

    let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let scan = MenuItem::with_id(app, "scan", "扫描端口", true, None::<&str>)?;
    let lookup = MenuItem::with_id(app, "lookup", "速查端口", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)?;
    let logs = MenuItem::with_id(app, "logs", "实时日志…", true, None::<&str>)?;
    let update = MenuItem::with_id(app, "update", "检查更新…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &PredefinedMenuItem::separator(app)?,
            &scan,
            &lookup,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &logs,
            &update,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let builder = TrayIconBuilder::with_id("pk-main")
        .icon(
            app.default_window_icon()
                .cloned()
                .ok_or("缺少应用图标（检查 bundle.icon）")?,
        )
        .tooltip("pocket · pk")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                show_main_window(app);
            }
            "quit" => app.exit(0),
            // 功能入口：显示窗口后把动作 id 交给前端执行
            "scan" | "lookup" | "settings" | "logs" | "update" => {
                if let Some(w) = show_main_window(app) {
                    let _ = w.emit(TRAY_EVENT, event.id.as_ref());
                }
            }
            _ => {}
        });

    // 左键行为按平台惯例（cfg 见模块文档）
    #[cfg(target_os = "macos")]
    let builder = builder.show_menu_on_left_click(true);
    #[cfg(not(target_os = "macos"))]
    let builder = builder
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    let tray = builder.build(app)?;
    tray.set_visible(false)?;
    app.manage(tray);
    Ok(())
}

/// 关闭窗口时调用：若当前策略是"隐藏到托盘"则隐藏窗口并返回 true，
/// 调用方随后需 `prevent_close` 取消真正的关闭。
pub fn intercept_close(window: &tauri::Window) -> bool {
    let quit = window
        .state::<CloseToQuit>()
        .0
        .read()
        .map(|v| *v)
        .unwrap_or(true);
    if quit {
        false
    } else {
        let _ = window.hide();
        true
    }
}

fn show_main_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    let w = app.get_webview_window("main")?;
    let _ = w.show();
    let _ = w.unminimize();
    let _ = w.set_focus();
    Some(w)
}

/// 显示 / 隐藏系统托盘图标（macOS 为菜单栏图标）。初始隐藏，
/// 前端启动后按设置同步。
#[tauri::command]
pub fn set_tray_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    app.state::<tauri::tray::TrayIcon>()
        .set_visible(visible)
        .map_err(|e| e.to_string())
}

/// 设置关闭窗口时的行为（true 退出 / false 隐藏到托盘）。
#[tauri::command]
pub fn set_close_to_quit(app: tauri::AppHandle, quit: bool) -> Result<(), String> {
    *app.state::<CloseToQuit>()
        .0
        .write()
        .map_err(|e| e.to_string())? = quit;
    Ok(())
}
