import Link from "next/link";
import { User } from "lucide-react";

const DUMMY_CLIENTS = [
  { id: "1", name: "Maharaja Group", docCount: 8, status: "Active" },
  { id: "2", name: "Peninsula Canada", docCount: 3, status: "Active" },
  { id: "3", name: "WBT Trades", docCount: 5, status: "Active" },
];

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">
          Clients
        </h1>
        <Link
          href="/dashboard/clients"
          className="font-body inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] transition-colors hover:bg-muted-hover"
        >
          + New Client
        </Link>
      </div>

      <input
        type="search"
        placeholder="Search clients..."
        className="font-body w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground"
      />

      <ul className="space-y-0 rounded-lg border border-border">
        {DUMMY_CLIENTS.map((client) => (
          <li
            key={client.id}
            className="border-b border-border last:border-b-0"
          >
            <Link
              href={`/dashboard/clients/${client.id}`}
              className="font-body flex flex-wrap items-center gap-4 px-4 py-3 transition-colors hover:bg-muted-hover"
            >
              <User className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 font-medium">{client.name}</span>
              <span className="text-muted-foreground">
                {client.docCount} docs
              </span>
              <span className="text-muted-foreground">{client.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
