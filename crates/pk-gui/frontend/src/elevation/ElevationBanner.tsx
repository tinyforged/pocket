import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ElevationBannerProps {
  /** 因权限看不到进程的占用条数 */
  invisibleCount: number;
  onRelaunch: () => void;
}

/** 有不可见条目且当前非提权运行时，给出"怎么提权"的出路。 */
export default function ElevationBanner({
  invisibleCount,
  onRelaunch,
}: ElevationBannerProps) {
  if (invisibleCount === 0) return null;

  return (
    <div className="mx-5 mt-3 flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/8 px-4 py-2.5">
      <div className="flex items-center gap-2.5 text-[13px]">
        <ShieldAlert className="size-4 shrink-0 text-warn" />
        <span>
          有 <b className="font-mono">{invisibleCount}</b> 条占用看不到进程
          （root / 其他用户所有）——以管理员权限重启后即可查看与终止。
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={onRelaunch}>
        <ShieldAlert />
        提权重启
      </Button>
    </div>
  );
}
