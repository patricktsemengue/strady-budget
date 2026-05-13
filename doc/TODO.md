
 # Transition Plan: Monolith to "Tri-App Ecosystem" Architecture

 ## 1. Objective and Scope
 Transition the current monolithic user interface into a **"Tri-App Ecosystem"**. This architectural redesign aims to
 drastically reduce cognitive load by presenting the application as a suite of three distinct, focused tools. Similar to how a
 user opens a "Google Apps" launcher to choose between Gmail, Maps, or Calendar, the user will log in to a main "Platform
 Portal" where they explicitly launch one of three distinct applications based on their immediate intent.

 ## 2. Core Architectural Concepts

 ### 2.1 The "Platform Portal" (The Launcher View)
 This is the new root experience (`#`). It is a clean, minimal "desktop" or "app launcher" screen.
 *   **Visual Design:** Displays three prominent App Icons/Cards (The Ledger, The Vault, The Compass).
 *   **Behavior:** Clicking an icon "launches" the respective app. The transition should feel like entering a completely
 different application, not just navigating to a different page in a menu.

 ### 2.2 The "Global Shell" (The App Header)
 Once inside an app, the navigation heavily restricts cross-pollination. To switch apps, the user must use an "App Switcher" or
 return to the Portal.
 *   **The App Switcher (Top Left):** A prominent button (e.g., a 9-dot grid icon like Google's app launcher) that either
 returns the user to the Platform Portal or opens an overlay to switch directly to another app.
 *   **The App Identity:** The Top Bar strongly brands the current app (e.g., "The Daily Ledger") and adopts its specific accent
 color.
 *   **The Shared-Month-Selector:** Placed centrally in the Top Bar. This is the only visual cue that these apps share a data
 layer (time).
 *   **The Profile Drawer (Top Right):** A single dropdown containing quick platform-wide settings (Language, Theme, Entity) and
 a link to the "Platform Global Settings".

 ### 2.3 The Three Independent Apps
 The current modules will be strictly siloed into these three applications. Each app has its own isolated sub-navigation
 (sidebar or bottom tabs) that *only* shows its internal modules.

 1.  **The Daily Ledger (Focus: Data Entry & Tracking)**
     *   *Identity:* Indigo / Green. Icon: Wallet/List.
     *   *Modules:* Transactions, Categories, Accounts.
 2.  **The Wealth Vault (Focus: Long-term Net Worth)**
     *   *Identity:* Amber / Gold. Icon: Safe/Building.
     *   *Modules:* Wealth (Assets, Liabilities, Historical Valuations).
 3.  **The Strategic Compass (Focus: Analysis & Education)**
     *   *Identity:* Emerald / Blue. Icon: Chart/Compass.
     *   *Modules:* Dashboard (New), Education (70/20/10), Reports.

 ### 2.4 Settings Architecture: Platform Global vs. Tiny-App Specific
 To maintain the illusion of distinct applications while leveraging a shared backend, configuration is strictly divided into two
 tiers:

 **A. Platform Global Settings (The Admin Console)**
 Accessed via the Profile Drawer or Platform Portal, these settings manage the core database, platform shell, and ecosystem-wide
 parameters.
 *   *Data Management:* **CSV Import/Export**, Full System JSON Backup, Factory Reset (Data Wipe).
 *   *Environment:* Entity Switcher (Household/Individual), Language (FR/EN), Theme (Dark/Light).
 *   *Security:* Log Out, Privacy Controls.

 **B. Tiny-App Specific Settings (Contextual Preferences)**
 Accessed *only* from within a specific mini-app's local navigation. These govern how data is viewed or managed within that
 silo, without affecting the other apps.
 *   *The Ledger Settings:* Default transaction sorting, bulk edit preferences.
 *   *The Vault Settings:* Hidden assets toggle, valuation display preferences.
 *   *The Compass Settings:* Custom budget goal overrides (tweaking the 70/20/10 ratio targets).

 ## 3. Technical Refactoring Strategy

 ### Phase 1: The Platform Portal & App Switcher (`index.html` & CSS)
 1.  Create the root "Launcher" view with three distinct App Icons.
 2.  Redesign the global shell to include the App Switcher (9-dot icon) in the top-left, replacing the standard sidebar toggle.
 3.  Implement the Profile Drawer component for quick platform-wide settings.
 4.  Ensure the header dynamically updates its branding (title and accent color) based on the active app.

 ### Phase 2: Router Upgrade (`app-router.js`)
 1.  Introduce a rigid `currentApp` state variable.
 2.  Update module registration. Modules must belong to a specific `appId` (e.g., `appId: 'ledger'`).
 3.  Modify the navigation rendering logic. When `currentApp` is 'ledger', the router must *exclusively* render the navigation
 for 'Transactions', 'Categories', and 'Accounts'. Modules from other apps must be completely invisible to the routing UI unless
 the user explicitly switches apps via the App Switcher.

 ### Phase 3: Settings & Contextual Relocation
 1.  Consolidate CSV Import/Export, Backup, and Factory Reset into the `settings-module.js`, treating it as the Platform Global
 Settings console.
 2.  Design lightweight "Settings" tabs or modals specifically within each of the three mini-apps for their Tiny-App Specific
 preferences.

 ## 4. Verification & Testing
 *   **Total App Isolation:** Verify that a user cannot see or navigate to a "Vault" module while inside "The Ledger" without
 using the App Switcher.
 *   **Branding Consistency:** Ensure the header correctly adopts the name and color of the active application immediately upon
 launch.
 *   **State Persistence:** Confirm that changing the shared month in the Global Shell correctly updates the data context for
 all apps, preserving the illusion of separate apps running on a unified platform.
 *   **Settings Boundary Check:** Ensure no app-specific setting accidentally overwrites or lives in the Platform Global
 Settings.

 ## 5. Rollback Strategy
 *   Maintain the existing `group` metadata in modules. If the strict app isolation causes severe workflow friction, the router
 can be temporarily configured to render an "All Apps" mega-menu in a unified sidebar as a fallback.