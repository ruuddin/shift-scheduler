# Feature Checklist — Non-Functional Requirements

Every functional feature ships with these. This is the contract — if a PR
can't tick every box, it doesn't merge.

## Process
- [ ] Feature branch → PR → green `build` → merge (main is protected, no direct pushes)
- [ ] Preview URL shared after the build
- [ ] Release branch auto-cut verified (workflow handles this; confirm the branch exists)

## Quality gates
- [ ] `npm run lint` clean (includes `eslint-plugin-security` SAST)
- [ ] `next build` clean
- [ ] Nightly suite updated if behavior changed (`test:nightly`: smoke + load + docs + security + api)
- [ ] Code review checklist on the PR template completed

## Product
- [ ] **Device-friendly**: verified at 390px width, no horizontal overflow, matches wireframes
- [ ] **Guide page**: every user-facing feature gets its own step-by-step `/guide/*` page
- [ ] **Docs tests**: the new guide is covered by `tests/docs/run.js`
- [ ] **Event tracking**: user-facing actions call `logEventAction()` with the right `event_type`
- [ ] **Admin portal**: updated if the feature touches admin-visible data or permissions
- [ ] **Preview mode**: app still works with no Supabase keys (graceful demo fallback, no hard crash)

## Security & data
- [ ] **Team scoping**: every DB read/write uses the active team (`getActiveTeam()`), never unfiltered queries
- [ ] **Authorization**: role checks use the employee row on the active team, not global `user_metadata.role`
- [ ] **Secrets**: no keys, tokens, or credentials in code (nightly secret scan enforces)
- [ ] **Auth gates**: new pages are gated appropriately (manager-only vs signed-in vs public)

## Architecture
- [ ] **ADR impact**: if the change alters architecture, update `docs/ADR-001-architecture.md` or add a new ADR

## History
- [ ] Change recorded in the dated change-history doc for that day (`~/workspace/your_files/shift-scheduler-changes-<date>/`)
