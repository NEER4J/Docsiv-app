export type UserTheme = "light" | "dark";
export type WorkspacePlan = "free" | "pro" | "agency";
export type WorkspaceMemberRole = "owner" | "admin" | "member" | "client";

export interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  theme: UserTheme | null;
  subscribed_to_updates: boolean;
  onboarding_completed: boolean;
  team_size: string | null;
  preferred_doc_types: string[] | null;
  hear_about_us: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  handle: string;
  logo_url: string | null;
  favicon_url: string | null;
  tagline: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  business_address: string | null;
  terms_url: string | null;
  privacy_url: string | null;
  brand_color: string | null;
  brand_font: string | null;
  social_linkedin: string | null;
  social_twitter: string | null;
  social_instagram: string | null;
  default_currency: string | null;
  default_language: string | null;
  custom_domain: string | null;
  domain_verified: boolean;
  custom_domain_verified_at: string | null;
  hide_docsiv_branding: boolean;
  custom_email_from: string | null;
  plan: WorkspacePlan;
  billing_country: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  invited_at: string;
  joined_at: string | null;
}

// ── Document Types (global catalogue) ────────────────────────────────────────

export interface DocumentType {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  bg_color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// ── Clients ───────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClientWithDocCount extends Omit<Client, "notes"> {
  doc_count: number;
}

// ── Documents ─────────────────────────────────────────────────────────────────

export type DocumentBaseType = "doc" | "sheet" | "presentation" | "contract";

export type DocumentStatus =
  | "draft"
  | "sent"
  | "open"
  | "accepted"
  | "declined"
  | "commented"
  | "signed"
  | "archived";

export interface Document {
  id: string;
  workspace_id: string;
  client_id: string | null;
  document_type_id: string | null;
  base_type: DocumentBaseType;
  title: string;
  status: DocumentStatus;
  content: Record<string, unknown> | null;
  thumbnail_url: string | null;
  created_by: string;
  last_modified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  status: DocumentStatus;
  base_type: DocumentBaseType;
  document_type_id: string | null;
  document_type: Pick<
    DocumentType,
    "name" | "slug" | "color" | "bg_color" | "icon"
  > | null;
  client_id: string | null;
  client_name: string | null;
  thumbnail_url: string | null;
  /** First page / first area HTML for card preview (GrapesJS docs); optional until migration applied */
  preview_html?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface DocumentDetail extends DocumentListItem {
  content: Record<string, unknown> | null;
  created_by: string;
  last_modified_by: string | null;
  require_signature?: boolean;
}
