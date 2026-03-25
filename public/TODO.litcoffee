# Single Transaction Datamodel
    {
        "date" : "2026-01-01", // effective date
        "label" : "string",
        "amount" : 0,
        "source" : "string",
        "destination" : "string",
        "Category" : "string",
        "Model": null
    }

 # Template to Reccuring transaction Datamodel

    {
    "date" : "2026-01-01", // Anchor and start date
    "label" : "string",
    "amount" : 0,
    "source" : "string",
    "destination" : "string",
    "reccuring" : true,
    "endDate": null 
    "periodicity": "string"
    "category": "string" 
    }


    
# Logical ID
* date, label, amount, source, destination.

When the system compare two single transactions T0 and T1, 

     IF T0.date = T1.date and
        T0.label = T1.label and 
        T0.amount = T1.amount and
        T0.source = T1.source and 
        T0.destination = T1.destination
     Then 
       T0 and T1 are the same transaction.

# Transaction Creation
The user clicks on the button to add a new transaction via the GUI, 

The system displays the Create Form:

**Mandatory fields to edit**:
 * Date // default value = current date
 * label, 
 * amount, // default value = 0

 **Optional fields to edit**:
 * source,
    * Default value = "" to indicates the transaction is a revenu from an external account.
 * destination
    * Default value = "" to inidicate the transaction is a payment to an external account.
 * Category. Default value =
    * "Revenu" if source is empty
    * "Autre" if destination is empty
    
* Both source and destination cannot be empty at the same time.

**Reccuring transaction only**:
* periodicity
    * Default = M. 
    * Expected Values: M=Month, Y=Year, Q = Quarter
* EndDate
    * Default is empty string.

## Case: Single Transaction
The user edits the form and submits, the system creates a new transaction.

## Case: Reccuring Transaction
The user edits the form.
When the user checks the "reccuring transaction" checkbox, reccuring transaction fieds ALSO appear on the screen.

The user edits the fields and submits.

The system creates:
*  The transaction template if not exists
    
    e.g.

        TemplateT0 = 
        {
            date : "2026-01-01",
            label : "Salaire",
            amount : 3000,
            source :"",
            destination : "Compte principal",
            endate : null, //null is considered infinite
            periodicity: "M",
            category : "Revenu"
        }
* The system creates a Single transaction 
    ```
     onFocusMonth = the month the user has selected
     iF onFocusMonth is not within TemplateT0.date - TemplateT0.endate range, 
     then SkIP

     New Single transaction T = (){
        date.day = TemplateT0.date.day,
        date.month = onFocusMonth.day,
        date.Year = onFocusMonth.year
        label = TemplateT0.label,
        amount = TemplateT0.amount,
        source = TemplateT0.source,
        destination = TemplateT0.destination
        periodicity = TemplateT0.periodicity
        category = TemplateT0.category
        model = TemplateT0

     }
     If t already exist, skip
     Else
      Create a single transaction T in the selected month "OnFocus".
    ```


    Remark: a Template will be assigned
    * 1 transaction per month in the case of Montly template.  
    * 0 or 1 transaction per month in the case of Quaterly, and yearly template.
## Case: Reccuring Transaction - The user navigate to another month.
When the user navigates another month,
THe system autogenerate single transaction for valid templates.

A valid template is one that the user selected month is within the "date" and "endate" interval.

# Transaction Update
The user selects a transaction, and clicks on the update button.
The system displays the update transaction form.
## CASE: Single transaction
The system identifies single transaction when the "Model" field is null/empty.

When the user submits the form, the system deletes the old transaction, and creates a new transaction.

## CASE: reccuring transaction
The system identifies single transaction when the "Model" field is assigned an existing template.

When the user submits the form, 
* the system updates the enddate of the old Template (e.g. TemplateT0)
* Clean all single transaction linked to the old Template, having a date out of the old Template's date and endDate interval.
* the system create a new template (e.g. TemplateT1)
* the system creates the single transaction of TemplateT1 for the onfocused month.



# Transaction deletion
The user selects a transaction, and clicks on the delete button, 

## CASE: Single transaction
The system displays a confirmation box (danger)
The user confirms
The system deletes the transaction.

## CASE: reccuring transaction
The system displays a confirmation box (danger)
The user confirms
The system deletes the template and linked transactions.



## 