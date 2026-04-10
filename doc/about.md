# Strady Budget - Functional Specifications

This document outlines the functional specifications for the Strady Budget application. It is intended to be used as a reference for development and as input for AI-assisted feature creation.

## 1. Core Data Entities

The system revolves around the following data entities, all of which are scoped to the authenticated user (`users/{userId}/...` in Firestore).

- **USER**: The authenticated user via Firebase Authentication.
- **ACCOUNT**: A financial account belonging to the user (e.g., checking, savings).
  - `id`: string (unique)
  - `name`: string
  - `initialBalance`: float
  - `initialBalanceDate`: string (YYYY-MM-DD)
  - `isSavings`: boolean
  - `balanceDirty`: boolean (true if balance needs background recalculation)
- **CATEGORY**: A user-defined category for transactions.
  - `id`: string (unique)
  - `label`: string
  - `icon`: string (FontAwesome class, e.g., `fa-car`)
  - `color`: string (hex code)
  - `index-order`: integer (for sorting)
- **TRANSACTION**: A single, non-recurring financial event.
  - `id`: string (unique-MM-DD)
  - `label`: string
  - `amount`: float
  - `source`: string (either an `ACCOUNT.id` or an empty string `""` for external income)
  - `destination`: string (either an `ACCOUNT.id` or an empty string `""` for external expenses)
  - `Category`: string (`CATEGORY.id`)
  - `Model`: string (`RECURRING_TEMPLATE.id`), `null` for single transactions.
- **RECURRING_TEMPLATE**: A template for generating recurring transactions.
  - `id`: string (unique, prefixed with `rec_`)
  - `date`: string (YYYY-MM-DD, the anchor/start date)
  - `label`: string
  - `amount`: float
  - `source`: string (`ACCOUNT.id` or `""`)
  - `destination`: string (`ACCOUNT.id` or `""`)
  - `category`: string (`CATEGORY.id`)
  - `recurring`: boolean (always `true`)
  - `endDate`: string (YYYY-MM-DD, optional)
  - `periodicity`: string (`M` for Monthly, `Q` for Quarterly, `Y` for Yearly)
- **MONTH**: Stores metadata and pre-calculated balances for a specific month.
  - `id`: string (YYYY-MM)
  - `status`: string (e.g., "closed")
  - `balances`: map (accountId: float, the running balance at the end of the month)

---

## 2. Use Cases

### 2.1 Account Management (CRUD)

#### 2.1.1 Create an Account
- **Trigger**: User clicks "Add Account" in the accounts view.
- **Process**:
  1. A new `ACCOUNT` document is created in Firestore.
  2. The `id` is a generated unique ID.

#### 2.1.2 Edit an Account
- **Trigger**: User clicks the edit icon for an account.
- **Process**: The corresponding `ACCOUNT` document in Firestore is updated.

#### 2.1.3 Delete an Account
- **Trigger**: User clicks the delete icon for an account.
- **Constraints**: An account cannot be deleted if it is used in any `TRANSACTION` or `RECURRING_TEMPLATE`.

### 2.2 Category Management (CRUD & Reordering)

#### 2.2.1 Create a Category
- **Trigger**: User clicks "Add Category" in the settings view.
- **Process**: A new `CATEGORY` document is created in Firestore.

#### 2.2.2 Edit a Category
- **Trigger**: User clicks the edit icon for a category.
- **Process**: The corresponding `CATEGORY` document is updated in Firestore.

#### 2.2.3 Delete a Category
- **Trigger**: User clicks the delete icon for a category.
- **Constraints**: A category cannot be deleted if it is currently used.

#### 2.2.4 Reorder Categories
- **Trigger**: User drags and drops a category.
- **Process**: Batch update of `index-order` field for all affected categories.

### 2.3 Transaction Management (CRUD)

#### 2.3.1 Create a Single Transaction
- **Trigger**: User submits the transaction form with "Is Recurring" unchecked.
- **Process**: A new `TRANSACTION` document is created with `Model: null`.

#### 2.3.2 Create a Recurring Transaction
- **Trigger**: User submits the form with "Is Recurring" checked.
- **Process**:
  1. A new `RECURRING_TEMPLATE` document is created.
  2. The system calculates an end date boundary for generation: `boundaryDate = FUNCTIONAL_BOUNDARY_DATE`.
  3. **Case 1: User has NOT edited the end date**:
     - `RECURRING_TEMPLATE.endDate` remains `null` in Firestore.
     - The system batch-generates child transactions from `startDate` to `boundaryDate`.
  4. **Case 2: User HAS edited the end date**:
     - `RECURRING_TEMPLATE.endDate` is stored as provided.
     - The system batch-generates child transactions from `startDate` to `MIN(userEndDate, boundaryDate)`.

#### 2.3.3 Edit a Single Transaction
- **Process**: Updading a single transaction consists in delete-old and create-new. The system deletes the old transaction and creates a new one based on the updated details.

#### 2.3.4 Edit a Recurring Transaction
- **Process**: Updading a recurring transaction consists in delete-old and create-new.
  1. The system retrieves the parent `RECURRING_TEMPLATE`.
  2. It batch deletes the template and ALL its associated child transactions.
  3. It creates a new `RECURRING_TEMPLATE` with updated details.
  4. It batch-generates new child transactions for the new template (up to the `FUNCTIONAL_BOUNDARY_DATE`).

#### 2.3.5 Delete a Single Transaction
- **Process**: The `TRANSACTION` document is deleted from Firestore.

#### 2.3.6 Delete a Recurring Series
- **Process**: Both the `RECURRING_TEMPLATE` and ALL associated `TRANSACTION` documents are deleted.

### 2.4 Data Import / Export

##### 2.4.1 Export/Import Transactions & Accounts
- **Process**: Supports CSV export and import for both transactions and accounts. Import is a destructive action that replaces existing records.

### 2.5 Navigation Menu & UI Layout

The application uses a **Modular Plug-and-Play Architecture**. Each feature is a self-contained module that can be added or removed with minimal code changes. The UI is dynamically generated based on the registered modules.

- **Dashboard**: Displays key financial indicators and advanced visualizations.
  - **KPI Cards**: Global Balance, Monthly Income, Monthly Expenses, and Emergency Fund progress.
  - **Sankey Diagram**: A graphical flow chart showing how "Entrées" (external income) are dispatched into accounts, and then filtered into expense categories or savings transfers.
  - **Anticipated Expenses**: Highlights non-recurring expenses planned for the next 3 months.
  - **Budget Analysis**: Percentage of spending vs. income and end-of-month balance forecasts.
  - **Month Closure**: "Clôture du mois" feature to freeze a month and roll over balances.
- **Transactions**: Dedicated list view for managing month-specific transactions.
  - **Search**: Real-time filtering by label, category, or amount.
  - **Filters**: By category or account.
  - **Sorting**: By Date, Account, Type, Category, or Amount.
  - **Views**: Responsive design with a detailed table for desktop and a card-based list for mobile.
- **Accounts**: Centralized management of financial accounts.
  - **Search & Filters**: Filter by account type (Current/Savings) and search by name.
  - **Calculations**: Dynamically calculates balances for the selected period.
- **Categories**: Management of transaction categories.
  - **Customization**: Icons (FontAwesome) and color coding.
  - **Visual Ordering**: Support for manual drag-and-drop reordering.
- **Settings**: System configuration and data maintenance.
  - **Period Configuration**: Set the start/end range and step (Monthly/Quarterly) for the global month selector.
  - **Data Portability**: CSV import/export for both transactions and accounts.
  - **Data Reset**: Options to wipe transactions or the entire account structure.

#### Shared UI System
- **Global Router**: A centralized `AppRouter` handles view switching via URL hashes and manages the dynamic building of the navigation menu (desktop sidebar/top bar and mobile menu).
- **Month Selector**: A sticky, horizontal timeline selector visible on the Dashboard and Transactions views. It allows for instant context switching between different financial periods.
- **Dynamic Indicators**: Real-time data status indicator showing if the data is being served from local cache or is "Live" from Firestore.
- **Mobile Floating Action Button (FAB)**: Provides quick access to "Add Transaction" on relevant views when the selected month is open.


### 2.6 Account Balance Refresh (Asynchronous Aggregator)
- **Trigger**: Any addition, update, or deletion of an `ACCOUNT`, `TRANSACTION`, or `RECURRING_TEMPLATE`.
- **Process**: 
  1. The client-side system marks affected accounts with `balanceDirty: true`.
  2. A Firebase Cloud Function (`onTransactionWrite` or `onTemplateWrite`) is triggered.
  3. The function recalculates balances month-by-month from the month of the change (minus 1 month) up to the `FUNCTIONAL_BOUNDARY_DATE`.
  4. Recalculation is atomic (using transactions) and idempotent (using event IDs).
  5. Upon completion, the `balanceDirty` flag is cleared and a log is written to `system_logs`.
- **UI Indicator**: A spinning "stale" icon appears next to accounts and global balances while `balanceDirty` is true.

### 2.7 FUNCTIONAL_BOUNDARY_DATE
- **Definition**: The fixed upper limit for all financial calculations and transaction generation.
- **Rule**: Automatically set to December 31st of the current year + 3.
- **Usage**:
  - Sets the `endDate` for the global Month Selector.
  - Defines the stop date for the background balance recalculation job.
  - Used as the default `endDate` for recurring transaction generation if not specified by the user.

---

## 3. Key Indicator Calculations

### Calculation Model
The system uses **Batch Generation** for recurring transactions and **Pre-calculated Balances** for performance.

### 3.1 Monthly Income
Sum of all `TRANSACTION` documents for the month where `source` is empty.

### 3.2 Account Balance
The account balance for a selected month is retrieved from the `MONTH` collection. It represents:
`(Sum of Credits in Month) - (Sum of Debits in Month) + (Previous Month Balance)`.
The first month's balance is calculated relative to the account's `initialBalance` and `initialBalanceDate`.

### 3.3 Emergency Fund
Sum of balances for all accounts marked `isSavings: true`.

### 3.4 Monthly Spending
Sum of all `TRANSACTION` documents for the month where `destination` is empty.

---

## 4. Agentic Development Workflow

To ensure high-quality, specialized development, this project employs an **Agentic Multi-Agent Architecture**. This approach utilizes specialized AI agents, each acting as a senior software developer for a specific domain of the application.

### 4.1 Architecture Overview

The workflow is governed by a **Lead Developer (Master Agent)** who orchestrates the development process and coordinates between specialized **Domain Specialists**.

- **Lead Developer (Orchestrator):** Performs initial triage of user requests, identifies affected modules, and delegates tasks to the appropriate specialists. It also ensures cross-module consistency and manages global infrastructure (routing, state).
- **Domain Specialists:**
    - **Account Specialist:** Expert in account management and Firestore `ACCOUNT` entity logic.
    - **Category Specialist:** Master of classification, icons, and sorting.
    - **Transaction Specialist:** Specialist in the transaction lifecycle and complex recurring batch generation (FUNCTIONAL_BOUNDARY_DATE rule).
    - **Dashboard Specialist:** Focused on data visualization (Sankey, KPI Cards) and financial forecasting.
    - **Settings Specialist:** Manages system configuration and robust data portability (CSV Import/Export).
    - **Calculation Specialist:** Expert in the core financial engine and background balance recalculations (`MONTH` collection).

### 4.2 Specialist Handoffs

For features that span multiple modules (e.g., "Add a warning to the dashboard when a category exceeds its budget"), the Lead Developer manages the sequence:
1. **Category Specialist** provides the budget retrieval logic.
2. **Dashboard Specialist** implements the UI warning using that logic.
3. **Lead Developer** validates the integration and cross-module imports.

This modularity ensures that each part of the codebase is handled with deep domain expertise and consistent architectural patterns.
