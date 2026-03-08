export default async function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">
        Analytics
      </h1>
      <p className="text-muted-foreground">
        Track document engagement, opens, and signatures. Analytics dashboard coming soon.
      </p>
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
    </div>
  );
}
