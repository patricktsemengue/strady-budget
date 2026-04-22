# Strady Budget - Functional Specifications

This document outlines the functional specifications for the Strady Budget application. It is intended to be used as a reference for development and as input for AI-assisted feature creation.

## 1. Core Data Entities

The system revolves around the following data entities, all of which are scoped to the authenticated user (`users/{userId}/...` in Firestore).

- **USER**: The authenticated user via Firebase Authentication.
  - `isImporting`: boolean (true during CSV import to pause background refreshes)
- **ACCOUNT**: A financial account belonging to the user (e.g., checking, savings).
  - `id`: string (unique, derived from name: `acc_name`)
  - `name`: string (unique)
  - `createDate`: string (YYYY-MM-DD)
  - `isSaving`: boolean
  - `isInvestmentAccount`: boolean
  - `balanceDirty`: boolean (true if balance needs background recalculation)
- **CATEGORY**: A user-defined category for transactions.
  - `id`: string (unique, deterministic UUID based on label)
  - `label`: string (unique)
  - `nature`: string (REVENU, FIXE, QUOTIDIEN, LOISIR, EPARGNE)
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
- **ACCOUNT_BALANCE**: Stores the pre-calculated balance for a specific account and date.
  - `account_id`: string (FK to `ACCOUNT.id`)
  - `date`: string (YYYY-MM-DD)
  - `balance`: float

- **ASSET**: A non-liquid asset (Real Estate, shares, etc.).
  - `id`: string (unique)
  - `name`: string (unique)
- **ASSET_VALUE**: A value snapshot for an asset.
  - `id`: string (unique)
  - `asset_id`: string (FK to `ASSET.id`)
  - `date`: string (YYYY-MM-DD)
  - `value`: float
  - `quantity`: float
- **LIABILITY**: A debt or loan.
  - `id`: string (unique)
  - `name`: string (unique)
- **LIABILITY_VALUE**: A balance snapshot for a liability.
  - `id`: string (unique)
  - `liability_id`: string (FK to `LIABILITY.id`)
  - `date`: string (YYYY-MM-DD)
  - `value`: float

---

## 2. Use Cases

### 2.1 Wealth Management (Snapshot Monitoring)

#### 2.1.1 Track an Asset or Liability
- **Trigger**: User adds a new Wealth entity.
- **Process**:
  1. The system creates the parent entity (`ASSET` or `LIABILITY`).
  2. The system immediately creates the first value snapshot (`ASSET_VALUE` or `LIABILITY_VALUE`).
  3. No transactions are generated. Wealth is monitored via periodic "Estimation" updates.

#### 2.1.2 Update Wealth Value
- **Process**: The user adds a new snapshot with a more recent date. The Dashboard Net Worth calculation always uses the **latest available snapshot** for each entity.

### 2.1 Trésorerie Management (CRUD)

#### 2.1.1 Create an Account
- **Trigger**: User submits the "Add Account" form.
- **Process**:
  1. A new `ACCOUNT` document is created in Firestore.
  2. The `createDate` (YYYY-MM-DD) is stored.
  3. The system immediately writes exactly **one** `ACCOUNT_BALANCE` record for the `createDate` using the provided initial balance.
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
  3. The system delegates the delta application (`newInitialValue - oldInitialValue`) to the **Service Worker**.
  4. Once the Service Worker finishes updating all `ACCOUNT_BALANCE` records, it signals the UI to set `balanceDirty` to `false`.

#### 2.1.3 Delete an Account
- **Trigger**: User clicks the delete icon for an account.
- **Constraints**: An account **cannot be deleted** if it is referenced in any `TRANSACTION` or `RECURRING_TEMPLATE`. The "delete" button is disabled in the UI if transactions exist.
- **Process**: 
  1. The `ACCOUNT` document is deleted from Firestore.
  2. ALL associated `ACCOUNT_BALANCE` records for that account are deleted via a batch operation.

### 2.2 Analyses Management (CRUD & Reordering)

#### 2.2.1 Create a Poste (Category)
- **Trigger**: User clicks "Add Category" in the analyses view.
- **Process**: A new `CATEGORY` document is created in Firestore.

#### 2.2.2 Edit a Poste
- **Trigger**: User clicks the edit icon for a category.
- **Process**: The corresponding `CATEGORY` document is updated in Firestore. Poste updates (name, icon, color) are allowed even if the poste is assigned to transactions, as transactions reference the stable category ID.

#### 2.2.3 Delete a Poste
- **Trigger**: User clicks the delete icon for a category.
- **Constraints**: A category cannot be deleted if it is currently used in any `TRANSACTION` or `RECURRING_TEMPLATE`.

#### 2.2.4 Reorder Postes
- **Trigger**: User drags and drops a category.
- **Process**: Batch update of `index-order` field for all affected categories.

### 2.3 Transaction Management (CRUD)

#### 2.3.1 Create a Single Transaction
- **Trigger**: User submits the transaction form with "Is Recurring" unchecked.
- **Restriction**: The transaction `date` cannot be earlier than the `createDate` of the `source` account or the `destination` account.
- **Process**: 
  1. A new `TRANSACTION` document is created with `Model: null`.
  2. The system sets `balanceDirty` to `true` for affected accounts.
  3. The system sends a message to the **Service Worker** to refresh the source and destination account balances incrementally from `transaction.date`.
  4. Once the Service Worker completes the surgical updates, it signals the UI to set `balanceDirty` to `false`.

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
  5. The system requests a **full chronological sweep** from the Service Worker for the affected accounts to ensure all generated transactions are accounted for.

#### 2.3.3 Edit a Single Transaction
- **Process**: Updating a single transaction consists in delete-old and create-new. The system deletes the old transaction and creates a new one based on the updated details. This triggers balance refreshes via the Service Worker for both old and new dates/accounts.

#### 2.3.4 Edit a Recurring Transaction
- **Process**: Updating a recurring transaction consists in delete-old and create-new.
  1. The system retrieves the parent `RECURRING_TEMPLATE`.
  2. It batch deletes the template and ALL its associated child transactions.
  3. It creates a new `RECURRING_TEMPLATE` with updated details.
  4. It batch-generates new child transactions for the new template (up to the `FUNCTIONAL_BOUNDARY_DATE`).
  5. It triggers a **full chronological sweep** from the Service Worker for the affected accounts.

#### 2.3.5 Delete a Single Transaction
- **Process**: The `TRANSACTION` document is deleted from Firestore, and the Service Worker is notified to adjust the balances of affected accounts.

#### 2.3.6 Delete a Recurring Series
- **Process**: Both the `RECURRING_TEMPLATE` and ALL associated `TRANSACTION` documents are deleted, and the Service Worker performs a full account refresh.

### 2.4 Data Import / Export

##### 2.4.1 Export/Import Transactions & Accounts
- **Process**: Supports CSV export and import for both transactions and accounts. 
- **Refresh Management**: To ensure reliability, the `isImporting` flag is set to `true` on the User document. Once the bulk import is complete, the flag is cleared, and a single **global chronological sweep** is requested from the Service Worker for all accounts.

### 2.5 Navigation Menu & UI Layout

The application uses a **Modular Plug-and-Play Architecture**. Each feature is a self-contained module that can be added or removed with minimal code changes. The UI is dynamically generated based on the registered modules.

- **Dashboard**: Displays key financial indicators and advanced visualizations.
- **Flux & Prévisions**: Dedicated list view for managing month-specific operations. Features **Smart Grouping** by category with **MoM Variance Analysis**, allowing users to instantly see where spending has increased or decreased compared to the previous month.
- **Trésorerie**: Centralized management of liquid financial accounts.
- **Patrimoine**: High-level monitoring of assets and liabilities.
- **Analyses**: Configuration of budget posts and categories.

#### Shared UI System
- **Global Router**: A centralized `AppRouter` handles view switching via URL hashes and manages the dynamic building of the navigation menu.
- **Month Selector**: A horizontal timeline selector visible on the Dashboard and Flux & Prévisions views. It allows for context switching between different financial periods. Changing the month does **not** trigger a balance refresh; it only displays existing data.
- **Dynamic Indicators**: Real-time data status indicator showing if the data is being served from local cache or is "Live" from Firestore.
- **Mobile Floating Action Button (FAB)**: Provides quick access to "Add Transaction" on relevant views when the selected month is open.


### 2.6 Account Balance Refresh (Serverless Client-Side Aggregator)
- **Architecture**: All balance calculations are performed on the client's device using a **Service Worker**. This eliminates the need for expensive and slower Cloud Functions.
- **Trigger**: Any addition, update, or deletion of an `ACCOUNT`, `TRANSACTION`, or `RECURRING_TEMPLATE`.
- **Process**: 
  1. The transaction or account change is written to Firestore.
  2. The UI marks affected accounts with `balanceDirty: true`.
  3. The UI sends a `REFRESH_BALANCES` message to the Service Worker.
  4. The Service Worker (running on a background thread) executes the calculation logic:
     - **DELTA mode**: Surgically updates future records for a single transaction change.
     - **SWEEP mode**: Chronologically rebuilds the entire account timeline from the earliest transaction.
  5. The Service Worker writes the updated `ACCOUNT_BALANCE` documents to Firestore.
  6. Upon completion, the Service Worker sends a message back to the UI to clear the `balanceDirty` flag.
- **UI Indicator**: A spinning "stale" icon appears next to accounts and global balances whenever `balanceDirty` is true on an account.

### 2.7 FUNCTIONAL_BOUNDARY_DATE
- **Definition**: The fixed upper limit for all financial calculations and transaction generation.
- **Rule**: Automatically set to December 31st of the current year + 3.

---

## 3. Key Indicator Calculations

### Calculation Model
The system uses **Batch Generation** for recurring transactions and **Pre-calculated Balances** for performance.

### 3.1 Monthly Income
Sum of all `TRANSACTION` documents for the month where `source` is empty or "external".

### 3.2 Account Balance
The account balance for a selected month is retrieved from the `ACCOUNT_BALANCE` collection for the corresponding `account_id` and `date`.
For each account, the system picks the **last balance record** of the selected month (ranked by date ascending).
If no record exists for the month, it falls back to the latest balance record **before** the month.

### 3.3 Emergency Fund
Sum of balances for all accounts marked `isSaving: true`.

### 3.4 Monthly Spending
Sum of all `TRANSACTION` documents for the month where `destination` is empty or "external".
