# Admin minimal refactor plan (audit-only — DO NOT IMPLEMENT)

Order: lowest risk first.

1. **Documentation & IA labels** — Rename sidebar sections to match target: "Crypto Operations" vs "Forex Operations" vs "Control Plane" (nav-sections.ts only; no route moves).
2. **RBAC visibility** — Document per-page required permissions in admin-panel (no backend change).
3. **Forex admin honesty pass** — Ensure LP/REAL_FOREX panels show NOT_CONFIGURED (UI copy only if gaps found).
4. **Navigation grouping** — Move Forex groups under single top-level without duplicating Crypto Trading links.
5. **Permission re-scope** — Split coarse `/forex` write rule only after automated RBAC regression tests exist.
6. **Shared user profile** — Clarify Crypto vs Forex tabs on `/users/[id]` (scope labels).
7. **Certification** — Run admin RBAC IDOR suite + forex-admin-ui-e2e after any structural change.

**Never in first waves:** admin.fastify.ts finance routes, admin-spot, mm-control, matching-engine, spot.fastify.ts.
