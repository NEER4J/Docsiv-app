export type UserTheme = "light" | "dark";
export type WorkspacePlan = "free" | "pro" | "agency";
export type WorkspaceMemberRole = "owner" | "admin" | "member";

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
