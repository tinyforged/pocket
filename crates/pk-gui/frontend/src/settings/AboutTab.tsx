import { getVersion } from "@tauri-apps/api/app";
import type { Update } from "@tauri-apps/plugin-updater";
import { CheckCircle2, Download, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { describeError, writeFrontendLog } from "@/api/logging";
import { checkUpdate, installUpdate, relaunchApp } from "@/updater/update";

/** 关于：版本、在线更新与终止策略说明。 */
export default function AboutTab() {
  const [version, setVersion] = useState("…");
  const [update, setUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [installed, setInstalled] = useState(false);
  const [upToDate, setUpToDate] = useState(false);

  useEffect(() => {
    void getVersion()
      .then(setVersion)
      .catch((error: unknown) => {
        setVersion("?");
        void writeFrontendLog("warn", `读取应用版本失败：${describeError(error)}`);
      });
  }, []);

  async function onCheck() {
    setChecking(true);
    setUpToDate(false);
    setUpdate(null);
    await writeFrontendLog("info", `检查更新开始（当前版本 v${version}）`);
    try {
      const found = await checkUpdate();
      setUpdate(found);
      setUpToDate(!found);
      if (found) {
        await writeFrontendLog(
          "info",
          `检查更新完成：发现新版本 v${found.version}（当前 v${version}）`,
        );
      } else {
        await writeFrontendLog("info", `检查更新完成：当前 v${version} 已是最新版本`);
      }
    } catch (e) {
      await writeFrontendLog("error", `检查更新失败：${describeError(e)}`);
      toast.error(`检查更新失败：${e}`);
    } finally {
      setChecking(false);
    }
  }

  async function onInstall() {
    if (!update) return;
    setDownloading(true);
    setProgress(null);
    await writeFrontendLog("info", `开始下载并安装 v${update.version}`);
    try {
      await installUpdate(update, setProgress);
      setInstalled(true);
      await writeFrontendLog("info", `v${update.version} 已安装，等待重启生效`);
      toast.success("新版本已安装，重启后生效");
    } catch (e) {
      await writeFrontendLog(
        "error",
        `下载或安装 v${update.version} 失败：${describeError(e)}`,
      );
      toast.error(`下载或安装失败：${e}`);
    } finally {
      setDownloading(false);
    }
  }

  async function onRelaunch() {
    await writeFrontendLog("info", "用户请求重启应用以启用更新");
    try {
      await relaunchApp();
    } catch (error) {
      await writeFrontendLog("error", `重启应用失败：${describeError(error)}`);
      toast.error(`重启失败：${error}`);
    }
  }

  return (
    <div className="space-y-7">
      <section className="space-y-2.5">
        <Label className="text-xs text-muted-foreground">版本</Label>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 rounded-[10px] border border-border px-3 py-2.5 text-xs">
          <dt className="text-muted-foreground">应用</dt>
          <dd className="font-mono">pocket · pk v{version}</dd>
          <dt className="text-muted-foreground">标识</dt>
          <dd className="font-mono">dev.tinyforged.pocket</dd>
          <dt className="text-muted-foreground">CLI</dt>
          <dd className="font-mono">pk port kill &lt;端口&gt;</dd>
        </dl>
      </section>

      <section className="space-y-2.5">
        <Label className="text-xs text-muted-foreground">更新</Label>
        <div className="rounded-[10px] border border-border px-3 py-2.5 text-xs">
          {update ? (
            <div className="space-y-3">
              <p>
                发现新版本 <span className="font-mono">v{update.version}</span>，当前{" "}
                <span className="font-mono">v{version}</span>
              </p>
              {update.body ? (
                <p className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">
                  {update.body}
                </p>
              ) : null}
              {installed ? (
                <Button size="sm" onClick={() => void onRelaunch()}>
                  <RotateCcw className="size-4" />
                  重启生效
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void onInstall()}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {downloading
                    ? progress !== null
                      ? `下载中 ${Math.round(progress * 100)}%`
                      : "下载中…"
                    : "下载并安装"}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {upToDate ? (
                <CheckCircle2 className="size-3.5 text-muted-foreground" />
              ) : null}
              <span className={upToDate ? "text-muted-foreground" : ""}>
                {upToDate ? "已是最新版本" : "更新源：GitHub Releases"}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => void onCheck()}
                disabled={checking}
              >
                {checking ? <Loader2 className="size-4 animate-spin" /> : null}
                {checking ? "检查中…" : "检查更新"}
              </Button>
            </div>
          )}
        </div>
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
