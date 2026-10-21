/** 全局背景图层：垫在内容与光晕之下，卡片 / 对话框保持不透明。 */
import { useSettings } from "@/providers/settings";

import { bgLayerStyle } from "./background";

export default function BackgroundLayer({ url }: { url: string | null }) {
  const { settings } = useSettings();
  if (!url) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={bgLayerStyle(url, settings.bg)}
    />
  );
}
