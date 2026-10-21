import AccentSection from "./AccentSection";
import BackgroundSection from "./BackgroundSection";
import ThemeSection from "./ThemeSection";

interface AppearanceTabProps {
  bgSet: boolean;
  onBgChanged: () => void | Promise<void>;
}

/** 外观：主题 / 主题色 / 背景图片。 */
export default function AppearanceTab({ bgSet, onBgChanged }: AppearanceTabProps) {
  return (
    <div className="space-y-7">
      <ThemeSection />
      <AccentSection />
      <BackgroundSection bgSet={bgSet} onBgChanged={onBgChanged} />
    </div>
  );
}
