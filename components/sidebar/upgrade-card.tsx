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
      viewBox="0 0 80 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-full", className)}
      aria-hidden
    >
      {/* Document */}
      <path
        d="M12 4h32l12 12v32a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"
        fill="var(--muted-hover)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <path d="M44 4v12h12" stroke="var(--border)" strokeWidth="1.5" fill="none" />
      {/* Lines */}
      <rect x="18" y="24" width="24" height="2" rx="1" fill="var(--muted-foreground)" opacity="0.5" />
      <rect x="18" y="32" width="20" height="2" rx="1" fill="var(--muted-foreground)" opacity="0.4" />
      <rect x="18" y="40" width="28" height="2" rx="1" fill="var(--muted-foreground)" opacity="0.3" />
      {/* Sparkle / AI indicator */}
      <g transform="translate(52, 20)">
        <path
          d="M14 2L15.5 6.5L20 8L15.5 9.5L14 14L12.5 9.5L8 8L12.5 6.5L14 2Z"
          fill="var(--notion-yellow)"
        />
        <path
          d="M22 18L23 20L25 21L23 22L22 24L21 22L19 21L21 20L22 18Z"
          fill="var(--notion-blue)"
          opacity="0.8"
        />
      </g>
    </svg>
  );
}

export function UpgradeCard() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

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
