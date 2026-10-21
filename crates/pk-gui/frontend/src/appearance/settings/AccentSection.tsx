import { Label } from "@/components/ui/label";
import { useSettings } from "@/providers/settings";
import { cn } from "@/lib/utils";

import { ACCENTS, ACCENT_KEYS } from "../accents";

/** 主题色：内置 5 套，双圆点展示亮 / 暗两档。 */
export default function AccentSection() {
  const { settings, update } = useSettings();

  return (
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
  );
}
