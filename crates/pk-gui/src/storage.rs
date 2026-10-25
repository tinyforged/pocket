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
const MIGRATABLE: [&str; 2] = ["background.img", "logs"];

/// 把可迁移内容**复制**到新目录。复制而非移动：全部成功前旧目录保持
/// 完整，任一步失败都只是"没换成"，绝不丢数据；清理旧目录由调用方在
/// 切换指针成功之后进行。
fn migrate(from: &Path, to: &Path) -> Result<(), String> {
    for name in MIGRATABLE {
        let src = from.join(name);
        if !src.exists() {
            continue;
        }
        let dst = to.join(name);
        if dst.is_dir() {
            std::fs::remove_dir_all(&dst).map_err(|e| format!("清理目标 {name} 失败：{e}"))?;
        } else if dst.exists() {
            std::fs::remove_file(&dst).map_err(|e| format!("清理目标 {name} 失败：{e}"))?;
        }
        copy_item(&src, &dst).map_err(|e| format!("迁移 {name} 失败：{e}"))?;
    }
    Ok(())
}

/// 单条目复制：文件直接复制；目录按一层展开（日志目录无嵌套，见 dir_size）。
fn copy_item(src: &Path, dst: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        std::fs::create_dir_all(dst)?;
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            if entry.file_type()?.is_file() {
                std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
            }
        }
    } else {
        std::fs::copy(src, dst)?;
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

    // 先复制迁移，全部成功才继续：旧目录全程完整；新目录里复制到一半
    // 的残留会在下次换目录时被同一段清理逻辑覆盖，无害
    migrate(&old, &new_dir)?;

    // 迁移成功：写 bootstrap、切换运行时指针，最后才清理旧目录的副本
    // （清理放在指针切换之后：即使 bootstrap 写入失败，也只是新旧两份
    // 并存，数据不丢）
    let cfg = json!({ "dir": new_dir.display().to_string() });
    std::fs::write(
        bootstrap_path(&app),
        serde_json::to_vec(&cfg).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("写入目录配置失败：{e}"))?;
    *data_dir().write().expect("数据目录锁中毒") = new_dir.clone();
    logging::set_dir(new_dir.join("logs"));
    for name in MIGRATABLE {
        let p = old.join(name);
        // 尽力清理：失败只留孤儿文件，不影响正确性
        if p.is_dir() {
            let _ = std::fs::remove_dir_all(&p);
        } else if p.exists() {
            let _ = std::fs::remove_file(&p);
        }
    }
    logging::info(format!(
        "数据目录已更改：{} → {}",
        old.display(),
        new_dir.display()
    ));

    Ok(Some(new_dir.display().to_string()))
}

#[cfg(test)]
mod tests {
    use super::migrate;
    use std::fs;
    use std::path::PathBuf;

    /// 每个用例独立的临时目录（用例名 + 进程号隔离，并行不串）。
    fn scratch(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pk-storage-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("old")).unwrap();
        fs::create_dir_all(dir.join("new")).unwrap();
        dir
    }

    /// 复制语义：目标齐全，源原封不动——失败可回退的前提。
    #[test]
    fn migrate_copies_without_touching_source() {
        let base = scratch("copy");
        let (old, new) = (base.join("old"), base.join("new"));
        fs::create_dir_all(old.join("logs")).unwrap();
        fs::write(old.join("background.img"), b"img").unwrap();
        fs::write(old.join("logs/pk.log"), b"log").unwrap();
        fs::write(old.join("logs/pk.log.1"), b"log1").unwrap();

        migrate(&old, &new).expect("迁移应成功");

        assert_eq!(fs::read(new.join("background.img")).unwrap(), b"img");
        assert_eq!(fs::read(new.join("logs/pk.log")).unwrap(), b"log");
        assert_eq!(fs::read(new.join("logs/pk.log.1")).unwrap(), b"log1");
        assert!(old.join("background.img").exists());
        assert!(old.join("logs/pk.log").exists());

        fs::remove_dir_all(&base).ok();
    }

    /// 旧目录缺项直接跳过；目标已有同名项时被覆盖。
    #[test]
    fn migrate_skips_missing_and_overwrites_existing() {
        let base = scratch("skip");
        let (old, new) = (base.join("old"), base.join("new"));
        fs::write(new.join("background.img"), b"stale").unwrap();

        migrate(&old, &new).expect("旧目录为空应迁移成功");
        assert!(!new.join("logs").exists());

        fs::write(old.join("background.img"), b"fresh").unwrap();
        migrate(&old, &new).expect("覆盖迁移应成功");
        assert_eq!(fs::read(new.join("background.img")).unwrap(), b"fresh");

        fs::remove_dir_all(&base).ok();
    }
}
