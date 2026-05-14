# Codebase Review (May 14, 2026)

## Automated checks run

- `npm run -s lint` ✅ (3 warnings)
- `npm test -- --run` ❌ (3 failing tests in `src/lib/aiProvider.test.ts`)
- `npm run -s build` ✅ (production build succeeds; chunk-size warning)

## Priority errors and fixes

1. **AI provider fallback order mismatch vs test expectations**
   - `generateJSONWithFallback` currently attempts OpenRouter first when configured, then Gemini.
   - Existing tests expect Gemini-first behavior (and no OpenRouter call on Gemini success), causing failures.
   - **Fix options:**
     - Preferred: restore Gemini-first in `generateJSONWithFallback` to match comments and test intent.
     - Alternative: update tests + docs to explicitly define OpenRouter-first strategy.

2. **Unused catch variable indicates dead/error-handling drift**
   - `fallbackErr` is declared but unused in `src/lib/aiProvider.ts`.
   - **Fix:** remove the variable or include it in structured logging/telemetry payload.

3. **React anti-pattern: setState inside effect body**
   - `src/pages/MaintenanceLogs.tsx` sets state synchronously in an effect.
   - **Fix:** initialize state from props/derived data, or gate setState in callback-based subscription paths.

## Security / reliability concerns

4. **Firestore error handling consistency gap**
   - Project rule requires `handleFirestoreError` for Firestore operations, but many calls use ad-hoc `try/catch` or none.
   - **Fix:** implement a shared wrapper/hook and apply to all `addDoc/setDoc/updateDoc/deleteDoc/getDocs/onSnapshot` error paths.

5. **Potential stale/cross-tab AI cooldown logic risk**
   - Gemini cooldown persists in `sessionStorage`; multi-tab behavior may diverge from intent.
   - **Fix:** optionally move cooldown to `localStorage` + storage event sync, or explicitly document per-tab behavior.

## Product improvements (high impact)

6. **Add role-based route and action guards at a single policy layer**
   - Centralize Technician/NCOIC/Leadership permissions with route-level and component-level helpers.

7. **Improve offline-first UX for hangar conditions**
   - Queue write intents locally and replay on reconnect; expose reconciliation status in `SyncStatus` and notifications.

8. **Performance optimization for large datasets**
   - Add pagination/windowing for logs and DIFM tables; avoid wide `onSnapshot` listeners where historical data is not needed.

9. **Observability for AI + Firestore failures**
   - Add structured client telemetry (error type, role, shop, operation) and dashboard for recurring permission/index errors.

10. **Bundle-size reduction**
    - Current production JS includes a very large chunk (`~1.9 MB` pre-gzip).
    - Lazy-load admin/diagnostics/assistant heavy modules and split vendor chunks.

## Suggested next execution order

1. Fix `aiProvider` strategy mismatch + update tests.
2. Standardize Firestore error handling wrapper and apply in highest-write surfaces first (`MaintenanceLogs`, `DIFMLogs`, `Handoff`).
3. Refactor `MaintenanceLogs` effect state update pattern.
4. Implement route/action RBAC helpers.
5. Add code-splitting and verify bundle budget.
