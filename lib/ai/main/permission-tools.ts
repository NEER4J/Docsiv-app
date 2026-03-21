import { tool } from "ai";
import { z } from "zod";
import {
  getDocumentById,
  checkDocumentAccess,
  addDocumentCollaborator,
  removeDocumentCollaborator,
  updateDocumentCollaboratorRole,
  createDocumentLink,
  revokeDocumentLink,
  setDocumentLinkPassword,
  getDocumentCollaborators,
  getDocumentLinks,
} from "@/lib/actions/documents";

// ── Manage Document Collaborators Tool ──────────────────────────────────────

export function createManageCollaboratorsTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>
) {
  return tool({
    description:
      "Manage document collaborators - add, remove, or update their access roles. User must have edit permission on the document. Roles: view (read-only), comment (view + comments), edit (full access).",
    parameters: z.object({
      document_id: z.string().describe("The document ID to manage"),
      action: z
        .enum(["add", "remove", "update_role", "list"])
        .describe("Action to perform on collaborators"),
      email: z
        .string()
        .email()
        .optional()
        .describe("Email address for add/remove/update actions"),
      user_id: z
        .string()
        .optional()
        .describe("User ID for remove/update actions (alternative to email)"),
      role: z
        .enum(["view", "comment", "edit"])
        .optional()
        .describe("Role to assign (for add or update_role)"),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
    execute: async ({ document_id, action, email, user_id, role }) => {
      // Check access permissions (need edit to manage collaborators)
      const access = await checkDocumentAccess(document_id);
      if (access.role !== "edit") {
        return {
          success: false as const,
          error: "You need edit permission to manage document collaborators",
        };
      }

      // Get document details for the response
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

      switch (action) {
        case "add": {
          if (!email) {
            return {
              success: false as const,
              error: "Email is required for add action",
            };
          }
          if (!role) {
            return {
              success: false as const,
              error: "Role is required for add action (view, comment, or edit)",
            };
          }

          const { error } = await addDocumentCollaborator(document_id, email, role);
          if (error) {
            return { success: false as const, error };
          }

          return {
            success: true as const,
            document_id,
            action,
            email,
            role,
            message: `Added ${email} as ${role}`,
          };
        }

        case "remove": {
          // Need to get collaborator ID first
          const { collaborators, error: listError } = await getDocumentCollaborators(document_id);
          if (listError) {
            return { success: false as const, error: listError };
          }

          const target = collaborators.find(
            (c) => (email && c.email?.toLowerCase() === email.toLowerCase()) || (user_id && c.user_id === user_id)
          );

          if (!target) {
            return {
              success: false as const,
              error: `Collaborator not found with ${email ? `email: ${email}` : `user_id: ${user_id}`}`,
            };
          }

          const { error } = await removeDocumentCollaborator(target.id);
          if (error) {
            return { success: false as const, error };
          }

          return {
            success: true as const,
            document_id,
            action,
            removed_email: target.email,
            message: `Removed ${target.email ?? "collaborator"} from document`,
          };
        }

        case "update_role": {
          if (!role) {
            return {
              success: false as const,
              error: "New role is required for update_role action",
            };
          }

          // Get collaborator ID
          const { collaborators, error: listError } = await getDocumentCollaborators(document_id);
          if (listError) {
            return { success: false as const, error: listError };
          }

          const target = collaborators.find(
            (c) => (email && c.email?.toLowerCase() === email.toLowerCase()) || (user_id && c.user_id === user_id)
          );

          if (!target) {
            return {
              success: false as const,
              error: `Collaborator not found with ${email ? `email: ${email}` : `user_id: ${user_id}`}`,
            };
          }

          const { error } = await updateDocumentCollaboratorRole(target.id, role);
          if (error) {
            return { success: false as const, error };
          }

          return {
            success: true as const,
            document_id,
            action,
            email: target.email,
            new_role: role,
            message: `Updated ${target.email ?? "collaborator"} to ${role}`,
          };
        }

        case "list": {
          const { collaborators, error: listError } = await getDocumentCollaborators(document_id);
          if (listError) {
            return { success: false as const, error: listError };
          }

          return {
            success: true as const,
            document_id,
            action,
            collaborators: collaborators.map((c) => ({
              id: c.id,
              email: c.email,
              user_id: c.user_id,
              role: c.role,
              invited_at: c.invited_at,
            })),
            count: collaborators.length,
          };
        }

        default:
          return {
            success: false as const,
            error: `Unknown action: ${action}`,
          };
      }
    },
  });
}

// ── Create Share Link Tool ───────────────────────────────────────────────────

export function createCreateShareLinkTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>
) {
  return tool({
    description:
      "Create a shareable link for a document with optional password protection and expiration. User must have edit permission. Returns the full share URL that can be copied and shared.",
    parameters: z.object({
      document_id: z.string().describe("The document ID to share"),
      role: z
        .enum(["view", "comment", "edit"])
        .describe("Access level for the share link"),
      expires_days: z
        .number()
        .min(1)
        .max(365)
        .optional()
        .describe("Number of days until link expires (1-365)"),
      password: z
        .string()
        .optional()
        .describe("Optional password protection for the link"),
      require_identity: z
        .boolean()
        .optional()
        .describe("Require viewers to provide name/email (default: false)"),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
    execute: async ({ document_id, role, expires_days, password, require_identity }) => {
      // Check access permissions (need edit to create share links)
      const access = await checkDocumentAccess(document_id);
      if (access.role !== "edit") {
        return {
          success: false as const,
          error: "You need edit permission to create share links",
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

      // Calculate expiration date
      const expires_at = expires_days
        ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Create the link
      const { link, error } = await createDocumentLink(document_id, {
        role,
        expires_at,
        password_hash: password ?? null,
      });

      if (error || !link) {
        return {
          success: false as const,
          error: error ?? "Failed to create share link",
        };
      }

      // Build the full share URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://habiv.app";
      const shareUrl = `${appUrl}/d/${document_id}?share=${link.token}`;

      return {
        success: true as const,
        document_id,
        title: document.title,
        role,
        share_url: shareUrl,
        token: link.token,
        expires_at,
        has_password: !!password,
        require_identity: require_identity ?? false,
        message: `Share link created with ${role} access${password ? " and password protection" : ""}`,
      };
    },
  });
}

// ── Manage Share Links Tool ────────────────────────────────────────────────────

export function createManageShareLinksTool(
  workspaceId: string,
  localCache: Map<string, unknown>,
  withCache: <T>(key: string, fn: () => Promise<T>) => Promise<T>
) {
  return tool({
    description:
      "Manage document share links - list, revoke, or update existing links. User must have edit permission on the document.",
    parameters: z.object({
      document_id: z.string().describe("The document ID to manage"),
      action: z.enum(["list", "revoke", "set_password", "remove_password"]).describe("Action to perform"),
      link_id: z.string().optional().describe("Link ID for revoke or password actions"),
      password: z.string().optional().describe("New password for set_password action"),
    }),
    // @ts-expect-error AI SDK v5 tool() overload inference issue with execute return type
    execute: async ({ document_id, action, link_id, password }) => {
      // Check access permissions
      const access = await checkDocumentAccess(document_id);
      if (access.role !== "edit") {
        return {
          success: false as const,
          error: "You need edit permission to manage share links",
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

      switch (action) {
        case "list": {
          const { links, error: listError } = await getDocumentLinks(document_id);
          if (listError) {
            return { success: false as const, error: listError };
          }

          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://habiv.app";

          return {
            success: true as const,
            document_id,
            action,
            links: links.map((l) => ({
              id: l.id,
              role: l.role,
              share_url: `${appUrl}/d/${document_id}?share=${l.token}`,
              expires_at: l.expires_at,
              has_password: l.has_password,
              created_at: l.created_at,
            })),
            count: links.length,
          };
        }

        case "revoke": {
          if (!link_id) {
            return {
              success: false as const,
              error: "link_id is required for revoke action",
            };
          }

          const { error } = await revokeDocumentLink(link_id);
          if (error) {
            return { success: false as const, error };
          }

          return {
            success: true as const,
            document_id,
            action,
            revoked_link_id: link_id,
            message: "Share link revoked successfully",
          };
        }

        case "set_password": {
          if (!link_id) {
            return {
              success: false as const,
              error: "link_id is required for set_password action",
            };
          }
          if (!password) {
            return {
              success: false as const,
              error: "password is required for set_password action",
            };
          }

          const { error } = await setDocumentLinkPassword(link_id, password);
          if (error) {
            return { success: false as const, error };
          }

          return {
            success: true as const,
            document_id,
            action,
            link_id,
            message: "Password protection added to share link",
          };
        }

        case "remove_password": {
          if (!link_id) {
            return {
              success: false as const,
              error: "link_id is required for remove_password action",
            };
          }

          const { error } = await setDocumentLinkPassword(link_id, null);
          if (error) {
            return { success: false as const, error };
          }

          return {
            success: true as const,
            document_id,
            action,
            link_id,
            message: "Password protection removed from share link",
          };
        }

        default:
          return {
            success: false as const,
            error: `Unknown action: ${action}`,
          };
      }
    },
  });
}
