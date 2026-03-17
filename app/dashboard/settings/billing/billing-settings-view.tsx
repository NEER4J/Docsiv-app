"use client";

import { Button } from "@/components/ui/button";
import type { WorkspacePlan } from "@/types/database";
import { CreditCard } from "lucide-react";

const PLAN_LABELS: Record<WorkspacePlan, string> = {
  free: "Free",
  pro: "Pro",
  agency: "Agency",
};

export function BillingSettingsView({
  plan,
  billingCountry,
}: {
  plan: WorkspacePlan;
  billingCountry?: string;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">
          Current plan
        </h2>
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
            <CreditCard className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-ui text-sm font-medium text-foreground">
              {PLAN_LABELS[plan]}
            </p>
            <p className="font-body text-xs text-muted-foreground">
              {billingCountry
                ? `Billing country: ${billingCountry}`
                : "No billing country set"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">
          Upgrade
        </h2>
        <p className="font-body text-sm text-muted-foreground">
          Pro and Agency plans unlock whitelabel, custom domains, and more.
          Contact us to upgrade.
        </p>
        <Button variant="outline" className="border-border" disabled>
          Upgrade (coming soon)
        </Button>
      </section>
    </div>
  );
}
