/** 提权状态检测（失败按未提权处理，横幅会给出提权入口）。 */
import { useEffect, useState } from "react";

import { isElevated } from "@/api/elevation";

export function useElevation() {
  const [elevated, setElevated] = useState(true);
  useEffect(() => {
    void isElevated().then(setElevated, () => setElevated(false));
  }, []);
  return elevated;
}
