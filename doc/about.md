# Strady Budget - Functional Specifications

This document outlines the functional specifications for the Strady Budget application. It is intended to be used as a reference for development and as input for AI-assisted feature creation.

## 1. Core Data Entities

The system revolves around the following data entities, all of which are scoped to the authenticated user (`users/{userId}/...` in Firestore).

- **USER**: The authenticated user via Firebase Authentication.
  - `isImporting`: boolean (true during CSV import to pause background refreshes)
- **ACCOUNT**: A financial account belonging to the user (e.g., checking, savings).
  - `id`: string (unique, derived from name: `acc_name`)
  - `name`: string (unique)
  - `initialBalance`: float
  - `createDate`: string (YYYY-MM-DD)
  - `isSavings`: boolean
  - `balanceDirty`: boolean (true if balance needs background recalculation)
- **CATEGORY**: A user-defined category for transactions.
  - `id`: string (unique, derived from name: `cat_name`)
  - `label`: string (unique)
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
- **MONTH**: Stores metadata for a specific month.
  - `id`: string (YYYY-MM)
  - `status`: string (e.g., "closed")
- **ACCOUNT_BALANCE**: Stores the pre-calculated balance for a specific account and month.
  - `account_id`: string (FK to `ACCOUNT.id`)
  - `date`: string (YYYY-MM-DD)
  - `balance`: float

---

## 2. Use Cases

### 2.1 Account Management (CRUD)

#### 2.1.1 Create an Account
- **Trigger**: User submits the "Add Account" form.
- **Process**:
  1. A new `ACCOUNT` document is created in Firestore.
  2. The `initialBalance` and `createDate` (YYYY-MM-DD) are stored.
  3. The system immediately writes exactly **one** `ACCOUNT_BALANCE` record for the `createDate`.
  4. **No background refresh** is triggered at this stage (STOP rule).
  5. The `balanceDirty` flag is NOT set.

#### 2.1.2 Edit an Account
- **Trigger**: User clicks the edit icon for an account.
- **Constraints**: 
  - **Creation Date**: Cannot be set after the date of the oldest transaction involving this account. UI limits the date picker to `min(transaction.date) - 1 day`.
  - **Initial Balance**: If changed, the difference is applied as a delta to all existing `ACCOUNT_BALANCE` records for this account.
- **Process**: 
  1. The `ACCOUNT` document in Firestore is updated.
  2. The `balanceDirty` flag is set to `true`.
  3. The system applies the delta (`newInitialBalance - oldInitialBalance`) to all `ACCOUNT_BALANCE` records for the account.
  4. Once updated, `balanceDirty` is set to `false`.

#### 2.1.3 Delete an Account
- **Trigger**: User clicks the delete icon for an account.
- **Constraints**: An account **cannot be deleted** if it is referenced in any `TRANSACTION` or `RECURRING_TEMPLATE`. The "delete" button is disabled in the UI if transactions exist.
- **Process**: 
  1. The `ACCOUNT` document is deleted from Firestore.
  2. ALL associated `ACCOUNT_BALANCE` records for that account are deleted.

### 2.2 Category Management (CRUD & Reordering)

#### 2.2.1 Create a Category
- **Trigger**: User clicks "Add Category" in the settings view.
- **Process**: A new `CATEGORY` document is created in Firestore.

#### 2.2.2 Edit a Category
- **Trigger**: User clicks the edit icon for a category.
- **Process**: The corresponding `CATEGORY` document is updated in Firestore. Category updates (name, icon, color) are allowed even if the category is assigned to transactions, as transactions reference the stable category ID.

#### 2.2.3 Delete a Category
- **Trigger**: User clicks the delete icon for a category.
- **Constraints**: A category cannot be deleted if it is currently used in any `TRANSACTION` or `RECURRING_TEMPLATE`.

#### 2.2.4 Reorder Categories
- **Trigger**: User drags and drops a category.
- **Process**: Batch update of `index-order` field for all affected categories.

### 2.3 Transaction Management (CRUD)

#### 2.3.1 Create a Single Transaction
- **Trigger**: User submits the transaction form with "Is Recurring" unchecked.
- **Restriction**: The transaction `date` cannot be earlier than the `createDate` of the `source` account or the `destination` account.
- **Process**: 
  1. A new `TRANSACTION` document is created with `Model: null`.
  2. The system sets `balanceDirty` to `true` for affected accounts.
  3. The system triggers a backend job to refresh the source and destination account balances incrementally from `transaction.date`.
  4. Once refreshed, `balanceDirty` is set to `false`.

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
  5. The system triggers a backend job to refresh the source and destination account balances for all generated child transactions.

#### 2.3.3 Edit a Single Transaction
- **Process**: Updating a single transaction consists in delete-old and create-new. The system deletes the old transaction and creates a new one based on the updated details. This triggers balance refreshes for both old and new dates/accounts.

#### 2.3.4 Edit a Recurring Transaction
- **Process**: Updating a recurring transaction consists in delete-old and create-new.
  1. The system retrieves the parent `RECURRING_TEMPLATE`.
  2. It batch deletes the template and ALL its associated child transactions.
  3. It creates a new `RECURRING_TEMPLATE` with updated details.
  4. It batch-generates new child transactions for the new template (up to the `FUNCTIONAL_BOUNDARY_DATE`).
  5. It triggers a full balance refresh for affected accounts.

#### 2.3.5 Delete a Single Transaction
- **Process**: The `TRANSACTION` document is deleted from Firestore, and account balances are updated accordingly.

#### 2.3.6 Delete a Recurring Series
- **Process**: Both the `RECURRING_TEMPLATE` and ALL associated `TRANSACTION` documents are deleted, and account balances are refreshed.

### 2.4 Data Import / Export

##### 2.4.1 Export/Import Transactions & Accounts
- **Process**: Supports CSV export and import for both transactions and accounts. 
- **Uniqueness**: Both accounts and categories must have unique names.
- **Auto-Creation**: During transaction import, if a referenced account or category does not exist, it is automatically created "on the fly".
- **Refresh Management**: To prevent performance issues, the `isImporting` flag is set to `true` during the process, which causes Cloud Functions to skip background recalculations. A single full recalculation is triggered once the import is complete.

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
  1. The transaction `T` is written to the database.
  2. A backend job is triggered to refresh source and destination account balances.
  3. The system calculates the start date: `balanceDate = T.date`.
  4. It iterates from `balanceDate` to `FUNCTIONAL_BOUNDARY_DATE`.
  5. For each affected account balance record:
     - If an `ACCOUNT_BALANCE` record exists for the date, it is updated: `balance = balance ± amount`.
     - If no record exists for the exact date, a new one is created by finding the latest balance *prior* to that date and adding/subtracting the amount.
  6. The process is atomic and idempotent.
- **UI Indicator**: A spinning "stale" icon appears next to accounts and global balances whenever `balanceDirty` is true on an account (meaning a calculation is pending).

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
Sum of all `TRANSACTION` documents for the month where `source` is empty or "external".

### 3.2 Account Balance
The account balance for a selected month is retrieved from the `ACCOUNT_BALANCE` collection for the corresponding `account_id` and `date`.
For each account, the system picks the last balance record of the selected month (ranked by date ascending).
If no record exists for the month, it falls back to the latest balance record before the month, or the account's initial balance.

### 3.3 Emergency Fund
Sum of balances for all accounts marked `isSavings: true`.

### 3.4 Monthly Spending
Sum of all `TRANSACTION` documents for the month where `destination` is empty or "external".

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
