import { ImagePlus, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { toast } from "sonner";

import { ACCENTS, ACCENT_KEYS } from "@/accent";
import { clearBackgroundImage, pickBackgroundImage } from "@/api";
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
import { cn } from "@/lib/utils";
import {
  BG_FIT_OPTIONS,
  DEFAULTS,
  INTERVAL_OPTIONS,
  useSettings,
  type BgFit,
} from "@/settings";
import { useTheme, type ThemePreference } from "@/theme";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 是否已设置背景图（控制参数区的可用状态） */
  bgSet: boolean;
  /** 选择 / 移除背景图后通知 App 重新读取 */
  onBgChanged: () => void | Promise<void>;
}

export default function SettingsDialog({
  open,
  onOpenChange,
  bgSet,
  onBgChanged,
}: SettingsDialogProps) {
  const { settings, update } = useSettings();
  const { preference, setPreference } = useTheme();

  const chooseImage = async () => {
    try {
      const url = await pickBackgroundImage();
      if (url) await onBgChanged();
    } catch (e) {
      sonnerError(e);
    }
  };

  const removeImage = async () => {
    try {
      await clearBackgroundImage();
      await onBgChanged();
    } catch (e) {
      sonnerError(e);
    }
  };

  /** 恢复默认：设置、主题、主题色全部复位，并删除背景图。 */
  const resetAll = async () => {
    update(DEFAULTS);
    setPreference("system");
    if (bgSet) await removeImage();
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

        <section className="space-y-2.5">
          <Label className="text-xs text-muted-foreground">主题色</Label>
          <div className="flex flex-wrap gap-2">
            {ACCENT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => update({ accent: key })}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors",
                  settings.accent === key
                    ? "border-primary/70 bg-primary/10"
                    : "border-border hover:bg-muted/60",
                )}
              >
                <span
                  className="size-3 rounded-full"
                  style={{ background: ACCENTS[key].light }}
                />
                <span
                  className="size-3 rounded-full"
                  style={{ background: ACCENTS[key].dark }}
                />
                {ACCENTS[key].label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">背景图片</Label>
            {bgSet ? (
              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void chooseImage()}
                >
                  更换图片
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => void removeImage()}
                >
                  移除
                </Button>
              </div>
            ) : (
              <Button
                size="xs"
                variant="outline"
                onClick={() => void chooseImage()}
              >
                <ImagePlus className="size-3.5" />
                选择图片…
              </Button>
            )}
          </div>

          <div
            className={cn(
              "space-y-2.5 transition-opacity",
              bgSet ? "" : "pointer-events-none opacity-40",
            )}
          >
            <RadioGroup
              value={settings.bg.fit}
              onValueChange={(v) =>
                update({ bg: { ...settings.bg, fit: v as BgFit } })
              }
              className="flex flex-wrap gap-2"
            >
              {BG_FIT_OPTIONS.map((opt) => (
                <Label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted/60 has-[button[data-state=checked]]:border-primary/60 has-[button[data-state=checked]]:bg-primary/8"
                >
                  <RadioGroupItem
                    value={opt.value}
                    className="size-3"
                  />
                  {opt.label}
                </Label>
              ))}
            </RadioGroup>

            <div className="flex items-center gap-3">
              <Label className="w-12 shrink-0 text-xs text-muted-foreground">
                透明度
              </Label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(settings.bg.opacity * 100)}
                onChange={(e) =>
                  update({
                    bg: {
                      ...settings.bg,
                      opacity: Number(e.target.value) / 100,
                    },
                  })
                }
                className="h-1.5 flex-1 accent-primary"
              />
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                {Math.round(settings.bg.opacity * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-12 shrink-0 text-xs text-muted-foreground">
                模糊
              </Label>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={settings.bg.blur}
                onChange={(e) =>
                  update({
                    bg: { ...settings.bg, blur: Number(e.target.value) },
                  })
                }
                className="h-1.5 flex-1 accent-primary"
              />
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                {settings.bg.blur}px
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              卡片与对话框保持不透明以保证可读性；图片存于应用数据目录。
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>显示系统托盘 / 菜单栏图标</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                macOS 为菜单栏图标；左键点图标可重新显示窗口
              </p>
            </div>
            <Switch
              checked={settings.showTrayIcon}
              onCheckedChange={(v) => update({ showTrayIcon: v })}
            />
          </div>
          <div
            className={cn(
              "space-y-2.5 transition-opacity",
              settings.showTrayIcon ? "" : "pointer-events-none opacity-40",
            )}
          >
            <Label className="text-xs text-muted-foreground">关闭窗口时</Label>
            <RadioGroup
              value={settings.closeToQuit ? "quit" : "hide"}
              onValueChange={(v) => update({ closeToQuit: v === "quit" })}
              className="flex flex-wrap gap-2"
            >
              {(
                [
                  ["quit", "退出程序"],
                  ["hide", "隐藏到托盘"],
                ] as const
              ).map(([value, label]) => (
                <Label
                  key={value}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted/60 has-[button[data-state=checked]]:border-primary/60 has-[button[data-state=checked]]:bg-primary/8"
                >
                  <RadioGroupItem value={value} className="size-3" />
                  {label}
                </Label>
              ))}
            </RadioGroup>
          </div>
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
            className={cn(
              "space-y-2.5 transition-opacity",
              settings.autoRefresh ? "" : "pointer-events-none opacity-40",
            )}
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

function sonnerError(e: unknown) {
  toast.error(String(e));
}
