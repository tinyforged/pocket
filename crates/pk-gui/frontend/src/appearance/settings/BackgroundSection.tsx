import { ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { clearBackgroundImage, pickBackgroundImage } from "@/api/appearance";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  BG_FIT_OPTIONS,
  useSettings,
  type BgFit,
} from "@/providers/settings";
import { cn } from "@/lib/utils";

interface BackgroundSectionProps {
  /** 是否已设置背景图（控制参数区的可用状态） */
  bgSet: boolean;
  /** 选择 / 移除背景图后通知上层重新读取 */
  onBgChanged: () => void | Promise<void>;
}

/** 背景图片：选择 / 更换 / 移除 + 显示方式 / 透明度 / 模糊。 */
export default function BackgroundSection({
  bgSet,
  onBgChanged,
}: BackgroundSectionProps) {
  const { settings, update } = useSettings();
  const { bg } = settings;

  const chooseImage = async () => {
    try {
      const url = await pickBackgroundImage();
      if (url) await onBgChanged();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const removeImage = async () => {
    try {
      await clearBackgroundImage();
      await onBgChanged();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">背景图片</Label>
        {bgSet ? (
          <div className="flex items-center gap-2">
            <Button size="xs" variant="outline" onClick={() => void chooseImage()}>
              更换图片
            </Button>
            <Button size="xs" variant="ghost" onClick={() => void removeImage()}>
              移除
            </Button>
          </div>
        ) : (
          <Button size="xs" variant="outline" onClick={() => void chooseImage()}>
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
          value={bg.fit}
          onValueChange={(v) =>
            update({ bg: { ...bg, fit: v as BgFit } })
          }
          className="flex flex-wrap gap-2"
        >
          {BG_FIT_OPTIONS.map((opt) => (
            <Label
              key={opt.value}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted/60 has-[button[data-state=checked]]:border-primary/60 has-[button[data-state=checked]]:bg-primary/8"
            >
              <RadioGroupItem value={opt.value} className="size-3" />
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
            value={Math.round(bg.opacity * 100)}
            onChange={(e) =>
              update({ bg: { ...bg, opacity: Number(e.target.value) / 100 } })
            }
            className="h-1.5 flex-1 accent-primary"
          />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {Math.round(bg.opacity * 100)}%
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
            value={bg.blur}
            onChange={(e) =>
              update({ bg: { ...bg, blur: Number(e.target.value) } })
            }
            className="h-1.5 flex-1 accent-primary"
          />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {bg.blur}px
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          卡片与对话框保持不透明以保证可读性；图片存于应用数据目录。
        </p>
      </div>
    </section>
  );
}
