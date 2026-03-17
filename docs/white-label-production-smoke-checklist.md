# White-Label Production Smoke Checklist

## Domain Routing
- Verify wildcard domain is configured on Vercel for `*.docsiv.com`.
- Verify a workspace handle resolves: `https://{handle}.docsiv.com`.
- Verify unknown custom host redirects to `https://docsiv.com`.
- Verify custom domain resolves only after ownership verification.

## SSL
- Verify subdomain cert is issued automatically by Vercel.
- Verify custom domain cert is issued after verification succeeds.

## Workspace Isolation
- Verify API upload endpoint rejects mismatched `workspaceId`/`documentId`.
- Verify cross-workspace cookie tampering does not expose data in dashboard pages.
- Verify document routes render only for permitted workspace/collaborator access.

## Branding
- Verify workspace logo/name appears in auth flow on workspace domains.
- Verify custom favicon is present in browser tab for workspace domains.
- Verify brand color is applied via `--brand-color` token and primary UI accents.
- Verify shared client portal surfaces do not show Docsiv branding.

## Auth Routes
- Verify canonical routes work: `/login`, `/signup`, `/reset-password`, `/magic-link`.
- Verify legacy routes redirect: `/auth/login`, `/auth/register`, `/auth/reset-password`, `/auth/forgot-password`.

## Custom Domain Lifecycle
- Add domain via settings and confirm status is reflected.
- Verify TXT challenge details are shown when needed.
- Run manual verify action and confirm `domain_verified` state persists.
- Refresh status and confirm local state matches Vercel project domain state.
