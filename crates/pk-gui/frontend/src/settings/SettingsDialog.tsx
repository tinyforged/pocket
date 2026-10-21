import {
  Database,
  Info,
  Palette,
  RotateCcw,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { clearBackgroundImage } from "@/api/appearance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DEFAULTS, useSettings } from "@/providers/settings";
import { useTheme } from "@/providers/theme";

import AboutTab from "./AboutTab";
import AppearanceTab from "./AppearanceTab";
import BehaviorTab from "./BehaviorTab";
import DataTab from "./DataTab";
import LogTab from "./LogTab";

const TABS = [
  { key: "appearance", label: "外观", icon: Palette },
  { key: "behavior", label: "行为", icon: SlidersHorizontal },
  { key: "data", label: "数据", icon: Database },
  { key: "logs", label: "日志", icon: ScrollText },
  { key: "about", label: "关于", icon: Info },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 是否已设置背景图（控制背景参数区的可用状态） */
  bgSet: boolean;
  /** 选择 / 移除背景图后通知上层重新读取 */
  onBgChanged: () => void | Promise<void>;
  /** 打开实时日志窗口（会先收起设置） */
  onOpenLogs: () => void;
}

/**
 * 设置中心：左侧分类导航 + 右侧内容分区，壳只负责拼装与恢复默认，
 * 分区内容各自成文件，避免堆回一个组件。
 */
export default function SettingsDialog({
  open,
  onOpenChange,
  bgSet,
  onBgChanged,
  onOpenLogs,
}: SettingsDialogProps) {
  const [tab, setTab] = useState<TabKey>("appearance");
  const { update } = useSettings();
  const { setPreference } = useTheme();

  /** 恢复默认：设置与主题全部复位，并删除背景图。 */
  const resetAll = async () => {
    update(DEFAULTS);
    setPreference("system");
    if (!bgSet) return;
    try {
      await clearBackgroundImage();
      await onBgChanged();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">设置</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            设置保存在本地，重启后仍然生效。
          </p>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* 左侧分类导航 */}
          <nav className="flex w-36 shrink-0 flex-col gap-0.5 border-r border-border p-2">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-xs transition-colors ${
                  tab === key
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </nav>

          {/* 右侧内容区 */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {tab === "appearance" && (
              <AppearanceTab bgSet={bgSet} onBgChanged={onBgChanged} />
            )}
            {tab === "behavior" && <BehaviorTab />}
            {tab === "data" && <DataTab onBgChanged={onBgChanged} />}
            {tab === "logs" && <LogTab onOpenLogs={onOpenLogs} />}
            {tab === "about" && <AboutTab />}
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-3 sm:justify-between">
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
