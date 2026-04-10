
Always update @doc/about.md and/or @doc/erd.mermaid when you implement or change a functionality
Let's change account balance calculation.

# Asynchronous Account Balance Aggregator
Write a Firebase Cloud Function `refreshUserAccountBalance` to manage user's account balance calculation.

## Rules
### Single transaction:
 * When the user creates a single transaction 'T (date, amount, source, destination,...)' and the system successfully writes the transaction to firestore, and notifies the user.
 * Then, the cloud function calculates iteratively the source account balance and destination account balance.
 * The iteration loop through every month, from 'T.date - 1 month' to 'FUNCTIONAL_BOUNDARY_DATE' 

 
### Reccuring transaction
 * When the user creates a reccuring transaction 'Recc_T (date, amount, source, destination,...)' and the system successfully writes the 'RECCURING_TEMPLATE' and associated transacations to firestore.
 * Then, the cloud function calculates iteratively the source account balance and destination account balance.
 * The iteration loop through every month, from  'Recc_T.date - 1 month' to 'FUNCTIONAL_BOUNDARY_DATE' 
 
### Calculation
* For Source account: 'balance = balance - amount'
* For Destination account: 'balance = balance + amount'

### Log
Record the completion of the `refreshUserAccountBalance` task to a system_logs collection for audit.

### Exception
 * External accounts are ignored from the calculation. 
 
## Transaction deletion
 In case a transaction is deleted, the Cloud function should refresh the source and destination account balance
 
## Concurrency & Collision Requirements
 * Atomic Transactions: Use db.runTransaction() when updating balance documents to prevent race conditions when multiple transactions affect the same account simultaneously.

 * Idempotency: Implement a check using an operationId or the event.id to ensure the same backend process does not run twice for the same database write.

 * Batching: Since the window covers ~48 months, use writeBatch to ensure the propagation of balances across years is atomic (all months update, or none do).
 
## Shared Month Selector
 * Store the calculation of transaction so that, when the user select a month, the UI immediately displays the accounts balance.
 
## User login or navigate the account page
 * Keep the state of user account balance calculation. 
 * For every Account with a balanceDirty account Balance state , the `refreshUserAccountBalance` is executed.
 * The state is set back to "not dirty" is when the  `refreshUserAccountBalance` is executed successfully. 
## UI - Indicator
 * While the `refreshUserAccountBalance`is processing, the user sees a stale icon next to their account indicating that the balance is not refreshed yet. THe user can continue to navigate the application.

	
 
 
