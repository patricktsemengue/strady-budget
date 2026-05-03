# Family Wealth Management Expansion - Functional Backlog

This document outlines the strategic roadmap to evolve **Strady Budget** from a monthly cash-flow tracker into a comprehensive **Family Wealth Management** suite.

## 1. Core Architecture & Entity Model
*Shifting from simple accounts to Asset/Liability classes.*

| ID | Requirement | Description | Status |
|:---|:---|:---|:---|
| ARCH-01 | **Account Classification** | Add `account_type` (Asset, Liability, Equity) and `liquidity_status` (Liquid, Illiquid) to the account schema. | TO-DO |
| ARCH-02 | **Liability Tracking** | Enable accounts to have negative balances as a "default" state (e.g., Mortgages, Loans) with specific interest rate fields. | TO-DO |
| ARCH-03 | **Contributor Entity** | Introduce `member_id` to transactions to track which family member is responsible for a specific inflow/outflow. | TO-DO |
| ARCH-04 | **Shared vs. Private Flag** | Add a visibility toggle to accounts to distinguish between "Joint" family assets and "Individual" private holdings. | TO-DO |

## 2. Wealth Management (Assets & Liabilities)
*High-level monitoring via snapshots rather than transactions.*

| ID | Requirement | Description | Status |
|:---|:---|:---|:---|
| NW-01 | **Net Worth Dashboard** | New high-level view showing `Account Balances + Latest Asset Values - Latest Liability Values`. | TO-DO |
| NW-02 | **Asset Allocation Chart** | A Donut chart categorizing total wealth (e.g., 20% Shares, 50% Real Estate, 30% Cash). | TO-DO |
| NW-03 | **Asset Snapshot CRUD** | Create/Read/Update/Delete for Assets (name) and their Value History (date, value, quantity). | TO-DO |
| NW-04 | **Liability Snapshot CRUD** | Create/Read/Update/Delete for Liabilities (name) and their Value History (date, value, quantity) for manual debt tracking. | TO-DO |
| NW-05 | **Wealth Trajectory Chart** | A simple line chart projecting Net Worth trend based on historical snapshots. | TO-DO |
| NW-06 | **Liquidity Distribution** | Breakdown of immediately accessible cash vs. illiquid assets. | **DONE** |

## 3. Advanced Flow Modeling
*Distinguishing between spending and equity building.*

| ID | Requirement | Description | Status |
|:---|:---|:---|:---|
| TX-01 | **Principal/Interest Splitting** | Allow a single recurring flow (e.g., Mortgage) to be split: Interest = Expense, Principal = Transfer to Liability. | TO-DO |
| TX-02 | **Depreciation Schedules** | Automated monthly "Expense" flows for depreciating assets like vehicles. | TO-DO |
| TX-03 | **Investment Reinvestment** | Logic to handle Dividends/Interests that auto-increase an asset balance without leaving the account. | TO-DO |

## 4. Forecasting & "What-If" Scenarios
*Using the 36-month engine for future planning.*

| ID | Requirement | Description | Status |
|:---|:---|:---|:---|
| FC-01 | **Scenario Sandbox** | Ability to create "Draft" recurring templates to see their impact on the 3-year Net Worth projection. | TO-DO |
| FC-02 | **Savings Rate Tracker** | Monthly report showing the % of Income directed toward "Asset" accounts or "Liability" paydown. | TO-DO |
| FC-03 | **Debt-Free Date Calculator** | Dynamic calculation of when a Liability account will hit zero based on current recurring templates. | TO-DO |
| FC-04 | **Financial Runway (Burn Rate)** | Metric showing "Months of Survival" if all income stopped, based on liquid assets and average expenses. | TO-DO |

## 5. User Experience & The "10-Minute Health Check"
*Simplifying the interface for big-picture decision making.*

| ID | Requirement | Description | Status |
|:---|:---|:---|:---|
| UX-01 | **"Safe-to-Spend" Gauge** | Prominent dashboard indicator showing: `Income - Fixed Costs - Savings Goals - Unforecasted Buffer = Discretionary Remaining`. | TO-DO |
| UX-02 | **Bill Collapsing** | Transaction list view that collapses all items linked to a `Model` (recurring) into a single "Fixed Costs" row, exposing only variable spending. | TO-DO |
| UX-03 | **The "10-Minute Reconciliation"** | A side-by-side view of "Expected Account Balance" vs "Actual." One-click button to create an "Adjustment Transaction" for any divergence. | TO-DO |
| UX-04 | **Monthly "Victory" Sweep** | End-of-month notification if the "Safe-to-Spend" buffer was not fully utilized, suggesting a transfer to Investment accounts. | TO-DO |
| UX-05 | **Health Signal (Traffic Lights)** | Simple Green/Amber/Red indicators for the month: Green = On track, Amber = Buffer used, Red = Savings goals at risk. | TO-DO |
| UX-06 | **Collapsible Grouping** | Flux & Prévisions view grouped by Category with collapsible sections and "Expand/Collapse All" global toggle. State is persisted in localStorage. | **DONE** |
| UX-07 | **MoM Variance Analysis** | Category headers display the total amount for the month AND a percentage/absolute delta compared to the previous month. | **DONE** |
| UX-08 | **"Wealth Mode" Toggle** | A setting to silo user types: "Wealth-only" (hides transactions/budgeting modules) vs. "Full Suite" (shows everything). | TO-DO |

## 6. Profiled Entities Flat Model (PEFM)
*Multi-entity management with selective privacy.*

| ID | Requirement | Description | Status |
|:---|:---|:---|:---|
| PEFM-01 | **Entity Schema** | Add `entityId` to Accounts, Assets, Liabilities, Categories, and Transactions. | TO-DO |
| PEFM-02 | **Profile Definition** | Implement a `profiles` collection in Firestore to map UIDs to `visibleEntities` lists. | TO-DO |
| PEFM-03 | **State-Level Filtering** | Update `rebuildRecords` and calculation engines to honor the current user's authorized entities. | TO-DO |
| PEFM-04 | **Entity Selector UI** | Add a global "Entity Switcher" to filter the entire app by a specific entity (e.g., Alice, Bob, Joint). | TO-DO |
| PEFM-05 | **Admin View** | Create a "Family Admin" view to manage entities and member permissions. | TO-DO |
| PEFM-06 | **Cross-Entity Neutralization** | Ensure inter-entity transfers are neutralized in the "Global" view to avoid double-counting. | TO-DO |

## 7. Zero-Friction & "Ready-to-drive" Experience
*Anticipating user intent and automating "mechanical" steps.*

| ID | Requirement | Description | Status |
|:---|:---|:---|:---|
| RTD-01 | **Inline Dependency Upsert** | Create missing Categories or Accounts directly within the Transaction modal (dropdown "+ Create") without leaving the workflow. | TO-DO |
| RTD-02 | **Magic Input (NLP)** | Single smart text field to parse "Amount + Label + Date" (e.g., "50 Restaurant yesterday") and auto-create/assign entities. | TO-DO |
| RTD-03 | **Workflow Chaining** | After creating an Account, suggest immediate "Initialize Balance" or "New Transaction" with context pre-locked. | TO-DO |
| RTD-04 | **Smart Account Discovery** | Suggest account creation if a user types an unknown target in a Transfer/Source field. | TO-DO |
| RTD-05 | **Heuristic Auto-Categorization** | Record and apply label-to-category mappings (e.g., "Shell" always = "Fuel") to pre-fill 90% of manual entries. | TO-DO |
| RTD-06 | **Predictive Intent Mapping** | Detect keywords like "To" or "From" in labels to automatically toggle between Expense and Transfer modes. | TO-DO |
| RTD-07 | **"One-Click" Action Feed** | Dashboard cards for "Due Today" recurring items allowing confirmation with zero navigation. | TO-DO |

## 8. Financial Education & Philosophy
*Establishing the Strady principles as a comprehensive digital resource.*

| ID | Requirement | Description | Status |
|:---|:---|:---|:---|
| EDU-01 | **The Strady Digital Book** | Comprehensive digital book (200+ pages) deployed on a separate domain (e.g., `book.strady.app`) using a modern documentation engine (Docusaurus/GitBook). | TO-DO |
| EDU-02 | **Contextual Deep-Linking** | Link app features and KPI info modals directly to relevant chapters/paragraphs in the Digital Book for instant education. | TO-DO |
| EDU-03 | **Mastery Progress Integration** | Connect app-level mission completion with the Book UI via SSO (e.g., "You've mastered this concept" badges visible while reading). | TO-DO |
| EDU-04 | **Sovereignty Scorecard** | Interactive assessment/quiz in the Book site that recommends specific App Missions based on results. | TO-DO |
| EDU-05 | **Philosophical PWA** | Ensure the Digital Book is offline-ready for distraction-free reading of the Strady methodology. | TO-DO |

