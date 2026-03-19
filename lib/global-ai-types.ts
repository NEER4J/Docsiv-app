/**
 * Global AI context types: page detection and context sources so the AI assistant
 * knows where the user is and what it can do (Konva edit, Plate, Univer, or general page help).
 */

export type DocumentEditorSubType =
  | 'konva-report'
  | 'konva-presentation'
  | 'plate'
  | 'univer'
  | 'grapes'
  | null;

export type GlobalAiPageType =
  | 'dashboard-home'
  | 'documents'
  | 'document-detail'
  | 'document-editor'
  | 'shared'
  | 'notifications'
  | 'clients'
  | 'client-detail'
  | 'teams'
  | 'templates'
  | 'analytics'
  | 'integrations'
  | 'settings'
  | 'unknown';

export interface GlobalAiPageContext {
  pathname: string;
  pageType: GlobalAiPageType;
  /** Only set when we're on /d/[id] and the editor has registered its type */
  documentEditorSubType: DocumentEditorSubType;
  /** Optional: document id when on /d/[id] */
  documentId: string | null;
  /** Optional: client id when on /dashboard/clients/[id] */
  clientId: string | null;
}

export interface GlobalAiContextValue extends GlobalAiPageContext {
  /** Set from document editor when it mounts; call with null when unmounting or switching type */
  setDocumentEditorSubType: (subType: DocumentEditorSubType) => void;
  /** Optional: set extra page context (e.g. entity ids) for future use */
  setPageContext: (ctx: Partial<Pick<GlobalAiPageContext, 'documentId' | 'clientId'>>) => void;
}

/**
 * Derive page type from pathname (dashboard and /d routes).
 */
export function getPageTypeFromPathname(pathname: string): Omit<GlobalAiPageContext, 'documentEditorSubType'> {
  if (!pathname || typeof pathname !== 'string') {
    return { pathname: '', pageType: 'unknown', documentId: null, clientId: null };
  }

  // Document editor: /d or /d/[id]
  if (pathname.startsWith('/d')) {
    const rest = pathname.slice(2).replace(/^\/+/, '');
    const segments = rest ? rest.split('/') : [];
    const documentId = segments[0] ?? null;
    return {
      pathname,
      pageType: documentId ? 'document-editor' : 'document-editor',
      documentId: documentId || null,
      clientId: null,
    };
  }

  // Dashboard
  if (pathname.startsWith('/dashboard')) {
    const rest = pathname.slice('/dashboard'.length).replace(/^\/+/, '') || '';
    const segments = rest ? rest.split('/') : [];
    const first = segments[0] ?? '';
    const second = segments[1] ?? '';

    const segmentToPageType: Record<string, GlobalAiPageType> = {
      '': 'dashboard-home',
      documents: 'documents',
      shared: 'shared',
      notifications: 'notifications',
      clients: 'clients',
      teams: 'teams',
      templates: 'templates',
      analytics: 'analytics',
      integrations: 'integrations',
      settings: 'settings',
    };

    let pageType: GlobalAiPageType = segmentToPageType[first] ?? 'unknown';
    let clientId: string | null = null;

    if (first === 'documents' && second) {
      pageType = 'document-detail';
    }
    if (first === 'clients' && second) {
      pageType = 'client-detail';
      clientId = second;
    }

    return {
      pathname,
      pageType,
      documentId: null,
      clientId,
    };
  }

  return { pathname, pageType: 'unknown', documentId: null, clientId: null };
}

/**
 * Human-readable label for each page type (for AI panel placeholder and prompts).
 */
export const GLOBAL_AI_PAGE_LABELS: Record<GlobalAiPageType, string> = {
  'dashboard-home': 'Documents home',
  documents: 'Documents',
  'document-detail': 'Document details',
  'document-editor': 'Document editor',
  shared: 'Shared with me',
  notifications: 'Notifications',
  clients: 'Clients',
  'client-detail': 'Client details',
  teams: 'Team',
  templates: 'Templates',
  analytics: 'Analytics',
  integrations: 'Integrations',
  settings: 'Settings',
  unknown: 'this page',
};
