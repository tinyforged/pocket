import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { INTERVAL_OPTIONS, useSettings } from "@/settings";
import { useTheme, type ThemePreference } from "@/theme";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsDialog({
  open,
  onOpenChange,
}: SettingsDialogProps) {
  const { settings, update } = useSettings();
  const { preference, setPreference } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            设置保存在本地（localStorage），重启后仍然生效。
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2.5">
          <Label className="text-xs text-muted-foreground">外观主题</Label>
          <RadioGroup
            value={preference}
            onValueChange={(v) => setPreference(v as ThemePreference)}
            className="grid grid-cols-3 gap-2"
          >
            {(
              [
                ["system", "跟随系统", Monitor],
                ["light", "亮色", Sun],
                ["dark", "暗色", Moon],
              ] as const
            ).map(([value, label, Icon]) => (
              <Label
                key={value}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-border px-3 py-3 transition-colors hover:bg-muted/60 has-[button[data-state=checked]]:border-primary/60 has-[button[data-state=checked]]:bg-primary/8"
              >
                <RadioGroupItem value={value} />
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </Label>
            ))}
          </RadioGroup>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>自动刷新占用列表</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                开启后按设定频率重新扫描（只读操作，不会自动终止任何进程）
              </p>
            </div>
            <Switch
              checked={settings.autoRefresh}
              onCheckedChange={(v) => update({ autoRefresh: v })}
            />
          </div>
          <div
            className={`space-y-2.5 transition-opacity ${settings.autoRefresh ? "" : "pointer-events-none opacity-40"}`}
          >
            <Label className="text-xs text-muted-foreground">刷新频率</Label>
            <RadioGroup
              value={String(settings.intervalMs)}
              onValueChange={(v) => update({ intervalMs: Number(v) })}
              className="flex flex-wrap gap-2"
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <Label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted/60 has-[button[data-state=checked]]:border-primary/60 has-[button[data-state=checked]]:bg-primary/8"
                >
                  <RadioGroupItem value={String(opt.value)} className="size-3" />
                  {opt.label}
                </Label>
              ))}
            </RadioGroup>
          </div>
        </section>

        <p className="rounded-[10px] bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          终止策略与 CLI 一致：SIGTERM → 3 秒宽限 → SIGKILL；受保护进程
          （数据库 / 系统组件 / Docker）需要二次确认；杀前校验启动时间防
          PID 复用。
        </p>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
