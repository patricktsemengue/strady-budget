import { state } from './state.js';
import { currentUserId } from './storage.js';
import { resetDataInFirestore, importDataToFirestore } from './firestore-service.js';
import { render, showNotification } from './ui.js';
import { generateId, generateDeterministicId } from './utils.js';

export const handleReset = async () => {
    const txCheckbox = document.getElementById('delete-transactions-checkbox');
    const accCheckbox = document.getElementById('delete-accounts-checkbox');
    
    const deleteTransactions = txCheckbox.checked;
    const deleteAccounts = accCheckbox.checked;

    if (!deleteTransactions && !deleteAccounts) {
        showNotification("Veuillez sélectionner une option de réinitialisation.", 'error');
        return;
    }

    let confirmationMessage = "";
    if (deleteAccounts) {
        // If accounts is checked, it deletes BOTH (as per requirement and UI label)
        confirmationMessage = "Êtes-vous sûr de vouloir supprimer TOUS les comptes et TOUTES les transactions ? Cette action est irréversible.";
    } else {
        // Only transactions
        confirmationMessage = "Êtes-vous sûr de vouloir supprimer TOUTES les transactions ? Les comptes seront conservés. Cette action est irréversible.";
    }

    if (confirm(confirmationMessage)) {
        try {
            // If deleteAccounts is true, we force deleteTransactions to true as well
            await resetDataInFirestore(currentUserId, deleteAccounts, deleteAccounts || deleteTransactions);
            showNotification('Données réinitialisées avec succès.');
            
            // Uncheck after success
            txCheckbox.checked = false;
            accCheckbox.checked = false;
        } catch (err) {
            showNotification('Erreur lors de la réinitialisation.', 'error');
        }
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
    reader.onload = async (e) => {
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

        const existingCategories = new Set(state.categories.map(c => c.id.toLowerCase()));
        const categoriesToCreate = [];
        const seenInCsv = new Set();

        const newTransactions = [];
        const newTemplates = [];
        let importedCount = 0;

        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            if (!line || line.trim() === "") continue;

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

                // Auto-generate category if it doesn't exist
                if (finalCategory !== 'Autre' && !existingCategories.has(finalCategory.toLowerCase()) && !seenInCsv.has(finalCategory.toLowerCase())) {
                    categoriesToCreate.push({
                        id: finalCategory,
                        label: finalCategory,
                        icon: 'fa-tag',
                        color: '#94a3b8'
                    });
                    seenInCsv.add(finalCategory.toLowerCase());
                }

                if (isRecurring) {
                    if (!startDate) {
                        throw new Error(`La date de début est obligatoire pour la transaction récurrente "${label}".`);
                    }
                    
                    // Deterministic ID for templates to prevent duplicates
                    const templateData = { label, amount: parseFloat(amount), sourceId, destinationId, anchorDate: startDate, periodicity: periodicity || 'M', category: finalCategory };
                    const templateId = `rec_${generateDeterministicId(templateData)}`;
                    
                    newTemplates.push({
                        id: templateId,
                        ...templateData,
                        startMonth: startDate.substring(0, 7),
                        endMonth: endDate ? endDate.substring(0, 7) : null
                    });
                } else {
                    // Deterministic ID for single transactions to prevent duplicates
                    const txData = { label, amount: parseFloat(amount), date, category: finalCategory, sourceId, destinationId };
                    const txId = `tx_${generateDeterministicId(txData)}`;

                    newTransactions.push({
                        id: txId,
                        ...txData
                    });
                }
                importedCount++;
            } catch (err) {
                showNotification(`Erreur d'importation : ${err.message}`, 'error');
                return;
            }
        }

        if (importedCount > 0) {
            try {
                // Import categories first
                if (categoriesToCreate.length > 0) {
                    await importDataToFirestore(currentUserId, null, null, null, categoriesToCreate);
                }

                // Import templates one by one to trigger generation
                const templatePromises = newTemplates.map(tpl => import('./firestore-service.js').then(m => m.addRecurringTemplate(currentUserId, tpl)));
                
                // Import standalone transactions in one go
                if (newTransactions.length > 0) {
                    await importDataToFirestore(currentUserId, null, newTransactions, null, null);
                }
                
                await Promise.all(templatePromises);
                
                showNotification(`Importation réussie : "${file.name}" (${importedCount} lignes traitées).`);
            } catch (err) {
                console.error(err);
                showNotification("Erreur lors de l'enregistrement de l'import.", 'error');
            }
        } else {
            showNotification("Le fichier est valide mais ne contient aucune transaction à importer.", "info");
        }
    };
    reader.onerror = () => showNotification("Erreur lors de la lecture du fichier.", "error");
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
    reader.onload = async (e) => {
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
            
            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (parts.length < 4) continue;
            
            const name = parts[0].replace(/"/g, '').replace(/'/g, '').trim();
            const initialBalance = parseFloat(parts[1]);
            const initialBalanceDate = parts[2].trim();
            const isSavings = parts[3].trim().toLowerCase() === 'yes';
            
            if (seenNames.has(name.toLowerCase())) {
                showNotification(`Erreur d'importation : le nom de compte "${name}" est utilisé plusieurs fois dans le fichier.`, 'error');
                return;
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
            try {
                await resetDataInFirestore(currentUserId, true, false); // clear existing accounts first
                await importDataToFirestore(currentUserId, newAccounts, null, null);
                showNotification(`Importation réussie : "${file.name}" (${newAccounts.length} comptes).`);
            } catch (err) {
                showNotification("Erreur lors de l'enregistrement des comptes.", 'error');
            }
        }
    };
    reader.onerror = () => showNotification("Erreur lors de la lecture du fichier.", "error");
    reader.readAsText(file);
};
