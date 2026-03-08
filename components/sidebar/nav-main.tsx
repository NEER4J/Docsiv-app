"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronRight } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { type NavGroup, type NavMainItem } from "@/navigation/sidebar-items";
import { cn } from "@/lib/utils";

interface NavMainProps {
  readonly items: readonly NavGroup[];
}

const IsComingSoon = () => (
  <span className="ml-auto rounded-md bg-muted-hover px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
    Soon
  </span>
);

const ProTag = () => (
  <Badge variant="secondary" className="ml-auto border-0 bg-black text-[0.65rem] font-normal uppercase tracking-wider text-white">
    Pro
  </Badge>
);

const NavItemExpanded = ({
  item,
  isActive,
  isSubmenuOpen,
  onProClick,
}: {
  item: NavMainItem;
  isActive: (url: string, subItems?: NavMainItem["subItems"]) => boolean;
  isSubmenuOpen: (subItems?: NavMainItem["subItems"]) => boolean;
  onProClick?: (item: NavMainItem) => void;
}) => {
  const active = isActive(item.url, item.subItems);

  return (
    <Collapsible key={item.title} asChild defaultOpen={isSubmenuOpen(item.subItems)} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          {item.subItems ? (
            <SidebarMenuButton
              disabled={item.comingSoon}
              isActive={active}
              tooltip={item.title}
              className={cn(
                "h-9 gap-3 text-[0.8125rem]",
                active && "font-semibold"
              )}
            >
              {item.icon && <item.icon className={cn("size-[1.0625rem] shrink-0", active ? "opacity-100" : "opacity-60")} />}
              <span>{item.title}</span>
              {item.comingSoon && <IsComingSoon />}
              <ChevronRight className="ml-auto size-3.5 opacity-50 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          ) : item.pro && onProClick ? (
            <SidebarMenuButton
              onClick={() => onProClick(item)}
              isActive={active}
              tooltip={`${item.title} (Pro)`}
              className={cn(
                "h-9 gap-3 text-[0.8125rem] cursor-pointer",
                active && "font-semibold"
              )}
            >
              {item.icon && <item.icon className={cn("size-[1.0625rem] shrink-0", active ? "opacity-100" : "opacity-60")} />}
              <span>{item.title}</span>
              <ProTag />
            </SidebarMenuButton>
          ) : (
            <SidebarMenuButton
              asChild
              aria-disabled={item.comingSoon}
              isActive={active}
              tooltip={item.title}
              className={cn(
                "h-9 gap-3 text-[0.8125rem]",
                active && "font-semibold"
              )}
            >
              <Link href={item.url} target={item.newTab ? "_blank" : undefined}>
                {item.icon && <item.icon className={cn("size-[1.0625rem] shrink-0", active ? "opacity-100" : "opacity-60")} />}
                <span>{item.title}</span>
                {item.comingSoon && <IsComingSoon />}
              </Link>
            </SidebarMenuButton>
          )}
        </CollapsibleTrigger>
        {item.subItems && (
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.subItems.map((subItem) => {
                const subActive = isActive(subItem.url);
                return (
                  <SidebarMenuSubItem key={subItem.title}>
                    <SidebarMenuSubButton
                      aria-disabled={subItem.comingSoon}
                      isActive={subActive}
                      asChild
                      className={cn(
                        "h-8 text-[0.8rem] text-muted-foreground",
                        subActive && "text-foreground font-medium"
                      )}
                    >
                      <Link href={subItem.url} target={subItem.newTab ? "_blank" : undefined}>
                        {subItem.icon && <subItem.icon className="size-3.5 shrink-0" />}
                        <span>{subItem.title}</span>
                        {subItem.comingSoon && <IsComingSoon />}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </SidebarMenuItem>
    </Collapsible>
  );
};

const NavItemCollapsed = ({
  item,
  isActive,
}: {
  item: NavMainItem;
  isActive: (url: string, subItems?: NavMainItem["subItems"]) => boolean;
}) => {
  return (
    <SidebarMenuItem key={item.title}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <SidebarMenuButton
            disabled={item.comingSoon}
            tooltip={item.title}
            isActive={isActive(item.url, item.subItems)}
          >
            {item.icon && <item.icon className="opacity-70" />}
            <span>{item.title}</span>
            <ChevronRight className="size-3.5 opacity-50 group-data-[collapsible=icon]:hidden" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-50 space-y-1" side="right" align="start">
          {item.subItems?.map((subItem) => (
            <DropdownMenuItem key={subItem.title} asChild>
              <SidebarMenuSubButton
                key={subItem.title}
                asChild
                className="focus-visible:ring-0"
                aria-disabled={subItem.comingSoon}
                isActive={isActive(subItem.url)}
              >
                <Link href={subItem.url} target={subItem.newTab ? "_blank" : undefined}>
                  {subItem.icon && <subItem.icon className="text-foreground" />}
                  <span>{subItem.title}</span>
                  {subItem.comingSoon && <IsComingSoon />}
                </Link>
              </SidebarMenuSubButton>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export function NavMain({ items }: NavMainProps) {
  const path = usePathname();
  const { state, isMobile } = useSidebar();
  const [proDialogOpen, setProDialogOpen] = useState(false);
  const [proFeatureTitle, setProFeatureTitle] = useState<string>("");

  const handleProClick = (item: NavMainItem) => {
    setProFeatureTitle(item.title);
    setProDialogOpen(true);
  };

  const isItemActive = (url: string, subItems?: NavMainItem["subItems"]) => {
    if (subItems?.length) {
      return subItems.some((sub) => path.startsWith(sub.url));
    }
    return path === url;
  };

  const isSubmenuOpen = (subItems?: NavMainItem["subItems"]) => {
    return subItems?.length ? true : false;
  };

  return (
    <>
      {items.map((group) => (
        <SidebarGroup key={group.id} className="!px-0 py-1">
          {group.label && (
            <SidebarGroupLabel className="mb-1 h-6 px-0 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground/60 hover:bg-transparent">
              {group.label}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => {
                if (state === "collapsed" && !isMobile) {
                  if (!item.subItems) {
                    if (item.pro) {
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            onClick={() => handleProClick(item)}
                            tooltip={`${item.title} (Pro)`}
                            isActive={isItemActive(item.url)}
                            className="cursor-pointer"
                          >
                            {item.icon && <item.icon className="size-[1.125rem] shrink-0" />}
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          aria-disabled={item.comingSoon}
                          tooltip={item.title}
                          isActive={isItemActive(item.url)}
                        >
                          <Link href={item.url} target={item.newTab ? "_blank" : undefined}>
                            {item.icon && <item.icon className="size-[1.125rem] shrink-0" />}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  return <NavItemCollapsed key={item.title} item={item} isActive={isItemActive} />;
                }
                return (
                  <NavItemExpanded
                    key={item.title}
                    item={item}
                    isActive={isItemActive}
                    isSubmenuOpen={isSubmenuOpen}
                    onProClick={handleProClick}
                  />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}

      <Dialog open={proDialogOpen} onOpenChange={setProDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock {proFeatureTitle} with Pro</DialogTitle>
            <DialogDescription>
              Upgrade to Pro to access {proFeatureTitle}. Get full visibility into your proposals and reports with advanced analytics and insights.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProDialogOpen(false)}>
              Maybe later
            </Button>
            <Button asChild>
              <Link href="#">Upgrade to Pro</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
