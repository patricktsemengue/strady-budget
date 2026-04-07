
# Requirement 2026-04-06_1540

Always update @doc/about.md and/or @doc/erd.mermaid when you implement or change a functionality

# Account management

## Shared Month selector
Make the Shared Month selector at the account page.

Given the user is at the account page,
When the user select a month on the month selector, 
The system displays the accounts:
* Account name
* Type (courant, épargne)
* Solde (the selected month account balance calculated by the balance of all transactions added to the previous month balance)
* Actions (edit, delete button)

## Display account balance ('Solde') of the selected month.
The system reads
 * (1) the sum all transaction that credits the accounts at the selected month,
 * (2) the sum all transaction that debits the accounts at the selected month,
 * (3) the account previous month balance.
The account balance on the selected month is (1) - (2) + (3).


## Triggering the calculation of the account balance.
Given that the user has created a single transacation "T"
When the transaction "T" is successfully stored in the database,
then the system triggers a backend job to refresh the balance of ALL the user's accounts.
The starting point to refresh is T.date :
 1. The job retrieves the previous month (T.date - 1 month) balance of all accounts
 2. THe job retrieves all transactions from the current month (based on T.date) to FUNCTIONAL_BOUNDARY_DATE
 3. The Job calculates the balance of all accounts, from the current month (based on T.date) to FUNCTIONAL_BOUNDARY_DATE

Given that the user has created a reccuring transaction "reccT"
 When the template "reccT" is successfully stored in the database,
 and child transactions are successfully stored in the database,
Then the system triggers a backend job to refresh the balance of ALL the user's accounts.
The starting point to refresh is reccT.date :
1. The job retrieves the previous month (reccT.date - 1 month) balance of all accounts
2. The job retrieves all transactions from the current month (based on reccT.date) to FUNCTIONAL_BOUNDARY_DATE
3. The job calculates the balance of all accounts from the current month (based on reccT.date) to FUNCTIONAL_BOUNDARY_DATE



# FUNCTIONAL_BOUNDARY_DATE - General rule
When the user logs in and is successfully authenticated, the FUNCTIONAL_BOUNDARY_DATE is autmatically set to the 31st december of the current year + 3.

e.g. As the current year is 2026, the FUNCTIONAL_BOUNDARY_DATE = "2029-12-31"
When we will be in 2030, the FUNCTIONAL_BOUNDARY_DATE will be automatically set to "2033-12-31"

## Applying FUNCTIONAL_BOUNDARY_DATE

### Apply FUNCTIONAL_BOUNDARY_DATE on reccuring transaction batch generation
the system must limit the batch generation of a template's child transactions up to FUNCTIONAL_BOUNDARY_DATE.
Operations based on a 36-month windows are no longer required.
Iterative operations based on arithmetic series formla are no longer required.


### Dashboard key indicator forecasting
the system must limit all iterative operations on physical transactions only up to FUNCTIONAL_BOUNDARY_DATE.
Operations based on arithmetic series formula are no longer required.

### Account balance
the system must limit all iterative operations on physical transactions only, from the transaction/template date anchor date up to FUNCTIONAL_BOUNDARY_DATE.

## Apply FUNCTIONAL_BOUNDARY_DATE on Shared Month selector configuration
When the user configures the dates of the shared month selector in the setting UI, the end date must be limited up to FUNCTIONAL_BOUNDARY_DATE.

The periodicity "Step" is always 1 month. The "Step" field must be deleted