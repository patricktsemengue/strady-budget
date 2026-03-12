import { state, updateState } from './state.js';
import { saveState } from './storage.js';
import { render, showNotification } from './ui.js';
import { generateId } from './utils.js';

export const handleReset = () => {
    const deleteTransactions = document.getElementById('delete-transactions-checkbox').checked;
    const deleteAccounts = document.getElementById('delete-accounts-checkbox').checked;

    if (!deleteTransactions && !deleteAccounts) {
        alert("Veuillez sélectionner une option de réinitialisation.");
        return;
    }

    let confirmationMessage = "Êtes-vous sûr de vouloir continuer ? Cette action est irréversible.";
    if (deleteAccounts) {
        confirmationMessage = "Êtes-vous sûr de vouloir supprimer tous les comptes et transactions ? Cette action est irréversible.";
    } else if (deleteTransactions) {
        confirmationMessage = "Êtes-vous sûr de vouloir supprimer toutes les transactions ? Cette action est irréversible.";
    }

    if (confirm(confirmationMessage)) {
        if (deleteAccounts) {
            updateState({ accounts: [], records: {}, recurring: [] });
        } else if (deleteTransactions) {
            updateState({ records: {}, recurring: [] });
        }
        saveState();
        render();
        showNotification('Données réinitialisées.');
    }
};

export const exportCSV = () => {
    // Basic implementation of export
    let csv = "ID,Label,Amount,Date,Category,Source,Destination\n";
    Object.values(state.records).forEach(monthData => {
        monthData.items.forEach(item => {
            csv += `${item.id},"${item.label}",${item.amount},${item.date},${item.category},${item.sourceId},${item.destinationId}\n`;
        });
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const importCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        const header = lines[0] ? lines[0].trim().replace(/\r/g, '') : "";

        const expectedHeader = "date,label,amount,source,destination,reccuring,startdate,endate,periodicity,category";
        if (header !== expectedHeader) {
            showNotification(`L'en-tête du fichier est invalide. Attendu: ${expectedHeader}`, 'error');
            return;
        }

        const dataLines = lines.slice(1);
        const accountMap = {};
        state.accounts.forEach(acc => {
            accountMap[acc.name.toLowerCase()] = acc.id;
        });

        const newRecords = {};
        const newRecurring = [];
        let importedCount = 0;

        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            if (!line || line.trim() === "") continue;

            // Handle potentially quoted values
            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/"/g, '').replace(/'/g, '').trim());
            if (parts.length < 10) continue;

            const [date, label, amount, sourceName, destName, recurringFlag, startDate, endDate, periodicity, category] = parts;

            const getAccountId = (name, fieldName, label) => {
                if (!name) return 'external';
                const id = accountMap[name.toLowerCase()];
                if (!id) {
                    throw new Error(`Le compte ${fieldName} "${name}" n'existe pas (transaction: "${label}").`);
                }
                return id;
            };

            try {
                if (!sourceName && !destName) {
                    throw new Error(`La transaction "${label}" doit avoir au moins un compte source ou destination.`);
                }

                const sourceId = getAccountId(sourceName, 'source', label);
                const destinationId = getAccountId(destName, 'destination', label);
                const isRecurring = recurringFlag === '1';
                const finalCategory = category || 'Autre';

                // Add to records
                const monthKey = date.substring(0, 7);
                if (!newRecords[monthKey]) newRecords[monthKey] = { status: 'open', items: [] };
                
                const txId = generateId();
                newRecords[monthKey].items.push({
                    id: txId,
                    label,
                    amount: parseFloat(amount),
                    date,
                    category: finalCategory,
                    sourceId,
                    destinationId,
                    isRecurringInst: isRecurring, // If it's recurring in CSV, we mark it as instance? Or just a record.
                    parentId: isRecurring ? `rec_${txId}` : null
                });

                if (isRecurring) {
                    if (!startDate) {
                        throw new Error(`La date de début est obligatoire pour la transaction récurrente "${label}".`);
                    }
                    
                    // End date logic
                    let finalEndDate = endDate;
                    if (!finalEndDate) {
                        const d = new Date(startDate);
                        d.setFullYear(d.getFullYear() + 1);
                        finalEndDate = d.toISOString().split('T')[0];
                    }

                    newRecurring.push({
                        id: `rec_${txId}`,
                        label,
                        amount: parseFloat(amount),
                        sourceId,
                        destinationId,
                        startMonth: startDate.substring(0, 7),
                        endMonth: finalEndDate.substring(0, 7),
                        periodicity: periodicity || 'M',
                        category: finalCategory
                    });
                }
                importedCount++;
            } catch (err) {
                showNotification(`Erreur d'importation : ${err.message}`, 'error');
                return; // Stop the whole process
            }
        }

        if (importedCount > 0) {
            updateState({ records: newRecords, recurring: newRecurring });
            saveState();
            render();
            showNotification(`${importedCount} transactions importées avec succès !`);
        } else {
            showNotification("Le fichier est valide mais ne contient aucune transaction à importer.", "info");
        }
    };
    reader.readAsText(file);
};

export const exportAccountsCSV = () => {
    let csv = "ID,Account,balance,date,saving\n";
    state.accounts.forEach(acc => {
        csv += `${acc.id},"${acc.name}",${acc.initialBalance},${acc.initialBalanceDate},${acc.isSavings ? 'Yes' : 'No'}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `accounts_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const importAccountsCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        const header = lines[0] ? lines[0].trim().replace(/\r/g, '') : "";

        if (header !== "Account,balance,date,saving") {
            showNotification(`L'en-tête du fichier est invalide. Attendu: Account,balance,date,saving`, 'error');
            return;
        }

        const dataLines = lines.slice(1);
        const newAccounts = [];
        const seenNames = new Set();

        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            if (!line || line.trim() === "") continue;
            
            // Handle potentially quoted values
            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (parts.length < 4) continue;
            
            const name = parts[0].replace(/"/g, '').replace(/'/g, '').trim();
            const initialBalance = parseFloat(parts[1]);
            const initialBalanceDate = parts[2].trim();
            const isSavings = parts[3].trim().toLowerCase() === 'yes';
            
            // Uniqueness validation
            if (seenNames.has(name.toLowerCase())) {
                showNotification(`Erreur d'importation : le nom de compte "${name}" est utilisé plusieurs fois dans le fichier.`, 'error');
                return; // Stop the whole process
            }
            seenNames.add(name.toLowerCase());

            newAccounts.push({
                id: `acc_${generateId()}`,
                name,
                initialBalance,
                initialBalanceDate,
                isSavings
            });
        }

        if (newAccounts.length > 0) {
            // Success: delete existing accounts and replace with new ones
            state.accounts = newAccounts;
            saveState();
            render();
            showNotification(`${newAccounts.length} comptes importés avec succès !`);
        }
    };
    reader.readAsText(file);
};
