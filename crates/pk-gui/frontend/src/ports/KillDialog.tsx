import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import type { ProcessDto } from "@/api/types";
import { Badge } from "@/components/ui/badge";
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
import { fmtBytes } from "@/lib/format";

interface KillDialogProps {
  /** 待终止的进程（1 个 = 单杀；多个 = 端口组一键全杀）；非 null 时打开 */
  targets: ProcessDto[] | null;
  onClose: () => void;
  /** force 仅在含受保护进程且完成二次确认后为 true */
  onConfirm: (targets: ProcessDto[], force: boolean) => void;
}

/** 终止确认：与 CLI 同策略——普通确认即杀，含受保护进程时红色二次确认。 */
export default function KillDialog({
  targets,
  onClose,
  onConfirm,
}: KillDialogProps) {
  const [ack, setAck] = useState(false);

  // 切换目标集合时重置勾选
  const pendingKey = targets?.map((t) => t.pid).join(",") ?? "";
  useEffect(() => {
    setAck(false);
  }, [pendingKey]);

  if (!targets || targets.length === 0) return null;

  const multi = targets.length > 1;
  const critical = targets.some((t) => t.risk === "critical");
  const caution = targets.some((t) => t.risk === "caution");
  const first = targets[0]!;
  const meta = multi
    ? []
    : ([first.exe && `exe：${first.exe}`, first.cwd && `cwd：${first.cwd}`].filter(
        Boolean,
      ) as string[]);

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
            {multi
              ? critical
                ? `终止 ${targets.length} 个进程（含受保护）`
                : `终止 ${targets.length} 个进程`
              : critical
                ? "终止受保护进程"
                : "终止进程"}
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              {multi ? (
                <>
                  以下 <b className="text-foreground">{targets.length} 个进程</b>{" "}
                  共用同一端口，将逐个发送 SIGTERM，3 秒内未退出则升级 SIGKILL。
                </>
              ) : (
                <>
                  将终止{" "}
                  <b className="text-foreground">
                    {first.name}
                  </b>{" "}
                  <span className="font-mono">
                    （pid {first.pid}
                    {first.user ? `，${first.user}` : ""}）
                  </span>
                  ，先发 SIGTERM，3 秒内未退出则升级 SIGKILL。
                </>
              )}
              {critical && (
                <span className="mt-2 block font-medium text-danger">
                  {multi
                    ? "目标中包含受保护进程（数据库 / 系统组件 / Docker 等），误杀可能丢数据、废掉整套开发环境。"
                    : "这是受保护进程（数据库 / 系统组件 / Docker 等），误杀可能丢数据、废掉整套开发环境。"}
                </span>
              )}
              {caution && (
                <span className="mt-2 block font-medium text-warn">
                  {multi
                    ? "目标中有系统账户下的进程，请再次确认。"
                    : "该进程运行在系统账户下，请再次确认。"}
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {multi && (
          <ul className="max-h-44 space-y-1 overflow-y-auto rounded-[10px] bg-muted/50 p-2.5">
            {targets.map((t) => (
              <li
                key={t.pid}
                className="flex items-center justify-between gap-2 px-1 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold">{t.name}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">
                    pid {t.pid}
                    {t.user ? ` · ${t.user}` : ""}
                  </span>
                  {t.risk === "critical" && <Badge variant="crit">⚠ 受保护</Badge>}
                  {t.risk === "caution" && <Badge variant="warn">系统账户</Badge>}
                </span>
                {t.memory > 0 && (
                  <span className="shrink-0 font-mono text-muted-foreground/70">
                    {fmtBytes(t.memory)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {!multi && critical && meta.length > 0 && (
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
              我已知晓其中包含<b>受保护进程</b>，终止可能导致数据丢失或开发环境损坏
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
            onClick={() => onConfirm(targets, critical)}
          >
            {multi ? `终止全部 ${targets.length} 个` : "确认终止"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
