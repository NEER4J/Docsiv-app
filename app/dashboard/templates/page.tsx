import Link from "next/link";
import { FileText } from "lucide-react";

const TABS = ["All", "Proposals", "Reports", "Decks"];
const STARTER_TEMPLATES = [
  "Agency Proposal Starter",
  "Monthly Report Starter",
];
const YOUR_TEMPLATES = ["Maharaja Proposal Template"];

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">
          Templates
        </h1>
        <Link
          href="/dashboard/templates"
          className="font-body inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] transition-colors hover:bg-muted-hover"
        >
          + New Template
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className="font-body border-b-2 border-transparent px-3 py-2 text-[0.875rem] text-muted-foreground transition-colors hover:text-foreground data-[active]:border-foreground data-[active]:text-foreground"
            data-active={tab === "All" || undefined}
          >
            {tab}
          </button>
        ))}
      </div>

      <section>
        <h2 className="font-ui mb-3 text-sm font-semibold">
          Docsiv Starter Templates
        </h2>
        <ul className="space-y-1 rounded-lg border border-border">
          {STARTER_TEMPLATES.map((title) => (
            <li key={title} className="border-b border-border last:border-b-0">
              <Link
                href="#"
                className="font-body flex items-center gap-3 px-4 py-3 text-[0.875rem] transition-colors hover:bg-muted-hover"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                {title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-ui mb-3 text-sm font-semibold">Your Templates</h2>
        <ul className="space-y-1 rounded-lg border border-border">
          {YOUR_TEMPLATES.map((title) => (
            <li key={title} className="border-b border-border last:border-b-0">
              <Link
                href="#"
                className="font-body flex items-center gap-3 px-4 py-3 text-[0.875rem] transition-colors hover:bg-muted-hover"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                {title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
