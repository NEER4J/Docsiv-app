import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";

export const metadata: Metadata = {
  title: `Onboarding – ${APP_CONFIG.name}`,
  description: `Set up your ${APP_CONFIG.name} workspace in a few steps.`,
};

export default function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
