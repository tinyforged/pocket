import { Monitor, Moon, Sun } from "lucide-react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTheme, type ThemePreference } from "@/providers/theme";

/** 外观主题：亮 / 暗 / 跟随系统。 */
export default function ThemeSection() {
  const { preference, setPreference } = useTheme();

  return (
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
  );
}
