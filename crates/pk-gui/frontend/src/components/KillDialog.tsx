import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProcessDto } from "@/types";

interface KillDialogProps {
  /** 待终止的进程；非 null 时打开 */
  target: ProcessDto | null;
  onClose: () => void;
  /** force 仅在受保护进程完成二次确认后为 true */
  onConfirm: (process: ProcessDto, force: boolean) => void;
}

/** 终止确认：与 CLI 同策略——普通确认即杀，受保护进程红色二次确认。 */
export default function KillDialog({
  target,
  onClose,
  onConfirm,
}: KillDialogProps) {
  const [ack, setAck] = useState(false);

  // 切换目标时重置勾选
  useEffect(() => {
    setAck(false);
  }, [target?.pid]);

  if (!target) return null;

  const critical = target.risk === "critical";
  const caution = target.risk === "caution";
  const meta = [
    target.exe && `exe：${target.exe}`,
    target.cwd && `cwd：${target.cwd}`,
  ].filter(Boolean);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={critical ? "max-w-md border-danger/50 shadow-danger/15" : "max-w-md"}
      >
        <DialogHeader>
          <DialogTitle
            className={critical ? "flex items-center gap-2 text-danger" : ""}
          >
            {critical && <ShieldAlert className="size-4.5" />}
            {critical ? "终止受保护进程" : "终止进程"}
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              将终止{" "}
              <b className="text-foreground">
                {target.name}
              </b>{" "}
              <span className="font-mono">
                （pid {target.pid}
                {target.user ? `，${target.user}` : ""}）
              </span>
              ，先发 SIGTERM，3 秒内未退出则升级 SIGKILL。
              {critical && (
                <span className="mt-2 block font-medium text-danger">
                  这是受保护进程（数据库 / 系统组件 / Docker
                  等），误杀可能丢数据、废掉整套开发环境。
                </span>
              )}
              {caution && (
                <span className="mt-2 block font-medium text-warn">
                  该进程运行在系统账户下，请再次确认。
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {critical && meta.length > 0 && (
          <ul className="ml-4 list-disc space-y-1 font-mono text-xs text-muted-foreground">
            {meta.map((s) => (
              <li key={s} className="break-all">
                {s}
              </li>
            ))}
          </ul>
        )}

        {critical && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-warn/30 bg-warn/8 px-3 py-2.5 text-xs leading-relaxed text-warn">
            <Checkbox
              checked={ack}
              onCheckedChange={(v) => setAck(v === true)}
              className="mt-0.5 border-warn/50 data-[state=checked]:border-warn data-[state=checked]:bg-warn data-[state=checked]:text-white"
            />
            <span>
              我已知晓这是<b>受保护进程</b>，终止它可能导致数据丢失或开发环境损坏
            </span>
          </label>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={critical && !ack}
            onClick={() => onConfirm(target, critical)}
          >
            确认终止
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
