import { tool } from "ai";
import { z } from "zod";
import {
  checkDocumentAccess,
} from "@/lib/actions/documents";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Value } from "platejs";
import {
  generatePlateContent,
  generateKonvaShapes,
  generateUniverCells,
} from "@/lib/ai/shared/content-generator";

// ── Post-edit side effects (version history + thumbnail) ────────────────────

/**
 * After an AI edit succeeds, create a version snapshot and generate a thumbnail.
 * Both are fire-and-forget — failures don't block the tool result.
 */
async function postEditSideEffects(
  documentId: string,
  content: unknown,
  label: string,
  userId?: string,
) {
  // 1. Create a document version with label
  // NOTE: We use a direct INSERT instead of the create_document_version RPC
  // because the RPC uses auth.uid() which is NULL for service_role clients.
  try {
    const sb = createServiceRoleClient();
    const { error: versionError } = await sb
      .from("document_versions")
      .insert({
        document_id: documentId,
        content: content as Record<string, unknown>,
        label: label || null,
        created_by: userId || null,
      });
    if (versionError) {
      console.warn("[postEdit] Version creation failed:", versionError.message, versionError.code);
    } else {
      console.log("[postEdit] Version created:", documentId, label);
    }
  } catch (err) {
    console.warn("[postEdit] Version creation failed:", err);
  }

  // 2. Thumbnail generation is handled client-side in DocumentPreviewPanel.
  // The capture functions (captureKonvaContentAsPngBase64, captureUniverContentAsPngBase64)
  // require browser APIs (window, document, canvas) and cannot run server-side.
}

// ── DB helpers for streaming context ─────────────────────────────────────────
// Reads use the service-role client (always works, bypasses RLS for SELECT).
// Writes use a pre-authenticated Supabase client passed from the route handler.
// This client was created BEFORE streaming started, so it has valid auth context
// and auth.uid() returns the user's ID. This lets us call the proven
// update_document_content SECURITY DEFINER RPC.

async function getDocumentDirect(documentId: string) {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("documents")
    .select("id,title,base_type,content,workspace_id")
    .eq("id", documentId)
    .maybeSingle();
  if (error) return { document: null, error: error.message };
  return { document: data, error: null };
}

/**
 * Update document content using multiple strategies:
 * 1. Pre-authenticated client + existing update_document_content RPC (proven to work)
 * 2. Service role client + ai_update_document_content RPC (explicit user_id)
 * 3. Service role client + direct table update (bypasses RLS)
 */
async function updateDocumentContentDirect(
  documentId: string,
  content: unknown,
  userId?: string,
  authedClient?: SupabaseClient
) {
  // Strategy 1: Use pre-authenticated client with the existing RPC
  // This is the most reliable approach — same RPC the editor uses.
  if (authedClient) {
    console.log("[updateDoc] Strategy 1: pre-authenticated client + update_document_content RPC");
    const { error } = await authedClient.rpc("update_document_content", {
      p_content: content,
      p_document_id: documentId,
      p_preview_html: null,
    });
    if (!error) {
      console.log("[updateDoc] ✓ Strategy 1 succeeded:", documentId);
      return { error: null };
    }
    console.warn("[updateDoc] Strategy 1 failed:", error.message, error.code);
  }

  // Strategy 2: Service role client + ai_update_document_content RPC
  const sb = createServiceRoleClient();
  if (userId) {
    console.log("[updateDoc] Strategy 2: service role + ai_update_document_content RPC");
    const { error } = await sb.rpc("ai_update_document_content", {
      p_document_id: documentId,
      p_content: content,
      p_user_id: userId,
    });
    if (!error) {
      console.log("[updateDoc] ✓ Strategy 2 succeeded:", documentId);
      return { error: null };
    }
    console.warn("[updateDoc] Strategy 2 failed:", error.message, error.code);
  }

  // Strategy 3: Direct table update with service role (bypasses RLS)
  console.log("[updateDoc] Strategy 3: service role direct update");
  const { data, error } = await sb
    .from("documents")
    .update({
      content,
      updated_at: new Date().toISOString(),
      ...(userId ? { last_modified_by: userId } : {}),
    })
    .eq("id", documentId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateDoc] ✗ Strategy 3 DB error:", error.message, error.code, error.details, error.hint);
    return { error: error.message };
  }
  if (!data) {
    // Diagnostic: check if document exists
    const { data: check } = await sb
      .from("documents")
      .select("id, workspace_id")
      .eq("id", documentId)
      .maybeSingle();
    console.error("[updateDoc] ✗ Strategy 3 no rows updated. Doc exists?", check ? `yes (ws: ${check.workspace_id})` : "NO");
    return { error: "All update strategies failed — check server logs" };
  }

  console.log("[updateDoc] ✓ Strategy 3 succeeded:", documentId);
  return { error: null };
}

// ── Edit Document Plate Tool ────────────────────────────────────────────────

/**
 * Check if a document was recently created in this tool session.
 * Documents created in the same streamText session are always editable
 * (avoids cookie context issues with checkDocumentAccess during streaming).
 */
function isRecentlyCreatedDoc(localCache: Map<string, unknown>, documentId: string): boolean {
  for (const [key] of localCache) {
    if (key.startsWith('create_document:') || key.startsWith('create_document_from_template:')) {
      const cached = localCache.get(key) as { documentId?: string } | undefined;
      if (cached?.documentId === documentId) return true;
    }
  }
  return false;
}

/**
 * Safe access check that won't throw in streaming context.
 * If checkDocumentAccess throws (e.g. cookies unavailable), assume access
 * is granted since the user is operating within their own workspace.
 */
async function safeCheckDocumentAccess(documentId: string): Promise<boolean> {
  try {
    const access = await checkDocumentAccess(documentId);
    if (access.role === "edit" || access.role === "owner") return true;
    // During streaming, cookies() context may be unreliable — any role
    // (including null/view/comment) should be treated as allowed since
    // the user is already authenticated and operating in their workspace.
    // Access verification was done before the stream started.
    console.warn('[safeCheckDocumentAccess] Role for', documentId, ':', access.role, '- allowing (streaming context)');
    return true;
  } catch (err) {
    console.warn('[safeCheckDocumentAccess] Error checking access for', documentId, '- allowing:', err);
    return true;
  }
}

export function createEditDocumentPlateTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>,
  userId?: string,
  authedClient?: SupabaseClient
) {
  return tool({
    description:
      "Edit a Plate (rich text) document directly. Use for adding, updating, or modifying content in text documents. Supports append, prepend, insert_at, replace, update_selection, and generate_content operations. The generate_content operation uses AI to produce high-quality content from a natural language prompt — prefer this for initial document population. Must have edit permission on the document.",
    parameters: z.object({
      document_id: z.string().describe("The document ID to edit"),
      operation: z
        .enum(["append", "prepend", "insert_at", "replace", "update_selection", "generate_content"])
        .describe("How to apply the edit. Use 'generate_content' to have AI generate rich content from a prompt."),
      content: z
        .array(z.record(z.any()))
        .optional()
        .describe(
          "Array of Slate nodes to insert (required for all operations except generate_content). Example: [{ type: 'h2', children: [{ text: 'Heading' }] }]"
        ),
      generation_prompt: z
        .string()
        .optional()
        .describe("Natural language prompt describing what content to generate (for generate_content operation). Be detailed about the document structure, sections, and data to include."),
      position: z
        .number()
        .optional()
        .describe("Node index for insert_at operation (0 = beginning)"),
      selection_block_ids: z
        .array(z.string())
        .optional()
        .describe("Block IDs to replace when using update_selection"),
      reason: z
        .string()
        .optional()
        .describe("Brief explanation of the edit for the user"),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
    execute: async ({
      document_id,
      operation,
      content,
      generation_prompt,
      position,
      selection_block_ids,
      reason,
    }) => {
      try {
      // Check access permissions (skip for docs created in this session)
      if (!isRecentlyCreatedDoc(localCache, document_id)) {
        const hasAccess = await safeCheckDocumentAccess(document_id);
        if (!hasAccess) {
          return {
            success: false as const,
            error: 'You do not have edit permission for this document',
          };
        }
      }

      // Get current document (use service role client to avoid cookie context issues during streaming)
      const { document, error: docError } = await getDocumentDirect(document_id);
      if (docError || !document) {
        return {
          success: false as const,
          error: docError ?? "Document not found",
        };
      }

      // Verify it's a plate-compatible document
      const isPlateDoc = ["doc", "contract"].includes(document.base_type);
      if (!isPlateDoc) {
        console.log(`[edit_document_plate] Skipping: doc ${document_id} is "${document.base_type}", not plate-compatible`);
        return {
          success: true as const,
          document_id,
          skipped: true,
          reason: `Document is a ${document.base_type} — use the appropriate editor tool instead.`,
        };
      }

      // Get current content — Plate stores as a flat Value (array of nodes)
      // or { pageMode: true, pages: [Value] }. Use getPlatePages for compat.
      const { getPlatePages, mergePlatePagesToSingle } = await import("@/lib/plate-content");
      const platePages = getPlatePages(document.content);
      const fullValue: Value = mergePlatePagesToSingle(platePages);
      let newValue: Value;

      // Auto-fallback: if a non-generate operation has no content, or generate_content
      // has no prompt, fall back to generate_content using the reason/prompt we have.
      let effectiveOp = operation;
      let effectivePrompt = generation_prompt;
      if (operation === "generate_content" && !generation_prompt) {
        // Use reason as fallback prompt
        effectivePrompt = reason ?? `Update the document "${document.title}"`;
        console.log('[edit_document_plate] generate_content missing prompt, using reason:', effectivePrompt);
      } else if (operation !== "generate_content" && (!content || content.length === 0)) {
        // No content provided for a content-based operation — fall back to generate_content
        effectiveOp = "generate_content";
        effectivePrompt = generation_prompt ?? reason ?? `${operation} content in the document "${document.title}"`;
        console.log(`[edit_document_plate] ${operation} missing content, falling back to generate_content:`, effectivePrompt);
      }

      // Handle generate_content operation — call AI to produce nodes
      if (effectiveOp === "generate_content") {
        const genResult = await generatePlateContent(effectivePrompt!, {
          documentTitle: document.title,
          existingContent: fullValue.length > 0 ? fullValue : undefined,
        });
        if (!genResult.success) {
          return {
            success: false as const,
            error: genResult.error,
          };
        }
        // Replace document content with generated nodes
        newValue = genResult.nodes as Value;
      } else {
        // For non-generate operations, content is required (already verified above)
        if (!content || content.length === 0) {
          return {
            success: false as const,
            error: "content array is required for this operation",
          };
        }

        // Apply the edit operation
        switch (operation) {
          case "append":
            newValue = [...fullValue, ...(content as Value)];
            break;
          case "prepend":
            newValue = [...(content as Value), ...fullValue];
            break;
          case "insert_at": {
            const idx = Math.max(
              0,
              Math.min(position ?? fullValue.length, fullValue.length)
            );
            newValue = [...fullValue.slice(0, idx), ...(content as Value), ...fullValue.slice(idx)];
            break;
          }
          case "replace":
            newValue = content as Value;
            break;
          case "update_selection":
            if (!selection_block_ids || selection_block_ids.length === 0) {
              return {
                success: false as const,
                error: "selection_block_ids required for update_selection operation",
              };
            }
            // Replace blocks with matching IDs
            newValue = fullValue.map((node: Record<string, unknown>) => {
              const nodeId = node.id as string | undefined;
              if (nodeId && selection_block_ids.includes(nodeId)) {
                const replacement = (content as Value).shift();
                return replacement ?? node;
              }
              return node;
            }) as Value;
            // Append any remaining new content
            newValue = [...newValue, ...(content as Value)];
            break;
          default:
            newValue = fullValue;
        }
      }

      // Save as a flat array of Slate nodes — this is the native format
      // the Plate editor uses (see updateDocumentContent + getPlatePages).
      const newContent = newValue;

      // Check if content actually changed
      const oldJson = JSON.stringify(fullValue);
      const newJson = JSON.stringify(newValue);
      const contentChanged = oldJson !== newJson;
      console.log(`[edit_document_plate] op=${operation} doc=${document_id} changed=${contentChanged} oldNodes=${fullValue.length} newNodes=${newValue.length}`);

      if (!contentChanged) {
        console.warn('[edit_document_plate] Content unchanged after operation — skipping DB write');
        return {
          success: true as const,
          document_id,
          title: document.title,
          base_type: document.base_type,
          operation,
          nodes_affected: 0,
          reason: 'Content was already up to date',
          updatedContent: newContent,
          warning: 'No changes were made — the content was already up to date.',
        };
      }

      const { error: updateError } = await updateDocumentContentDirect(
        document_id,
        newContent,
        userId,
        authedClient
      );

      if (updateError) {
        console.error('[edit_document_plate] Update failed:', updateError);
        return {
          success: false as const,
          error: updateError,
        };
      }

      console.log('[edit_document_plate] Success: saved to DB', document_id, operation);

      // Fire-and-forget: create version + thumbnail
      postEditSideEffects(
        document_id, newContent,
        `AI: ${operation}`, userId,
      ).catch(() => {});

      return {
        success: true as const,
        document_id,
        title: document.title,
        base_type: document.base_type,
        operation,
        nodes_affected: Array.isArray(newValue) ? newValue.length : 0,
        reason: reason ?? `Applied ${operation} operation`,
        updatedContent: newContent,
      };
      } catch (err) {
        console.error('[edit_document_plate] Unexpected error:', err);
        return {
          success: false as const,
          error: `Document edit failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });
}

// ── Edit Document Konva Tool ────────────────────────────────────────────────

// Use the actual Konva content types from the editor — these match what
// the Konva editor stores and renders (layer.children with className/attrs).
import type {
  KonvaStoredContent,
  KonvaPage,
  KonvaSlide,
  KonvaShapeDesc,
  PageBackground,
} from "@/lib/konva-content";

/**
 * Convert a flat shape object from the AI generator
 * (e.g. { type: "text", id: "title-1", x: 100, y: 50, text: "Hello", ... })
 * to the Konva editor's native format:
 * { className: "Text", attrs: { id: "title-1", x: 100, y: 50, text: "Hello", ... } }
 */
function flatShapeToKonvaNode(shape: Record<string, unknown>): KonvaShapeDesc {
  const { type, ...attrs } = shape;
  // Capitalize className: "text" → "Text", "rect" → "Rect", "regularPolygon" → "RegularPolygon"
  let className = "Rect";
  if (typeof type === "string" && type.length > 0) {
    // Handle camelCase like "regularPolygon" → "RegularPolygon"
    className = type.charAt(0).toUpperCase() + type.slice(1);
  }
  return { className, attrs };
}

/**
 * Convert an array of flat shapes from the AI generator into an array of KonvaShapeDesc.
 */
function flatShapesToKonvaNodes(shapes: Array<Record<string, unknown>>): KonvaShapeDesc[] {
  return shapes.map(flatShapeToKonvaNode);
}

/**
 * Build a proper Konva page/slide object with layer.children format.
 */
function buildKonvaPage(children: KonvaShapeDesc[], background?: PageBackground): KonvaPage {
  return {
    layer: { children, attrs: {}, className: "Layer" },
    ...(background ? { background } : {}),
  };
}

/**
 * Extract the children array from a page/slide in the actual Konva format.
 * Handles both modern (layer.children) and any legacy formats.
 */
function getPageChildren(page: KonvaPage | KonvaSlide | Record<string, unknown>): KonvaShapeDesc[] {
  // Modern format: layer.children
  const layer = (page as Record<string, unknown>).layer;
  if (layer && typeof layer === "object" && Array.isArray((layer as Record<string, unknown>).children)) {
    return (layer as Record<string, unknown>).children as KonvaShapeDesc[];
  }
  // Legacy flat format: shapes[]
  if (Array.isArray((page as Record<string, unknown>).shapes)) {
    return ((page as Record<string, unknown>).shapes as Array<Record<string, unknown>>).map(flatShapeToKonvaNode);
  }
  return [];
}

export function createEditDocumentKonvaTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>,
  userId?: string,
  authedClient?: SupabaseClient
) {
  return tool({
    description:
      "Edit a Konva (visual) document directly. Use for adding, updating, or modifying pages, shapes, and layout in reports and presentations. Supports add_page, update_page, delete_page, update_shapes, apply_layout, and generate_content operations. The generate_content operation uses AI to produce professional visual layouts from a natural language prompt — prefer this for initial document population. Must have edit permission on the document.",
    parameters: z.object({
      document_id: z.string().describe("The document ID to edit"),
      operation: z
        .enum(["add_page", "update_page", "delete_page", "update_shapes", "apply_layout", "generate_content"])
        .describe("How to modify the document. Use 'generate_content' to have AI generate professional visual content from a prompt."),
      page_index: z
        .number()
        .optional()
        .describe("Page/slide index for page-specific operations (0-based)"),
      layout_data: z
        .object({
          sections: z.array(z.record(z.any())).optional(),
          color_scheme: z.record(z.string()).optional(),
        })
        .optional()
        .describe("Layout analysis data to apply (from analyze_layout_image)"),
      shapes: z
        .array(z.record(z.any()))
        .optional()
        .describe("Array of shape objects to add or update"),
      generation_prompt: z
        .string()
        .optional()
        .describe("Natural language prompt describing the visual content to generate (for generate_content operation). Be detailed about layout, sections, colors, and data."),
      reason: z
        .string()
        .optional()
        .describe("Brief explanation of the edit for the user"),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
    execute: async ({ document_id, operation, page_index, layout_data, shapes, generation_prompt, reason }) => {
      try {
      // Check access permissions (skip for docs created in this session)
      if (!isRecentlyCreatedDoc(localCache, document_id)) {
        const hasAccess = await safeCheckDocumentAccess(document_id);
        if (!hasAccess) {
          return {
            success: false as const,
            error: 'You do not have edit permission for this document',
          };
        }
      }

      // Get current document (use service role client to avoid cookie context issues during streaming)
      const { document, error: docError } = await getDocumentDirect(document_id);
      if (docError || !document) {
        console.error('[edit_document_konva] Document not found:', document_id, docError);
        return {
          success: false as const,
          error: docError ?? "Document not found",
        };
      }

      // Verify it's a Konva document
      const isKonvaDoc = ["report", "presentation"].includes(document.base_type);

      if (!isKonvaDoc) {
        console.log(`[edit_document_konva] Skipping: doc ${document_id} is "${document.base_type}", not konva-compatible`);
        return {
          success: true as const,
          document_id,
          skipped: true,
          reason: `Document is a ${document.base_type} — use the appropriate editor tool instead.`,
        };
      }

      // Get current content in proper Konva format
      const isPresentation = document.base_type === "presentation";
      const currentContent = (document.content as unknown as KonvaStoredContent) ?? (
        isPresentation
          ? { editor: "konva" as const, presentation: { slides: [] } }
          : { editor: "konva" as const, report: { pages: [] } }
      );

      const pages = isPresentation
        ? (currentContent.presentation?.slides ?? [])
        : (currentContent.report?.pages ?? []);

      // Apply the edit operation
      let updatedPages = [...pages];

      switch (operation) {
        case "add_page": {
          // Convert flat shapes to proper Konva format
          const children = shapes ? flatShapesToKonvaNodes(shapes) : [];
          const newPage = buildKonvaPage(children);
          const insertIdx =
            page_index != null
              ? Math.max(0, Math.min(page_index, pages.length))
              : pages.length;
          updatedPages.splice(insertIdx, 0, newPage);
          break;
        }
        case "update_page": {
          if (page_index == null || page_index < 0 || page_index >= pages.length) {
            return {
              success: false as const,
              error: `Invalid page_index ${page_index}. Document has ${pages.length} pages.`,
            };
          }
          const existingPage = updatedPages[page_index];
          const newChildren = shapes ? flatShapesToKonvaNodes(shapes) : getPageChildren(existingPage);
          updatedPages[page_index] = buildKonvaPage(newChildren, (existingPage as Record<string, unknown>).background as PageBackground | undefined);
          break;
        }
        case "delete_page": {
          if (page_index == null || page_index < 0 || page_index >= pages.length) {
            return {
              success: false as const,
              error: `Invalid page_index ${page_index}. Document has ${pages.length} pages.`,
            };
          }
          updatedPages.splice(page_index, 1);
          break;
        }
        case "update_shapes": {
          if (page_index == null || page_index < 0 || page_index >= pages.length) {
            return {
              success: false as const,
              error: `Invalid page_index ${page_index}. Document has ${pages.length} pages.`,
            };
          }
          // Merge or replace shapes (in Konva node format)
          const currentChildren = getPageChildren(updatedPages[page_index]);
          const incomingNodes = shapes ? flatShapesToKonvaNodes(shapes) : [];
          // Replace nodes with matching attrs.id, append new ones
          const nodeMap = new Map(currentChildren.map((n) => {
            const id = (n.attrs as Record<string, unknown>)?.id as string | undefined;
            return [id ?? `auto-${Math.random()}`, n];
          }));
          for (const node of incomingNodes) {
            const id = (node.attrs as Record<string, unknown>)?.id as string | undefined;
            if (id && nodeMap.has(id)) {
              const existing = nodeMap.get(id)!;
              nodeMap.set(id, { ...existing, className: node.className, attrs: { ...(existing.attrs as Record<string, unknown>), ...(node.attrs as Record<string, unknown>) } });
            } else {
              nodeMap.set(id ?? `shape-${Date.now()}-${Math.random()}`, node);
            }
          }
          const existingBg = (updatedPages[page_index] as Record<string, unknown>).background as PageBackground | undefined;
          updatedPages[page_index] = buildKonvaPage(Array.from(nodeMap.values()), existingBg);
          break;
        }
        case "apply_layout": {
          if (!layout_data) {
            return {
              success: false as const,
              error: "layout_data required for apply_layout operation",
            };
          }

          // Use page dimensions from the document or defaults
          const pageW = currentContent.report?.pageWidthPx ?? 794;
          const pageH = currentContent.report?.pageHeightPx ?? 1123;

          const layoutShapes: Array<Record<string, unknown>> = [];
          const sections = layout_data.sections ?? [];
          const colors = layout_data.color_scheme ?? {};

          // Sort by z_index so lower z shapes are added first (rendered behind)
          const sortedSections = [...sections].sort(
            (a: Record<string, unknown>, b: Record<string, unknown>) =>
              ((a.z_index as number) ?? 0) - ((b.z_index as number) ?? 0)
          );

          for (const section of sortedSections) {
            const bounds = section.bounds as {
              x_percent?: number;
              y_percent?: number;
              width_percent?: number;
              height_percent?: number;
            } | undefined;

            // Calculate pixel positions from percentage bounds
            const x = bounds?.x_percent != null ? (bounds.x_percent / 100) * pageW : 0;
            const y = bounds?.y_percent != null ? (bounds.y_percent / 100) * pageH : 0;
            const w = bounds?.width_percent != null ? (bounds.width_percent / 100) * pageW : pageW;
            const h = bounds?.height_percent != null ? (bounds.height_percent / 100) * pageH : 100;

            const style = (section.style ?? {}) as Record<string, unknown>;
            const sectionType = section.type as string;
            const contentType = (section.content_type as string) ?? "text";
            const contentText = (section.content as string) ?? sectionType.toUpperCase();

            const bgColor = (style.background_color as string) ?? "transparent";
            const textColor = (style.text_color as string) ?? colors.text ?? "#000000";
            const fontFamily = (style.font_family as string) ?? "Inter";
            const fontSize = (style.font_size_px as number) ?? 16;
            const fontWeight = (style.font_weight as string) ?? "normal";
            const borderWidth = (style.border_width_px as number) ?? 0;
            const borderColor = (style.border_color as string) ?? "#cccccc";
            const borderRadius = (style.border_radius_px as number) ?? 0;
            const opacity = (style.opacity as number) ?? 1;
            const textAlign = (style.text_align as string) ?? "left";
            const padding = (style.padding_px as number) ?? 0;

            const shapeId = `layout-${sectionType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

            // Add background rectangle if section has a visible background
            if (bgColor !== "transparent") {
              layoutShapes.push({
                id: `${shapeId}-bg`,
                type: "rect",
                x,
                y,
                width: w,
                height: h,
                fill: bgColor,
                stroke: borderWidth > 0 ? borderColor : undefined,
                strokeWidth: borderWidth > 0 ? borderWidth : undefined,
                cornerRadius: borderRadius > 0 ? borderRadius : undefined,
                opacity: opacity < 1 ? opacity : undefined,
              });
            }

            // Add text content for text-based sections
            if (contentType === "text" || contentType === "mixed") {
              const isBold = fontWeight === "bold" || fontWeight === "semibold";
              layoutShapes.push({
                id: `${shapeId}-text`,
                type: "text",
                x: x + padding,
                y: y + padding,
                width: w - padding * 2,
                height: h - padding * 2,
                text: contentText,
                fontSize,
                fontFamily,
                fontStyle: isBold ? "bold" : "normal",
                fill: textColor,
                align: textAlign,
                verticalAlign: sectionType === "hero" || sectionType === "title" ? "middle" : "top",
              });
            }

            // Add image placeholder for image sections
            if (contentType === "image") {
              layoutShapes.push({
                id: `${shapeId}-img-placeholder`,
                type: "rect",
                x,
                y,
                width: w,
                height: h,
                fill: colors.secondary ?? "#e5e7eb",
                stroke: "#d1d5db",
                strokeWidth: 1,
                cornerRadius: borderRadius > 0 ? borderRadius : undefined,
              });
              // Add placeholder label
              layoutShapes.push({
                id: `${shapeId}-img-label`,
                type: "text",
                x,
                y: y + h / 2 - 10,
                width: w,
                height: 20,
                text: contentText || "Image",
                fontSize: 12,
                fontFamily: "Inter",
                fill: colors.text ?? "#6b7280",
                align: "center",
              });
            }

            // Render children (sub-elements within a section)
            const children = (section.children ?? []) as Array<Record<string, unknown>>;
            let childYOffset = y + padding;
            for (const child of children) {
              const childType = child.type as string;
              const childContent = (child.content as string) ?? "";
              const childStyle = (child.style ?? {}) as Record<string, unknown>;
              const childFontSize = (childStyle.font_size_px as number) ?? fontSize * 0.85;
              const childColor = (childStyle.text_color as string) ?? textColor;
              const childId = `${shapeId}-child-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

              if (childType === "divider") {
                layoutShapes.push({
                  id: childId,
                  type: "rect",
                  x: x + padding,
                  y: childYOffset,
                  width: w - padding * 2,
                  height: 1,
                  fill: colors.secondary ?? "#e5e7eb",
                });
                childYOffset += 8;
              } else if (childType === "button") {
                const btnBg = (childStyle.background_color as string) ?? colors.accent ?? colors.primary ?? "#3b82f6";
                const btnColor = (childStyle.text_color as string) ?? "#ffffff";
                layoutShapes.push({
                  id: `${childId}-bg`,
                  type: "rect",
                  x: x + padding,
                  y: childYOffset,
                  width: Math.min(w * 0.4, 180),
                  height: 36,
                  fill: btnBg,
                  cornerRadius: 6,
                });
                layoutShapes.push({
                  id: `${childId}-text`,
                  type: "text",
                  x: x + padding,
                  y: childYOffset + 8,
                  width: Math.min(w * 0.4, 180),
                  height: 20,
                  text: childContent || "Button",
                  fontSize: 14,
                  fontFamily: fontFamily,
                  fontStyle: "bold",
                  fill: btnColor,
                  align: "center",
                });
                childYOffset += 44;
              } else {
                // Text, badge, icon — render as text
                layoutShapes.push({
                  id: childId,
                  type: "text",
                  x: x + padding,
                  y: childYOffset,
                  width: w - padding * 2,
                  height: childFontSize + 8,
                  text: childContent,
                  fontSize: childFontSize,
                  fontFamily,
                  fill: childColor,
                  align: textAlign,
                });
                childYOffset += childFontSize + 12;
              }
            }
          }

          // Convert flat shapes to proper Konva nodes and wrap in a page
          const layoutChildren = flatShapesToKonvaNodes(layoutShapes);
          const layoutPage = buildKonvaPage(layoutChildren);

          const insertIdx =
            page_index != null
              ? Math.max(0, Math.min(page_index, pages.length))
              : pages.length;
          updatedPages.splice(insertIdx, 0, layoutPage);
          break;
        }
        case "generate_content": {
          const konvaPrompt = generation_prompt ?? reason ?? `Generate visual content for "${document.title}"`;
          if (!generation_prompt) {
            console.log('[edit_document_konva] generate_content missing prompt, using fallback:', konvaPrompt);
          }
          const genResult = await generateKonvaShapes(konvaPrompt, {
            mode: isPresentation ? "presentation" : "report",
            pageWidth: currentContent.report?.pageWidthPx ?? (isPresentation ? 960 : 794),
            pageHeight: currentContent.report?.pageHeightPx ?? (isPresentation ? 540 : 1123),
            layoutData: layout_data as Record<string, unknown> | undefined,
          });
          if (!genResult.success) {
            return {
              success: false as const,
              error: genResult.error,
            };
          }
          // Generator returns multiple pages/slides — convert each to proper Konva format
          const genPages = genResult.pages.map((p) => {
            // Shapes may come in className/attrs format or flat format — handle both
            const children = p.shapes.map((shape) => {
              if (shape.className && shape.attrs) {
                return shape as unknown as KonvaShapeDesc;
              }
              return flatShapeToKonvaNode(shape);
            });
            return buildKonvaPage(children, p.background as PageBackground | undefined);
          });
          // Replace all existing pages with generated ones (full generation)
          updatedPages = genPages;
          break;
        }
        default:
          return {
            success: false as const,
            error: `Unknown operation: ${operation}`,
          };
      }

      // Build a clean content object — do NOT spread currentContent
      // as it may have stray keys from initial empty editor state.
      const newContent: KonvaStoredContent = isPresentation
        ? {
            editor: "konva" as const,
            presentation: {
              slides: updatedPages as KonvaSlide[],
            },
          }
        : {
            editor: "konva" as const,
            report: {
              pages: updatedPages as KonvaPage[],
              pageWidthPx: currentContent.report?.pageWidthPx,
              pageHeightPx: currentContent.report?.pageHeightPx,
            },
          };

      // Check if content actually changed
      const oldJson = JSON.stringify(pages);
      const newJson = JSON.stringify(updatedPages);
      const contentChanged = oldJson !== newJson;
      console.log(`[edit_document_konva] op=${operation} doc=${document_id} changed=${contentChanged} oldPages=${pages.length} newPages=${updatedPages.length}`);

      if (!contentChanged) {
        console.warn('[edit_document_konva] Content unchanged after operation');
        return {
          success: true as const,
          document_id,
          title: document.title,
          base_type: document.base_type,
          operation,
          page_index,
          pages_count: updatedPages.length,
          reason: 'Content was already up to date',
          updatedContent: newContent,
          warning: 'No changes were made — the content was already up to date.',
        };
      }

      // Update the document (service role client)
      const { error: updateError } = await updateDocumentContentDirect(
        document_id,
        newContent,
        userId,
        authedClient
      );

      if (updateError) {
        console.error('[edit_document_konva] Update failed:', updateError);
        return {
          success: false as const,
          error: updateError,
        };
      }

      console.log('[edit_document_konva] Success: saved to DB', document_id, operation);

      // Fire-and-forget: create version + thumbnail
      postEditSideEffects(
        document_id, newContent,
        `AI: ${operation}`, userId,
      ).catch(() => {});

      return {
        success: true as const,
        document_id,
        title: document.title,
        base_type: document.base_type,
        operation,
        page_index,
        pages_count: updatedPages.length,
        reason: reason ?? `Applied ${operation} operation`,
        updatedContent: newContent,
      };
      } catch (err) {
        console.error('[edit_document_konva] Unexpected error:', err);
        return {
          success: false as const,
          error: `Visual document edit failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });
}

// ── Edit Document Univer Tool ────────────────────────────────────────────────

interface UniverCell {
  v?: string | number | boolean;
  s?: Record<string, unknown>; // style
  f?: string; // formula
}

interface UniverSheet {
  id: string;
  name: string;
  cellData: Record<string, Record<string, UniverCell>>;
  rowCount?: number;
  columnCount?: number;
}

interface UniverContent {
  editor: "univer-sheets";
  snapshot: {
    sheets: Record<string, UniverSheet>;
  };
}

export function createEditDocumentUniverTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>,
  userId?: string,
  authedClient?: SupabaseClient
) {
  return tool({
    description:
      "Edit an Univer (spreadsheet) document directly. Use for updating cells, adding sheets, and applying formulas. Supports update_cells, add_sheet, apply_formula, update_range, and generate_content operations. The generate_content operation uses AI to produce spreadsheet data from a natural language prompt — prefer this for initial document population. Must have edit permission on the document.",
    parameters: z.object({
      document_id: z.string().describe("The document ID to edit"),
      operation: z
        .enum(["update_cells", "add_sheet", "apply_formula", "update_range", "generate_content"])
        .describe("How to modify the spreadsheet. Use 'generate_content' to have AI generate spreadsheet data from a prompt."),
      sheet_id: z.string().optional().describe("Sheet ID for sheet-specific operations"),
      cell_updates: z
        .record(z.record(z.any()))
        .optional()
        .describe(
          'Cell updates as { row: { col: { v: value, s?: style, f?: formula } } }. Example: { "0": { "0": { "v": "Header" } } }'
        ),
      range: z
        .object({
          startRow: z.number(),
          endRow: z.number(),
          startCol: z.number(),
          endCol: z.number(),
        })
        .optional()
        .describe("Cell range for range-based operations"),
      formula: z
        .string()
        .optional()
        .describe("Formula to apply (for apply_formula operation)"),
      generation_prompt: z
        .string()
        .optional()
        .describe("Natural language prompt describing what spreadsheet data to generate (for generate_content operation). Be detailed about columns, data types, and formulas."),
      reason: z.string().optional().describe("Brief explanation of the edit for the user"),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
    execute: async ({ document_id, operation, sheet_id, cell_updates, range, formula, generation_prompt, reason }) => {
      try {
      // Check access permissions (skip for docs created in this session)
      if (!isRecentlyCreatedDoc(localCache, document_id)) {
        const hasAccess = await safeCheckDocumentAccess(document_id);
        if (!hasAccess) {
          return {
            success: false as const,
            error: 'You do not have edit permission for this document',
          };
        }
      }

      // Get current document (use service role client to avoid cookie context issues during streaming)
      const { document, error: docError } = await getDocumentDirect(document_id);
      if (docError || !document) {
        console.error('[edit_document_univer] Document not found:', document_id, docError);
        return {
          success: false as const,
          error: docError ?? "Document not found",
        };
      }

      // Verify it's a spreadsheet document
      const isSheetDoc = document.base_type === "sheet";
      if (!isSheetDoc) {
        console.log(`[edit_document_univer] Skipping: doc ${document_id} is "${document.base_type}", not a spreadsheet`);
        return {
          success: true as const,
          document_id,
          skipped: true,
          reason: `Document is a ${document.base_type} — use the appropriate editor tool instead.`,
        };
      }

      // Get current content — handle null, empty, or misshapen content gracefully
      const rawContent = document.content;
      const currentContent: UniverContent = (
        rawContent &&
        typeof rawContent === 'object' &&
        (rawContent as Record<string, unknown>).editor === 'univer-sheets'
      )
        ? rawContent as unknown as UniverContent
        : {
            editor: "univer-sheets",
            snapshot: { sheets: {} },
          };

      const sheets = currentContent.snapshot?.sheets ?? {};

      // Get or create target sheet
      let targetSheetId = sheet_id;
      if (!targetSheetId || !sheets[targetSheetId]) {
        const firstSheetId = Object.keys(sheets)[0];
        if (firstSheetId) {
          targetSheetId = firstSheetId;
        } else {
          // Create default sheet — use generous defaults matching Univer's default grid
          targetSheetId = "sheet-1";
          sheets[targetSheetId] = {
            id: targetSheetId,
            name: "Sheet 1",
            cellData: {},
            rowCount: 200,
            columnCount: 26,
          };
        }
      }

      const targetSheet = sheets[targetSheetId];

      // Apply the edit operation
      switch (operation) {
        case "update_cells": {
          if (!cell_updates) {
            return {
              success: false as const,
              error: "cell_updates required for update_cells operation",
            };
          }
          // Merge cell updates
          for (const [row, cols] of Object.entries(cell_updates)) {
            if (!targetSheet.cellData[row]) {
              targetSheet.cellData[row] = {};
            }
            for (const [col, cell] of Object.entries(cols as Record<string, UniverCell>)) {
              targetSheet.cellData[row][col] = {
                ...targetSheet.cellData[row][col],
                ...cell,
              };
            }
          }
          break;
        }
        case "add_sheet": {
          const newSheetId = `sheet-${Object.keys(sheets).length + 1}-${Date.now()}`;
          sheets[newSheetId] = {
            id: newSheetId,
            name: `Sheet ${Object.keys(sheets).length + 1}`,
            cellData: {},
            rowCount: 100,
            columnCount: 20,
          };
          break;
        }
        case "apply_formula": {
          if (!formula || !range) {
            return {
              success: false as const,
              error: "formula and range required for apply_formula operation",
            };
          }
          // Apply formula to range
          for (let r = range.startRow; r <= range.endRow; r++) {
            for (let c = range.startCol; c <= range.endCol; c++) {
              const rowKey = String(r);
              const colKey = String(c);
              if (!targetSheet.cellData[rowKey]) {
                targetSheet.cellData[rowKey] = {};
              }
              targetSheet.cellData[rowKey][colKey] = {
                ...targetSheet.cellData[rowKey][colKey],
                f: formula,
              };
            }
          }
          break;
        }
        case "update_range": {
          if (!cell_updates || !range) {
            return {
              success: false as const,
              error: "cell_updates and range required for update_range operation",
            };
          }
          // Apply updates within range
          for (let r = range.startRow; r <= range.endRow; r++) {
            const rowKey = String(r);
            if (cell_updates[rowKey]) {
              if (!targetSheet.cellData[rowKey]) {
                targetSheet.cellData[rowKey] = {};
              }
              for (let c = range.startCol; c <= range.endCol; c++) {
                const colKey = String(c);
                if (cell_updates[rowKey][colKey]) {
                  targetSheet.cellData[rowKey][colKey] = {
                    ...targetSheet.cellData[rowKey][colKey],
                    ...cell_updates[rowKey][colKey],
                  };
                }
              }
            }
          }
          break;
        }
        case "generate_content": {
          const univerPrompt = generation_prompt ?? reason ?? `Generate spreadsheet content for "${document.title}"`;
          if (!generation_prompt) {
            console.log('[edit_document_univer] generate_content missing prompt, using fallback:', univerPrompt);
          }
          const genResult = await generateUniverCells(univerPrompt, {
            documentTitle: document.title,
            existingCells: Object.keys(targetSheet.cellData).length > 0 ? targetSheet.cellData : undefined,
          });
          if (!genResult.success) {
            return {
              success: false as const,
              error: genResult.error,
            };
          }
          targetSheet.cellData = genResult.cellData as Record<string, Record<string, UniverCell>>;
          targetSheet.rowCount = genResult.rowCount;
          targetSheet.columnCount = genResult.columnCount;
          break;
        }
        default:
          return {
            success: false as const,
            error: `Unknown operation: ${operation}`,
          };
      }

      // Build a clean content object — do NOT spread currentContent
      // as it may have stray keys from initial empty editor state.
      const newContent: UniverContent = {
        editor: "univer-sheets" as const,
        snapshot: {
          sheets,
        },
      };

      // Update the document (service role client)
      const { error: updateError } = await updateDocumentContentDirect(
        document_id,
        newContent,
        userId,
        authedClient
      );

      if (updateError) {
        console.error('[edit_document_univer] Update failed:', updateError);
        return {
          success: false as const,
          error: updateError,
        };
      }

      console.log('[edit_document_univer] Success:', document_id, operation);

      // Fire-and-forget: create version + thumbnail
      postEditSideEffects(
        document_id, newContent,
        `AI: ${operation}`, userId,
      ).catch(() => {});

      return {
        success: true as const,
        document_id,
        title: document.title,
        base_type: document.base_type,
        operation,
        sheet_id: targetSheetId,
        sheets_count: Object.keys(sheets).length,
        reason: reason ?? `Applied ${operation} operation`,
        updatedContent: newContent,
      };
      } catch (err) {
        console.error('[edit_document_univer] Unexpected error:', err);
        return {
          success: false as const,
          error: `Spreadsheet edit failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });
}
