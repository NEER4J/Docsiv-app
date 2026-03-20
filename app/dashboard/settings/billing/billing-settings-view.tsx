"use client";

import { Button } from "@/components/ui/button";
import type { WorkspacePlan } from "@/types/database";
import { CreditCard } from "lucide-react";
import type {
  WorkspaceAiUsageLogItem,
  WorkspaceAiUsageSummary,
} from "@/lib/actions/ai-usage";

const PLAN_LABELS: Record<WorkspacePlan, string> = {
  free: "Free",
  pro: "Pro",
  agency: "Agency",
};

export function BillingSettingsView({
  plan,
  billingCountry,
  aiUsageSummary,
  aiUsageLogs,
}: {
  plan: WorkspacePlan;
  billingCountry?: string;
  aiUsageSummary: WorkspaceAiUsageSummary | null;
  aiUsageLogs: WorkspaceAiUsageLogItem[];
}) {
  const summary = aiUsageSummary ?? {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    last7DaysTokens: 0,
  };

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

      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">
          AI token usage
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground">Total tokens</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {summary.totalTokens.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground">Last 7 days</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {summary.last7DaysTokens.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground">Requests</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {summary.totalRequests.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground">Errors</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {summary.failedRequests.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground">Prompt tokens</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {summary.promptTokens.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground">Completion tokens</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {summary.completionTokens.toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-foreground">
          Usage log
        </h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="max-h-[420px] overflow-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-12 border-b border-border bg-muted/30 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                <p className="col-span-3">Time</p>
                <p className="col-span-3">Route</p>
                <p className="col-span-2">Model</p>
                <p className="col-span-2 text-right">Tokens</p>
                <p className="col-span-2 text-right">Status</p>
              </div>
              {aiUsageLogs.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  No AI usage logged yet.
                </p>
              ) : (
                aiUsageLogs.map((log) => (
                  <div
                    key={log.id}
                    className="grid grid-cols-12 items-center border-b border-border px-3 py-2 text-xs"
                  >
                    <p className="col-span-3 text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                    <p className="col-span-3 truncate text-foreground">{log.route}</p>
                    <p className="col-span-2 truncate text-muted-foreground">
                      {log.model ?? "default"}
                    </p>
                    <p className="col-span-2 text-right font-medium text-foreground">
                      {log.total_tokens.toLocaleString()}
                    </p>
                    <p
                      className={
                        "col-span-2 text-right " +
                        (log.status === "error"
                          ? "text-destructive"
                          : "text-foreground")
                      }
                    >
                      {log.status}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
