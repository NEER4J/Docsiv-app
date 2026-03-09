import {
  FileText,
  Table,
  Presentation,
  Signature,
  type Icon,
} from "@phosphor-icons/react";

export type DocumentBaseTypeId = "doc" | "sheet" | "presentation" | "contract";

/**
 * Fallback when a document has no document_type_id (legacy or unspecific).
 * Used by DocumentCard and any flow that needs base_type display.
 */
export const BASE_TYPE_FALLBACK: Record<
  DocumentBaseTypeId,
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
