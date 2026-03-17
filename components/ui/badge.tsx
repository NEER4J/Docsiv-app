import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "font-ui inline-flex items-center rounded-lg border border-border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-foreground text-background hover:opacity-90 active:opacity-80",
        secondary:
          "border-transparent bg-muted text-foreground hover:bg-muted/80 active:bg-muted/70 dark:bg-muted-hover dark:hover:bg-muted-active",
        destructive:
          "border-transparent bg-notion-red-bg text-notion-red hover:opacity-90 active:opacity-80",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted-hover active:bg-muted-active",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
