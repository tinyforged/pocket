import RefreshSection from "./RefreshSection";
import TraySection from "./TraySection";

/** 行为：刷新策略 / 托盘与窗口。 */
export default function BehaviorTab() {
  return (
    <div className="space-y-7">
      <RefreshSection />
      <TraySection />
    </div>
  );
}
