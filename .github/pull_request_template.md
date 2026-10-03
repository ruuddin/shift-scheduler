## What


## Verification
<!-- How was this tested? Preview URL, manual steps, automated checks -->

- [ ] `npm run lint` clean
- [ ] `next build` clean
- [ ] Tested on the Vercel preview deployment

## Code review checklist
<!-- Reviewer: confirm each before merging -->

- [ ] **Team scoping** — every DB read/write uses the active team (`getActiveTeam()`), not metadata `team_id` or unfiltered queries
- [ ] **Authorization** — role checks use the employee row on the active team, not global `user_metadata.role`
- [ ] **Event tracking** — user-facing actions call `logEventAction()` with the right `event_type`
- [ ] **Guide** — user-facing features add/update a `/guide/*` page; docs tests cover it
- [ ] **Device-friendly** — layouts verified at 390px width, no horizontal overflow
- [ ] **Preview mode** — still works with no Supabase keys (no hard crash on missing env)
- [ ] **Secrets** — no keys, tokens, or credentials in code (security test scans for this)
- [ ] **ADR impact** — if this changes architecture, update `docs/ADR-001-architecture.md` (or add a new ADR)
