import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { clearBackgroundImage } from "@/api/appearance";
import { clearLogs } from "@/api/logging";
import { changeStorageDir, getStorageInfo } from "@/api/storage";
import type { StorageInfoDto } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function fmt(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface DataTabProps {
  /** 移除背景图后通知上层重新读取 */
  onBgChanged: () => void | Promise<void>;
}

/** 数据：目录位置（可更改并迁移）+ 占用统计 + 清理。 */
export default function DataTab({ onBgChanged }: DataTabProps) {
  const [info, setInfo] = useState<StorageInfoDto | null>(null);

  const load = useCallback(async () => {
    try {
      setInfo(await getStorageInfo());
    } catch {
      /* 静默：下次进入 tab 会重试 */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changeDir = async () => {
    try {
      const dir = await changeStorageDir();
      if (dir) toast.success(`数据目录已更改：${dir}`);
      await load();
    } catch (e) {
      toast.error(`更改数据目录失败：${e}`);
    }
  };

  const removeBg = async () => {
    try {
      await clearBackgroundImage();
      await onBgChanged();
      await load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const clear = async () => {
    try {
      await clearLogs();
      toast.success("日志已清空");
      await load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="space-y-7">
      <section className="space-y-2.5">
        <Label className="text-xs text-muted-foreground">数据目录</Label>
        <div className="flex items-start justify-between gap-3 rounded-[10px] bg-muted/50 px-3 py-2.5">
          <code className="min-w-0 break-all font-mono text-xs text-foreground">
            {info?.dir ?? "读取中…"}
          </code>
          <Button size="xs" variant="outline" onClick={() => void changeDir()}>
            <FolderOpen className="size-3.5" />
            更改…
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          背景图片与日志都存在这里；更改目录会把现有数据迁移过去（原目录
          的副本随后删除），默认位置在系统应用数据目录。
        </p>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">磁盘占用</Label>
          <Button size="xs" variant="ghost" onClick={() => void load()}>
            <RefreshCw className="size-3" />
            刷新
          </Button>
        </div>
        <div className="divide-y divide-border rounded-[10px] border border-border">
          <div className="flex items-center justify-between px-3 py-2.5 text-xs">
            <span>背景图片</span>
            <span className="flex items-center gap-2 font-mono text-muted-foreground">
              {fmt(info?.backgroundBytes ?? 0)}
              {(info?.backgroundBytes ?? 0) > 0 && (
                <Button size="xs" variant="ghost" onClick={() => void removeBg()}>
                  移除
                </Button>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5 text-xs">
            <span>日志</span>
            <span className="flex items-center gap-2 font-mono text-muted-foreground">
              {fmt(info?.logsBytes ?? 0)}
              <Button size="xs" variant="ghost" onClick={() => void clear()}>
                <Trash2 className="size-3" />
                清空
              </Button>
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5 text-xs font-medium">
            <span>合计</span>
            <span className="font-mono">
              {fmt((info?.backgroundBytes ?? 0) + (info?.logsBytes ?? 0))}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
