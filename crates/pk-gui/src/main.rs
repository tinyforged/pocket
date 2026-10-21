//! pk-gui：pocket（端口终结者）的 GUI 前端（Tauri 2 + Vite/React）。
//!
//! 模块按领域划分，main.rs 只做组装（Builder、托盘安装、事件接线、
//! 命令注册），不实现任何功能：
//! - `dto`：core 类型 → 前端 JSON（纯适配）
//! - `ports`：扫描 / 终止命令（主业务）
//! - `elevation`：提权检测与提权重启
//! - `tray`：托盘图标与窗口关闭行为
//! - `background`：背景图片存取
//! - `storage`：数据目录（支持更改路径与迁移）
//! - `logging`：应用日志（落盘 / 实时 / 导出）
//!
//! 依赖铁律不变：这里依赖 pk-core，core 不反向依赖任何 UI。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod background;
mod dto;
mod elevation;
mod logging;
mod ports;
mod storage;
mod tray;

fn main() {
    // panic 也不丢日志（文件未初始化时进内存，稍后随导出可见）
    std::panic::set_hook(Box::new(|info| logging::error(format!("panic：{info}"))));

    tauri::Builder::default()
        // 版本检测与自更新（GitHub Releases）；安装后由 process 插件负责重启
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            storage::init(app.handle());
            logging::init(app.handle().clone(), storage::dir().join("logs"));
            tray::install(app)
        })
        // "关闭窗口时隐藏到托盘"：托盘模块决定是否拦下关闭事件
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if tray::intercept_close(window) {
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            ports::scan_ports,
            ports::kill_processes,
            elevation::is_elevated,
            elevation::relaunch_elevated,
            tray::set_tray_visible,
            tray::set_close_to_quit,
            background::pick_background_image,
            background::load_background_image,
            background::clear_background_image,
            storage::get_storage_info,
            storage::change_storage_dir,
            logging::get_recent_logs,
            logging::export_logs,
            logging::clear_logs,
            logging::write_frontend_log
        ])
        .run(tauri::generate_context!())
        .expect("pk-gui 运行失败");
}
