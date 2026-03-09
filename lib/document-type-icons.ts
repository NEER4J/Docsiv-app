import {
  FileText,
  ChartBar,
  Table,
  Presentation,
  Signature,
  File,
  type Icon,
} from "@phosphor-icons/react";

/** Map icon name from DB (document_types.icon) to Phosphor Icon component */
const ICON_NAME_MAP: Record<string, Icon> = {
  FileText,
  ChartBar,
  Table,
  Presentation,
  Signature,
  File,
};

const FALLBACK_ICON = FileText;

/**
 * Resolve DB icon name string to Phosphor Icon component.
 * Used for document type tabs, cards, and dialogs.
 */
export function getIconForDocumentType(iconName: string | null | undefined): Icon {
  if (!iconName || typeof iconName !== "string") return FALLBACK_ICON;
  return ICON_NAME_MAP[iconName] ?? FALLBACK_ICON;
}

export type DocumentTypeDisplay = {
  icon: Icon;
  color: string;
  label: string;
  bgColor?: string;
};

/**
 * Build display config for a DB document type (name, icon, color).
 * Use in cards and tabs when rendering from document_types data.
 */
export function getDisplayForDocumentType(
  type: { name: string; icon?: string | null; color?: string | null; bg_color?: string | null } | null | undefined
): DocumentTypeDisplay {
  if (!type) {
    return {
      icon: FALLBACK_ICON,
      color: "#6b7280",
      label: "Document",
      bgColor: "#f3f4f6",
    };
  }
  return {
    icon: getIconForDocumentType(type.icon),
    color: type.color ?? "#6b7280",
    label: type.name,
    bgColor: type.bg_color ?? undefined,
  };
}
