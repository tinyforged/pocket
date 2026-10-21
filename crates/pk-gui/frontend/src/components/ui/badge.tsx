import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/10 text-primary",
        crit: "border-danger/40 bg-danger/12 text-danger",
        warn: "border-warn/35 bg-warn/10 text-warn",
        dim: "border-border bg-muted text-muted-foreground",
        protoTcp: "border-tcp/30 bg-tcp/12 text-tcp",
        protoUdp: "border-udp/30 bg-udp/12 text-udp",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
