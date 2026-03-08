import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FileText, User } from "lucide-react";

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "there";

  return (
    <div className="space-y-8">
      <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">
        Good morning, {name} 👋
      </h1>

      <section className="flex flex-wrap gap-4">
        <div className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-4 py-3">
          <p className="font-body text-[0.75rem] text-muted-foreground">Docs Sent</p>
          <p className="font-ui text-xl font-semibold">24</p>
        </div>
        <div className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-4 py-3">
          <p className="font-body text-[0.75rem] text-muted-foreground">Opened</p>
          <p className="font-ui text-xl font-semibold">18</p>
        </div>
        <div className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-4 py-3">
          <p className="font-body text-[0.75rem] text-muted-foreground">Signed</p>
          <p className="font-ui text-xl font-semibold">6</p>
        </div>
      </section>

      <section>
        <h2 className="font-ui mb-3 text-sm font-semibold">Recent Documents</h2>
        <ul className="space-y-1 rounded-lg border border-border">
          {[
            { title: "Maharaja Proposal", time: "2d ago" },
            { title: "Peninsula Report", time: "5d ago" },
            { title: "WBT Contract", time: "1d ago" },
          ].map((doc) => (
            <li key={doc.title}>
              <Link
                href="/dashboard/documents"
                className="font-body flex items-center gap-3 px-3 py-2 text-[0.875rem] transition-colors hover:bg-muted-hover"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{doc.title}</span>
                <span className="text-muted-foreground">{doc.time}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-ui mb-3 text-sm font-semibold">Recent Clients</h2>
        <ul className="space-y-1 rounded-lg border border-border">
          {[
            { name: "Maharaja Group" },
            { name: "Peninsula Canada" },
          ].map((client) => (
            <li key={client.name}>
              <Link
                href="/dashboard/clients"
                className="font-body flex items-center gap-3 px-3 py-2 text-[0.875rem] transition-colors hover:bg-muted-hover"
              >
                <User className="size-4 shrink-0 text-muted-foreground" />
                <span>{client.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
