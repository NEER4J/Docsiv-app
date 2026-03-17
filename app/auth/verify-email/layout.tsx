import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";

export const metadata: Metadata = {
  title: `Verify your email – ${APP_CONFIG.name}`,
  description: "Verify your email address for your Docsive account.",
};

export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
