import { ListFilter, RadioTower, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export type ProtocolFilter = "all" | "tcp" | "udp";

interface PortFiltersProps {
  protocol: ProtocolFilter;
  listeningOnly: boolean;
  onProtocolChange: (value: ProtocolFilter) => void;
  onListeningChange: (value: boolean) => void;
  entries: { protocol: "tcp" | "udp"; state: string | null }[];
}

/** Search refinements stay in sync across quick search and the full list. */
export default function PortFilters({
  protocol,
  listeningOnly,
  onProtocolChange,
  onListeningChange,
  entries,
}: PortFiltersProps) {
  const tcpCount = entries.filter((entry) => entry.protocol === "tcp").length;
  const udpCount = entries.filter((entry) => entry.protocol === "udp").length;
  const listenCount = entries.filter((entry) => entry.state === "LISTEN").length;
  const active = protocol !== "all" || listeningOnly;

  const optionClass = (selected: boolean) =>
    `inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
      selected
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/70 bg-card/65 px-2.5 py-2">
      <span className="mr-1 inline-flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
        <ListFilter className="size-3" />
        筛选
      </span>
      <button
        type="button"
        aria-pressed={protocol === "all"}
        onClick={() => onProtocolChange("all")}
        className={optionClass(protocol === "all")}
      >
        全部 <Count>{entries.length}</Count>
      </button>
      <button
        type="button"
        aria-pressed={protocol === "tcp"}
        onClick={() => onProtocolChange(protocol === "tcp" ? "all" : "tcp")}
        className={optionClass(protocol === "tcp")}
      >
        <Badge variant="protoTcp" className="px-1.5 py-0.5 text-[9px]">TCP</Badge>
        <Count>{tcpCount}</Count>
      </button>
      <button
        type="button"
        aria-pressed={protocol === "udp"}
        onClick={() => onProtocolChange(protocol === "udp" ? "all" : "udp")}
        className={optionClass(protocol === "udp")}
      >
        <Badge variant="protoUdp" className="px-1.5 py-0.5 text-[9px]">UDP</Badge>
        <Count>{udpCount}</Count>
      </button>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <button
        type="button"
        aria-pressed={listeningOnly}
        onClick={() => onListeningChange(!listeningOnly)}
        className={optionClass(listeningOnly)}
      >
        <RadioTower className="size-3" />
        仅监听 <Count>{listenCount}</Count>
      </button>
      {active && (
        <button
          type="button"
          onClick={() => {
            onProtocolChange("all");
            onListeningChange(false);
          }}
          className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="清除筛选条件"
        >
          <RotateCcw className="size-3" />
          重置
        </button>
      )}
    </div>
  );
}

function Count({ children }: { children: number }) {
  return (
    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
      {children}
    </span>
  );
}
