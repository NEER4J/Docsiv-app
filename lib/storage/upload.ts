import { createClient } from "@/lib/supabase/client";

const AVATARS_BUCKET = "avatars";
const WORKSPACE_LOGOS_BUCKET = "workspace-logos";
const DOCUMENT_ATTACHMENTS_BUCKET = "document-attachments";
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const DOCUMENT_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024; // 50MB for video/large files
const ALLOWED_TYPES = ["image/png", "image/jpeg"];

function getExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  return "jpg";
}

export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  if (file.size > MAX_SIZE_BYTES) return { error: "File must be under 10MB" };
  if (!ALLOWED_TYPES.includes(file.type))
    return { error: "Only PNG and JPEG images are allowed" };

  const supabase = createClient();
  const ext = getExtension(file.type);
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) return { error: error.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

export async function uploadWorkspaceLogo(
  workspaceId: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  if (file.size > MAX_SIZE_BYTES) return { error: "File must be under 10MB" };
  if (!ALLOWED_TYPES.includes(file.type))
    return { error: "Only PNG and JPEG images are allowed" };

  const supabase = createClient();
  const ext = getExtension(file.type);
  const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(WORKSPACE_LOGOS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) return { error: error.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(WORKSPACE_LOGOS_BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

export async function removeAvatar(userId: string, url: string): Promise<{ error: string | null }> {
  try {
    const path = url.split(`/${AVATARS_BUCKET}/`)[1]?.split("?")[0];
    if (!path || !path.startsWith(userId + "/")) return { error: "Invalid path" };
    const supabase = createClient();
    await supabase.storage.from(AVATARS_BUCKET).remove([path]);
    return { error: null };
  } catch {
    return { error: "Failed to remove file" };
  }
}

export async function removeWorkspaceLogo(
  workspaceId: string,
  url: string
): Promise<{ error: string | null }> {
  try {
    const path = url.split(`/${WORKSPACE_LOGOS_BUCKET}/`)[1]?.split("?")[0];
    if (!path || !path.startsWith(workspaceId + "/")) return { error: "Invalid path" };
    const supabase = createClient();
    await supabase.storage.from(WORKSPACE_LOGOS_BUCKET).remove([path]);
    return { error: null };
  } catch {
    return { error: "Failed to remove file" };
  }
}

/** Sanitize filename for storage path: remove path segments, limit length */
function sanitizeAttachmentFilename(name: string): string {
  const base = name.replace(/^.*[/\\]/, "").slice(0, 120) || "file";
  return base;
}

export type DocumentAttachmentResult = { url: string; name: string } | { error: string };

export async function uploadDocumentAttachment(
  workspaceId: string,
  documentId: string,
  file: File
): Promise<DocumentAttachmentResult> {
  if (file.size > DOCUMENT_ATTACHMENT_MAX_BYTES)
    return { error: "File must be under 50MB" };

  const supabase = createClient();
  const safeName = sanitizeAttachmentFilename(file.name);
  const path = `${workspaceId}/${documentId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from(DOCUMENT_ATTACHMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) return { error: error.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(DOCUMENT_ATTACHMENTS_BUCKET).getPublicUrl(path);
  return { url: publicUrl, name: file.name };
}
