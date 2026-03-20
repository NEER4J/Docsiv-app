import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";
import { getWorkspaceAiUsageSummary, listWorkspaceAiUsageLogs } from "@/lib/actions/ai-usage";

export const metadata: Metadata = {
  title: `Analytics – ${APP_CONFIG.name}`,
  description: "Track document engagement, opens, and signatures.",
};

export default async function AnalyticsPage() {
  const ctx = await getCurrentWorkspaceContext();
  const workspaceId = ctx.workspaceId;
  const usageSummary = workspaceId
    ? await getWorkspaceAiUsageSummary(workspaceId)
    : { summary: null as never, error: "No workspace selected" };
  const usageLogs = workspaceId ? await listWorkspaceAiUsageLogs(workspaceId, 8) : { logs: [] };

  return (
    <div className="space-y-8">
      <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">
        Analytics
      </h1>
      <p className="text-muted-foreground">Track document and AI engagement for your workspace.</p>
      <section className="flex flex-wrap gap-4">
        <div className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-4 py-3">
          <p className="font-body text-[0.75rem] text-muted-foreground">Documents sent</p>
          <p className="font-ui text-xl font-semibold">—</p>
        </div>
        <div className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-4 py-3">
          <p className="font-body text-[0.75rem] text-muted-foreground">Opened</p>
          <p className="font-ui text-xl font-semibold">—</p>
        </div>
        <div className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-4 py-3">
          <p className="font-body text-[0.75rem] text-muted-foreground">Signed</p>
          <p className="font-ui text-xl font-semibold">—</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-ui text-lg font-semibold tracking-[-0.02em]">AI ROI</h2>
        {!workspaceId || usageSummary.error ? (
          <p className="text-sm text-muted-foreground">
            {usageSummary.error ?? "Select a workspace to view AI usage analytics."}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4">
              <div className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-4 py-3">
                <p className="font-body text-[0.75rem] text-muted-foreground">Total AI requests</p>
                <p className="font-ui text-xl font-semibold">{usageSummary.summary.totalRequests}</p>
              </div>
              <div className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-4 py-3">
                <p className="font-body text-[0.75rem] text-muted-foreground">Total tokens</p>
                <p className="font-ui text-xl font-semibold">{usageSummary.summary.totalTokens.toLocaleString()}</p>
              </div>
              <div className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-4 py-3">
                <p className="font-body text-[0.75rem] text-muted-foreground">Success rate</p>
                <p className="font-ui text-xl font-semibold">
                  {usageSummary.summary.totalRequests > 0
                    ? `${Math.round((usageSummary.summary.successfulRequests / usageSummary.summary.totalRequests) * 100)}%`
                    : "—"}
                </p>
              </div>
              <div className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-4 py-3">
                <p className="font-body text-[0.75rem] text-muted-foreground">Last 7d tokens</p>
                <p className="font-ui text-xl font-semibold">
                  {usageSummary.summary.last7DaysTokens.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Route</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Model</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Tokens</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usageLogs.logs.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2">{l.route}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.model ?? "—"}</td>
                      <td className="px-3 py-2">{l.total_tokens.toLocaleString()}</td>
                      <td className="px-3 py-2">{l.status}</td>
                    </tr>
                  ))}
                  {usageLogs.logs.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                        No AI usage logs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
