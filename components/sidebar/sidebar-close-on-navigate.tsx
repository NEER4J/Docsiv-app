"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useSidebar } from "@/components/ui/sidebar";

/**
 * Closes the mobile sidebar when the user navigates to a new page.
 * Renders nothing; only handles side effect.
 */
export function SidebarCloseOnNavigate() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return null;
}
