import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { INTERVAL_OPTIONS, useSettings } from "@/providers/settings";
import { cn } from "@/lib/utils";

/** 列表刷新策略：开关 + 频率。 */
export default function RefreshSection() {
  const { settings, update } = useSettings();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>智能自动刷新</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            按设定频率静默重扫（默认 30 秒），占用无变化时不刷新界面、
            不打断操作；有变化才更新列表（只读操作，不会自动终止任何进程）
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
  );
}
