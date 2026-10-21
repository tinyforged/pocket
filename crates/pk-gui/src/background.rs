//! 背景图片存取：系统选择器选图，本体存数据目录（localStorage 放不下
//! 几张照片），前端只拿 data URL。数据目录可在设置中更改，见 storage。

use base64::Engine as _;

use crate::logging;
use crate::storage;

/// 背景图固定存 `<数据目录>/background.img`。
fn bg_path() -> Result<std::path::PathBuf, String> {
    Ok(storage::dir().join("background.img"))
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

/// 打开系统文件选择器选背景图，保存到数据目录；
/// 返回 data URL 供前端立即渲染；用户取消返回 None。
#[tauri::command]
pub async fn pick_background_image() -> Result<Option<String>, String> {
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
    let dest = bg_path()?;
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(dest, bytes).map_err(|e| e.to_string())?;
    logging::info("背景图片已更新");
    Ok(Some(url))
}

/// 启动时读取已保存的背景图；未设置返回 None。
#[tauri::command]
pub async fn load_background_image() -> Result<Option<String>, String> {
    match std::fs::read(bg_path()?) {
        Ok(bytes) => Ok(Some(encode_data_url(bytes)?)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// 删除已保存的背景图（恢复默认背景）。
#[tauri::command]
pub async fn clear_background_image() -> Result<(), String> {
    match std::fs::remove_file(bg_path()?) {
        Ok(()) => {
            logging::info("背景图片已移除");
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
