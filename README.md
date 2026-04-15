# 92nd AMXS Maintenance & Training Tracker

A comprehensive, real-time turnover and training tracking system designed specifically for the 92nd Aircraft Maintenance Squadron (AMXS). This application streamlines maintenance operations, enhances communication between shifts, and ensures personnel training records are up-to-date and accessible.

## Features

### 1. Maintenance Log & Turnover
*   **Real-time Discrepancy Tracking:** Log aircraft discrepancies, repair actions, and document numbers instantly.
*   **Shift Management:** Track maintenance activities by shift (Days, Swings, Nights, Weekend Duty).
*   **Urgency Indicators:** Identify "Red Ball" maintenance items for immediate visibility.
*   **Personnel Attribution:** Assign primary technicians and additional supporting personnel to each log entry.
*   **Edit Tracking:** Full audit trail for log entries, showing who made changes and when.
*   **Export Capabilities:** Generate CSV or PDF reports for turnover briefings and historical analysis.

### 2. Personnel Management
*   **Centralized Roster:** View and manage personnel status, roles, and shop assignments.
*   **Role-Based Access:** Secure access control with distinct views for Technicians, NCOICs, and Leadership.
*   **Status Tracking:** Monitor personnel availability and active status.

### 3. Training Tracker
*   **Qualification Monitoring:** Track training records, course names, and due dates.
*   **Expiration Alerts:** Proactively identify expiring or expired training requirements.
*   **Reporting:** Export training compliance reports for leadership review.

### 4. Demo Sandbox
*   **Safe Testing Environment:** A dedicated demo mode allows users to explore all features using mock data without impacting the live production database.
*   **Role Simulation:** Seamlessly switch between different user roles to test feature visibility and permissions.

## Technology Stack
*   **Frontend:** React, TypeScript, Tailwind CSS
*   **Backend/Database:** Firebase (Firestore)
*   **State Management:** React Context API
*   **Data Visualization/Formatting:** date-fns, Lucide React icons
