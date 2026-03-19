"use client";

import Link from "next/link";
import { Sparkles, Zap, BarChart3 } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const benefits = [
  { icon: Sparkles, label: "AI-powered proposals" },
  { icon: Zap, label: "Faster client reports" },
  { icon: BarChart3, label: "Advanced analytics" },
];

function UpgradeIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-full", className)}
      aria-hidden
    >
      {/* Document — rounded, clean */}
      <path
        d="M10 6h28l8 8v26a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        fill="var(--muted-hover)"
        stroke="var(--border)"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M38 6v8h8"
        stroke="var(--border)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Text lines */}
      <rect x="16" y="22" width="20" height="1.5" rx="0.75" fill="var(--muted-foreground)" opacity="0.45" />
      <rect x="16" y="28" width="16" height="1.5" rx="0.75" fill="var(--muted-foreground)" opacity="0.35" />
      <rect x="16" y="34" width="22" height="1.5" rx="0.75" fill="var(--muted-foreground)" opacity="0.25" />
      {/* Single clean sparkle */}
      <path
        d="M50 14 51.4 17.2 55 18.5 51.4 19.8 50 23 48.6 19.8 45 18.5 48.6 17.2 50 14Z"
        fill="var(--notion-yellow)"
        stroke="var(--notion-yellow)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UpgradeCard() {
  const { state, hoverOpen } = useSidebar();
  const isCollapsed = state === "collapsed" && !hoverOpen;

  const cardContent = (
    <Card className="overflow-hidden border-border bg-muted-hover/50">
      <CardContent className="p-0">
        <div className="flex flex-col">
        <div className="flex h-20 w-full shrink-0 items-center justify-center bg-muted/30 px-2 sm:h-auto sm:w-20">
            <UpgradeIllustration className="h-14 w-14 sm:h-16 sm:w-16" />
          </div>
          <div className="flex flex-1 flex-col gap-3 p-3">
            <div className="flex items-center gap-2">
              
              <span className="text-[0.8125rem] font-semibold">Upgrade to Pro</span>
            </div>
            <ul className="space-y-1.5">
              {benefits.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-[0.75rem] text-muted-foreground">
                  <Icon className="size-3.5 shrink-0 text-foreground/70" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="sm" className="mt-1 w-full text-[0.75rem]">
              <Link href="#">Upgrade</Link>
            </Button>
          </div>
          
        </div>
      </CardContent>
    </Card>
  );

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="#"
              className="flex size-9 items-center justify-center rounded-md border border-border bg-muted-hover/50 text-foreground transition-colors hover:bg-muted-hover"
            >
              <Sparkles className="size-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[240px] p-0" sideOffset={8}>
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="size-3.5" />
                <span className="text-[0.8125rem] font-semibold">Upgrade to Pro</span>
              </div>
              <ul className="mb-3 space-y-1 text-[0.75rem] text-muted-foreground">
                {benefits.map(({ label }) => (
                  <li key={label}>• {label}</li>
                ))}
              </ul>
              <Button asChild size="sm" className="w-full text-[0.75rem]">
                <Link href="#">Upgrade</Link>
              </Button>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}
