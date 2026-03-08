import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function DocumentEditorPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Link
        href="/dashboard/documents"
        className="font-body inline-flex items-center gap-1 text-[0.875rem] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to Documents
      </Link>
      <div className="flex min-h-[400px] flex-1 items-center justify-center rounded-lg border border-border border-dashed bg-muted/30">
        <p className="font-body text-muted-foreground">
          Document Editor content here (Puck / Plate.js / Presenton)
        </p>
      </div>
    </div>
  );
}
