import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";

/** 关于：版本与终止策略说明。 */
export default function AboutTab() {
  const [version, setVersion] = useState("…");
  useEffect(() => {
    void getVersion().then(setVersion).catch(() => setVersion("?"));
  }, []);

  return (
    <div className="space-y-7">
      <section className="space-y-2.5">
        <Label className="text-xs text-muted-foreground">版本</Label>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 rounded-[10px] border border-border px-3 py-2.5 text-xs">
          <dt className="text-muted-foreground">应用</dt>
          <dd className="font-mono">端口终结者 · pk v{version}</dd>
          <dt className="text-muted-foreground">标识</dt>
          <dd className="font-mono">dev.tinyforged.pocket</dd>
          <dt className="text-muted-foreground">CLI</dt>
          <dd className="font-mono">pk port kill &lt;端口&gt;</dd>
        </dl>
      </section>

      <section className="space-y-2.5">
        <Label className="text-xs text-muted-foreground">终止策略</Label>
        <p className="rounded-[10px] bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          与 CLI 一致：SIGTERM → 3 秒宽限 → SIGKILL；受保护进程（数据库 /
          系统组件 / Docker）需要二次确认；杀前校验启动时间防 PID 复用；
          每次终止都会写入应用日志。
        </p>
      </section>
    </div>
  );
}
