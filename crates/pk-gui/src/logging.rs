//! 应用日志：内存环形缓冲（最近 N 条，供前端快速拉取）+ 文件落盘
//! （完整历史，供导出）+ Tauri 事件推送（前端实时查看）。
//! 时间戳手工换算（Howard Hinnant 算法），避免为一行日志引 chrono。

use serde::Serialize;
use std::collections::VecDeque;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;

const RING_CAP: usize = 1000;
const LOG_EVENT: &str = "pk://log";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntryDto {
    /// "2026-10-21 14:23:45.123"
    pub time: String,
    /// "info" / "warn" / "error"
    pub level: &'static str,
    pub message: String,
}

struct Hub {
    ring: Mutex<VecDeque<LogEntryDto>>,
    /// None = 尚未初始化（setup 之前），只进内存不落盘
    file: Mutex<Option<PathBuf>>,
    /// 推送实时日志的目标窗口
    app: Mutex<Option<tauri::AppHandle>>,
}

static HUB: OnceLock<Hub> = OnceLock::new();

fn hub() -> &'static Hub {
    HUB.get_or_init(|| Hub {
        ring: Mutex::new(VecDeque::new()),
        file: Mutex::new(None),
        app: Mutex::new(None),
    })
}

/// setup 阶段调用：绑定事件目标、创建日志目录与文件。
pub fn init(app: tauri::AppHandle, logs_dir: PathBuf) {
    *hub().app.lock().expect("日志锁中毒") = Some(app);
    set_dir(logs_dir);
    info("应用启动");
}

/// 数据目录更改后切换落盘位置（缓冲保留，继续追加到新文件）。
pub fn set_dir(logs_dir: PathBuf) {
    let _ = std::fs::create_dir_all(&logs_dir);
    *hub().file.lock().expect("日志锁中毒") = Some(logs_dir.join("pk.log"));
}

fn write_file(path: &PathBuf, line: &str) {
    // 1MB 轮转一个备份，避免无限增长
    if std::fs::metadata(path)
        .map(|m| m.len() > 1024 * 1024)
        .unwrap_or(false)
    {
        let _ = std::fs::rename(path, path.with_extension("log.1"));
    }
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = f.write_all(line.as_bytes());
        let _ = f.write_all(b"\n");
    }
}

fn log(level: &'static str, message: String) {
    let entry = LogEntryDto {
        time: now_string(),
        level,
        message,
    };
    let line = format!(
        "{} [{}] {}",
        entry.time,
        level.to_uppercase(),
        entry.message
    );
    {
        let mut ring = hub().ring.lock().expect("日志锁中毒");
        ring.push_back(entry.clone());
        while ring.len() > RING_CAP {
            ring.pop_front();
        }
    }
    if let Some(path) = hub().file.lock().expect("日志锁中毒").as_ref() {
        write_file(path, &line);
    }
    if let Some(app) = hub().app.lock().expect("日志锁中毒").as_ref() {
        let _ = app.emit(LOG_EVENT, &entry);
    }
}

pub fn info(message: impl Into<String>) {
    log("info", message.into());
}

pub fn warn(message: impl Into<String>) {
    log("warn", message.into());
}

pub fn error(message: impl Into<String>) {
    log("error", message.into());
}

/// Frontend action logs share the same ring buffer, file and live event stream.
#[tauri::command]
pub fn write_frontend_log(level: String, mut message: String) -> Result<(), String> {
    if message.len() > 16_384 {
        let mut end = 16_384;
        while !message.is_char_boundary(end) {
            end -= 1;
        }
        message.truncate(end);
    }

    match level.as_str() {
        "info" => info(message),
        "warn" => warn(message),
        "error" => error(message),
        _ => return Err(format!("不支持的日志级别：{level}")),
    }
    Ok(())
}

/// 最近 N 条（实时视图的初始数据，之后靠事件增量推送）。
#[tauri::command]
pub fn get_recent_logs() -> Vec<LogEntryDto> {
    hub()
        .ring
        .lock()
        .expect("日志锁中毒")
        .iter()
        .cloned()
        .collect()
}

/// 导出：完整日志文件（含轮转备份）另存到用户选择的位置；取消返回 None。
#[tauri::command]
pub async fn export_logs() -> Result<Option<String>, String> {
    let src = hub().file.lock().expect("日志锁中毒").clone();
    let Some(src) = src else { return Ok(None) };
    let backup = src.with_extension("log.1");

    let picked = rfd::AsyncFileDialog::new()
        .set_title("导出日志")
        .set_file_name("pk.log")
        .save_file()
        .await;
    let Some(picked) = picked else {
        return Ok(None);
    };

    let mut content = String::new();
    if backup.exists() {
        content.push_str(&std::fs::read_to_string(&backup).map_err(|e| e.to_string())?);
    }
    if src.exists() {
        content.push_str(&std::fs::read_to_string(&src).map_err(|e| e.to_string())?);
    }
    std::fs::write(picked.path(), content).map_err(|e| e.to_string())?;
    Ok(Some(picked.path().display().to_string()))
}

/// 清空日志（文件 + 内存缓冲）。
#[tauri::command]
pub fn clear_logs() -> Result<(), String> {
    hub().ring.lock().expect("日志锁中毒").clear();
    if let Some(path) = hub().file.lock().expect("日志锁中毒").as_ref() {
        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_file(path.with_extension("log.1"));
    }
    info("日志已清空");
    Ok(())
}

// ---------- 时间格式化（零依赖） ----------

fn now_string() -> String {
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let (y, m, day) = civil_from_days(d.as_secs() as i64 / 86_400);
    let sod = d.as_secs() % 86_400;
    format!(
        "{y:04}-{m:02}-{day:02} {:02}:{:02}:{:02}.{:03}",
        sod / 3600,
        sod % 3600 / 60,
        sod % 60,
        d.subsec_millis()
    )
}

/// Unix 天数 → 公历年月日（Howard Hinnant civil_from_days）。
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::civil_from_days;

    #[test]
    fn epoch_and_known_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        // 2026-10-21 = 20747 天（datetime 校验过）
        assert_eq!(civil_from_days(20747), (2026, 10, 21));
        // 闰日：2000-02-29 = 11016 天
        assert_eq!(civil_from_days(11016), (2000, 2, 29));
    }
}
