
# Requirement 2026-03-28_2100
To remove the JIT transaction generation approach for reccuring transactions
To implement a batch generation approach for reccuring transactions:
 * The system will batch create all the periodic transactions within a 36-month interval, starting from the anchor date, and limited at the enddate.





## Datamodel.

Unchanged!

## Create transaction 
The user clicks on the button to add a new transaction via the GUI.

The system displays the Create Form : 
 * Date
 * Label
 * Amount
 * Source account (drop down list of existing account. Keep empty for external account)
 * Destination account (drop down list of existing accounts. Keep empty for external account)
 * Category (Drop down list of know categories)
 * Reccuring checkbox (to mention it when a transaction is a reccuring)
 * endDate (only available for reccuring transaction)
 * Periodicity (only for reccuring transaction)


The user edits the form and save.

Upon saving, the system display a toaster for error or success creation.

### Handling single transactions
THe system creates the single transaction in firestone.
```
Given two transaction T0 and T1, 
    IF T0.date = T1.date and
        T0.label = T1.label and 
        T0.amount = T1.amount and
        T0.source = T1.source and 
        T0.destination = T1.destination
     Then 
       T0 and T1 are the same transaction, and must have the same UUID.

The system cannot create duplicates of the same transaction.

```


### Handling reccuring transactions
The system create a reccuring_template in firestore : 

The system bacth creates all the periodic transaction within a 36-month interval from the starting date, and link them all to their parent reccuring template.

```
    Example, the user creates a monthly reccuring transaction starting on January 1st 2026:
     The system generates a reccuring template reccTemplateT0
        If no enddate is edited, the system generates 36 monthly single transactions linked to reccTemplateT0. THe system also forces reccTemplateT0.enddate to 31 December 2028 (36 months).

        if the endate was edited, 31st december 2026 for instance, the system generates only 12 monthly single transactions linked to the parent reccTemplateT0.


        Transaction cannot be duplicated based on the rule:       
        two transactions T0 and T1,  IF T0.date = T1.date and
        T0.label = T1.label and 
        T0.amount = T1.amount and
        T0.source = T1.source and 
        T0.destination = T1.destination 
     Then 
       T0 and T1 are the same transaction, and must have the same UUID.
```


## Update transaction 
The user click on a transaction "edit" button at the UI

The system displays the update transaction form prefilled, with the following fields:
For a single transaction (i.e. Model = null):
 * Date
 * Label
 * Amount
 * Source account
 * Destination account
 * Category
 

 For a reccuring transaction (i.e. Model != null):
 * Date
 * Label
 * Amount
 * Source account
 * Destination account
 * Category
 * Reccuring checkbox
 * endDate
 * Periodicity



The user edits the form and save.

The system updates the transaction in firestore.

The system displays a toaster for error or success creation.


### Handling single transaction
To update a single transaction, the system triggers:
- the Deletion of the selected transaction
- the creation of a new single transaction.
    The system cannot create duplicates of the same transaction(same date, amount, source, destination, label). "The transaction already exist" warnng message would be triggered.


### Handling reccuring transactions

``` 
 Rule: two reccuring templates reccT0 and reccT1 are the same
 IF reccT0.date = reccT1.date and
        reccT0.label = reccT1.label and 
        reccT0.amount = reccT1.amount and
        reccT0.source = reccT1.source and 
        reccT0.destination = reccT1.destination and
        reccT0.periodicity = reccT1.periodicity and
        reccT0.category = reccT1.category
     Then 
       reccT0 and reccT1 are the same transaction, and must have the same UUID.
```

To update a reccuring transaction, i.e Model!= reccTempateT0, 

 the system generates a new tempate (reccTemplateT1)
 if reccTemplateT1 = reccTemplateT0, the system continues with reccTemplateT0.
 if reccTemplateT1 != reccTemplateT0, then
   * case 1:  reccTemplateT1.date > reccTemplateT0.date
    The system updates reccTemplateT0 end Date: `reccTemplateT0.endDate = reccTemplateT1.date - 1 day`. 
    The system batch deletes all reccTemplateT0 child transaction having a date after the new reccTemplateT0.endDate.
    
    The system initiates the reccuring transaction function with reccTempateT1:
      - Persists the reccTempateT1 in firestore.
      - Batch creates all periodic child transactions in a 36-month windows, from reccTempateT1.date to `(reccTempateT1.endDate != null ? MIN( reccTempateT1.endDate, reccTemplateT1.date + 36 months) : reccTempateT1.date + 36 months)`
      - reccTempateT1.endDate is null (infinity) ? The system calculates the boundary of 36 months based on anchor date, in order the batch generate the initial transactions.
      - reccTempateT1.endDate is not null ? The system generates the periodic child transactions between the anchor date and end date, Limiting always to a 36 months interval.

    * Case 2: reccTemplateT1.date < reccTemplateT0.date
    The system deletes reccTemplateT0 and all child transactions.
    The system persist reccTemplateT1 in firestone and batch generate all periodic child transaction in a 36-month intervalle, from reccTemplate.date to `(reccTempateT1.endDate != null ? MIN( reccTempateT1.endDate, reccTemplateT1.date + 36 months) : reccTempateT1.date + 36 months)`

  

## Delete transaction
The user click on a transaction "delete" button at the UI

The system show a confirmation message (danger)

Upon confirmation, the system delete the transaction.

For reccuring transaction, the system delete the template and all child transactions.



## Key indicators
Key indicators (Account Balance, Emergency Fund, Monthly Income, Monthly Spending) are calculated on a monthly basis, on existing transactions on the selected month, and arithmetic series formula for reccuring transactions.


e.g. Forcasting Account Balance with reccuring transactions after the initial 36 months transactions, 
The system must calculate arithmetic series formula on reccuring transactions.





