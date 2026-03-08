import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const SUB_NAV = [
  { label: "Overview", href: "." },
  { label: "Documents", href: "#" },
  { label: "Portal Preview", href: "#" },
  { label: "Activity", href: "#" },
];

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const name = id === "1" ? "Maharaja Group" : id === "2" ? "Peninsula Canada" : "WBT Trades";

  return (
    <div className="flex flex-col gap-0 md:flex-row">
      <nav className="w-full border-b border-border md:w-48 md:flex-shrink-0 md:border-b-0 md:border-r">
        <ul className="flex gap-0 md:flex-col">
          <li>
            <Link
              href="/dashboard/clients"
              className="font-body flex items-center gap-1 px-3 py-2 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-muted-hover hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
              Clients
            </Link>
          </li>
          {SUB_NAV.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="font-body block px-3 py-2 text-[0.8125rem] transition-colors hover:bg-muted-hover data-[active]:bg-muted-active data-[active]:font-medium data-[active]:text-foreground"
                data-active={item.label === "Overview" || undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="min-w-0 flex-1 p-4">
        <div className="mb-6">
          <div className="mb-1 h-10 w-10 rounded-lg border border-border bg-muted" />
          <h1 className="font-ui text-xl font-semibold">{name}</h1>
        </div>
        <p className="font-body text-muted-foreground">
          Overview content here — docs, activity, stats.
        </p>
      </main>
    </div>
  );
}
