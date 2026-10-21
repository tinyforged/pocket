import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { clearBackgroundImage } from "@/api/appearance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULTS, useSettings } from "@/providers/settings";
import { useTheme } from "@/providers/theme";

import AccentSection from "./AccentSection";
import BackgroundSection from "./BackgroundSection";
import RefreshSection from "./RefreshSection";
import ThemeSection from "./ThemeSection";
import TraySection from "./TraySection";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 是否已设置背景图（控制背景参数区的可用状态） */
  bgSet: boolean;
  /** 选择 / 移除背景图后通知上层重新读取 */
  onBgChanged: () => void | Promise<void>;
}

/** 设置中心：壳 + 分区组件拼装，恢复默认与完成在 footer。 */
export default function SettingsDialog({
  open,
  onOpenChange,
  bgSet,
  onBgChanged,
}: SettingsDialogProps) {
  const { update } = useSettings();
  const { setPreference } = useTheme();

  /** 恢复默认：设置与主题全部复位，并删除背景图。 */
  const resetAll = async () => {
    update(DEFAULTS);
    setPreference("system");
    if (!bgSet) return;
    try {
      await clearBackgroundImage();
      await onBgChanged();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            设置保存在本地，重启后仍然生效。
          </DialogDescription>
        </DialogHeader>

        <ThemeSection />
        <AccentSection />
        <BackgroundSection bgSet={bgSet} onBgChanged={onBgChanged} />
        <TraySection />
        <RefreshSection />

        <p className="rounded-[10px] bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          终止策略与 CLI 一致：SIGTERM → 3 秒宽限 → SIGKILL；受保护进程
          （数据库 / 系统组件 / Docker）需要二次确认；杀前校验启动时间防
          PID 复用。
        </p>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => void resetAll()}
          >
            <RotateCcw className="size-3.5" />
            恢复默认
          </Button>
          <Button onClick={() => onOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
