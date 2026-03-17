import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DOCUMENT_ATTACHMENTS_BUCKET = 'document-attachments';
const DOCUMENT_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024; // 50MB

function sanitizeAttachmentFilename(name: string): string {
  const base = name.replace(/^.*[/\\]/, '').slice(0, 120) || 'file';
  return base;
}

/**
 * POST /api/documents/[documentId]/upload-asset
 * Body: multipart/form-data with field "files" (one or more image/files).
 * Query: workspaceId (required) — used for storage path and RLS.
 * Returns: { data: [{ src: string }, ...] } for GrapesJS Asset Manager.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Missing workspaceId query parameter' },
      { status: 400 }
    );
  }

  const resolvedWorkspaceId = request.headers.get("x-workspace-id");
  if (resolvedWorkspaceId && resolvedWorkspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Workspace mismatch for current domain context" },
      { status: 403 }
    );
  }

  const { data: documentRow, error: documentError } = await supabase
    .from("documents")
    .select("workspace_id")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError || !documentRow) {
    return NextResponse.json(
      { error: "Document not found or inaccessible" },
      { status: 404 }
    );
  }

  if (documentRow.workspace_id !== workspaceId) {
    return NextResponse.json(
      { error: "Document does not belong to the provided workspace" },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid form data' },
      { status: 400 }
    );
  }

  // Accept files from "files", "file", or any form field (GrapesJS may use different keys)
  let toUpload: File[] = [];
  const filesField = formData.getAll('files');
  if (filesField.length > 0) {
    toUpload = (Array.isArray(filesField) ? filesField : [filesField]).filter(
      (f): f is File => f instanceof File
    );
  }
  if (toUpload.length === 0) {
    const fileField = formData.get('file');
    if (fileField instanceof File) toUpload = [fileField];
  }
  if (toUpload.length === 0) {
    for (const [, value] of formData.entries()) {
      if (value instanceof File) toUpload.push(value);
    }
  }
  if (toUpload.length === 0) {
    return NextResponse.json(
      { error: 'No file found in request. Use form field "files" or "file".' },
      { status: 400 }
    );
  }

  const data: { src: string }[] = [];

  for (const file of toUpload) {
    if (file.size > DOCUMENT_ATTACHMENT_MAX_BYTES) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 50MB limit` },
        { status: 400 }
      );
    }
    const safeName = sanitizeAttachmentFilename(file.name);
    const path = `${workspaceId}/${documentId}/${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from(DOCUMENT_ATTACHMENTS_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Upload failed' },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(DOCUMENT_ATTACHMENTS_BUCKET).getPublicUrl(path);
    data.push({ src: publicUrl });
  }

  return NextResponse.json({ data });
}
