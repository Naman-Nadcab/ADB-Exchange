# MOB-001B — Complete Screen Specifications

**Surfaces:** 194 | **Status:** FROZEN | **Backend:** 0098864

---

## S-000 — Splash

| Field | Specification |
|-------|---------------|
| **Purpose** | Brand load while app initializes. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish splash without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Logo + spinner |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_000 |
| **Deep Link** | None |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | fade |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-001 — App Update Required

| Field | Specification |
|-------|---------------|
| **Purpose** | Force upgrade block. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish app update required without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_001 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Open App Store |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-002 — Maintenance Mode

| Field | Specification |
|-------|---------------|
| **Purpose** | Inform maintenance. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish maintenance mode without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | GET /health |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_002 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Check status |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-003 — Network Offline Gate

| Field | Specification |
|-------|---------------|
| **Purpose** | Explain offline. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish network offline gate without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_003 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Retry |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-004 — Geo Sanctions Blocked

| Field | Specification |
|-------|---------------|
| **Purpose** | Compliance block. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish geo sanctions blocked without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /public/compliance-policy |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_004 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-005 — Account Restricted

| Field | Specification |
|-------|---------------|
| **Purpose** | Limited account UX. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish account restricted without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/risk-status |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | AuthRequired |
| **Analytics** | screen_view_s_005 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-006 — Trading Halt Banner

| Field | Specification |
|-------|---------------|
| **Purpose** | Inline halt on Trade. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish trading halt banner without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /spot/metrics |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_006 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | none |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-007 — Rate Limited

| Field | Specification |
|-------|---------------|
| **Purpose** | 429 cooldown. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish rate limited without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_007 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Retry later |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## O-001 — Global Loading Overlay

| Field | Specification |
|-------|---------------|
| **Purpose** | Block during critical ops. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish global loading overlay without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_o_001 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## T-001 — Global Toast Queue

| Field | Specification |
|-------|---------------|
| **Purpose** | Transient feedback. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish global toast queue without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_t_001 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-001 — Generic Error Alert

| Field | Specification |
|-------|---------------|
| **Purpose** | Modal error. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish generic error alert without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_001 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-002 — Session Expired

| Field | Specification |
|-------|---------------|
| **Purpose** | Force re-login. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish session expired without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Clear tokens |
| **Analytics** | screen_view_d_002 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-003 — Concurrent Session Warning

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes concurrent session warning flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish concurrent session warning without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_003 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Logout other devices |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-004 — Logout Confirmation

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes logout confirmation flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish logout confirmation without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_004 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Logout |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-005 — Discard Unsaved Form

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes discard unsaved form flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish discard unsaved form without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_005 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Discard |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-001 — Global Search

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes global search flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish global search without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /spot/markets |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_001 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | 300ms debounce |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-002 — Quick Actions

| Field | Specification |
|-------|---------------|
| **Purpose** | Deposit withdraw transfer shortcuts. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish quick actions without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_002 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-100 — Welcome

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes welcome flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish welcome without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_100 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-101 — Login Method Chooser

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes login method chooser flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish login method chooser without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_101 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-102 — Login Email Phone

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes login email phone flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish login email phone without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_102 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-103 — Login Password

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes login password flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish login password without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_103 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-104 — Login OTP

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes login otp flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish login otp without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_104 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-105 — Login Passkey

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes login passkey flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish login passkey without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_105 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-106 — Signup Email Phone

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes signup email phone flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish signup email phone without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_106 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-107 — Signup OTP

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes signup otp flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish signup otp without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_107 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-108 — Signup Password

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes signup password flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish signup password without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_108 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-109 — Signup Referral

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes signup referral flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish signup referral without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_109 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-110 — Forgot Password Request

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes forgot password request flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish forgot password request without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_110 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-111 — Forgot Password OTP

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes forgot password otp flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish forgot password otp without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_111 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-112 — Forgot Password New

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes forgot password new flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish forgot password new without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_112 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-113 — OAuth Google

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes oauth google flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish oauth google without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_113 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-114 — OAuth Apple

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes oauth apple flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish oauth apple without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_114 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-115 — OAuth Callback

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes oauth callback flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish oauth callback without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_115 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-100 — Captcha

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes captcha flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish captcha without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /auth/captcha-config |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_100 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | modal |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-110 — Terms Acceptance

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes terms acceptance flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish terms acceptance without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_110 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Agree |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## W-100 — Post Signup 2FA Nudge

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes post signup 2fa nudge flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish post signup 2fa nudge without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Skip or S-712 |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_w_100 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## W-200 — Onboarding Carousel

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes onboarding carousel flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish onboarding carousel without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_w_200 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | horizontal paging |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-120 — Enable Biometrics

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes enable biometrics flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish enable biometrics without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | Biometrics |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_120 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-121 — Enable Push

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes enable push flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish enable push without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /push/subscribe |
| **Permissions** | Notifications |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_121 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-122 — KYC Prompt

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes kyc prompt flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish kyc prompt without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | S-730 or skip |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_122 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-123 — PIN App Lock Fallback

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes pin app lock fallback flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish pin app lock fallback without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Local PIN |
| **Analytics** | screen_view_s_123 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-120 — Complete Verification Prompt

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes complete verification prompt flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish complete verification prompt without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | S-730 |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_120 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-200 — Markets Home

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes markets home flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish markets home without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | GET /spot/markets,/tickers |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_200 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | Yes |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | tabs |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-201 — Market Search

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes market search flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish market search without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_201 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | instant |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-202 — Pair Detail

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes pair detail flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish pair detail without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | S-300 |
| **APIs** | /spot/ticker/:symbol |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_202 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Trade |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-200 — Add Favorite

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes add favorite flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish add favorite without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | AsyncStorage |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_200 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-200 — Sort Filter Markets

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes sort filter markets flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish sort filter markets without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_200 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | volume,change,name |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-201 — Quote Currency Selector

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes quote currency selector flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish quote currency selector without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_201 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-300 — Spot Trading Terminal

| Field | Specification |
|-------|---------------|
| **Purpose** | Execute spot orders. |
| **Business Goal** | Trading volume. |
| **User Goal** | Accomplish spot trading terminal without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | GET /spot/* POST /spot/order WS |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_300 |
| **Deep Link** | metheorium://trade/{symbol} |
| **Push Target** | fill→S-404 |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Place Order |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Pair side draft qty |
| **App Resume** | WS reconnect |

## S-301 — Pair Selector

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes pair selector flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish pair selector without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_301 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-302 — Chart Fullscreen

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes chart fullscreen flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish chart fullscreen without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_302 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-303 — Orderbook Fullscreen

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes orderbook fullscreen flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish orderbook fullscreen without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_303 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-304 — Recent Trades Fullscreen

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes recent trades fullscreen flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish recent trades fullscreen without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_304 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-300 — Order Type Selector

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes order type selector flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish order type selector without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_300 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-301 — Order Confirmation

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes order confirmation flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish order confirmation without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_301 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Confirm |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-302 — Leverage Margin Hidden

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes leverage margin hidden flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish leverage margin hidden without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | Not available |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_302 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-300 — Insufficient Balance

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes insufficient balance flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish insufficient balance without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_300 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Transfer |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-301 — Trading Halted Symbol

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes trading halted symbol flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish trading halted symbol without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_301 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-302 — Order Placed Success

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes order placed success flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish order placed success without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_302 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-300 — Cancel Order Confirm

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes cancel order confirm flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish cancel order confirm without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_300 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-301 — Cancel All Confirm

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes cancel all confirm flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish cancel all confirm without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_301 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## T-300 — Order Fill Toast

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes order fill toast flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish order fill toast without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_t_300 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | live region |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## O-300 — Placing Order Overlay

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes placing order overlay flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish placing order overlay without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_o_300 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-400 — Orders Hub

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes orders hub flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish orders hub without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /spot/*orders* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_400 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | Yes |
| **Infinite Scroll** | Yes |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-401 — Spot Open Orders

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes spot open orders flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish spot open orders without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /spot/*orders* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_401 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | Yes |
| **Infinite Scroll** | Yes |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-402 — Spot Order History

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes spot order history flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish spot order history without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /spot/*orders* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_402 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | Yes |
| **Infinite Scroll** | Yes |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-403 — Trade History

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes trade history flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish trade history without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /spot/*orders* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_403 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | Yes |
| **Infinite Scroll** | Yes |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-404 — Order Detail

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes order detail flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish order detail without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /spot/*orders* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_404 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | Yes |
| **Infinite Scroll** | Yes |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-400 — Orders Filter

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes orders filter flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish orders filter without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_400 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | pair side date |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-400 — Cancel From List

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes cancel from list flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish cancel from list without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_400 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-500 — Wallet Overview

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes wallet overview flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish wallet overview without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_500 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-501 — Asset Detail

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes asset detail flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish asset detail without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_501 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-502 — Funding Account

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes funding account flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish funding account without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_502 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-503 — Spot Account

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes spot account flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish spot account without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_503 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-504 — Trading Account

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes trading account flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish trading account without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_504 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-505 — PnL Summary

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes pnl summary flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish pnl summary without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_505 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-510 — Deposit Select Asset

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes deposit select asset flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish deposit select asset without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_510 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-511 — Deposit Select Network

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes deposit select network flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish deposit select network without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_511 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-512 — Deposit Address QR

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes deposit address qr flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish deposit address qr without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Clipboard clear 60s |
| **Analytics** | screen_view_s_512 |
| **Deep Link** | wallet/deposit/{symbol} |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | Address+memo |
| **Share** | Yes |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-513 — Deposit History

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes deposit history flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish deposit history without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_513 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-514 — Deposit Detail

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes deposit detail flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish deposit detail without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_514 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-520 — Withdraw Select Asset

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes withdraw select asset flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish withdraw select asset without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_520 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-521 — Withdraw Crypto Form

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes withdraw crypto form flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish withdraw crypto form without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_521 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-522 — Withdraw Crypto Confirm

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes withdraw crypto confirm flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish withdraw crypto confirm without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_522 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-523 — Withdraw INR Form

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes withdraw inr form flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish withdraw inr form without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_523 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-524 — Withdraw INR Confirm

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes withdraw inr confirm flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish withdraw inr confirm without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_524 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-525 — Withdrawal Detail

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes withdrawal detail flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish withdrawal detail without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_525 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-526 — Withdrawal History

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes withdrawal history flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish withdrawal history without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_526 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-530 — Transfer Accounts

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes transfer accounts flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish transfer accounts without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_530 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-531 — Transfer Confirm

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes transfer confirm flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish transfer confirm without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_531 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-532 — Transfer History

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes transfer history flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish transfer history without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_532 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-540 — Convert Pair Selector

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes convert pair selector flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish convert pair selector without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_540 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-541 — Convert Instant

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes convert instant flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish convert instant without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_541 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-542 — Convert Limit

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes convert limit flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish convert limit without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_542 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-543 — Convert History

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes convert history flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish convert history without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_543 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-550 — Transaction History All

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes transaction history all flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish transaction history all without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_550 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-551 — Fund History Ledger

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes fund history ledger flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish fund history ledger without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /wallet/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_551 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## W-510 — Withdrawal Security Wizard

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes withdrawal security wizard flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish withdrawal security wizard without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | 2FA+fund pwd+email OTP |
| **Analytics** | screen_view_w_510 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-520 — KYC Required Withdraw

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes kyc required withdraw flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish kyc required withdraw without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_520 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-521 — New Address Lock Warning

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes new address lock warning flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish new address lock warning without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_521 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-500 — Network Fee Arrival

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes network fee arrival flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish network fee arrival without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_500 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-501 — Address Book Picker

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes address book picker flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish address book picker without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_501 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-502 — Scan QR Withdraw

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes scan qr withdraw flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish scan qr withdraw without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | Camera |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_502 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-500 — Whitelist Blocked

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes whitelist blocked flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish whitelist blocked without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_500 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-501 — Emergency Withdraw Disabled

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes emergency withdraw disabled flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish emergency withdraw disabled without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_501 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-502 — Cancel Convert Limit

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes cancel convert limit flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish cancel convert limit without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_502 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-600 — P2P Marketplace

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p marketplace flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p marketplace without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_600 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-601 — P2P Ad Detail

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p ad detail flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p ad detail without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_601 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-602 — P2P Create Order

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p create order flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p create order without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_602 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-603 — Post Ad Type

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes post ad type flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish post ad type without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_603 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-604 — Post Ad Price

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes post ad price flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish post ad price without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_604 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-605 — Post Ad Payment

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes post ad payment flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish post ad payment without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_605 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-606 — Post Ad Review

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes post ad review flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish post ad review without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_606 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-607 — My Ads List

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes my ads list flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish my ads list without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_607 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-608 — Edit Ad

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes edit ad flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish edit ad without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_608 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-609 — P2P Orders List

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p orders list flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p orders list without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_609 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-610 — P2P Order Room

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p order room flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p order room without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | Camera |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_610 |
| **Deep Link** | p2p/order/{id} |
| **Push Target** | P2P updates |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | Chat pages |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-611 — Payment Methods List

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes payment methods list flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish payment methods list without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_611 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-612 — Add Edit Payment Method

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes add edit payment method flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish add edit payment method without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_612 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-613 — Merchant Dashboard

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes merchant dashboard flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish merchant dashboard without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_613 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-614 — Merchant Public Profile

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes merchant public profile flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish merchant public profile without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_614 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-615 — P2P Dispute Detail

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p dispute detail flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p dispute detail without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_615 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-616 — Blocked Advertisers

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes blocked advertisers flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish blocked advertisers without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /p2p/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_616 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P3 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-600 — P2P Disabled Sanctions

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p disabled sanctions flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p disabled sanctions without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_600 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-601 — Payment Proof Upload

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes payment proof upload flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish payment proof upload without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | Camera,Photos |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_601 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-602 — Open Dispute Form

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes open dispute form flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish open dispute form without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_602 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-600 — P2P Filters

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p filters flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p filters without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_600 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | fiat crypto payment |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-601 — P2P Action Confirm

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p action confirm flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p action confirm without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_601 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-600 — P2P Cancel Confirm

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p cancel confirm flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p cancel confirm without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_600 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## T-600 — P2P Status Toast

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes p2p status toast flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish p2p status toast without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_t_600 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-700 Account — Home

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes home flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish home without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_700 account |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-701 — Profile

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes profile flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish profile without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_701 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-702 — Avatar

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes avatar flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish avatar without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_702 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-703 Linked — Accounts

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes accounts flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish accounts without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_703 linked |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-704 Login — History

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes history flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish history without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_704 login |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-710 Security — Center

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes center flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish center without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_710 security |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-711 Change — Password

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes password flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish password without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_711 change |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-712 — 2FA

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes 2fa flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish 2fa without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_712 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-713 — Passkeys

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes passkeys flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish passkeys without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_713 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-714 Fund — Password

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes password flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish password without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_714 fund |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-715 Anti — Phishing

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes phishing flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish phishing without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_715 anti |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-716 — Sessions

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes sessions flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish sessions without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_716 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-717 Withdrawal — Limits

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes limits flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish limits without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_717 withdrawal |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-718 — Whitelist

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes whitelist flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish whitelist without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_718 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-719 Address — Book

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes book flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish book without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_719 address |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-720 Add — Address

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes address flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish address without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_720 add |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-721 Batch — Import

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes import flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish import without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_721 batch |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P3 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-725 Add — Identifier

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes identifier flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish identifier without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_725 add |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-730 KYC — Hub

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes hub flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish hub without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_730 kyc |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-731 KYC — Country

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes country flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish country without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_731 kyc |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-732 KYC Doc — Type

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes type flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish type without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_732 kyc doc |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-733 KYC — Upload

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes upload flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish upload without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_733 kyc |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-734 — DigiLocker

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes digilocker flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish digilocker without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_734 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-735 KYC — Result

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes result flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish result without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_735 kyc |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-740 — Preferences

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes preferences flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish preferences without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_740 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-741 Fee — Tier

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes tier flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish tier without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_741 fee |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-742 Referral — Home

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes home flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish home without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_742 referral |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-743 My — Referrals

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes referrals flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish referrals without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_743 my |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-744 Referral — Share

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes share flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish share without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_744 referral |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-750 API — List

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes list flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish list without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_750 api |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-751 Create API — Key

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes key flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish key without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_751 create api |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-752 API Key — Detail

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes detail flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish detail without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_752 api key |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-753 Data — Export

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes export flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish export without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_753 data |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P3 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-760 Help — FAQ

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes faq flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish faq without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_760 help |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-761 FAQ — Article

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes article flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish article without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_761 faq |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-762 Tickets — List

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes list flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish list without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_762 tickets |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-763 Create — Ticket

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes ticket flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish ticket without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_763 create |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-764 Ticket — Thread

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes thread flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish thread without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_764 ticket |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-770 — Announcements

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes announcements flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish announcements without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_770 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-771 Announcement — Detail

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes detail flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish detail without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_771 announcement |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-772 Notifications — Inbox

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes inbox flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish inbox without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_772 notifications |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-773 Notification — Detail

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes detail flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish detail without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_773 notification |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-780 — Events

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes events flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish events without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_780 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P3 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-781 Earn — Hub

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes hub flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish hub without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_781 earn |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P3 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-790 About — Legal

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes legal flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish legal without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_790 about |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-791 System — Status

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes status flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish status without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_791 system |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-792 Account — Deletion

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes deletion flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish deletion without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_792 account |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## S-124 Legal — Viewer

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes viewer flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish viewer without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_s_124 legal |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-700 2FA — Prompt

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes prompt flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish prompt without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_700 2fa |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-701 Security — OTP

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes otp flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish otp without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_701 security |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P0 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-700 Revoke API — Key

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes key flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish key without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_700 revoke api |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-701 Deletion — Confirm

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes confirm flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish confirm without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_701 deletion |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P1 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-700 Share — Referral

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes referral flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish referral without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | /user/* or /auth/* |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_700 share |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-900 — Currency Picker

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes currency picker flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish currency picker without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_900 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-901 — Date Range

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes date range flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish date range without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_901 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-902 — Country Picker

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes country picker flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish country picker without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_902 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## BS-903 — Payment Method Picker

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes payment method picker flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish payment method picker without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_bs_903 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-900 — Image Picker

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes image picker flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish image picker without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | Photos |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_900 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-901 — Camera Capture

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes camera capture flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish camera capture without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | Camera |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_901 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## M-902 — WebView

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes webview flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish webview without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_m_902 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-900 — Biometric Reauth

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes biometric reauth flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish biometric reauth without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | Biometrics |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_900 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-901 — Fund Password

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes fund password flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish fund password without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_901 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-902 — 2FA Entry

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes 2fa entry flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish 2fa entry without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_902 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

## D-903 — Email OTP Withdraw

| Field | Specification |
|-------|---------------|
| **Purpose** | User completes email otp withdraw flow. |
| **Business Goal** | Retention and task completion. |
| **User Goal** | Accomplish email otp withdraw without friction. |
| **Entry Points** | Navigation per MOB-001B index. |
| **Exit Points** | Back or completion route. |
| **APIs** | None |
| **Permissions** | None |
| **Required Data** | See API response fields. |
| **Loading** | Skeleton or spinner <300ms. |
| **Empty** | EmptyState illustration + CTA where applicable. |
| **Offline** | Cached read or block writes with banner. |
| **Skeleton** | Domain-appropriate skeleton variant. |
| **Error** | ErrorState + retry. |
| **Success** | Toast or forward navigation. |
| **Validation** | Inline field errors. |
| **Security** | Auth guard if required. |
| **Analytics** | screen_view_d_903 |
| **Deep Link** | Per MOB-001B deep link map. |
| **Push Target** | None |
| **A11y** | Labels on all CTAs; 44dp targets. |
| **Render Priority** | P2 |
| **Primary CTA** | Context primary action. |
| **Secondary CTA** | Back or overflow. |
| **Swipe** | None |
| **Long Press** | None |
| **Pull Refresh** | If list screen else No |
| **Infinite Scroll** | If paginated list else No |
| **Keyboard** | Dismiss on scroll/tap outside. |
| **Search** | N/A |
| **Filter** | N/A |
| **Sort** | N/A |
| **Selection** | Single/multi as needed. |
| **Copy** | If address/ID shown else No |
| **Share** | If shareable else No |
| **Back Nav** | Stack pop or dismiss. |
| **Gestures** | Platform standard. |
| **Animation** | motion.normal |
| **Transition** | push or modal per type. |
| **State Restore** | Restore scroll if list. |
| **App Resume** | Refresh stale data if >30s. |

