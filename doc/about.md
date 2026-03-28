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
  2. If no `endDate` is provided, it is automatically set to 36 months from the start `date`.
  3. The system immediately **batch-creates** all `TRANSACTION` documents for the entire series, from the start `date` to the `endDate`. Each transaction is linked to the template via its `Model` ID.

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
  2. **Case 1 (New Start Date is Later):** If the transaction's new date is after the series' original start date, the original `RECURRING_TEMPLATE` is updated: its `endDate` is set to the day before the edited transaction's new date. All `TRANSACTION` documents linked to the old template with a `date` on or after the new start date are deleted.
  3. **Case 2 (New Start Date is Earlier or Same):** If the new date is on or before the original start date, the entire original `RECURRING_TEMPLATE` and all its child `TRANSACTION` documents are deleted.
  4. A **new** `RECURRING_TEMPLATE` is created with the updated details. Its `date` (start date) is the date of the transaction being edited.
  5. The system immediately **batch-creates** all `TRANSACTION` documents for this new series.

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

### 2.4 Data Import / Export

##### 2.4.1 Export Transactions & Templates
- **Trigger**: User clicks "Export Transactions" button.
- **Format**: CSV with header: `date,label,amount,source,destination,recurring,startdate,endate,periodicity,category`
- **Process**:
  - All `RECURRING_TEMPLATE` documents are written as rows with `recurring: 1`.
  - All `TRANSACTION` documents with `Model: null` are written as rows with `recurring: 0`.

##### 2.4.2 Import Transactions & Templates
- **Trigger**: User selects a CSV file via the "Import Transactions" input.
- **Process**:
  1. **DESTRUCTIVE ACTION**: Before importing, all existing `TRANSACTION` and `RECURRING_TEMPLATE` documents for the user are **deleted**.
  2. The CSV is parsed row by row.
  3. Account `source` and `destination` names are mapped to their corresponding `ACCOUNT.id`s.
  4. If a category name in the CSV does not exist, a new `CATEGORY` document is created.
  5. Rows with `recurring: 1` are imported as new `RECURRING_TEMPLATE` documents.
  6. Rows with `recurring: 0` are imported as new `TRANSACTION` documents.

##### 2.4.3 Export/Import Accounts
- **Trigger**: User clicks "Export Accounts" or selects a file for "Import Accounts".
- **Process**:
  - **Export**: Writes all `ACCOUNT` documents to a CSV with header: `Account,balance,date,saving`.
  - **Import**: **DESTRUCTIVE ACTION**. Deletes all existing `ACCOUNT` documents before creating new ones from the CSV file.
  - **Note**: This action does **not** delete existing transactions or recurring templates.

---

## 3. Key Indicator Calculations

This section describes how key financial indicators are calculated.

### Calculation Model

With the batch creation approach, all instances of recurring transactions exist as standard `TRANSACTION` documents in the database from the moment they are created. This greatly simplifies calculations. The system no longer needs to generate transactions "Just-In-Time" or distinguish between single and recurring transactions during calculations.

For any calculation (e.g., balance, income), the logic can simply query the unified set of `TRANSACTION` documents for the relevant period.

### 3.1 Monthly Income (Revenu du mois)

- **Process**:
  1. The system queries all `TRANSACTION` documents where the `date` falls within the selected month.
  2. It filters these transactions to find those representing income (empty `source` field).
  3. **Forecasting**: If the selected month is beyond the 36-month batch-generation window for any `RECURRING_TEMPLATE` with an empty `source`, the system calculates the forecasted income for that month using an arithmetic series (counting occurrences of the template within that specific month).
  4. The total monthly income is the sum of existing transaction amounts and forecasted recurring amounts.

### 3.2 Account Balance (Solde)

The balance of any single account at a given point in time is calculated as follows:

- **Process**:
  1. Start with the account's `initialBalance` as of its `initialBalanceDate`.
  2. Query all `TRANSACTION` documents with a `date` after the `initialBalanceDate` and up to the target date.
  3. Add the `amount` of every transaction where the account is the `destination`.
  4. Subtract the `amount` of every transaction where the account is the `source`.
  5. **Forecasting**: If the target date is beyond the 36-month window of batch-generated transactions for any active `RECURRING_TEMPLATE`, the system calculates the additional impact using an arithmetic series formula (counting occurrences of the recurring template between the end of the batch window and the target date) and adjusts the balance accordingly.

### 3.3 Emergency Fund (Fond d'urgence)

The emergency fund represents the total amount held in all savings accounts.

- **Process**:
  1. The system identifies all `ACCOUNT` documents where the `isSavings` flag is `true`.
  2. For each of these savings accounts, it calculates its current balance using the method described in section 3.2 (including forecasting).
  3. The total emergency fund is the sum of the balances of all these designated savings accounts.

### 3.4 Monthly Spending (Dépenses du mois)

- **Process**:
  1. The system queries all `TRANSACTION` documents where the `date` falls within the selected month.
  2. It filters these transactions to find those representing expenses (empty `destination` field).
  3. **Forecasting**: If the selected month is beyond the 36-month batch-generation window for any `RECURRING_TEMPLATE` with an empty `destination`, the system calculates the forecasted spending for that month using an arithmetic series (counting occurrences of the template within that specific month).
  4. The total monthly spending is the sum of existing transaction amounts and forecasted recurring amounts.