import {
  FileText,
  Table,
  Presentation,
  Signature,
  type Icon,
} from "@phosphor-icons/react";

export type DocumentTypeId = "doc" | "sheet" | "presentation" | "contract";

export type Doc = {
  id: string;
  title: string;
  status: string;
  time: string;
  type: DocumentTypeId;
};

export const DOCUMENT_TYPES: Record<
  DocumentTypeId,
  { label: string; icon: Icon; color: string; bgColor: string }
> = {
  doc: {
    label: "Document",
    icon: FileText,
    color: "#4285F4",
    bgColor: "#E8F0FE",
  },
  sheet: {
    label: "Sheet",
    icon: Table,
    color: "#0F9D58",
    bgColor: "#E6F4EA",
  },
  presentation: {
    label: "Presentation",
    icon: Presentation,
    color: "#F4B400",
    bgColor: "#FEF7E0",
  },
  contract: {
    label: "Contract",
    icon: Signature,
    color: "#A142F4",
    bgColor: "#F3E8FD",
  },
};
