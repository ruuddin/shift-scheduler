# Security Review Queue

Created 2026-10-04. Trigger: a perceived gap (database row IDs exposed in API
responses/URLs) turned out to be already covered — every table uses UUIDv4
primary keys, enforced by a nightly check (`tests/security/run.js`). The fact
that the gap was *perceived but unverified* means our security coverage has
unknown unknowns. This queue lists the specs that call for this class of
coverage, to be reviewed one at a time, latest first.

## Already covered (nightly suite)
- Security headers, HSTS, X-Powered-By
- Auth gates on every protected page (anonymous → redirect)
- npm audit (no high/critical)
- Secret scan of the repo
- eslint-plugin-security SAST on every PR (required CI check)
- All database IDs are UUIDs (no sequential row IDs) — added 2026-10-04

## Queued specs

### 1. OWASP API Security Top 10 (2023 edition) — QUEUED
The spec for exactly this risk class.
- **API1:2023 — Broken Object Level Authorization (BOLA/IDOR):** every
  endpoint taking an object ID must verify the caller may access *that*
  object. Maps to: every server action accepting a team/org/announcement/
  flag id (`app/*-actions.ts`, `lib/*`).
- **API5:2023 — Broken Function Level Authorization:** admin functions
  reachable by non-admins. Maps to: the new `lib/owner.ts` gate, org-manager
  gates, and every `requireOwner`/`requireOrgManagerForActiveTeam` call site.
- Review: enumerate every id-accepting action, confirm the authorization
  check, record gaps.

### 2. OWASP Top 10 (2021 edition) — QUEUED
- **A01:2021 — Broken Access Control:** RLS policies vs. app-level gates —
  verify they agree (e.g. the `announcements_write` argument-order bug caught
  2026-10-04 is this class). Check every `pg_policies` entry against its
  intended rule.
- **A07:2021 — Identification and Authentication Failures:** Supabase Auth
  session handling, cookie settings (`active_team_id`), invite-link
  unguessability.
- Review after the API Top 10; overlaps are fine.

### 3. OWASP ASVS 4.0 (Application Security Verification Standard) — QUEUED
The systematic checklist version of the above. Relevant chapters:
- **V4 — Access Control** (4.1 general, 4.2 operation-level)
- **V2 — Authentication** (2.1 password security — N/A while Supabase
  handles it, 2.2 general authenticator, 2.8 single sign-on)
- **V13 — API and Web Service** (13.1 generic, 13.2 REST)
- Review: walk chapters V4/V13 against the codebase; file findings here.

### 4. CWE entries — QUEUED (reference during the above)
- **CWE-639** — Authorization Bypass Through User-Controlled Key (the
  formal IDOR definition; grep pattern for reviews)
- **CWE-200** — Exposure of Sensitive Information to an Unauthorized Actor
  (what gets returned in action responses beyond IDs: emails, metadata)

## How a review gets done
1. Pick the top queued spec.
2. Work through its items against the codebase; record date + findings below.
3. Every finding becomes a tracked fix (branch → PR → merge) or a documented
   accepted risk with rationale.
4. Move the spec to "Reviewed" with the date.

## Review log
- *(none yet)*
