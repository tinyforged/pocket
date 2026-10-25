import type { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

/** 检查更新源（GitHub Releases 的 latest.json）；无更新时返回 null。 */
export async function checkUpdate(): Promise<Update | null> {
  return check();
}

/**
 * 下载并安装更新。
 * progress 回调：0-1 的进度比例；总大小未知时为 null（仅展示"下载中…"）。
 */
export async function installUpdate(
  update: Update,
  progress?: (ratio: number | null) => void,
): Promise<void> {
  let total = 0;
  let downloaded = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? 0;
        downloaded = 0;
        progress?.(total > 0 ? 0 : null);
        break;
      case "Progress":
        // chunkLength 是本次分片大小，需累加才是已下载量
        downloaded += event.data.chunkLength;
        progress?.(total > 0 ? Math.min(1, downloaded / total) : null);
        break;
      case "Finished":
        progress?.(1);
        break;
    }
  });
}

/** 安装完成后重启应用，让新版本生效。 */
export async function relaunchApp(): Promise<void> {
  await relaunch();
}
