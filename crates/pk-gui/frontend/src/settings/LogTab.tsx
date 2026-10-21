import { FileDown, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { clearLogs, exportLogs } from "@/api/logging";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface LogTabProps {
  /** 打开实时日志窗口（会先收起设置） */
  onOpenLogs: () => void;
}

/** 日志：实时查看 / 导出 / 清空。 */
export default function LogTab({ onOpenLogs }: LogTabProps) {
  const exportAll = async () => {
    try {
      const path = await exportLogs();
      if (path) toast.success(`日志已导出：${path}`);
    } catch (e) {
      toast.error(`导出失败：${e}`);
    }
  };

  const clear = async () => {
    try {
      await clearLogs();
      toast.success("日志已清空");
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="space-y-2.5">
      <Label className="text-xs text-muted-foreground">应用日志</Label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        记录扫描、终止、提权与设置变更等事件，实时推送并落盘到数据目录
        的 logs/pk.log（超 1MB 自动轮转一份备份）。
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onOpenLogs}>
          <ScrollText className="size-3.5" />
          实时查看
        </Button>
        <Button size="sm" variant="outline" onClick={() => void exportAll()}>
          <FileDown className="size-3.5" />
          导出…
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void clear()}>
          <Trash2 className="size-3.5" />
          清空
        </Button>
      </div>
    </div>
  );
}
