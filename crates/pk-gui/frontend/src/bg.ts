/**
 * 背景图片图层的样式计算。图片本体存在应用数据目录（Rust 侧管理），
 * 前端只拿 data URL；透明度 / 模糊 / 显示方式来自设置。
 */
import type { CSSProperties } from "react";

import type { BgSettings } from "@/settings";

export type { BgFit } from "@/settings";

/** 显示方式 → CSS background 属性片段 */
const FIT: Record<BgSettings["fit"], { size: string; repeat: string }> = {
  fill: { size: "cover", repeat: "no-repeat" },
  fit: { size: "contain", repeat: "no-repeat" },
  stretch: { size: "100% 100%", repeat: "no-repeat" },
  center: { size: "auto", repeat: "no-repeat" },
  tile: { size: "auto", repeat: "repeat" },
};

/** 模糊时轻微放大，遮住 blur 产生的边缘半透明。 */
export function bgLayerStyle(url: string, bg: BgSettings): CSSProperties {
  const { size, repeat } = FIT[bg.fit] ?? FIT.fill;
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: size,
    backgroundRepeat: repeat,
    backgroundPosition: "center",
    opacity: bg.opacity,
    filter: bg.blur > 0 ? `blur(${bg.blur}px)` : undefined,
    transform: bg.blur > 0 ? `scale(${1 + bg.blur / 200})` : undefined,
  };
}
