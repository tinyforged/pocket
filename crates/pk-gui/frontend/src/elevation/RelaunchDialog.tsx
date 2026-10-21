import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { relaunchElevated } from "@/api/elevation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RelaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 提权重启确认：授权即拉起提权实例并退出当前窗口。 */
export default function RelaunchDialog({
  open,
  onOpenChange,
}: RelaunchDialogProps) {
  const confirm = async () => {
    onOpenChange(false);
    try {
      await relaunchElevated();
      toast.info("正在请求管理员权限，当前窗口将关闭…");
    } catch (e) {
      toast.error(`提权重启失败：${e}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warn">
            <ShieldAlert className="size-4.5" />
            以管理员权限重启？
          </DialogTitle>
          <DialogDescription>
            将请求系统管理员授权并重启应用。提权后<b>所有</b>进程可见、可终止
            ——包括系统组件，误操作的破坏面也会变大；root / 其他用户的进程
            也只有这样才能看到。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="destructive" onClick={() => void confirm()}>
            授权并重启
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
