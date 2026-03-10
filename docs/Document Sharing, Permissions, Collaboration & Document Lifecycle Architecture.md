# Docsiv – Document Sharing, Permissions, Collaboration & Document Lifecycle Architecture

## 1. Purpose

This document defines the **complete architecture for document access, collaboration, sharing, analytics, and lifecycle management** in Docsiv.

Docsiv is designed to be a **document hub for agencies**, where teams create, collaborate on, and deliver client-facing documents such as proposals, reports, contracts, briefs, and decks.

The system must support:

* secure sharing
* internal collaboration
* external client viewing
* live editing
* analytics tracking
* document lifecycle management
* marketing-driven viewer conversion

---

# 2. Core System Entities

Docsiv revolves around these core objects.

```
Workspace
Users
Clients
Documents
Share Links
Permissions
Invitations
Editing Sessions
```

Supporting relations:

```
Workspace Members
Document Permissions
Document Activity
Document Versions
```

---

# 3. URL Structure

Docsiv must maintain **stable document URLs**. URLs must not break if documents move between clients or folders.

## Application URLs

```
app.docsiv.com/dashboard
app.docsiv.com/clients
app.docsiv.com/templates
```

---

## Document Editing URL

```
app.docsiv.com/d/{documentId}
```

Example:

```
app.docsiv.com/d/8sk2Lm92
```

Used by authenticated users inside the application.

---

## Shared Document View

```
docsiv.com/view/{token}
```

Example:

```
docsiv.com/view/k39sd92ks
```

Used when documents are shared externally.

---

## Invitation Link

```
docsiv.com/invite/{inviteToken}
```

Used for accepting invitations to documents or workspaces.

---

## Public Document URL

```
docsiv.com/p/{documentId}
```

Used for documents intentionally made public.

---

# 4. Permission Model

Access can be granted through four mechanisms.

```
Workspace membership
Document-level permissions
Share links
Public visibility
```

---

## Workspace Roles

```
Owner
Admin
Member
```

| Role   | Capabilities               |
| ------ | -------------------------- |
| Owner  | full workspace control     |
| Admin  | manage members & documents |
| Member | create and edit documents  |

---

## Document Roles

```
Owner
Editor
Commenter
Viewer
```

| Role      | Capabilities          |
| --------- | --------------------- |
| Owner     | full document control |
| Editor    | edit document         |
| Commenter | comment on document   |
| Viewer    | read-only access      |

---

# 5. Permission Resolution Logic

When someone opens a document, the system evaluates permissions in the following order:

```
1. Workspace owner/admin → full access
2. Document permissions → assigned role
3. Workspace visibility → viewer
4. Share link token valid → role defined by link
5. Public visibility → viewer
6. Otherwise → deny access
```

All permission checks must run **server-side**.

---

# 6. Share Link Flow

When a user clicks **Share → Copy Link**, the system generates a share token.

Table:

```
share_links
-----------
document_id
token
role
expires_at
password
created_by
```

Example link:

```
docsiv.com/view/82ks9d2
```

Server validates the token before returning the document.

---

# 7. Email Invitation Flow

## Invite Existing User

If the email belongs to a registered user:

```
document_permissions record created
notification email sent
```

The document appears in:

```
Shared with me
```

---

## Invite Non-Existing User

If the email is not registered:

```
create invitation record
send invite email
```

Table:

```
invitations
-----------
email
document_id
role
token
expires_at
```

User flow:

```
open invite link
create account
accept invite
permissions applied
```

---

# 8. External Viewer Marketing Opportunities

When external users view shared documents, Docsiv should promote adoption.

### Footer Banner

```
This document was created with Docsiv
Create your own documents →
```

### Editing Attempt

If a viewer tries to edit or comment:

```
Create a free Docsiv account to collaborate
```

### Share Prompt

```
Want to create documents like this?
Start using Docsiv
```

These interactions convert document viewers into users.

---

# 9. Real-Time Collaboration

Docsiv supports **live collaborative editing**.

---

## Editing Sessions

Table:

```
editing_sessions
----------------
document_id
user_id
cursor_position
last_active
```

When a user opens a document, they join a session.

---

## Live Presence UI

The UI should display:

```
active editor avatars
cursor indicators
selection highlights
```

Example:

```
Neeraj editing
John viewing
Sarah commenting
```

---

## Cursor Indicators

Each user has:

```
unique cursor color
name label
live cursor movement
```

---

# 10. UI Components for Collaboration

## Document Header

Displays:

```
document title
share button
editor avatars
last saved indicator
```

Example:

```
Q2 Marketing Proposal
Neeraj • John • Sarah editing
Saved just now
```

---

## Active Editors

Top-right section shows:

```
[Avatar] Neeraj
[Avatar] John
+2 others
```

---

## Comments Sidebar

Features:

```
threaded comments
mentions (@user)
resolve comments
```

---

## Version History

Users can:

```
view previous versions
restore earlier versions
see who edited
```

---

# 11. Document Lifecycle States

Documents maintain status indicators.

```
Draft
Shared
Viewed
Commented
Approved
Archived
```

These states help agencies track client engagement.

---

# 12. Viewer Analytics

Docsiv should track how clients interact with documents.

Metrics include:

```
document opened
unique viewers
time spent
sections viewed
last viewed timestamp
```

Example insights:

```
Client opened proposal
3 viewers from company
Pricing section viewed
Total reading time 4m
```

Analytics helps agencies understand **client engagement and interest**.

---

# 13. Document Activity Log

Every document should maintain a **complete activity history**.

Table:

```
document_activity
-----------------
document_id
user_id
action
timestamp
```

Actions tracked:

```
document created
edited
shared
comment added
viewed
exported
permissions changed
```

UI should include an **Activity panel** showing recent actions.

---

# 14. Document Duplication

Agencies frequently reuse documents.

Example:

```
Duplicate proposal
→ customize for new client
```

Implementation:

```
clone document
copy content blocks
generate new document ID
assign new owner
```

Duplicated documents should not inherit old share links or analytics.

---

# 15. Conflict Resolution

When multiple users edit simultaneously, conflicts may occur.

Potential scenarios:

```
two users editing same block
simultaneous changes
network latency conflicts
```

Possible strategies:

### Operational Transform (OT)

Used by many collaborative editors.

```
merge edits intelligently
maintain document consistency
```

### CRDT (Conflict-free Replicated Data Type)

```
decentralized collaboration model
good for offline editing
```

### Fallback Strategy

```
last-write-wins
```

Even if the initial system is simpler, the architecture should allow advanced conflict resolution later.

---

# 16. Edge Cases

## Owner Leaves Workspace

Ownership transfers to workspace owner.

---

## Share Link Revoked

Deleting the share link record immediately disables access.

---

## Link Expiration

If

```
expires_at < current_time
```

Access denied.

---

## User Removed From Workspace

Removing the workspace membership revokes access to all workspace documents.

---

## User Removed From Document

Deleting the permission record removes access.

---

# 17. Security Principles

All access checks must occur **server-side**.

Server must validate:

```
authentication
workspace membership
document permissions
share link tokens
```

Frontend must never control security decisions.

---

# 18. Initial Implementation Scope

For the first release, Docsiv should support:

```
workspace members
share link viewer access
email invites
basic collaboration presence
viewer analytics
document duplication
activity logging
```

Advanced capabilities can be added later.

---

# 19. Product Vision

Docsiv is designed as **document infrastructure for agencies**.

The platform enables teams to:

```
create documents
collaborate in real time
deliver documents to clients
track engagement
store and manage all documents in one hub
```

A robust permission, collaboration, and analytics architecture ensures Docsiv scales as agencies manage **all client-facing documentation in a single platform**.
