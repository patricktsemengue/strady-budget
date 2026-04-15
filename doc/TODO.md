# Review Datamodel

## Account and AccountBalance

```
    ACCOUNT {
        string id PK
        string name unique
        string createDate "yyyy-MM-dd"
        boolean isSaving
        timestamp updated_at
    }

    ACCOUNT_BALANCE {
        string accound_id FK "references ACCOUNT.id"
        string date
        float balance
        timestamp updated_at
    }
```

## Account Balance calculation
## Single transaction
Given that the user has created a single transacation "T(date, amount, source, destination, label, category)" 
When the transaction "T" is successfully stored in the database,
Then the system triggers a backend job to refresh the source and destination account balances.

### Calculation logic
 1. The user creates the transaction `T`, which is immediately writen to the database.

 2. The system calculates the source and destination account balances. The calculation iterates monthly from `T.Date` to FUNCTIONAL_BOUNDARY_DATE. 

 ```
 balanceDate = T.date

 CalculateBalance(balanceDate, T.source, -T.amount, FUNCTIONAL_BOUNDARY_DATE)
 
 CalculateBalance(balanceDate, T.destination, T.amount, FUNCTIONAL_BOUNDARY_DATE)

 CalculateBalance(balanceDate, targetAccount, amount, endDate) ==> {

    AccountBalance = SqlQuery("Select * from ACCOUNT_BALANCE where date >= `balanceDate` and date <= `endDate` and account_id =`targetAccount.id`")

    if AccountBalance is NULL {

        SqlQuery("INSERT INTO ACCOUNT_BALANCE (account_id, balanceDate, balance, updated_at) VALUES (`targetAccount.id`, `_balanceDate` , `amount`, now())")

        /*  
        With transaction `T("2026-03-12", 100, "CBC", "BEL", "Epargne XYZ","Vacances")`

        The system creates the initial account balance [("cbc", "2026-03-12", 100, ...)]
        */
    }
    else {
           
        AccountBalance.forEach(acc) ==>{
            SQLQuery("INSERT INTO ACCOUNT_BALANCE (account_id, date, balance, updated_at) VALUES (`targetAccount.id`, `balanceDate` , `acc.balance + amount`, now())")
        }
        
        /*  
        With transaction `T("2026-03-12", 100, "CBC", "BEL", "Epargne XYZ","Vacances")`

        if the source Account Balance before transaction was
        [ 
            ("cbc", "2026-01-01", 10, ...), 
            ("cbc", "2026-02-01", 20, ...), 
            ("cbc", "2026-03-01", 20, ...), 
            ("cbc", "2026-04-01", 30, ...)
        ]

        Then, the Source Account Balance will be reduced by "100" after transaction : 
        [ 
            ("cbc", "2026-01-01", 10, ...), 
            ("cbc", "2026-02-01", 20, ...), 
            ("cbc", "2026-03-01", 20, ...), 
            ("cbc", "2026-03-12", -80, ...), 
            ("cbc", "2026-04-01", -70, ...)
        ].

        destination Account Balance is increased of '100' after the transaction.

        */
        
    }
  }
 ``` 


## Reccuring transaction
Given that the user has created a reccuring transacation "Recc_T(date, amount, source, destination, label, category, periodicity, endDate)",

And the system has successfully stored the `RECCURING_TEMPLATE` in the database,
And the child transactions are also successfully stored in the database,

Then the system triggers a backend job to refresh the source and destination account balances.

### Calculation logic
 1. The user creates the reccuring transaction `Recc_T`, which is immediately writen to the database.

 2. The child transactions are also immediately writen to the database.

 3. The system calculates the source and destination account balances. The calculation iterates `Recc_T.Date` to FUNCTIONAL_BOUNDARY_DATE. 

 ```
 balanceDate = T.date

 endDate = if (Recc_T.endDate is null) ? FUNCTIONAL_BOUNDARY_DATE : Recc_T.endDate

 transactions = SqlQuery("SELECT * FROM Transaction t where t.model = `Recc_T.id`")

 transactions.forEach(t) ==>{
    CalculateBalance(balanceDate, Recc_T.source, -Recc_T.amount, endDate)

    CalculateBalance(balanceDate, Recc_T.destination, Recc_T.amount, endDate)
 }

 ```

## Account Balance UI visualization
The user selects a month in the Shared Month Selector

The system retrieves from the database the user's account
The system retrieves the account balance of each account of the selected month.
For each account having several account balances on the selected month, the system picks the last one ranked by date ascending order.

```sql
SELECT ab.account_id, ab.balance
FROM ACCOUNT_BALANCE ab
WHERE ab.date = (
    SELECT MAX(sub.date)
    FROM ACCOUNT_BALANCE sub
    WHERE sub.account_id = ab.account_id
      AND MONTH(sub.date) = SELECTED_MONTH
      AND YEAR(sub.date) = SELECTED_YEAR
)
AND MONTH(ab.date) = SELECTED_MONTH
AND YEAR(ab.date) = SELECTED_YEAR;
```

The application cache (localstorage) is always refreshed when new transactions are written to the database.


## Account creation - deletion - update

### Account creation
The user creates a new account with an initial Balance and date.

The system writes the account to the database.

The system immediately write the CreateDate's month account balance, then STOP.


 e.g. 
 The user creates the new account A :
 
    * Name : CBC
    * Initial Balance : 1000
    * Date initial Balance : 2026-03-13
    * Saving account : false

 The system writes to the database the ACCOUNT("cbc", "CBC", "2026-03-13", false, now())

 And the system writes the ACCOUNT_BALANCE("cbc", "2026-03-13", 1000, now())
 
 AND STOP.  No backend refresh from 0 to FUNCTIONAL_BOUNDARY_DATE.

### Account delete
The user cannot delete an account that is involved in a transaction.

The button "delete" is disabled.

### Account Update
The user can update an account by changing:
 * the name
 * initial balance
 * creation date
 * Saving account (yes / no)



#### Logic to modify the account Creation Date
Given an account
When the user selects the date field
Then the system searches for the very oldest transaction on that account
```
    SELECT MIN(t.date) FROM TRANSACTION t
     WHERE t.source = SELECTED_ACCOUNT
      or t.destination = SELECTED_ACCOUNT
```
If found, the system limits the date picker up to t.date - 1 day.
i.e. The Creation Date can be changed only up to the first transaction's date occured to that account.

The system displays a firendly: because there is a transaction at `t.date`, The user cannot select a date after `t.date`.


#### Logic to modify the account Initial Balance
Given an account
When the user edit the initial balance and saves,
Then 
The system keeps in memory the old initial balance. `e.g. oldInitialBalance = 1000`
The system keeps in memory the edited new initial balance. `e.g. newInitialBalance = 2000`
The system searches for the account balances
```
    SELECT * FROM ACCOUNT_BALANCE ab
     WHERE ab.account_id = SELECTED_ACCOUNT
```
The system applies the difference betwen the old and new inial balance to all account balances.
```
    UPDATE ACCOUNT_BALANCE ab
    SET ab.balance = ab.balance + (newInitialBalance - oldInitialBalance)
    WHERE ab.account_id = SELECTED_ACCOUNT
```

#### Logic to Dirty Account Balance
The creation of an account does not set the account balance dirty.

The update of an account set the account balance dirty. However, upon adapting the account balance with the delta introduced by the new value, the account balance are no longer dirty.

Transaction creation set the account balance dirty. However, upon refreshing the account balance, the account balance are no longer dirty.



#### Transaction restriction
When the user creates a transaction (T) or Reccuring transaction (T),
And the T.date is before source.createDate or T.date is before destination.createDate
THen, the system stops the creation and display a friendly error message : the transaction cannot be created before the involved account.
















