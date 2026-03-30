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
- **MONTH**: Stores metadata for a specific month.
  - `id`: string (YYYY-MM)
  - `status`: string (e.g., "closed")

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
  2. The system calculates an end date boundary for generation: `boundaryDate = startDate + 36 months`.
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
  4. It batch-generates new child transactions for the new template (up to the 36-month boundary).

#### 2.3.5 Delete a Single Transaction
- **Process**: The `TRANSACTION` document is deleted from Firestore.

#### 2.3.6 Delete a Recurring Series
- **Process**: Both the `RECURRING_TEMPLATE` and ALL associated `TRANSACTION` documents are deleted.

### 2.4 Data Import / Export

##### 2.4.1 Export/Import Transactions & Accounts
- **Process**: Supports CSV export and import for both transactions and accounts. Import is a destructive action that replaces existing records.

### 2.5 Navigation Menu & UI Layout

The application is organized into five main sections:

- **Dashboard**: Displays key financial indicators (Balance, Income, Expenses, Emergency Fund), visual charts, and anticipated one-off expenses. Includes the "Clôture du mois" feature.
- **Transactions**: Dedicated list view for managing month-specific transactions.
  - **Search**: By label, category, or amount.
  - **Filters**: By category or account.
  - **Sorting**: By Date, Account, Type, Category, or Amount.
  - **Columns**: Date, Type, Category, Amount, Label, Actions.
- **Accounts**: Centralized management of financial accounts.
  - **Month Selection**: Affects the balance calculations shown.
  - **Search**: By name or balance.
  - **Filters**: By account type (Current/Savings).
  - **Sorting**: By Name, Type, or Balance.
  - **Columns**: Label, Tag (is savings), Balance, Actions.
- **Categories**: Management of transaction categories and their visual ordering.
- **Settings**: CSV import/export and data reset options.

#### Shared Month Selection Component
A horizontal selectable bar displayed at the top of the Dashboard and Transactions views.
- **Visibility**: Visible in Dashboard and Transactions views ONLY. Hidden in Accounts, Category, and Settings views.
- **Persistence**: The selected month is stored in `localStorage`.
- **Configuration**: User can configure the range and step in the Settings view:
  - **Start Date**: Defines the first month/quarter shown.
  - **End Date**: Defines the last month/quarter shown.
  - **Step**: Can be set to "Mensuel" (monthly) or "Trimestriel" (quarterly).
- **Sticky Display**: The selector remains visible at the top of the screen when scrolling for better usability.

---

### Mobile Floating Action Button (FAB)
- **Purpose**: Quick access to "Add Transaction".
- **Visibility**: Visible on the Transactions view ONLY, and only if the current selected month is NOT closed.

---

## 3. Key Indicator Calculations

### Calculation Model
The system uses **Batch Generation** for recurring transactions, simplifying calculations as all future transactions within the generation window already exist as database records.

### 3.1 Monthly Income
Sum of all `TRANSACTION` documents for the month where `source` is empty, plus forecasting for periods beyond the 36-month batch window using arithmetic series.

### 3.2 Account Balance
Calculated from the account's `initialBalance` at `initialBalanceDate`, plus all `destination` transactions and minus all `source` transactions up to the target date (including forecasting).

### 3.3 Emergency Fund
Sum of balances for all accounts marked `isSavings: true`.

### 3.4 Monthly Spending
Sum of all `TRANSACTION` documents for the month where `destination` is empty, plus forecasting for periods beyond the 36-month batch window.
