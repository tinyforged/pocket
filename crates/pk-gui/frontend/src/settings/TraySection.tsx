import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/providers/settings";
import { cn } from "@/lib/utils";

/** 窗口与托盘：托盘图标开关 + 关闭窗口行为。 */
export default function TraySection() {
  const { settings, update } = useSettings();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>显示系统托盘 / 菜单栏图标</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            macOS 为菜单栏图标，左键弹出功能菜单；Windows / Linux 左键显示窗口，菜单在右键
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
  );
}
