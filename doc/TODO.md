# Setting CSV Import/Export

To transform the CSV import/Exports into a unified backup system, fast, professional, and cross-platform, by implementing a single file format that reconstructs the entire application state.


## 1. Universal CSV Schema


Every row is identified by a **Type** column.


| Column | Description | Examples |
| :--- | :--- | :--- |
| **Type** | Defines the logic: `ACCOUNT`, `CATEGORY`, `TRANSACTION`, `RECCURING_TEMPLATE` | `ACCOUNT`, `TRANSACTION` |
| **Date** | `YYYY-MM-DD`: Account Creation Date, Transaction date, or Reccuring template anchor date. | `2024-03-15` |
| **Label** | Name of the account/category or description of the transaction. | `Salaire`, `Livret A` |
| **Value** | Monetary amount (Initial balance for accounts, Tx amount for others). | `1200.50`, `-45.00` |
| **Source** | The name of the source account. Default `External`| `Compte Courant`, `external` |
| **Destination** | The name of the destination account. Default `External` but source and destination cannot be the same.| `Livret A`, `external` |
| **Category** | The label of the category associated with the item. | `Alimentation`, `Loisirs` |
| **Icon** | (Metadata) FontAwesome icon class for Categories. | `fa-car`, `fa-house` |
| **Color** | (Metadata) Hex color for Categories. | `#3b82f6`, `#ef4444` |
| **Periodicity**| (Metadata) Frequency for templates (`M`, `Q`, `Y`). Default `M`.| `M` |
| **EndDate** | (Metadata) Expiration date for recurring templates. | `2025-12-31` |
| **IsSaving** | (Metadata) Flag for account type (1 for Savings, 0 for Current). | `1`, `0` |

---

## 2. Implementation Strategy

### Consolidated Workflow (Limited Clicks)
1. **One-Click Export:** A single "Exporter ma sauvegarde complète" button generates the Universal CSV containing the user's entire history and configuration.
2. **Universal Import:** Users upload **one file**. The system parses the `Type` column and routes data to the correct Firestore collections. The system pre-checks empty columns will not prevent a row to be mapped correctly.
  e.g. For the `RECCURING_TEMPLATE` type, the column `color` is not required. The column `periodicity` is optional and defaults to `M`. The column `endDate` is optional. The column `source` is mandata
3. **Auto-Dependency Resolution:** If a transaction references an account or category that doesn't exist, the system creates them automatically on-the-fly to ensure data integrity.
4. **Duplicate Prevention:** Before final save, a summary modal shows detected items and offers to "Skip Duplicates" based on deterministic ID matching (Date/Label/Amount).

### Responsive UX Strategy
*   **Desktop (Drag & Drop):**
    *   A large dashboard-style "Dropzone" in Settings.
    *   Side-by-side preview of data found in the CSV before confirming import.
*   **Mobile (Touch Portal):**
    *   Dropzone transforms into a large "Sélectionner un fichier" button for native OS file pickers.
    *   Export button pinned at the top for quick manual backups.

---

## 3. Technical Workflow Summary

*   **Atomic Batching:** Use `writeBatch` to commit all imported entities in chunks of 500 documents (Firestore limit).
*   **Entity Mapping:** On import, map CSV type to an entity and CSV names to generated UUIDs (deterministic) to link Transactions to their respective Accounts and Categories.
*   **Balance Engine Trigger:** Immediately trigger `markAccountsBalanceDirty(userId)` after import to recalculate the entire timeline based on the new backup.

## Outcome
Initial initialization is reduced from several minutes of entry to a **single file movement**. Veteran users gain a "Life Backup" that works across all devices with zero configuration.
