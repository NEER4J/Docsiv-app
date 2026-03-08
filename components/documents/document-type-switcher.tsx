"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type DocumentTypeTabItem = {
  value: string;
  label: string;
  icon: Icon;
  color: string;
};

type DocumentTypeSwitcherProps = {
  value: string;
  onValueChange: (value: string) => void;
  items: DocumentTypeTabItem[];
  className?: string;
  triggerClassName?: string;
  children?: React.ReactNode;
};

export function DocumentTypeSwitcher({
  value,
  onValueChange,
  items,
  className,
  triggerClassName,
  children,
}: DocumentTypeSwitcherProps) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      className={cn("group/document-type-tabs w-full min-w-0", className)}
    >
      <div className="w-full min-w-0">
        {/* Scrollable tab list: always scroll when content overflows (narrow viewport or AI sidebar open) */}
        <div className="min-w-0 overflow-x-auto overflow-y-visible scroll-smooth">
          <TabsPrimitive.List className="relative flex w-fit flex-nowrap gap-0">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = value === item.value;
              return (
                <TabsPrimitive.Trigger
                  key={item.value}
                  value={item.value}
                  className={cn(
                    "relative flex shrink-0 items-center justify-center gap-2 rounded-none border-b-2 border-transparent px-5 py-3.5 text-sm font-medium transition-[color,background-color,border-color] duration-200 ease-out",
                    "min-w-[6.5rem] sm:min-w-[7.5rem] md:min-w-[8rem]",
                    "text-muted-foreground hover:bg-muted-hover/60 hover:text-foreground",
                    "data-[state=active]:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-0",
                    triggerClassName
                  )}
                >
                  <span
                    className="flex items-center justify-center transition-colors duration-200 ease-out"
                    style={{ color: isActive ? item.color : "var(--muted-foreground)" }}
                  >
                    <Icon weight="fill" className="size-5 shrink-0" />
                  </span>
                  <span className="whitespace-nowrap">{item.label}</span>
                  {/* Colored underline for active tab */}
                  <span
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-0.5 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                      isActive ? "opacity-100 scale-100" : "opacity-0 scale-95"
                    )}
                    style={{ backgroundColor: item.color }}
                  />
                </TabsPrimitive.Trigger>
              );
            })}
          </TabsPrimitive.List>
        </div>
        {/* Full-width line below the tabs */}
        <div className="h-px w-full bg-border" aria-hidden />
      </div>
      {children}
    </TabsPrimitive.Root>
  );
}

type DocumentTypeSwitcherContentProps = {
  value: string;
  className?: string;
  children: React.ReactNode;
};

export function DocumentTypeSwitcherContent({
  value,
  className,
  children,
}: DocumentTypeSwitcherContentProps) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={cn(
        "outline-none",
        "data-[state=inactive]:hidden",
        "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200",
        className
      )}
    >
      {children}
    </TabsPrimitive.Content>
  );
}
