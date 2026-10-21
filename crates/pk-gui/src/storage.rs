//! 数据目录：默认在系统 app data 目录，支持用户更改（bootstrap 配置
//! 记录自定义路径，切换时迁移现有数据）。背景图、日志都存在这里。

use serde::Serialize;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::{OnceLock, RwLock};
use tauri::Manager;

use crate::logging;

/// 当前生效的数据目录（初始化后只被 change_storage_dir 替换）。
static DATA_DIR: OnceLock<RwLock<PathBuf>> = OnceLock::new();

fn data_dir() -> &'static RwLock<PathBuf> {
    DATA_DIR.get_or_init(|| RwLock::new(PathBuf::new()))
}

/// 默认数据目录下的路径重定向配置；字段缺省 / 文件不存在 = 用默认。
fn bootstrap_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("data_dir.json")
}

/// setup 阶段调用：解析 bootstrap 配置，确定并创建数据目录。
pub fn init(app: &tauri::AppHandle) {
    let default = app.path().app_data_dir().unwrap_or_default();
    let dir = std::fs::read(bootstrap_path(app))
        .ok()
        .and_then(|raw| serde_json::from_slice::<serde_json::Value>(&raw).ok())
        .and_then(|v| v["dir"].as_str().map(PathBuf::from))
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(default);
    let _ = std::fs::create_dir_all(&dir);
    *data_dir().write().expect("数据目录锁中毒") = dir;
}

/// 当前数据目录。
pub fn dir() -> PathBuf {
    data_dir().read().expect("数据目录锁中毒").clone()
}

fn default_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_default()
}

/// 目录体积（一层文件求和；日志目录无嵌套，够用）。
fn dir_size(p: &Path) -> u64 {
    std::fs::read_dir(p)
        .map(|it| {
            it.filter_map(|e| e.ok())
                .filter_map(|e| e.metadata().ok())
                .filter(|m| m.is_file())
                .map(|m| m.len())
                .sum()
        })
        .unwrap_or(0)
}

fn file_size(p: &Path) -> u64 {
    std::fs::metadata(p).map(|m| m.len()).unwrap_or(0)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfoDto {
    dir: String,
    default_dir: String,
    background_bytes: u64,
    logs_bytes: u64,
}

/// 数据目录信息（路径 + 占用统计），供设置面板展示。
#[tauri::command]
pub fn get_storage_info(app: tauri::AppHandle) -> StorageInfoDto {
    let dir = dir();
    StorageInfoDto {
        background_bytes: file_size(&dir.join("background.img")),
        logs_bytes: dir_size(&dir.join("logs")),
        dir: dir.display().to_string(),
        default_dir: default_dir(&app).display().to_string(),
    }
}

/// 数据目录下的可迁移内容（背景图 + 日志）。
fn migrate(from: &Path, to: &Path) -> Result<(), String> {
    for name in ["background.img", "logs"] {
        let src = from.join(name);
        if !src.exists() {
            continue;
        }
        let dst = to.join(name);
        if dst.exists() {
            std::fs::remove_dir_all(&dst).map_err(|e| format!("清理目标 {name} 失败：{e}"))?;
        }
        if let Err(e) = std::fs::rename(&src, &dst) {
            // 跨卷 rename 会失败，退回复制 + 删除
            std::fs::copy(&src, &dst)
                .map_err(|copy_err| format!("迁移 {name} 失败：rename {e} / copy {copy_err}"))?;
            if src.is_dir() {
                std::fs::remove_dir_all(&src).map_err(|e| format!("迁移 {name} 失败：{e}"))?;
            } else {
                std::fs::remove_file(&src).map_err(|e| format!("迁移 {name} 失败：{e}"))?;
            }
        }
    }
    Ok(())
}

/// 更改数据目录：选目录 → 迁移现有数据 → 记住新路径。
/// 返回新路径；用户取消返回 None。
#[tauri::command]
pub async fn change_storage_dir(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let picked = rfd::AsyncFileDialog::new()
        .set_title("选择新的数据目录")
        .pick_folder()
        .await;
    let Some(picked) = picked else {
        return Ok(None);
    };

    let new_dir = PathBuf::from(picked.path());
    let old = dir();
    if new_dir == old {
        return Err("新目录与当前相同".into());
    }
    let _ = std::fs::create_dir_all(&new_dir);

    // 先写 bootstrap 再迁移：中途失败时下次启动仍指向旧目录不至丢数据
    let cfg = json!({ "dir": new_dir.display().to_string() });
    std::fs::write(
        bootstrap_path(&app),
        serde_json::to_vec(&cfg).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("写入目录配置失败：{e}"))?;

    migrate(&old, &new_dir)?;
    *data_dir().write().expect("数据目录锁中毒") = new_dir.clone();
    logging::set_dir(new_dir.join("logs"));
    logging::info(format!(
        "数据目录已更改：{} → {}",
        old.display(),
        new_dir.display()
    ));

    Ok(Some(new_dir.display().to_string()))
}
