import { tool } from "ai";
import { z } from "zod";
import {
  getDocumentById,
  updateDocumentContent,
  updateDocumentRecord,
  checkDocumentAccess,
} from "@/lib/actions/documents";
import type { Value } from "platejs";
import {
  generatePlateContent,
  generateKonvaShapes,
  generateUniverCells,
} from "@/lib/ai/shared/content-generator";

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

export function createEditDocumentPlateTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>
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
        const access = await checkDocumentAccess(document_id);
        if (access.role !== "edit") {
          console.warn('[edit_document_plate] Access denied for document', document_id, 'role:', access.role);
          return {
            success: false as const,
            error: `You do not have edit permission for this document (role: ${access.role ?? 'none'})`,
          };
        }
      }

      // Get current document
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

      // Verify it's a plate-compatible document
      const isPlateDoc = ["doc", "contract"].includes(document.base_type);
      if (!isPlateDoc) {
        return {
          success: false as const,
          error: `Cannot edit document with base_type "${document.base_type}" using Plate editor. Use the appropriate editor tool.`,
        };
      }

      // Get current content
      const currentContent = (document.content ?? {
        editor: "plate",
        pages: [{ nodes: [] }],
      }) as { editor: string; pages: Array<{ nodes: Value }> };

      if (!currentContent.pages || currentContent.pages.length === 0) {
        currentContent.pages = [{ nodes: [] }];
      }

      const fullValue = currentContent.pages[0].nodes;
      let newValue: Value;

      // Handle generate_content operation — call AI to produce nodes
      if (operation === "generate_content") {
        if (!generation_prompt) {
          return {
            success: false as const,
            error: "generation_prompt required for generate_content operation",
          };
        }
        const genResult = await generatePlateContent(generation_prompt, {
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
        // For non-generate operations, content is required
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

      // Update the document
      const newContent = {
        ...currentContent,
        pages: [{ nodes: newValue }],
      };

      const { error: updateError } = await updateDocumentContent(
        document_id,
        newContent
      );

      if (updateError) {
        return {
          success: false as const,
          error: updateError,
        };
      }

      return {
        success: true as const,
        document_id,
        title: document.title,
        base_type: document.base_type,
        operation,
        nodes_affected: Array.isArray(content) ? content.length : 0,
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

interface KonvaShape {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  text?: string;
  fontSize?: number;
  [key: string]: unknown;
}

interface KonvaPage {
  id: string;
  shapes: KonvaShape[];
}

interface KonvaReportContent {
  editor: "konva";
  report?: {
    pages: KonvaPage[];
    pageWidthPx?: number;
    pageHeightPx?: number;
  };
  presentation?: {
    slides: KonvaPage[];
  };
}

export function createEditDocumentKonvaTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>
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
        const access = await checkDocumentAccess(document_id);
        if (access.role !== "edit") {
          console.warn('[edit_document_konva] Access denied for document', document_id, 'role:', access.role);
          return {
            success: false as const,
            error: `You do not have edit permission for this document (role: ${access.role ?? 'none'})`,
          };
        }
      }

      // Get current document
      const { document, error: docError } = await getDocumentById(
        workspaceId,
        document_id
      );
      if (docError || !document) {
        console.error('[edit_document_konva] Document not found:', document_id, docError);
        return {
          success: false as const,
          error: docError ?? "Document not found",
        };
      }

      // Verify it's a Konva document
      const isKonvaDoc = ["report", "presentation"].includes(
        document.document_type?.slug ?? ""
      ) || ["presentation"].includes(document.base_type);

      if (!isKonvaDoc) {
        return {
          success: false as const,
          error: `Cannot edit document with base_type "${document.base_type}" using Konva editor. Use the appropriate editor tool.`,
        };
      }

      // Get current content
      const currentContent = (document.content as unknown as KonvaReportContent) ?? {
        editor: "konva" as const,
        report: { pages: [] },
      };

      const pages = currentContent.report?.pages ?? currentContent.presentation?.slides ?? [];

      // Apply the edit operation
      let updatedPages = [...pages];

      switch (operation) {
        case "add_page": {
          const newPage: KonvaPage = {
            id: `page-${Date.now()}`,
            shapes: shapes ?? [],
          };
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
          updatedPages[page_index] = {
            ...updatedPages[page_index],
            shapes: shapes ?? updatedPages[page_index].shapes,
          };
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
          // Merge or replace shapes
          const currentShapes = updatedPages[page_index].shapes;
          const newShapes = shapes ?? [];
          // Replace shapes with matching IDs, append new ones
          const shapeMap = new Map(currentShapes.map((s) => [s.id, s]));
          for (const shape of newShapes) {
            if (shape.id && shapeMap.has(shape.id)) {
              shapeMap.set(shape.id, { ...shapeMap.get(shape.id), ...shape });
            } else {
              shapeMap.set(shape.id ?? `shape-${Date.now()}-${Math.random()}`, shape);
            }
          }
          updatedPages[page_index].shapes = Array.from(shapeMap.values());
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

          const layoutShapes: KonvaShape[] = [];
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

          const layoutPage: KonvaPage = {
            id: `layout-page-${Date.now()}`,
            shapes: layoutShapes,
          };

          const insertIdx =
            page_index != null
              ? Math.max(0, Math.min(page_index, pages.length))
              : pages.length;
          updatedPages.splice(insertIdx, 0, layoutPage);
          break;
        }
        case "generate_content": {
          if (!generation_prompt) {
            return {
              success: false as const,
              error: "generation_prompt required for generate_content operation",
            };
          }
          const isPresMode = !!currentContent.presentation;
          const genResult = await generateKonvaShapes(generation_prompt, {
            mode: isPresMode ? "presentation" : "report",
            pageWidth: currentContent.report?.pageWidthPx ?? (isPresMode ? 960 : 794),
            pageHeight: currentContent.report?.pageHeightPx ?? (isPresMode ? 540 : 1123),
            layoutData: layout_data as Record<string, unknown> | undefined,
          });
          if (!genResult.success) {
            return {
              success: false as const,
              error: genResult.error,
            };
          }
          const genPage: KonvaPage = {
            id: `gen-page-${Date.now()}`,
            shapes: genResult.shapes as KonvaShape[],
          };
          const genIdx =
            page_index != null
              ? Math.max(0, Math.min(page_index, pages.length))
              : pages.length;
          updatedPages.splice(genIdx, 0, genPage);
          break;
        }
        default:
          return {
            success: false as const,
            error: `Unknown operation: ${operation}`,
          };
      }

      // Build updated content
      const isPresentation = !!currentContent.presentation;
      const newContent = isPresentation
        ? {
            ...currentContent,
            presentation: {
              ...currentContent.presentation,
              slides: updatedPages,
            },
          }
        : {
            ...currentContent,
            report: {
              ...currentContent.report,
              pages: updatedPages,
            },
          };

      // Update the document
      const { error: updateError } = await updateDocumentContent(
        document_id,
        newContent
      );

      if (updateError) {
        return {
          success: false as const,
          error: updateError,
        };
      }

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
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>
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
        const access = await checkDocumentAccess(document_id);
        if (access.role !== "edit") {
          console.warn('[edit_document_univer] Access denied for document', document_id, 'role:', access.role);
          return {
            success: false as const,
            error: `You do not have edit permission for this document (role: ${access.role ?? 'none'})`,
          };
        }
      }

      // Get current document
      const { document, error: docError } = await getDocumentById(
        workspaceId,
        document_id
      );
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
        return {
          success: false as const,
          error: `Cannot edit document with base_type "${document.base_type}" using Univer editor. Use the appropriate editor tool.`,
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
          // Create default sheet
          targetSheetId = "sheet-1";
          sheets[targetSheetId] = {
            id: targetSheetId,
            name: "Sheet 1",
            cellData: {},
            rowCount: 100,
            columnCount: 20,
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
          if (!generation_prompt) {
            return {
              success: false as const,
              error: "generation_prompt required for generate_content operation",
            };
          }
          const genResult = await generateUniverCells(generation_prompt, {
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

      // Build updated content
      const newContent = {
        ...currentContent,
        snapshot: {
          ...currentContent.snapshot,
          sheets,
        },
      };

      // Update the document
      const { error: updateError } = await updateDocumentContent(
        document_id,
        newContent
      );

      if (updateError) {
        return {
          success: false as const,
          error: updateError,
        };
      }

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
