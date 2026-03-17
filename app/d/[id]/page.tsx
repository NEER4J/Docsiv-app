import type React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getDocumentById,
  checkDocumentAccess,
  getDocumentForCollaborator,
  resolveDocumentLink,
  getDocumentByToken,
  claimDocumentAccessViaLink,
  recordDocumentView,
  getLinkVerifiedToken,
  findActiveDocumentLink,
} from '@/lib/actions/documents';
import { contentToMetaDescription } from '@/lib/seo';
import { getCurrentUserProfile, getWorkspaceDetails, setWorkspaceCookie } from '@/lib/actions/onboarding';
import { DocumentRoomProvider } from '@/components/platejs/editors/document-room-provider';
import { DocumentEditorView } from './document-editor-view';
import { SharedDocumentView } from './shared-document-view';
import { LinkPasswordGate } from './link-password-gate';
import { ViewerIdentityGate } from './viewer-identity-gate';
import type { DocumentDetail } from '@/types/database';
import { APP_CONFIG } from '@/config/app-config';
import { getCurrentWorkspaceContext } from '@/lib/workspace-context/server';
import { getWorkspaceBrandingForRequest } from '@/lib/workspace-context/branding';
import { headers } from 'next/headers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_OG_IMAGE = '/opengraph.png';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ share?: string }>;
}): Promise<Metadata> {
  const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host") ?? "docsiv.com";
  const metadataBase = new URL(`https://${host.split(":")[0]}`);
  const hostBranding = await getWorkspaceBrandingForRequest();
  const brandName = hostBranding?.name ?? APP_CONFIG.name;
  const { share: shareToken } = await searchParams;

  if (!shareToken) {
    return {
      title: `Document – ${brandName}`,
      description: hostBranding ? `View document in ${brandName}.` : APP_CONFIG.meta.description,
      openGraph: {
        title: `Document – ${brandName}`,
        description: hostBranding ? `View document in ${brandName}.` : APP_CONFIG.meta.description,
        images: [new URL(DEFAULT_OG_IMAGE, metadataBase).toString()],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Document – ${brandName}`,
        description: hostBranding ? `View document in ${brandName}.` : APP_CONFIG.meta.description,
        images: [new URL(DEFAULT_OG_IMAGE, metadataBase).toString()],
      },
    };
  }

  const data = await getDocumentByToken(shareToken);
  if (!data) {
    return {
      title: `Document – ${brandName}`,
      description: hostBranding ? `View document in ${brandName}.` : APP_CONFIG.meta.description,
      openGraph: {
        title: `Document – ${brandName}`,
        description: hostBranding ? `View document in ${brandName}.` : APP_CONFIG.meta.description,
        images: [new URL(DEFAULT_OG_IMAGE, metadataBase).toString()],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Document – ${brandName}`,
        description: hostBranding ? `View document in ${brandName}.` : APP_CONFIG.meta.description,
        images: [new URL(DEFAULT_OG_IMAGE, metadataBase).toString()],
      },
    };
  }

  const { document: doc } = data;
  const title = `${doc.title || 'Untitled'} – ${data.workspace_name || brandName}`;
  const description =
    contentToMetaDescription(doc.content, doc.base_type) ??
    'View this document.';

  const ogImage =
    doc.thumbnail_url && doc.thumbnail_url.startsWith('http')
      ? doc.thumbnail_url
      : doc.thumbnail_url
        ? new URL(doc.thumbnail_url, metadataBase).toString()
        : new URL(DEFAULT_OG_IMAGE, metadataBase).toString();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function DocumentEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const { id } = await params;
  const { share: shareToken } = await searchParams;

  // If the param is not a UUID, it's likely an old share token — resolve and redirect
  if (!UUID_RE.test(id)) {
    const linkInfo = await resolveDocumentLink(id);
    if (linkInfo?.document_id) {
      redirect(`/d/${linkInfo.document_id}?share=${id}`);
    }
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ── Shared link flow (/d/{id}?share={token}) ──
  if (shareToken) {
    return handleSharedAccess(id, shareToken, user);
  }

  // ── Authenticated flow (no share token) ──
  if (!user) {
    // No share token, no user — check if doc has a public link before sending to login
    const activeLink = await findActiveDocumentLink(id);
    if (activeLink && !activeLink.has_password) {
      // Auto-discover public link: show shared view like Coda does
      const data = await getDocumentByToken(activeLink.token);
      if (data) {
        recordDocumentView(activeLink.token).catch(() => {});
        return (
          <DocumentRoomProvider documentId={id} enabled>
            <SharedDocumentView
              document={data.document}
              role={data.role}
              documentId={id}
              shareToken={activeLink.token}
              workspaceName={data.workspace_name}
              workspaceLogoUrl={data.workspace_logo_url}
            />
          </DocumentRoomProvider>
        );
      }
    }
    redirect(`/login?next=${encodeURIComponent(`/d/${id}`)}`);
  }

  // Try authenticated access; if it fails, check for a public link fallback
  const editorView = await handleAuthenticatedAccess(id, user, { fallbackToNull: true });
  if (editorView) return editorView;

  // Fallback: check if doc has an active public link
  const activeLink = await findActiveDocumentLink(id);
  if (activeLink) {
    // Claim access via the discovered link
    await claimDocumentAccessViaLink(activeLink.token);
    // Try again after claiming
    const retryView = await handleAuthenticatedAccess(id, user, { fallbackToNull: true });
    if (retryView) return retryView;

    // Still no access — show shared view with request edit option
    const data = await getDocumentByToken(activeLink.token);
    if (data) {
      recordDocumentView(activeLink.token).catch(() => {});
      return (
        <DocumentRoomProvider documentId={id} enabled>
          <SharedDocumentView
            document={data.document}
            role={data.role}
            documentId={id}
            shareToken={activeLink.token}
            workspaceName={data.workspace_name}
            workspaceLogoUrl={data.workspace_logo_url}
            isAuthenticated
          />
        </DocumentRoomProvider>
      );
    }
  }

  notFound();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared access: /d/{id}?share={token}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleSharedAccess(
  documentId: string,
  token: string,
  user: { id: string; email?: string } | null
) {
  const linkInfo = await resolveDocumentLink(token);
  if (!linkInfo?.document_id || linkInfo.document_id !== documentId) notFound();

  // ── Password gate ──
  if (linkInfo.has_password) {
    const verifiedToken = await getLinkVerifiedToken();
    if (verifiedToken !== token) {
      return <LinkPasswordGate token={token} />;
    }
  }

  if (user) {
    // Logged-in user with share link: claim access (adds as collaborator with link's role)
    await claimDocumentAccessViaLink(token);
    recordDocumentView(token).catch(() => {});
    // Try to render the full editor; fall back to shared view if access check fails
    // (e.g. new user without workspace, claim RPC failed, etc.)
    const editorView = await handleAuthenticatedAccess(documentId, user, { fallbackToNull: true });
    if (editorView) return editorView;

    // Fallback: show shared view with link role (user can still request edit access)
    const data = await getDocumentByToken(token);
    if (!data) notFound();
    return (
      <DocumentRoomProvider documentId={documentId} enabled>
        <SharedDocumentView
          document={data.document}
          role={data.role}
          documentId={documentId}
          shareToken={token}
          workspaceName={data.workspace_name}
          workspaceLogoUrl={data.workspace_logo_url}
          isAuthenticated
        />
      </DocumentRoomProvider>
    );
  }

  // ── Identity gate (anonymous only) ──
  if (linkInfo.require_identity) {
    const cookieStore = await cookies();
    const hasIdentity = cookieStore.get(`viewer_identity_${token}`)?.value;
    if (!hasIdentity) {
      // We need doc title + workspace name for the gate UI
      const data = await getDocumentByToken(token);
      return (
        <ViewerIdentityGate
          token={token}
          workspaceName={data?.workspace_name}
          documentTitle={data?.document?.title}
        />
      );
    }
  }

  // Anonymous user — show read-only shared view (they join presence as "Anonymous")
  const data = await getDocumentByToken(token);
  if (!data) notFound();

  recordDocumentView(token).catch(() => {});

  return (
    <DocumentRoomProvider documentId={documentId} enabled>
      <SharedDocumentView
        document={data.document}
        role={data.role}
        documentId={documentId}
        shareToken={token}
        workspaceName={data.workspace_name}
        workspaceLogoUrl={data.workspace_logo_url}
      />
    </DocumentRoomProvider>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Authenticated access: /d/{id} (no share token)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleAuthenticatedAccess(
  id: string,
  user: { id: string; email?: string },
  options?: { fallbackToNull?: boolean }
): Promise<React.ReactElement | null> {
  const context = await getCurrentWorkspaceContext();
  const workspaceId = context.workspaceId;
  const currentUserId = user.id;

  // Path 1: Try workspace-based access
  if (workspaceId) {
    const [{ profile }, { document, error }, { workspace }] = await Promise.all([
      getCurrentUserProfile(),
      getDocumentById(workspaceId, id),
      getWorkspaceDetails(workspaceId),
    ]);

    if (!error && document) {
      const currentUserDisplay = profile
        ? {
            name: [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || 'You',
            email: user.email ?? undefined,
            avatarUrl: profile.avatar_url ?? null,
          }
        : undefined;

      // Keep workspace cookie in sync so sidebar and nav show the doc's workspace
      await setWorkspaceCookie(workspaceId).catch(() => {});

      return (
        <DocumentRoomProvider
          documentId={document.id}
          currentUserId={currentUserId}
          currentUserDisplay={currentUserDisplay}
          enabled
        >
          <DocumentEditorView
            document={document}
            workspaceId={workspaceId}
            workspaceName={workspace?.name ?? undefined}
            workspaceHandle={workspace?.handle ?? undefined}
            currentUserId={currentUserId}
            currentUserDisplay={currentUserDisplay}
            role="edit"
          />
        </DocumentRoomProvider>
      );
    }
  }

  // Path 2: Collaborator or workspace-member fallback (e.g. when workspace cookie is missing, e.g. on mobile)
  const access = await checkDocumentAccess(id);
  if (!access.role || !access.accessType) {
    if (options?.fallbackToNull) return null;
    return notFound();
  }

  const { profile } = await getCurrentUserProfile();
  const currentUserDisplay = profile
    ? {
        name: [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || 'You',
        email: user.email ?? undefined,
        avatarUrl: profile.avatar_url ?? null,
      }
    : undefined;

  let document: DocumentDetail;
  let workspaceName: string | undefined;
  let workspaceHandle: string | undefined;

  if (access.accessType === 'workspace_member' && access.workspaceId) {
    const [{ document: wsDoc, error: wsError }, { workspace }] = await Promise.all([
      getDocumentById(access.workspaceId, id),
      getWorkspaceDetails(access.workspaceId),
    ]);
    if (wsError || !wsDoc) {
      if (options?.fallbackToNull) return null;
      return notFound();
    }
    document = wsDoc;
    workspaceName = workspace?.name;
    workspaceHandle = workspace?.handle;
  } else {
    const { document: collabDoc, error: collabError } = await getDocumentForCollaborator(id);
    if (collabError || !collabDoc) {
      if (options?.fallbackToNull) return null;
      return notFound();
    }
    document = {
      id: collabDoc.id,
      title: collabDoc.title,
      status: collabDoc.status as DocumentDetail['status'],
      base_type: collabDoc.base_type as DocumentDetail['base_type'],
      document_type_id: collabDoc.document_type_id,
      document_type: collabDoc.document_type,
      client_id: collabDoc.client_id,
      client_name: collabDoc.client_name,
      content: collabDoc.content as DocumentDetail['content'],
      thumbnail_url: collabDoc.thumbnail_url,
      created_by: collabDoc.created_by,
      last_modified_by: collabDoc.last_modified_by,
      created_at: collabDoc.created_at,
      updated_at: collabDoc.updated_at,
    };
    workspaceName = collabDoc.workspace_name;
    workspaceHandle = collabDoc.workspace_handle;
  }

  const role = access.role ?? 'view';
  const readOnly = role !== 'edit';
  const docWorkspaceId = access.workspaceId ?? '';

  // When opening a doc via link/collaborator, set workspace cookie so sidebar matches (if user is member)
  if (docWorkspaceId) {
    await setWorkspaceCookie(docWorkspaceId).catch(() => {});
  }

  return (
    <DocumentRoomProvider
      documentId={document.id}
      currentUserId={currentUserId}
      currentUserDisplay={currentUserDisplay}
      enabled
    >
      <DocumentEditorView
        document={document}
        workspaceId={docWorkspaceId}
        workspaceName={workspaceName}
        workspaceHandle={workspaceHandle}
        currentUserId={currentUserId}
        currentUserDisplay={currentUserDisplay}
        readOnly={readOnly}
        role={role}
      />
    </DocumentRoomProvider>
  );
}
