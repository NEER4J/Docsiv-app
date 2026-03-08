"use client";

import Link from "next/link";
import { MoreVertical, Pencil, ExternalLink, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DOCUMENT_TYPES, type Doc } from "@/app/dashboard/documents/document-types";

type DocumentCardVariant = "grid" | "list" | "recent";

function DocumentCardActions({ docId, docTitle }: { docId: string; docTitle: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          aria-label="Document actions"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Pencil className="size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`/dashboard/documents/${docId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <ExternalLink className="size-4" />
            Open in new tab
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <Trash2 className="size-4" />
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DocumentCard({
  doc,
  variant = "grid",
  className,
}: {
  doc: Doc;
  variant?: DocumentCardVariant;
  className?: string;
}) {
  const typeConfig = DOCUMENT_TYPES[doc.type];
  const Icon = typeConfig.icon;

  if (variant === "list") {
    return (
      <li>
        <Link
          href={`/dashboard/documents/${doc.id}`}
          className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted-hover"
        >
          <Icon className="size-5 shrink-0" style={{ color: typeConfig.color }} />
          <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-800 text-[0.7rem] font-normal border-0">
            {doc.status}
          </Badge>
          <span className="text-muted-foreground">{doc.time}</span>
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="shrink-0">
            <DocumentCardActions docId={doc.id} docTitle={doc.title} />
          </div>
        </Link>
      </li>
    );
  }

  if (variant === "recent") {
    return (
      <Link
        href={`/dashboard/documents/${doc.id}`}
        className="relative block min-w-[140px] max-w-[180px] shrink-0"
      >
        <Card className="overflow-hidden transition-colors hover:bg-muted-hover">
          <div
            className="flex aspect-[4/3] items-center justify-center border-b border-border"
            style={{ backgroundColor: typeConfig.bgColor }}
          >
            <Icon className="size-10" style={{ color: typeConfig.color }} />
          </div>
          <CardContent className="flex flex-col gap-2 p-2.5">
            <p className="min-w-0 truncate text-xs font-medium">{doc.title}</p>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="bg-zinc-100 text-zinc-800 text-[0.7rem] font-normal border-0">
                {doc.status}
              </Badge>
              <span className="text-[0.7rem] text-muted-foreground">{doc.time}</span>
              <div
                className="ml-auto shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <DocumentCardActions docId={doc.id} docTitle={doc.title} />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // grid
  return (
    <li>
      <Link href={`/dashboard/documents/${doc.id}`}>
        <Card className="overflow-hidden transition-colors hover:bg-muted-hover">
          <div
            className="flex aspect-[4/3] items-center justify-center border-b border-border"
            style={{ backgroundColor: typeConfig.bgColor }}
          >
            <Icon className="size-12" style={{ color: typeConfig.color }} />
          </div>
          <CardContent className="flex flex-col gap-2 p-3">
            <div className="flex min-w-0 items-center gap-2">
              <Icon
                className="size-4 shrink-0"
                style={{ color: typeConfig.color }}
              />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{doc.title}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="bg-zinc-100 text-zinc-800 text-[0.7rem] font-normal border-0">
                {doc.status}
              </Badge>
              <span className="text-xs text-muted-foreground">{doc.time}</span>
              <div
                className="ml-auto shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <DocumentCardActions docId={doc.id} docTitle={doc.title} />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
}
