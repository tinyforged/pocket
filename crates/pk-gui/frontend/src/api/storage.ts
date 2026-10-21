/** 数据目录（命令实现见 pk-gui/src/storage.rs）。 */
import { invoke } from "@tauri-apps/api/core";

import type { StorageInfoDto } from "./types";

export function getStorageInfo(): Promise<StorageInfoDto> {
  return invoke("get_storage_info");
}

/** 更改数据目录（迁移现有数据）；取消返回 null。 */
export function changeStorageDir(): Promise<string | null> {
  return invoke("change_storage_dir");
}
