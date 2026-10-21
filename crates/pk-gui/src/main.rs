//! pk-gui：端口终结者的 GUI 前端（Tauri 2 + Vite/React）。
//!
//! 模块按领域划分，main.rs 只做组装（Builder、托盘安装、事件接线、
//! 命令注册），不实现任何功能：
//! - `dto`：core 类型 → 前端 JSON（纯适配）
//! - `ports`：扫描 / 终止命令（主业务）
//! - `elevation`：提权检测与提权重启
//! - `tray`：托盘图标与窗口关闭行为
//! - `background`：背景图片存取
//!
//! 依赖铁律不变：这里依赖 pk-core，core 不反向依赖任何 UI。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod background;
mod dto;
mod elevation;
mod ports;
mod tray;

fn main() {
    tauri::Builder::default()
        .setup(tray::install)
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
            background::clear_background_image
        ])
        .run(tauri::generate_context!())
        .expect("pk-gui 运行失败");
}
