import { ReactNode } from "react";

export default function DocumentEditorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-0 md:flex-row">
      <div className="min-w-0 flex-1">{children}</div>
      <aside className="w-full border-t border-border md:w-80 md:border-l md:border-t-0 md:min-w-[320px]">
        <div className="flex flex-col gap-4 p-4">
          <h2 className="font-ui text-sm font-semibold">Properties</h2>
          <div className="space-y-3 border-b border-border pb-4">
            <div>
              <label className="font-body mb-1 block text-[0.75rem] text-muted-foreground">
                Client
              </label>
              <select className="font-body w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[0.8125rem]">
                <option>Maharaja</option>
              </select>
            </div>
            <div>
              <label className="font-body mb-1 block text-[0.75rem] text-muted-foreground">
                Status
              </label>
              <select className="font-body w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[0.8125rem]">
                <option>Draft</option>
              </select>
            </div>
          </div>
          <div className="space-y-2 border-b border-border pb-4">
            <p className="font-ui text-[0.8125rem] font-medium">Sharing</p>
            <button
              type="button"
              className="font-body block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-left text-[0.8125rem] hover:bg-muted-hover"
            >
              Copy Link
            </button>
            <button
              type="button"
              className="font-body block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-left text-[0.8125rem] hover:bg-muted-hover"
            >
              Send ✉️
            </button>
          </div>
          <div className="border-b border-border pb-4">
            <p className="font-ui mb-1 text-[0.8125rem] font-medium">Analytics</p>
            <p className="font-body text-[0.8125rem] text-muted-foreground">
              Opened: No
            </p>
          </div>
          <div className="space-y-2 border-b border-border pb-4">
            <p className="font-ui text-[0.8125rem] font-medium">Options</p>
            <label className="font-body flex items-center gap-2 text-[0.8125rem]">
              <input type="checkbox" className="rounded border-border" />
              Signature
            </label>
            <label className="font-body flex items-center gap-2 text-[0.8125rem]">
              <input type="checkbox" className="rounded border-border" />
              Password
            </label>
            <p className="font-body text-[0.75rem] text-muted-foreground">
              Expiry date
            </p>
          </div>
          <button
            type="button"
            className="font-body w-full rounded-lg border border-border bg-foreground py-2 text-[0.875rem] font-medium text-background transition-colors hover:opacity-90"
          >
            Send Doc →
          </button>
        </div>
      </aside>
    </div>
  );
}
