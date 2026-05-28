# 92 AMXS Tracker — Improvement Plan

> **Created:** 2026-05-28  
> **Based on:** Comprehensive code review of `sleuthy-sloth/92-AMXS-Tracker`  
> **Total estimated effort:** 40–55 hours across 6 phases

---

## Executive Summary

This plan addresses 10 issues identified during code review, organized into 6 phases ordered by severity and dependency. The two **critical** issues (client-side API key exposure and missing server-side validation) are tackled in Phase 2. Quick wins (CI test gate, hardcoded admin alias) are done first in Phase 1 to build momentum.

### Dependency Graph

```
Phase 1: [CI Gate] [Admin Alias]          ← Quick wins, no dependencies
                ↓
Phase 2: [AI Proxy] [Write Validation]    ← Critical security, enables Phase 5 rate limiting
                ↓
Phase 3: [Decompose Logs] [Decompose Training] [Decompose Personnel]  ← Refactor, parallelizable
                ↓
Phase 4: [Integration Tests] [Snapshot Tests]  ← Tests written against clean code
                ↓
Phase 5: [Mock Data Isolation] [Rate Limiting]  ← Rate limiting requires Phase 2 AI proxy
                ↓
Phase 6: [Accessibility] [Firebase Hardening]  ← Polish, no blockers
```

---

## Phase 1: Quick Wins (30 min)

### Task 1: Fix CI deploy pipeline — add test gate

**Problem:** The deploy workflow (`deploy.yml`) runs `npm ci` → `npm run build` → deploy. Tests are never executed in CI, so broken code can deploy silently.

**Fix:**
```yaml
# .github/workflows/deploy.yml — add before "Build" step
- name: Run tests
  run: npm test
```

**Files:** `.github/workflows/deploy.yml`  
**Risk:** None — purely additive  
**Effort:** 15 minutes

---

### Task 2: Remove hardcoded admin email alias

**Problem:** `AuthContext.tsx` maps the string `'admin'` to `'admin@us.af.mil'` in three places (`signInEmail`, `signUpEmail`, `resetPassword`). This is a hardcoded credential alias that could confuse users and creates a support liability.

**Fix:** Remove the ternary mapping. Users must enter their full email address. If a dev shortcut is needed, gate it behind `import.meta.env.DEV` with a clear comment.

**Files:** `src/contexts/AuthContext.tsx`  
**Risk:** Low — only affects users who type `'admin'` instead of the full email  
**Effort:** 30 minutes

---

## Phase 2: Critical Security Fixes (7–10 hrs)

### Task 3: Move AI API keys to Cloud Functions proxy

**Problem:** `GENAI_MIL_API_KEY` and `OPENROUTER_API_KEY` are inlined into the client-side JavaScript bundle via Vite's `define` config. Any user can extract them from DevTools. For a DoD-adjacent app using GenAI.mil, this is unacceptable.

**Fix — full Cloud Functions proxy:**

1. **Create `functions/` directory** with Firebase Cloud Functions
2. **`proxyAI` callable function:**
   - Validates caller is authenticated via `context.auth`
   - Accepts `{ prompt, schema, context, imageBase64?, provider? }`
   - Attaches API key server-side from `functions.config()` or Secret Manager
   - Forwards to GenAI.mil or OpenRouter with retry/fallback logic
   - Returns parsed JSON response
3. **Remove keys from client:**
   - Delete `define` entries from `vite.config.ts`
   - Update `aiProvider.ts` to call `httpsCallable(functions, 'proxyAI')` instead of direct `fetch`
   - Move retry/fallback logic into the Cloud Function
4. **Deploy:** `firebase deploy --only functions`

**Files:**
- **NEW:** `functions/src/index.ts`, `functions/src/proxyAI.ts`, `functions/package.json`, `functions/tsconfig.json`
- **MODIFY:** `vite.config.ts` (remove `define`), `src/lib/aiProvider.ts` (call Cloud Function), `src/lib/gemini.ts` (remove key getter)
- **MODIFY:** `firebase.json` (add functions config)

**Risk:** Medium — requires Firebase project config changes, Cloud Functions billing enablement, and deployment testing. The GenAI.mil endpoint must be reachable from Cloud Functions (verify network egress).  
**Effort:** 4–6 hours

---

### Task 4: Add Cloud Function for write validation

**Problem:** All business logic runs client-side. Firestore Security Rules validate field types and permissions but can't enforce complex business rules (e.g., "Red Ball items must have a JCN" or "training due dates must be reasonable").

**Fix — Firestore triggers:**

1. **`onWrite` for `/logs/{logId}`:**
   - Validate Red Ball items have a JCN
   - Normalize tail numbers (strip whitespace, standardize format)
   - Reject timestamps more than 24 hours in the future
   - Auto-set `lastEditedAt` to `serverTimestamp()`
2. **`onWrite` for `/training/{trainingId}`:**
   - Auto-compute `status` from `due_date` (current/expiring/expired)
   - Reject due dates more than 5 years in the future
3. **`onCreate` for `/users/{uid}`:**
   - Enforce `@us.af.mil` email domain at server level
   - Set default `status: 'pending'` if not already set
4. **`onDelete` for all collections:**
   - Write audit log entry to `/audit_log/{timestamp}`

**Files:**
- **NEW:** `functions/src/validators.ts`, `functions/src/auditLog.ts`
- **MODIFY:** `functions/src/index.ts`

**Risk:** Medium — need to handle edge cases for existing data; triggers add latency to writes  
**Effort:** 3–4 hours

---

## Phase 3: Component Decomposition (9–13 hrs)

These three tasks are independent and can be parallelized across multiple developers or worktrees.

### Task 5: Decompose MaintenanceLogs.tsx

**Problem:** `MaintenanceLogs.tsx` is a 1000+ line monolith handling state, queries, forms, OCR, export, modals, and search.

**Extract into:**

| New File | Responsibility |
|----------|---------------|
| `src/hooks/useMaintenanceLogs.ts` | Firestore queries, snapshot listeners, pagination state |
| `src/hooks/useLogForm.ts` | Form state, validation, submit/edit logic |
| `src/hooks/useBulkScan.ts` | Logbook scanning, OCR integration |
| `src/components/logs/LogEntryModal.tsx` | Create/edit form modal |
| `src/components/logs/LogCard.tsx` | Individual log entry display |
| `src/components/logs/LogSearchBar.tsx` | Search + filter controls |
| `src/components/logs/LogActionsMenu.tsx` | Management dropdown (export, bulk scan, turnover) |
| `src/components/logs/DIFMSection.tsx` | DIFM table at the bottom |

**Target:** No single file over 300 lines. `MaintenanceLogs.tsx` becomes a composition root (~100 lines).  
**Risk:** Low — pure refactor, no behavior change  
**Effort:** 4–6 hours

---

### Task 6: Decompose TrainingTracker.tsx

**Extract into:**

| New File | Responsibility |
|----------|---------------|
| `src/hooks/useTrainingData.ts` | Firestore queries, stats computation |
| `src/hooks/useTrainingUpload.ts` | File upload, AI parsing, reconciliation |
| `src/components/training/TrainingStatsPanel.tsx` | Three stat cards |
| `src/components/training/TrainingTable.tsx` | Sortable/filterable table |
| `src/components/training/TrainingUploadZone.tsx` | Drag-and-drop upload area |
| `src/components/training/TrainingNotifyModal.tsx` | Email notification modal |

**Risk:** Low — pure refactor  
**Effort:** 3–4 hours

---

### Task 7: Decompose Personnel.tsx

**Extract into:**

| New File | Responsibility |
|----------|---------------|
| `src/hooks/usePersonnelRoster.ts` | Firestore queries, filtering |
| `src/components/personnel/PersonnelCard.tsx` | Individual person display |
| `src/components/personnel/PersonnelDetailModal.tsx` | Detail/edit modal |
| `src/components/personnel/PersonnelSearchBar.tsx` | Search + filter |

**Risk:** Low — pure refactor  
**Effort:** 2–3 hours

---

## Phase 4: Test Coverage (8–11 hrs)

Tests are written against the decomposed code from Phase 3, making them easier to write and maintain.

### Task 8: Integration tests for core CRUD flows

**Priority tests:**

| Test File | What It Covers |
|-----------|---------------|
| `src/contexts/__tests__/AuthContext.test.tsx` | Login flow, email verification gate, bypassLogin dev-only guard, logout clears session, role-based access |
| `src/pages/__tests__/MaintenanceLogs.test.tsx` | Create log, edit log, archive, search/filter by AMU/shop, Red Ball flag, G081 upload |
| `src/pages/__tests__/TrainingTracker.test.tsx` | Upload Excel, mock AI reconciliation, status computation, notification modal |
| `src/hooks/__tests__/useProactiveTrainingScan.test.ts` | Expiring/overdue detection, notification creation |
| `src/hooks/__tests__/useSupplyRiskScan.test.ts` | Supply risk signal detection |
| `src/lib/__tests__/exportUtils.test.ts` | PDF generation, CSV generation, data formatting |

**Mocking strategy:** Use `firebase-functions-test` or manual mocks for Firestore. Mock AI responses with fixtures.

**Risk:** Low — additive, no production code changes  
**Effort:** 6–8 hours

---

### Task 9: Snapshot tests for key pages

**Pages to snapshot:**

| Test File | What It Verifies |
|-----------|-----------------|
| `src/pages/__tests__/Dashboard.test.tsx` | KPI cards render with mock data, Intelligence Feed mounts |
| `src/pages/__tests__/DIFMLogs.test.tsx` | Pipeline status rendering, status badges |
| `src/pages/__tests__/G081Gallery.test.tsx` | Photo grid rendering, verification status |
| `src/pages/__tests__/Setup.test.tsx` | Form fields present, AMU/Shop selectors |
| `src/pages/__tests__/PendingApproval.test.tsx` | Holding page content |

**Risk:** Low  
**Effort:** 2–3 hours

---

## Phase 5: Architecture Cleanup (6–9 hrs)

### Task 10: Isolate mock data behind a provider

**Problem:** Every page has `if (isDemoMode) return MOCK_*` conditional logic, duplicating the dual-path pattern across 10+ files.

**Fix:**

1. Create `DemoDataProvider` context that wraps the app when `isDemoMode` is true
2. Create `useData()` hook that returns either Firestore data or mock data transparently:
   ```ts
   const { logs, training, difm, personnel } = useData();
   // Pages no longer check isDemoMode
   ```
3. Remove all `isDemo` checks from page components
4. Remove `MOCK_*` imports from page files — they only exist in `mockData.ts` and the provider

**Files:**
- **NEW:** `src/contexts/DemoDataProvider.tsx`, `src/hooks/useData.ts`
- **MODIFY:** All pages that check `isDemoMode`

**Risk:** Medium — touches many files, needs careful regression testing  
**Effort:** 4–6 hours

---

### Task 11: Add per-user rate limiting for AI calls

**Problem:** Even after moving keys to Cloud Functions (Task 3), a malicious authenticated user could make unlimited AI calls, exhausting quotas and budget.

**Fix:**

1. Add rate check to `proxyAI` Cloud Function:
   - Maintain `ai_rate_limits/{uid}` document with `{ count, windowStart }`
   - Max 60 requests/hour for technicians, 120 for NCOIC/leadership
   - Return 429 with `Retry-After` header when exceeded
2. Add client-side rate limit display in `MaintenanceAssistant.tsx`:
   - Show "X requests remaining this hour" indicator
   - Disable send button when limit reached
3. Create `useAIRateLimit` hook to track usage client-side

**Files:**
- **MODIFY:** `functions/src/proxyAI.ts`
- **NEW:** `src/hooks/useAIRateLimit.ts`
- **MODIFY:** `src/components/MaintenanceAssistant.tsx`

**Blocked by:** Task 3 (Cloud Functions proxy must exist first)  
**Risk:** Low — additive  
**Effort:** 2–3 hours

---

## Phase 6: Polish & Compliance (8–11 hrs)

### Task 12: Accessibility audit and Section 508 compliance

**Problem:** No evidence of accessibility testing. Government-adjacent applications typically require Section 508 compliance.

**Checklist:**

1. **Automated audit:**
   - Install `@axe-core/react` for runtime checks in dev mode
   - Run Lighthouse accessibility audit on all pages
   - Fix all critical/serious violations

2. **Manual fixes:**
   - Add `aria-label` to all icon-only buttons (edit, delete, close, scan)
   - Add `role="dialog"` and `aria-modal="true"` to all modals
   - Add `aria-live="polite"` to Intelligence Feed and scan result areas
   - Add `role="alert"` to notification toasts and error messages
   - Ensure all form inputs have associated `<label>` elements
   - Add `aria-expanded` to dropdown menus (LogActionsMenu, etc.)

3. **Keyboard navigation:**
   - Verify Tab order is logical on every page
   - Escape closes all modals and dropdowns
   - Enter submits forms
   - Focus is trapped inside open modals
   - Focus returns to trigger element when modal closes

4. **Color contrast:**
   - Verify `safety-orange` (#FF6B35) on white meets WCAG AA (4.5:1) — likely fails, darken to #E55A2B
   - Verify `caution-yellow` (#FFB800) on white meets WCAG AA — likely fails, darken to #CC9300
   - Run contrast checker on all text/background combinations

**Files:** Touch most components in `src/components/` and `src/pages/`, plus `src/index.css` for color adjustments  
**Risk:** Low — additive changes  
**Effort:** 6–8 hours

---

### Task 13: Harden Firebase config exposure

**Problem:** `firebase-applet-config.json` is committed to the public repo with project ID, API key, and database ID. While Firebase API keys are designed to be public, the combination with exposed AI keys gives attackers a complete infrastructure map.

**Fix:**

1. **Add Firebase App Check:**
   ```ts
   // src/firebase.ts
   import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
   const appCheck = initializeAppCheck(app, {
     provider: new ReCaptchaEnterpriseProvider('YOUR_SITE_KEY'),
     isTokenAutoRefreshEnabled: true,
   });
   ```
   This prevents unauthorized clients from calling the Firebase API even with the config.

2. **Restrict API key in Google Cloud Console:**
   - Go to APIs & Services → Credentials
   - Edit the API key used by the app
   - Add HTTP referrer restriction to `https://sleuthy-sloth.github.io/92-AMXS-Tracker/*`

3. **Verify Firestore rules completeness:**
   - Ensure no collection has `allow read, write: if true`
   - Ensure `isDemo` flag cannot be set by unauthenticated users (already done — verify)

4. **Document security model in README:**
   - Explain that Firebase API key is intentionally public
   - Explain that security is enforced by Firestore Rules + App Check
   - Explain the AI key proxy architecture

**Files:**
- **MODIFY:** `src/firebase.ts`, `firestore.rules`, `README.md`

**Risk:** Low — App Check is additive; API key restriction needs testing  
**Effort:** 2–3 hours

---

## Execution Order Summary

| Order | Task | Effort | Priority | Blockers |
|-------|------|--------|----------|----------|
| 1 | Fix CI deploy pipeline | 15 min | P0 | None |
| 2 | Remove admin email alias | 30 min | P1 | None |
| 3 | Move AI keys to Cloud Functions | 4–6 hrs | **P0 Critical** | None |
| 4 | Add write validation functions | 3–4 hrs | P0 Critical | None (parallel with #3) |
| 5 | Decompose MaintenanceLogs | 4–6 hrs | P2 | None |
| 6 | Decompose TrainingTracker | 3–4 hrs | P2 | None (parallel with #5) |
| 7 | Decompose Personnel | 2–3 hrs | P2 | None (parallel with #5, #6) |
| 8 | Integration tests | 6–8 hrs | P1 | #5, #6, #7 |
| 9 | Snapshot tests | 2–3 hrs | P2 | #5, #6, #7 |
| 10 | Isolate mock data provider | 4–6 hrs | P2 | None |
| 11 | Add AI rate limiting | 2–3 hrs | P1 | #3 |
| 12 | Accessibility audit | 6–8 hrs | P2 | #5, #6, #7 |
| 13 | Firebase App Check | 2–3 hrs | P1 | None |

**Recommended first sprint:** Tasks 1, 2, 3, 4 — fix CI, remove admin alias, move AI keys server-side. This addresses the two critical security issues and the deploy pipeline gap in one focused effort (~8–11 hours).

---

## Success Criteria

After all phases are complete:

- [ ] CI pipeline runs tests before deploying — broken builds never reach production
- [ ] AI API keys are no longer in the client-side bundle — verified by searching `dist/` output
- [ ] Cloud Functions enforce per-user rate limits on AI calls
- [ ] Firestore write triggers validate business rules server-side
- [ ] No page component exceeds 300 lines
- [ ] Test coverage includes all core CRUD flows and role-based access
- [ ] Mock data is transparent to page components via `useData()` hook
- [ ] All pages pass axe-core automated accessibility audit with zero critical violations
- [ ] Firebase App Check is active and rejecting unauthorized clients
- [ ] README documents the full security architecture
