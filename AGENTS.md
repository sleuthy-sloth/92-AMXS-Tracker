# Project Rules: 92nd AMXS Maintenance & Training System

## Design Philosophy
- **Theme:** Light corporate aerospace.
- **Sidebar:** Deep navy background (`bg-sidebar`), high-contrast white text (`text-white`).
- **Navigation:** AMU, Role, and Shop selection dropdowns are located at the top of the sidebar, immediately below the logo.
- **Accessibility:** High-contrast buttons and interactive elements for hangar environments.

## User Roles
- **Technician:** Standard access to logs and training.
- **NCOIC:** Access to logs, training, and onboarding.
- **Leadership:** Access to logs, training, onboarding, and administrative functions.

## Security & Data
- **Firestore:** All operations must be secured with strict rules.
- **Authentication:** Google Auth is the primary provider.
- **Error Handling:** All Firestore operations must use `handleFirestoreError` to catch and log permission issues.
- **Data Model:** All entities must be defined in `firebase-blueprint.json` before implementation.
- **DIFM Log:** Each shop must maintain a Due-In From Maintenance (DIFM) log.

## Development Standards
- **TypeScript:** Strict type safety, functional components, hooks.
- **Styling:** Tailwind CSS utility classes only. No custom CSS files.
- **Icons:** Lucide-react only.
- **Animations:** Motion/react for transitions.
