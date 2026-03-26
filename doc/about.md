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
  - `id`: string (unique)
  - `date`: string (YYYY-MM-DD)
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
- **Trigger**: User clicks "Add Account" in the settings view.
- **UI**: `add-account-form` drawer.
- **Inputs**:
  - `name`: string
  - `initialBalance`: float
  - `initialBalanceDate`: date
  - `isSavings`: boolean
- **Process**:
  1. A new `ACCOUNT` document is created in Firestore under `users/{userId}/accounts`.
  2. The `id` is a generated unique ID (`acc_` + random string).
  3. The drawer closes and a success notification is shown.

#### 2.1.2 Edit an Account
- **Trigger**: User clicks the edit icon for an account in the settings view.
- **UI**: `edit-account-form` drawer.
- **Process**:
  1. The form is pre-filled with the selected account's data.
  2. User modifies the data and submits.
  3. The corresponding `ACCOUNT` document in Firestore is updated.
  4. The drawer closes and a success notification is shown.

#### 2.1.3 Delete an Account
- **Trigger**: User clicks the delete icon for an account in the settings view.
- **Constraints**:
  - An account cannot be deleted if it is used as a `source` or `destination` in any existing `TRANSACTION` or `RECURRING_TEMPLATE`.
- **UI Behavior**:
  - The "delete" button for an account is disabled if the account is currently in use. A tooltip explains why it is disabled.
  - The button is enabled only when the account is not associated with any transaction or template.
- **Process**:
  1. User clicks the enabled delete button.
  2. A confirmation dialog is shown ("Êtes-vous sûr de vouloir supprimer ce compte ? Cette action est irréversible.").
  3. Upon confirmation, the system performs a final check to ensure the account is not in use.
  4. If the check passes, the corresponding `ACCOUNT` document is deleted from Firestore.
  5. If the check fails (e.g., UI out of sync), an error message is displayed.

### 2.2 Category Management (CRUD & Reordering)

#### 2.2.1 Create a Category
- **Trigger**: User clicks "Add Category" in the settings view.
- **UI**: `add-category-form` drawer.
- **Inputs**:
  - `label`: string
  - `icon`: string (e.g., `car`, `home`)
  - `color`: hex color code
- **Process**:
  1. A new `CATEGORY` document is created in Firestore.
  2. The `index-order` is set to be the highest existing `index-order` + 1.

#### 2.2.2 Edit a Category
- **Trigger**: User clicks the edit icon for a category.
- **UI**: `edit-category-form` drawer.
- **Process**: The corresponding `CATEGORY` document is updated in Firestore.

#### 2.2.3 Delete a Category
- **Trigger**: User clicks the delete icon for a category.
- **Constraints**:
- A category cannot be deleted if it is currently used by any `TRANSACTION` or `RECURRING_TEMPLATE`.
- **Process**:
  1. The system checks if the category is in use. If so, the delete button is disabled with an explanatory title.
  2. If not in use, a confirmation dialog is shown.
  3. Upon confirmation, the `CATEGORY` document is deleted from Firestore.

#### 2.2.4 Reorder Categories
- **Trigger**: User drags and drops a category in the management list (`mgmt-categories-list`).
- **Process**:
  1. The `onEnd` event of the SortableJS library is fired.
  2. The new visual order of the list items is used to calculate the new `index-order` for each category.
  3. A batch write is sent to Firestore to update the `index-order` field for all affected categories.

### 2.3 Transaction Management (CRUD)

#### 2.3.1 Create a Single Transaction
- **Trigger**: User clicks "Add Transaction" and submits the form with "Is Recurring" unchecked.
- **UI**: `transaction-modal` / `transaction-form`.
- **Inputs**: `label`, `amount`, `date`, `Category`, `source`, `destination`.
- **Validation**:
  - `source` and `destination` cannot both be empty (`""`).
  - An empty `source` implies income (external source).
  - An empty `destination` implies an expense (external destination).
- **Dynamic Behavior**:
  - If `source` is `""`, the `Category` field defaults to the "Revenu" category.
  - If `destination` is `""`, the `Category` field defaults to the "Autre" category.
- **Process**: A new `TRANSACTION` document is created with `Model: null`.

#### 2.3.2 Create a Recurring Transaction
- **Trigger**: User clicks "Add Transaction" and submits the form with "Is Recurring" checked.
- **UI**: `transaction-modal` / `transaction-form` with `recurring-fields` visible.
- **Inputs**: Same as a single transaction, plus `periodicity` and optional `endDate`.
- **Process**:
  1. A new `RECURRING_TEMPLATE` document is created. The `id` is prefixed with `rec_`.
  2. **No initial `TRANSACTION` is created by this action.** Transactions are generated Just-In-Time (see 2.4).
  3. The `generateJitTransactions` function is called for the new template's starting month to ensure it appears immediately if relevant.

#### 2.3.3 Edit a Single Transaction
- **Trigger**: User edits a transaction that has `Model: null`.
- **Process**:
  1. A confirmation dialog is shown: "Êtes-vous sûr de vouloir remplacer cette transaction ? Cette action supprime l'ancienne et en crée une nouvelle."
  2. Upon confirmation, the original `TRANSACTION` document is **deleted** from Firestore.
  3. A **new** `TRANSACTION` document is created with a new ID and the updated details.

#### 2.3.4 Edit a Recurring Transaction (Series Split)
- **Trigger**: User edits a transaction that has a `Model` ID.
- **Process**: This action "splits" the recurring series to preserve history.
  1. A confirmation dialog is shown explaining the split.
  2. The original `RECURRING_TEMPLATE` is updated: its `endDate` is set to the day before the edited transaction's new date.
  3. All `TRANSACTION` documents linked to the old template (`Model` ID) with a `date` on or after the new start date are deleted.
  4. A **new** `RECURRING_TEMPLATE` is created with the updated details. Its `date` (start date) is the date of the transaction being edited.
  5. The `generateJitTransactions` function is called for the current month to generate the new transaction instance immediately.

#### 2.3.5 Delete a Single Transaction
- **Trigger**: User deletes a transaction with `Model: null`.
- **Process**: After confirmation, the `TRANSACTION` document is deleted from Firestore.

#### 2.3.6 Delete a Recurring Series
- **Trigger**: User deletes a transaction that has a `Model` ID.
- **Process**:
  1. A confirmation dialog is shown: "Voulez-vous supprimer cette transaction récurrente ET toutes les transactions liées ? (Action irréversible)"
  2. Upon confirmation, a batch delete operation is performed:
     - The `RECURRING_TEMPLATE` document is deleted.
     - **ALL** `TRANSACTION` documents (past, present, and future) that have the matching `Model` ID are deleted.

### 2.4 Just-In-Time (JIT) Transaction Generation

- **Trigger**: The user navigates to a new month (`setViewDate`) or logs in (`init`).
- **Function**: `generateJitTransactions(userId, monthKey)`
- **Process**:
  1. Fetches all `RECURRING_TEMPLATE` documents.
  2. Fetches all existing transactions for the given `monthKey` that were generated from a template (`Model != null`).
  3. For each template, it calculates the expected occurrence dates within the `monthKey` based on `periodicity` and the anchor `date`.
  4. It checks if the template is active for the month (i.e., `monthKey` is between the template's start and end dates).
  5. It compares the list of expected occurrences against the list of existing JIT transactions for that month.
  6. If an expected transaction does not exist, it is created in a batch write to Firestore. This ensures that if a template is created or updated, the corresponding transactions appear in the correct months when viewed.

### 2.5 Data Import / Export

#### 2.5.1 Export Transactions & Templates
- **Trigger**: User clicks "Export Transactions" button.
- **Format**: CSV with header: `date,label,amount,source,destination,reccuring,startdate,endate,periodicity,category`
- **Process**:
  - All `RECURRING_TEMPLATE` documents are written as rows with `reccuring: 1`.
  - All `TRANSACTION` documents with `Model: null` are written as rows with `reccuring: 0`.

#### 2.5.2 Import Transactions & Templates
- **Trigger**: User selects a CSV file via the "Import Transactions" input.
- **Process**:
  1. **DESTRUCTIVE ACTION**: Before importing, all existing `TRANSACTION` and `RECURRING_TEMPLATE` documents for the user are **deleted**.
  2. The CSV is parsed row by row.
  3. Account `source` and `destination` names are mapped to their corresponding `ACCOUNT.id`s.
  4. If a category name in the CSV does not exist, a new `CATEGORY` document is created.
  5. Rows with `reccuring: 1` are imported as new `RECURRING_TEMPLATE` documents.
  6. Rows with `reccuring: 0` are imported as new `TRANSACTION` documents.

#### 2.5.3 Export/Import Accounts
- **Trigger**: User clicks "Export Accounts" or selects a file for "Import Accounts".
- **Process**:
  - **Export**: Writes all `ACCOUNT` documents to a CSV with header: `Account,balance,date,saving`.
  - **Import**: **DESTRUCTIVE ACTION**. Deletes all existing `ACCOUNT` documents before creating new ones from the CSV file. This also implicitly deletes all transactions.

---

## 3. Key Indicator Calculations

This section describes how key financial indicators like monthly income, account balances (`solde`), and the emergency fund (`fond d'urgence`) are calculated. The calculations rely on the Just-In-Time (JIT) generation of transactions from recurring templates.

### The Role of Recurring Templates & JIT Generation

When calculating indicators for any given month, the system first calls the `generateJitTransactions` function (see section 2.4). This function ensures that all expected transactions from active `RECURRING_TEMPLATE`s for that month exist as actual `TRANSACTION` documents in the database.

This means that for any calculation within a specific month (past or present), the logic does not need to distinguish between single-entry transactions and recurring ones. It can simply query the unified set of `TRANSACTION` documents for that period, greatly simplifying the calculations.

### 3.1 Monthly Income (Revenu du mois)

- **Process**:
  1. The system queries all `TRANSACTION` documents where the `date` falls within the selected month.
  2. It filters these transactions to find those representing income. An income transaction is identified by its `source` field being empty (`""`).
  3. The monthly income is the sum of the `amount` field for all these filtered income transactions.

### 3.2 Account Balance (Solde)

The balance of any single account at a given point in time is calculated as follows:

- **Process**:
  1. Start with the account's `initialBalance` as of its `initialBalanceDate`.
  2. Query all `TRANSACTION` documents with a `date` after the `initialBalanceDate`.
  3. Add the `amount` of every transaction where the account is the `destination`.
  4. Subtract the `amount` of every transaction where the account is the `source`.

### 3.3 Emergency Fund (Fond d'urgence)

The emergency fund represents the total amount held in all savings accounts.

- **Process**:
  1. The system identifies all `ACCOUNT` documents where the `isSavings` flag is `true`.
  2. For each of these savings accounts, it calculates its current balance using the method described in section 3.2.
  3. The total emergency fund is the sum of the balances of all these designated savings accounts.