/**
 * "扫描于 N 秒前"：独立持有 1s 定时器，只重渲染自己不惊动列表。
 */
import { useEffect, useState } from "react";

function relative(seconds: number): string {
  if (seconds < 5) return "刚刚";
  if (seconds < 60) return `${seconds} 秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  return `${Math.floor(seconds / 3600)} 小时前`;
}

export default function ScanTime({ at }: { at: number | null }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (at == null) return null;
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  return <span>· 扫描于 {relative(s)}</span>;
}
