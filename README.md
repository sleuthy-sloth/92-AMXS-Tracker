# 92 AMXS Tracker

> Maintenance, training, and logistics command center for the 92nd Aircraft Maintenance Squadron.

---

## Table of Contents

- [Overview](#overview)
- [Capabilities](#capabilities)
- [Architecture](#architecture)
- [Pages & Modules](#pages--modules)
- [AI Features](#ai-features)
- [Proactive Monitoring](#proactive-monitoring)
- [Export & Reporting](#export--reporting)
- [Security Model](#security-model)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

The **92 AMXS Tracker** is an operational management platform built for Air Force maintenance squadrons. It replaces paper logbooks, disconnected spreadsheets, and email chains with a single real-time command center that tracks everything from aircraft discrepancies to personnel training compliance.

**Live:** [sleuthy-sloth.github.io/92-AMXS-Tracker](https://sleuthy-sloth.github.io/92-AMXS-Tracker/) 
**Latest:** `v0.9.0`. Interactive intelligence, scoped AI assistant (June 2026)

---

## What's New in v0.9.0

- **🔍 Clickable intelligence alerts:** Mission Intelligence feed alerts are now interactive. Click any alert to open a drill-down modal:
 - **Red Ball alerts** → full list of all urgent maintenance items with tail numbers, discrepancies, repairs, technicians, and timestamps
 - **Recurring issues** → all maintenance entries for the flagged tail number, plus a summary panel showing all recurring tails with entry counts
 - **Training expired/expiring** → personnel list with names, ranks, courses, due dates, and shop assignments
- **🤖 Scoped AI Maintenance Assistant:** floating AI terminal with tool-calling (query logs, DIFM, training) now active on all pages. System prompt is strictly scoped to tracker data. refuses general knowledge, coding, or off-topic questions. Only answers questions about maintenance logs, training compliance, DIFM parts, and personnel within the 92 AMXS Tracker.
- **♿ Accessibility:** clickable alerts include keyboard support (Enter/Space), `role="button"`, `aria-label`, and focus indicators

## Capabilities

### Core Tracking

| Module | What It Does |
|--------|-------------|
| **Maintenance Logs** | Full CRUD for aircraft maintenance entries. tail numbers, JCNs, discrepancies, repairs, Red Ball alerts |
| **DIFM (Due-In From Maintenance)** | Parts pipeline tracking. ordered → en-route → received → bench-check → installed |
| **G081 Gallery** | Photo verification of G081 screen proofs with pending/verified status |
| **Reference Docs** | ISO checklist + QRL file management. upload, view, edit Excel files in-browser, auto-save completed checklists |
| **Training Tracker** | Personnel qualifications with current/expiring/expired status, 60-day expiration alerts |
| **Personnel Roster** | Shop-level personnel management with role-based access control |

### Operations & Command

| Feature | Description |
|---------|-------------|
| **Dashboard KPIs** | Active log count, Red Ball items, training readiness %, expiring/overdue counts |
| **24H Activity Heatmap** | Visual timeline of maintenance activity across shifts (Days, Swings, Nights) |
| **Intelligence Feed** | AI-generated insights and anomaly detection from maintenance/training data |
| **Loop Closure Tracker** | Identifies recurring discrepancies on the same tail number |
| **Workload Analytics** | NCOIC/Leadership view of shop-level workload distribution |
| **Shift Turnover** | Handoff reports with PDF generation for shift-to-shift continuity |

### Real-Time Collaboration

- **Live presence indicators:** see who's online and where
- **Edit conflict detection:** warns when another user is editing the same record
- **Multi-tab persistence:** IndexedDB-backed offline Firestore support
- **Sync status indicator:** visual feedback on connectivity

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│ GitHub Pages (Static SPA) │
│ ┌────────────────────────────────────────────┐ │
│ │ React 19 + TypeScript + TailwindCSS 4 │ │
│ │ ┌───────┐ ┌─────────┐ ┌───────────────┐ │ │
│ │ │16 │ │12 │ |3 Services │ │ │
│ │ │Pages │ │Hooks │ │OCR/Parser/ │ │ │
│ │ │ │ │ │ │Notifications │ │ │
│ │ └───┬───┘ └────┬────┘ └───────┬───────┘ │ │
│ │ └──────────┼──────────────┘ │ │
│ │ ┌─────┴─────┐ │ │
│ │ │ Firebase │ │ │
│ │ │ Client │ │ │
│ │ └─────┬─────┘ │ │
│ └─────────────────┼──────────────────────────┘ │
│ │ │
│ PWA: Workbox + IndexedDB offline support │
└────────────────────┼──────────────────────────────┘
 │
┌────────────────────┼──────────────────────────────┐
│ Firebase Cloud │ │
│ ┌──────────────────┴───────────────────────┐ │
│ ┌──────────┐ ┌──────────┐ ┌───────────────┐ │
│ │ Auth │ │ Firestore│ │ App Check │ │
│ │ (@us.af │ │ (Rules + │ │ (reCAPTCHA │ │
│ │ .mil) │ │ IndexedDB│ │ Enterprise) │ │
│ └──────────┘ └──────────┘ └───────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ API keys injected at build time │ │
│ │ via GitHub Secrets. never in repo │ │
│ └──────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
 ↗ ↖
┌────────┴──────┐ ┌────────┴──────────────┐
│ GenAI.mil │ │ OpenRouter │
│ (Primary AI) │ │ (Fallback. Qwen VL) │
└───────────────┘ └───────────────────────┘
```

---

## Pages & Modules

### 🏠 Dashboard
Command center with real-time KPIs: active logs, Red Ball items, training readiness %, intelligence feed, and loop closure tracking. Role-scoped views automatically filter data by AMU and shop.

### 🔧 Maintenance Logs
- Grid and list views with animated transitions
- Create, edit, delete, and archive maintenance entries
- Red Ball priority flagging with notification dispatch
- G081 screen proof uploads with pending/verified status
- Full-text search across tail numbers, JCNs, technicians, personnel
- Date range filtering
- **AI-powered OCR scanning** of AF Forms 781A/781K
- **Bulk logbook scanning:** batch OCR from handwritten Green Log Book photos
- Inline editing with **conflict detection** (warns if another user modified the record)
- Edit presence indicators show who's currently editing
- Export to CSV, PDF, and shift turnover reports

### 📦 DIFM Logs
- Pipeline tracking with 5 stages: ordered → en-route → received → bench-check → installed
- Status categorization: due-in, awaiting-parts, in-repair, complete
- NSN and document number tracking

### 🎓 Training Tracker
- Qualification compliance dashboard with percentage bars
- Current / Expiring (≤60 days) / Expired status computation
- **AI-powered training report parsing** from Excel (.xlsx/.xlsm) and CSV files
- Bulk email notifications for personnel with expired/expiring training
- Export to PDF and CSV
- Grid and list views

### 👥 Personnel Roster
- Shop-level roster with role badges (technician, NCOIC, leadership)
- Per-person training history and maintenance log drill-down
- Edit personnel profiles (role, shop, AMU, contact info)
- Soft-delete support (sets status to inactive)

### 🖼️ G081 Gallery
- Photo verification gallery for G081 screen proof submissions
- Pending/verified status with verifier attribution

### 📄 Reference Docs
- **Dual-section layout**: ISO Checklists and QRL (Quick Reference List) under a single tab
- **File upload**: Drag-and-drop or click to upload `.xlsx` / `.xls` / `.csv` files to Firebase Storage
- **In-browser viewer**: SheetJS renders Excel files as interactive HTML tables with multi-sheet tab support
- **Edit mode**: Click "Edit" to make cells contenteditable. fill out checklist items directly in the browser
- **Save completed**: "Save Completed" re-exports the edited workbook as a new `.xlsx` file, uploads to Firebase Storage, and creates a new Firestore record. templates are never overwritten
- **Download**: Original file download from every document row
- **Live search**: Filter documents by filename, description, or uploader
- **All roles**: View and upload; NCOIC/Leadership only for delete operations

### 📊 Workload & Diagnostics
- **Workload**: NCOIC/Leadership view of shop activity metrics (NCOIC/Leadership only)
- **Diagnostics**: System health checks, Firestore connectivity verification (NCOIC/Leadership only)

### 🔐 Auth & Onboarding
- Google SSO authentication
- **Email/password authentication** with self-service registration
- Password reset via email
- Domain-restricted registration (`@us.af.mil` required)
- Email verification enforced before access
- Super-admin approval workflow for new users
- Development-only demo sandbox with bypass login

### 🔄 Handoff
- Shift turnover management
- Handoff report generation

### 🆘 Support
- Help center with in-app documentation
- Guided interactive tour via Driver.js

---

## AI Features

All AI features are powered by a **dual-provider architecture** with automatic fallback:

| Tier | Provider | Model | Role |
|------|----------|-------|------|
| **Primary** | GenAI.mil | `gemini-3.5-flash` | DoD-approved endpoint |
| **Fallback** | OpenRouter | `gemma-4-31b:free` | Free-tier multimodal model, 262K context |
| **Last Resort** | OpenRouter | `nemotron-nano-12b-2-vl:free` | OCR & document intelligence specialist |

### AI-Powered Capabilities

| Feature | Input | Output |
|---------|-------|--------|
| **Form Scanner** | Photo of AF Form 781A/781K | Tail number, JCN, discrepancy, repair, document number |
| **Logbook Scanner** | Photo of handwritten Green Log Book | Array of maintenance entries |
| **Training Report Parser** | Excel (.xlsx/.xlsm) or CSV file | Array of training records with personnel, course, due date |
| **Intelligence Feed** | Maintenance + training data | Anomaly detection, trend analysis, risk flags |

### Security Architecture

AI API keys are **injected at build time** via GitHub Secrets (CI/CD pipeline) and **never committed to the repository**. The client calls AI providers directly. In production, Firebase App Check prevents unauthorized API access.

---

## Proactive Monitoring

The app runs background compliance scans that detect and alert on:

| Hook | What It Scans | Alert Type |
|------|--------------|------------|
| `useProactiveTrainingScan` | Expiring/overdue training records | Training deadline alerts |
| `useG081ExpiryScan` | G081 verification expiry | G081 status warnings |
| `useSupplyRiskScan` | Supply chain risk signals | Supply risk indicators |

---

## Export & Reporting

| Export Type | Format | Content |
|------------|--------|---------|
| Logs Export | CSV, PDF | Filtered maintenance log entries |
| Training Export | CSV, PDF | Filtered training records |
| Turnover Report | PDF | Shift handover summary with logs + DIFM |
| Red Ball Weekly | PDF | Weekly Red Ball item summary |

---

## Security Model

| Layer | Protection |
|-------|-----------|
| **Authentication** | Firebase Auth. Google SSO or email/password, `@us.af.mil` domain enforced, email verification required |
| **Authorization** | Firestore Security Rules. role-based (technician, NCOIC, leadership), AMU/shop scoping |
| **Admin Claims** | Custom claims set via Firebase Admin SDK (no hardcoded emails) |
| **API Keys** | Injected at build time via GitHub Secrets (CI/CD only); not committed to repo |
| **App Check** | Firebase App Check (reCAPTCHA Enterprise). prevents unauthorized clients from calling Firebase APIs |
| **Demo Isolation** | `isDemo` flag prevents mock data from leaking into live Firestore |
| **Dev-only Gates** | `seedDatabase` and `bypassLogin` disabled in production builds (`import.meta.env.PROD`) |
| **CI Gate** | `npm test` runs before deployment. broken code can't deploy |
| **Domain Restriction** | Firebase API key scoped to `sleuthy-sloth.github.io` in Google Cloud Console |
| **Firebase Config** | API key is intentionally public. security is in Firestore Rules, not key secrecy |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.8, Vite 6 |
| **Styling** | TailwindCSS 4, custom military design system |
| **Animation** | Motion (Framer Motion successor) |
| **Backend** | Firebase (Auth, Firestore) |
| **AI/ML** | GenAI.mil + OpenRouter (dual-provider fallback) |
| **Validation** | Zod 4 for AI response validation |
| **PWA** | vite-plugin-pwa with Workbox |
| **Export** | jsPDF + autoTable (PDF), custom CSV |
| **Testing** | Vitest + Testing Library (14 test files, 99 tests) |
| **Linting** | ESLint + Prettier + Husky pre-commit hooks |
| **Deployment** | GitHub Pages + Codeberg mirror |
| **Onboarding** | Driver.js guided interactive tour |

### Key Dependencies

```
react ^19, vite ^6, tailwindcss ^4, firebase ^12
date-fns ^4, zod ^4, motion ^12, lucide-react ^0.546
jspdf ^4, xlsx ^0.18, driver.js ^1.4
@testing-library/react ^16, vitest ^4
```

---

## Project Structure

```
92-AMXS-Tracker/
├── src/
│ ├── pages/ # 16 page components
│ │ ├── Dashboard.tsx # Command center with KPIs
│ │ ├── MaintenanceLogs.tsx # Aircraft discrepancy tracking
│ │ ├── DIFMLogs.tsx # Parts pipeline tracking
│ │ ├── TrainingTracker.tsx # Qualification compliance
│ │ ├── Personnel.tsx # Shop roster management
│ │ ├── G081Gallery.tsx # Photo verification gallery
│ │ ├── ReferenceDocs.tsx # ISO checklists + QRL (upload, edit, view)
│ │ ├── Operations.tsx # Nested ops routing
│ │ ├── Handoff.tsx # Shift turnover
│ │ ├── Workload.tsx # NCOIC/Leadership analytics
│ │ ├── Diagnostics.tsx # System health
│ │ ├── Onboarding.tsx # User approval workflow
│ │ ├── Login.tsx # Authentication
│ │ ├── Setup.tsx # Initial profile setup
│ │ ├── PendingApproval.tsx # Approval holding page
│ │ └── Support.tsx # Help center
│ │
│ ├── hooks/ # 12 custom hooks
│ │ ├── useMaintenanceLogs.ts # Logs + DIFM data management
│ │ ├── useLogForm.ts # Form state for log entries
│ │ ├── useLogScanning.ts # OCR scanning logic
│ │ ├── useTrainingData.ts # Training records + filtering
│ │ ├── useTrainingUpload.ts # File upload + AI parsing
│ │ ├── usePersonnelRoster.ts # Personnel data management
│ │ ├── useProactiveTrainingScan.ts
│ │ ├── useG081ExpiryScan.ts
│ │ ├── useSupplyRiskScan.ts
│ │ ├── usePresence.ts # Real-time presence
│ │ ├── useGuidedTour.ts # Driver.js onboarding
│ │ └── useAuthConstrainedQuery.ts
│ │
│ ├── components/
│ │ ├── logs/ # 7 maintenance log components
│ │ │ ├── LogCard.tsx, LogTableRow.tsx
│ │ │ ├── LogSearchFilter.tsx, LogActionsMenu.tsx
│ │ │ ├── LogDetailsModal.tsx, LogFormModal.tsx
│ │ │ └── ShiftTimeline.tsx
│ │ ├── training/ # 4 training components
│ │ │ ├── TrainingStatsPanel.tsx, TrainingTable.tsx
│ │ │ ├── TrainingUploadZone.tsx, TrainingFormModal.tsx
│ │ ├── personnel/ # 3 personnel components
│ │ │ ├── PersonnelCard.tsx, PersonnelSearchBar.tsx
│ │ │ └── PersonnelDetailModal.tsx
│ │ ├── dashboard/ # IntelligenceFeed, LoopClosure
│ │ ├── layout/ # AppLayout, Sidebar, TopBar
│ │ └── common/ # ErrorBoundary, SyncStatus, etc.
│ │
│ ├── services/
│ │ ├── ocrService.ts # AI-powered form/logbook scanning
│ │ ├── parserService.ts # Training report parsing
│ │ └── notificationService.ts # In-app notification dispatch
│ │
│ ├── lib/
│ │ ├── aiProvider.ts # Dual-provider AI with fallback
│ │ ├── aiRetry.ts # Exponential backoff + error classification
│ │ ├── aiSchemas.ts # Zod schemas for AI response validation
│ │ ├── aiCache.ts # Firestore-backed AI response cache
│ │ ├── exportUtils.ts # PDF/CSV export generators
│ │ └── utils.ts # General utilities
│ │
│ ├── contexts/
│ │ ├── AuthContext.tsx # Firebase Auth + Firestore profile
│ │ ├── AIScanStatusContext.tsx # AI scan status tracking
│ │ ├── TourContext.ts # Guided tour state
│ │ └── DemoDataProvider.tsx # Centralized mock data provider
│ │
│ ├── hooks/
│ │ ├── useRoleGuard.ts # RBAC helper (canManage, canAdmin, isAllowed)
│ │ └── ... # 12 additional hooks
│
├── .github/workflows/
│ ├── deploy.yml # GitHub Pages deployment (with test gate)
│ └── mirror.yml # Codeberg mirror
│
├── firebase.json # Firebase project configuration
├── firestore.rules # Firestore security rules (~170 lines)
├── vite.config.ts # Vite + PWA configuration
└── vitest.config.ts # Test configuration
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 24
- Firebase project with Firestore and Auth enabled

### Development

```bash
# Clone
git clone https://github.com/sleuthy-sloth/92-AMXS-Tracker.git
cd 92-AMXS-Tracker

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Start dev server
npm run dev
```

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GENAI_MIL_API_KEY` | CI/CD only | Injected via GitHub Secrets at build time |
| `OPENROUTER_API_KEY` | CI/CD only | OpenRouter fallback (injected at build time) |
| `SUPER_ADMIN_EMAIL` | Yes | Designated admin user email |
| `DEV_DIRECT_AI` | Optional | Set to `true` to bypass proxy in dev |

> **Production:** API keys are stored as Firebase Secrets. not in the client bundle.

### Testing

```bash
# Run all tests (14 test files, 98 tests)
npm test

# Watch mode
npm run test:watch

# UI mode
npm run test:ui

# Lint
npm run lint

# Format
npm run format
```

### Cloud Functions

This project runs on the Firebase Spark (free) tier and does not use Cloud Functions. API keys are injected during the GitHub Actions build via repository secrets.

```bash
# To set up the deployment secrets:
# 1. Go to GitHub repo → Settings → Secrets and variables → Actions
# 2. Add these repository secrets:
# GENAI_MIL_API_KEY
# OPENROUTER_API_KEY
# SUPER_ADMIN_EMAIL
```

---

## Deployment

The app deploys automatically to **GitHub Pages** on push to `main`:

1. `npm ci`. install dependencies
2. `npm test`. run test suite (blocks deploy on failure)
3. `npm run build`. Vite production build
4. Deploy to GitHub Pages

A mirror workflow syncs to **Codeberg** simultaneously.

---

## Known Issues

- **`xlsx` package vulnerabilities:** The SheetJS community edition (`xlsx` ^0.18.5) has known prototype pollution and ReDoS vulnerabilities with no npm fix available. Mitigation: only user-uploaded files are processed (not untrusted external input). Planned migration to SheetJS CDN or `exceljs`.
- **AI API keys in client bundle:** Keys are injected at build time via GitHub Secrets but are present in the deployed JavaScript. This is a deliberate trade-off to stay on the Firebase Spark free tier (no Cloud Functions). See [Security Model](#security-model) for mitigations.

---

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Attribution-NonCommercial

Copyright (c) 2026 Steven (Sleuthy-Sloth)

This work is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License. You are free to share and adapt for non-commercial purposes with appropriate attribution.
