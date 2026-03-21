import { tool } from "ai";
import { z } from "zod";
import {
  getDocumentById,
  checkDocumentAccess,
  createDocumentLink,
} from "@/lib/actions/documents";

// ── Export/Download Document Tool ────────────────────────────────────────────

export function createExportDocumentTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>
) {
  return tool({
    description:
      "Export or download a document in various formats (PDF, DOCX, PNG, HTML, Markdown). Generates an export and returns a download URL. User must have at least view permission on the document.",
    parameters: z.object({
      document_id: z.string().describe("The document ID to export"),
      format: z
        .enum(["pdf", "docx", "png", "html", "markdown"])
        .describe("Export format"),
      include_comments: z
        .boolean()
        .optional()
        .describe("Include comments in the export (if supported by format)"),
      password: z
        .string()
        .optional()
        .describe("Optional password for PDF protection"),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
    execute: async ({ document_id, format, include_comments, password }) => {
      // Check access permissions (need at least view)
      const access = await checkDocumentAccess(document_id);
      if (!access.role) {
        return {
          success: false as const,
          error: "You do not have permission to access this document",
        };
      }

      // Get document details
      const { document, error: docError } = await getDocumentById(
        workspaceId,
        document_id
      );
      if (docError || !document) {
        return {
          success: false as const,
          error: docError ?? "Document not found",
        };
      }

      // Validate format based on document type
      const validFormats = getValidFormatsForBaseType(document.base_type);
      if (!validFormats.includes(format)) {
        return {
          success: false as const,
          error: `Format "${format}" is not supported for ${document.base_type} documents. Valid formats: ${validFormats.join(", ")}`,
        };
      }

      // Generate export via API
      const exportRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/documents/${document_id}/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format,
            include_comments: include_comments ?? false,
            password: password ?? undefined,
          }),
        }
      );

      if (!exportRes.ok) {
        const err = await exportRes.json().catch(() => ({}));
        return {
          success: false as const,
          error: err.error ?? `Export failed (${exportRes.status})`,
        };
      }

      const exportData = await exportRes.json();

      return {
        success: true as const,
        document_id,
        title: document.title,
        format,
        download_url: exportData.download_url,
        file_name: exportData.file_name,
        file_size_bytes: exportData.file_size_bytes,
        expires_at: exportData.expires_at,
      };
    },
  });
}

function getValidFormatsForBaseType(baseType: string): string[] {
  switch (baseType) {
    case "doc":
    case "contract":
      return ["pdf", "docx", "html", "markdown", "png"];
    case "sheet":
      return ["pdf", "html", "png"];
    case "presentation":
    case "report":
      return ["pdf", "png"];
    default:
      return ["pdf"];
  }
}
