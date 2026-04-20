# 92nd AMXS: Next-Gen Maintenance Operations & Training Intelligence (MOTI)

**Accelerating Flight Line Readiness through Real-Time Logistics and Collaborative Forensics.**

The 92nd AMXS platform is a purpose-built aerospace maintenance ecosystem designed to eliminate documentation friction and ground-truth communication gaps across the flight line. Engineered for the high-tempo environment of the 92nd Aircraft Maintenance Squadron.

---

## ⚡ Core Operational Capabilities

### 1. Advanced Maintenance Forensics (OCR-Powered)
- **Vision Data Entry**: Gemini-powered OCR extracts JCNs, Tail Numbers, and Discrepancies from AF Form 781A imagery or G081 dashboard screenshots in a single snap.
- **Bulk Logbook Scan**: Batch OCR a photographed Green Log Book page and import 5–10 handwritten entries into the active shop in one confirmed action.
- **Red Ball Broadcast**: Instant shop-wide notifications for critical mission-impacting discrepancies.
- **G081 Ground-Truth Gallery**: Every major repair action is paired with a photo of the G081 screen, with NCOIC verification, auto-archival once verified, and a searchable forensics library.
- **Concurrent-Edit Conflict Detection**: If two maintainers open the same log, the system warns on save rather than silently overwriting — protecting work across shifts.

### 2. AI Maintenance Assistant (Gemini Terminal)
- **Dynamic Data Querying**: Natural-language interface with function-calling tools to query fleet health, parts status, training compliance, and recent discrepancies — all scoped to the maintainer's role.
- **Session Memory**: Chat history persists per user via `sessionStorage`, keyed by UID, so a mid-troubleshoot context isn't lost across navigation. Automatically cleared on logout.
- **Intelligence Feed**: Dashboard widget analyzes the last 15 maintenance logs + 10 upcoming training expirations and surfaces 1–3 ranked operational alerts (critical / warning / info). Guaranteed to return "System Nominal" when data is sparse — no hallucinated incidents.
- **Shift Turnover Forensics**: Summarize Swings and Nights activity for Day-shift production briefings with one query.

### 3. Proactive Compliance Engine
- **Predictive Training Alerts**: Hourly background scan notifies NCOICs when a technician's certification (Engine Run, Towing, Refuel, etc.) expires within 30 days.
- **Supply Risk Radar**: 7-day unrepaired-discrepancy sweep classifies parts risk (high / medium / low) and flags likely NSN/kit requirements before a bad actor grounds a jet.
- **G081 Re-Verification Watch**: Detects verified G081 proofs older than 30 days and prompts re-verification.
- **Deduplication**: Every alert uses a server-side dedup key (user + resource + date) — no duplicate pings across multiple tabs or devices.

### 4. AI Reliability Infrastructure
- **Classified Error Handling**: Every Gemini call is routed through a typed retry wrapper that distinguishes retryable (rate-limit, quota, network, timeout) from terminal (auth, parse) failures.
- **Exponential Backoff**: 3 retries by default (1s → 2s → 4s) with configurable per-call timeout (default 30s) enforced via `AbortController`.
- **External Cancellation**: Aborting the parent signal short-circuits the retry loop cleanly — no leaked `DOMException` surfaces.
- **Live Health Telemetry**: A shared `AIScanStatusContext` tracks 6 concurrent AI pipelines (assistant, supply-risk, g081-expiry, training, diagnostics, intelligence-feed) with status, last-run timestamp, run count, last error, and **which provider answered most recently** — visible to NCOIC/leadership on the Support page.
- **OpenRouter Fallback**: Text→JSON scans (Intelligence Feed, Supply Risk, Diagnostics) automatically reroute to OpenRouter's free tier (`meta-llama/llama-3.2-3b-instruct:free`) when Gemini exhausts its daily quota or trips a 429. The Support panel surfaces a `GEMINI` / `OPENROUTER` chip per scan so operators see at a glance which provider is active.
- **Graceful Degradation**: AI errors never crash a page; they surface as inline status chips with the classified kind, so the rest of the app stays operational.

### 5. Resilient Mission Continuity
- **Offline-First PWA**: Built-in persistence allows technicians to log maintenance in deep-hangar "dead zones" where Wi-Fi is unstable. Data syncs automatically once the link is re-established.
- **Live Collaborative Presence**: 30-second heartbeats show which NCOICs or Production Supers are currently viewing your shop's logs or turnover reports, preventing duplicate documentation.
- **Real-Time Sync Indicator**: A visible beacon in the top bar surfaces online/offline state and last-sync timestamp.
- **Guided Sandbox Tour**: First-time entry into Sandbox mode auto-launches a `driver.js`-powered walkthrough covering navigation, the AI Intelligence Feed, OCR + bulk-scan entry, the DIFM pipeline, the G081 gallery, handoff, training, diagnostics (NCOIC), workload (Leadership), and the AI health panel. Replayable any time via the **Restart Tour** button in the sidebar (sandbox-only).

### 6. Integrated Logistics (DIFM)
- **Pipeline Visibility**: Track components from `Ordered → En-Route → Received → Bench-Check → Installed` with a visual progress bar on every track.
- **Real-Time "Parts-Received" Pushes**: Immediate notifications the moment a long-lead component reaches the bench, shortening the repair cycle.
- **NSN + JCN + Doc Linkage**: Every track binds logistics data to the originating maintenance record for end-to-end audit.

### 7. Predictive Diagnostics (NCOIC / Leadership)
- **Bad-Actor Analysis**: Gemini reviews the last 60 logs for the target tail and reports recurrent component failures with high/medium/low confidence and evidence citations.
- **Workload Distribution**: 30-day dashboard showing logs-per-technician, red-ball counts, 7-day trend, and load classification (high/normal/low vs. team mean).

---

## 🧭 Page Map

| Area | Scope | Key capabilities |
|---|---|---|
| **Dashboard** | All roles | Readiness matrix, personnel roster snapshot, red-ball counts, AI Intelligence Feed, turnover & red-ball PDF exports |
| **Maintenance Logs** | All roles | OCR entry, bulk logbook scan, 24-h shift heatmap, grid/list views, archive, G081 uploads, conflict detection, CSV/PDF export |
| **DIFM Logs** | Shop-scoped | Pipeline tracker, inline status updates, parts-received notifications, seed mocks (demo), turnover PDF |
| **G081 Gallery** | Shop + leadership | Photo-proof grid, verification workflow, auto-archive on verify, full-screen viewer, archive table |
| **Handoff** | Shop | Shift-to-shift acknowledgment board with line-item attribution and 25-entry history |
| **Training Tracker** | All roles | Bulk upload from PDF/Excel manifests, manual entry, current/expiring/expired status, CSV/PDF export |
| **Personnel** | Roster | Per-member profile (training, logs, qualifications); leadership edits rank/role/shop/AMU |
| **Onboarding** | Admin | Access-request queue, approve/reject with role + shop assignment |
| **Diagnostics** | Admin | Gemini bad-actor analysis per tail with risk classification and evidence |
| **Workload** | Admin | 30-day technician distribution dashboard with balance visualization |
| **Support** | All roles | Help center, connectivity status, **AI system health panel** (per-module scan status, last run, error detail) |
| **Operations** | All roles | Tabbed composite of Maintenance / DIFM / G081 for single-screen ops workflows |
| **Login / Setup / Pending** | All roles | Google OAuth + email-master admin, demo sandbox toggle, rank/AMU/shop onboarding, NCOIC activation gate |

---

## 🔐 Access Model

- **Technician** — self-scoped; sees and edits their own logs and training records.
- **NCOIC** — shop-scoped; reviews and verifies shop-wide data, approves onboarding, receives compliance alerts.
- **Leadership** — org-wide; cross-AMU visibility, predictive diagnostics, workload dashboards, AI health panel.
- **Demo Mode** — Sandbox that uses in-memory `MOCK_*` data so stakeholders can tour the app without touching Firestore. Toggle in the sidebar.

All Firestore queries run through `useAuthConstrainedQuery`, which automatically applies shop/AMU filters, excludes demo records, and hard-caps result sets (default 500) — eliminating the hand-rolled filter scaffolding that used to live on every page.

---

## 🛠 Technology

| Layer | Stack |
|---|---|
| UI | React 19, TypeScript, Vite 6, TailwindCSS 4, Motion, Lucide |
| State | React Context (`AuthContext`, `AIScanStatusContext`), real-time Firestore subscriptions |
| Backend | Firebase Auth, Firestore, `vite-plugin-pwa` (offline persistence) |
| AI | Google Gemini (`@google/genai`) with typed retry + classification via `src/lib/aiRetry.ts` |
| Validation | Zod schemas on every Gemini response |
| Export | `jspdf` + `jspdf-autotable`, `xlsx` (lazy-loaded) |
| Testing | Vitest, `@testing-library/react`, jsdom |
| Tooling | ESLint (incl. `react-hooks/set-state-in-effect`), Prettier, Husky, lint-staged |

### Architecture patterns

- **Demo-mode split** — pages hold `firestoreX` state plus a `useMemo`-derived view. In demo mode the memo returns filtered `MOCK_*` data; in live mode it returns the Firestore snapshot. No side-effects run from the demo branch.
- **AI observability** — every Gemini call reports `start/success/error` to `AIScanStatusContext`. The Support page surfaces these as live health indicators for NCOIC/leadership.
- **Reactive Firestore + conflict detection** — edits compare `lastEditedAt` at submit time; if another user saved in between, the system prompts rather than silently overwriting.
- **Lazy loading** — `xlsx` imports only on export; Gemini SDK initializes on first use.
- **Dedup keys** — notification writes include `user + resource + date` keys to prevent duplicate alerts across tabs/devices.

---

## 🚀 Getting Started

```bash
# Node 24+
npm install
npm run dev          # Vite dev server on :3000

npm run test         # vitest run
npm run test:watch   # vitest
npm run test:ui      # vitest --ui
npm run lint         # tsc --noEmit + eslint
npm run build        # production bundle
```

Required env vars (`.env.local`):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...   # optional — enables automatic fallback when Gemini quota is exhausted
```

---

## 🧪 Test Coverage

The AI reliability layer and scan-status context are fully covered:

| Suite | File | Coverage |
|---|---|---|
| `classifyError` matrix | `src/lib/aiRetry.test.ts` | 429 / 503 / 401 / 403 / Zod parse / timeout / abort / network / quota / 400 / `AIRetryError` unwrap |
| `withRetry` lifecycle | `src/lib/aiRetry.test.ts` | Fast success, exponential backoff then success, retry exhaustion, no-retry on auth/parse, `timeoutMs` abort, external-signal short-circuit |
| Scan status context | `src/contexts/AIScanStatusContext.test.tsx` | Initial idle state across all 6 scan kinds, `idle → running → success` transitions, error recording, error clearing on subsequent success, kind isolation, provider-less throw |

---

## 🛡 Security

- **Zero-Trust Firestore Rules** — Attribute-Based Access Control using the caller's role, shop, and AMU claims.
- **Encryption at Rest & Transit** — Google Cloud / Firebase-provided.
- **TypeScript-Safe Architecture** — Zod-validated Gemini responses, no untyped `any` in critical data paths.
- **Responsive Aero-Design** — high-contrast, touch-optimized UI for oily, high-glare hangar environments.

---

## 🚧 Roadmap

- **Firestore pagination** — replace the current `limit(500)` guardrails with cursor-based paging on the high-volume collections (`logs`, `difm`).
- **AI provider proxy** — move Gemini + OpenRouter key handling to a Cloud Function so neither key ships in the client bundle. (OpenRouter fallback already mitigates the immediate availability risk.)
- **Fleet Health Predictor** — longitudinal ML-based trend analysis for airframe fatigue.
- **Native mobile PWA** — personalized maintainer feed on iOS/Android home screens.
- **Unified Support Request** — inline specialist routing from any log or DIFM track.

---

**Mission First. Data Always.**
*Built for the 92nd Aircraft Maintenance Squadron.*
