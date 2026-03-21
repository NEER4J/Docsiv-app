import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Maximum time for export generation (5 minutes)
const MAX_EXPORT_TIME_MS = 5 * 60 * 1000;

// Valid export formats by base type
const VALID_FORMATS: Record<string, string[]> = {
  doc: ["pdf", "docx", "html", "markdown", "png"],
  contract: ["pdf", "docx", "html", "markdown", "png"],
  sheet: ["pdf", "html", "png", "csv"],
  presentation: ["pdf", "png"],
  report: ["pdf", "png"],
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;

  const supabase = await createClient();

  // Verify user has access
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check document access
  const { data: accessData, error: accessError } = await supabase.rpc(
    "check_document_access",
    { p_document_id: documentId }
  );

  if (accessError || !accessData || !accessData.role) {
    return NextResponse.json(
      { error: "You do not have permission to access this document" },
      { status: 403 }
    );
  }

  // Get request body
  let body: {
    format?: string;
    include_comments?: boolean;
    password?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { format, include_comments, password } = body;

  if (!format) {
    return NextResponse.json(
      { error: "Missing format parameter" },
      { status: 400 }
    );
  }

  // Get document
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, title, base_type, content, workspace_id")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Validate format
  const validFormats = VALID_FORMATS[doc.base_type] || ["pdf"];
  if (!validFormats.includes(format)) {
    return NextResponse.json(
      {
        error: `Invalid format "${format}" for ${doc.base_type} documents. Valid: ${validFormats.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Generate export based on document type and format
  try {
    const exportResult = await generateExport(doc, format, {
      include_comments: include_comments ?? false,
      password,
    });

    if (!exportResult.success) {
      return NextResponse.json(
        { error: exportResult.error },
        { status: 500 }
      );
    }

    // Store export in temporary storage bucket
    const fileName = `${doc.title.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.${format}`;
    const storagePath = `exports/${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("document-exports")
      .upload(storagePath, exportResult.buffer, {
        contentType: exportResult.contentType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to store export: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Create signed URL with 1-hour expiry
    const {
      data: { signedUrl },
      error: signedUrlError,
    } = await supabase.storage
      .from("document-exports")
      .createSignedUrl(storagePath, 60 * 60);

    if (signedUrlError || !signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      download_url: signedUrl,
      file_name: fileName,
      file_size_bytes: exportResult.buffer.length,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    console.error("[export] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export generation failed" },
      { status: 500 }
    );
  }
}

// ── Export Generation Logic ────────────────────────────────────────────────

interface ExportResult {
  success: boolean;
  buffer: Buffer;
  contentType: string;
  error?: string;
}

async function generateExport(
  doc: {
    id: string;
    title: string;
    base_type: string;
    content: Record<string, unknown> | null;
  },
  format: string,
  options: { include_comments: boolean; password?: string }
): Promise<ExportResult> {
  // For now, generate a placeholder export
  // In production, this would use libraries like:
  // - PDF: pdf-lib, puppeteer, or html2canvas + jsPDF
  // - DOCX: docx or mammoth
  // - HTML: direct content serialization
  // - PNG: html2canvas or sharp

  const exportContent = generateExportContent(doc, format);

  return {
    success: true,
    buffer: Buffer.from(exportContent),
    contentType: getContentType(format),
  };
}

function generateExportContent(
  doc: {
    title: string;
    base_type: string;
    content: Record<string, unknown> | null;
  },
  format: string
): string {
  const content = doc.content ?? {};

  switch (format) {
    case "html":
      return generateHtmlExport(doc.title, content);
    case "markdown":
      return generateMarkdownExport(doc.title, content);
    case "csv":
      return generateCsvExport(content);
    default:
      // PDF and PNG would be binary - return JSON metadata for now
      return JSON.stringify(
        {
          title: doc.title,
          base_type: doc.base_type,
          format,
          exported_at: new Date().toISOString(),
          content_summary: summarizeContent(content),
        },
        null,
        2
      );
  }
}

function generateHtmlExport(title: string, content: Record<string, unknown>): string {
  const pages = (content as { pages?: Array<{ nodes: unknown[] }> }).pages ?? [];
  const nodes = pages[0]?.nodes ?? [];

  let htmlContent = nodes
    .map((node: Record<string, unknown>) => {
      const type = node.type as string;
      const children = (node.children as Array<{ text?: string }>) ?? [];
      const text = children.map((c) => c.text ?? "").join("");

      switch (type) {
        case "h1":
          return `<h1>${escapeHtml(text)}</h1>`;
        case "h2":
          return `<h2>${escapeHtml(text)}</h2>`;
        case "h3":
          return `<h3>${escapeHtml(text)}</h3>`;
        case "p":
          return `<p>${escapeHtml(text)}</p>`;
        case "blockquote":
          return `<blockquote>${escapeHtml(text)}</blockquote>`;
        case "code":
          return `<pre><code>${escapeHtml(text)}</code></pre>`;
        default:
          return `<p>${escapeHtml(text)}</p>`;
      }
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.3rem; }
    blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 1rem; color: #666; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${htmlContent}
</body>
</html>`;
}

function generateMarkdownExport(title: string, content: Record<string, unknown>): string {
  const pages = (content as { pages?: Array<{ nodes: unknown[] }> }).pages ?? [];
  const nodes = pages[0]?.nodes ?? [];

  let mdContent = `# ${title}\n\n`;

  for (const node of nodes) {
    const type = (node as Record<string, unknown>).type as string;
    const children = ((node as Record<string, unknown>).children as Array<{
      text?: string;
      bold?: boolean;
      italic?: boolean;
    }>) ?? [];

    const text = children
      .map((c) => {
        let t = c.text ?? "";
        if (c.bold) t = `**${t}**`;
        if (c.italic) t = `*${t}*`;
        return t;
      })
      .join("");

    switch (type) {
      case "h1":
        mdContent += `# ${text}\n\n`;
        break;
      case "h2":
        mdContent += `## ${text}\n\n`;
        break;
      case "h3":
        mdContent += `### ${text}\n\n`;
        break;
      case "p":
        mdContent += `${text}\n\n`;
        break;
      case "blockquote":
        mdContent += `> ${text}\n\n`;
        break;
      case "code":
        mdContent += "\`\`\`\n${text}\n\`\`\`\n\n";
        break;
    }
  }

  return mdContent;
}

function generateCsvExport(content: Record<string, unknown>): string {
  const sheets = (content as { snapshot?: { sheets?: Record<string, { cellData?: Record<string, Record<string, { v?: string }>> }> } }).snapshot?.sheets ?? {};
  const firstSheet = Object.values(sheets)[0];

  if (!firstSheet?.cellData) {
    return "";
  }

  const rows: string[][] = [];
  for (const [row, cols] of Object.entries(firstSheet.cellData)) {
    const rowIndex = parseInt(row, 10);
    const rowData: string[] = [];
    for (const [col, cell] of Object.entries(cols)) {
      const colIndex = parseInt(col, 10);
      const value = (cell?.v ?? "").toString();
      // Ensure row has enough columns
      while (rowData.length <= colIndex) {
        rowData.push("");
      }
      rowData[colIndex] = value;
    }
    // Ensure rows array has enough entries
    while (rows.length <= rowIndex) {
      rows.push([]);
    }
    rows[rowIndex] = rowData;
  }

  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
}

function escapeHtml(text: string): string {
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  // Server-side fallback
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function getContentType(format: string): string {
  const contentTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    html: "text/html",
    markdown: "text/markdown",
    png: "image/png",
    csv: "text/csv",
  };
  return contentTypes[format] ?? "application/octet-stream";
}

function summarizeContent(content: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  if (content.editor) {
    summary.editor = content.editor;
  }

  if ((content as { pages?: unknown[] }).pages) {
    summary.pages_count = (content as { pages?: unknown[] }).pages?.length ?? 0;
  }

  if ((content as { report?: { pages?: unknown[] } }).report?.pages) {
    summary.report_pages = (content as { report?: { pages?: unknown[] } }).report?.pages?.length ?? 0;
  }

  if ((content as { presentation?: { slides?: unknown[] } }).presentation?.slides) {
    summary.presentation_slides = (content as { presentation?: { slides?: unknown[] } }).presentation?.slides?.length ?? 0;
  }

  if ((content as { snapshot?: { sheets?: Record<string, unknown> } }).snapshot?.sheets) {
    summary.sheets_count = Object.keys(
      (content as { snapshot?: { sheets?: Record<string, unknown> } }).snapshot?.sheets ?? {}
    ).length;
  }

  return summary;
}
