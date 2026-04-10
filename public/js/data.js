import { state } from './state.js';
import { currentUserId } from './storage.js';
import { resetDataInFirestore, importDataToFirestore, setUserImportingState, markAccountsBalanceDirty } from './firestore-service.js';
import { showNotification } from './ui.js';
import { router } from './app-router.js';
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
        confirmationMessage = "Êtes-vous sûr de vouloir supprimer TOUS les comptes et TOUTES les transactions ? Cette action est irréversible.";
    } else {
        confirmationMessage = "Êtes-vous sûr de vouloir supprimer TOUTES les transactions ? Les comptes seront conservés. Cette action est irréversible.";
    }

    if (confirm(confirmationMessage)) {
        try {
            await resetDataInFirestore(currentUserId, deleteAccounts, deleteAccounts || deleteTransactions);
            showNotification('Données réinitialisées avec succès.');
            txCheckbox.checked = false;
            accCheckbox.checked = false;
        } catch (err) {
            showNotification('Erreur lors de la réinitialisation.', 'error');
        }
    }
};

export const exportCSV = () => {
    // Header based on public/strady-budget-export-2026-03-08.csv
    let csv = "date,label,amount,source,destination,recurring,startdate,endate,periodicity,category\n";
    
    // 1. Export Templates as "recurring"
    state.recurringTemplates.forEach(tpl => {
        csv += `${tpl.date},"${tpl.label}",${tpl.amount},"${tpl.source || ''}","${tpl.destination || ''}",1,${tpl.date},${tpl.endDate || ''},${tpl.periodicity},${tpl.category}\n`;
    });
    
    // 2. Export Standalone Transactions (those without a Model) from the flat list
    state.transactions.forEach(item => {
        if (!item.Model) {
            csv += `${item.date},"${item.label}",${item.amount},"${item.source || ''}","${item.destination || ''}",0,,,,"${item.Category || item.category || ''}"\n`;
        }
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `strady-budget-export-${new Date().toISOString().split('T')[0]}.csv`);
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

        // User requested validation: "date,label,amount,source,destination,reccuring,endate,periodicity,category"
        // The provided CSV has "startdate" between reccuring and endate. We'll handle both.
        const headerCols = header.split(',').map(c => c.trim().toLowerCase().replace('reccuring', 'recurring'));
        const requiredCols = ["date", "label", "amount", "source", "destination", "recurring", "endate", "periodicity", "category"];
        const missing = requiredCols.filter(c => !headerCols.includes(c.toLowerCase()));

        if (missing.length > 0) {
            showNotification(`L'en-tête du fichier est invalide. Colonnes manquantes: ${missing.join(', ')}`, 'error');
            return;
        }

        const colIdx = {};
        headerCols.forEach((col, idx) => colIdx[col.toLowerCase()] = idx);

        const dataLines = lines.slice(1);
        
        // Maps to track existing and newly created entities to ensure uniqueness by name
        const accountMap = {}; // name.toLowerCase() -> id
        state.accounts.forEach(acc => {
            accountMap[acc.name.toLowerCase()] = acc.id;
        });

        const categoryMap = {}; // name.toLowerCase() -> id
        state.categories.forEach(cat => {
            categoryMap[cat.id.toLowerCase()] = cat.id;
        });

        const accountsToCreate = [];
        const categoriesToCreate = [];

        const newTransactions = [];
        const newTemplates = [];
        let importedCount = 0;

        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            if (!line || line.trim() === "") continue;

            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/"/g, '').replace(/'/g, '').trim());
            if (parts.length < requiredCols.length) continue;

            const getValue = (colName) => parts[colIdx[colName]] || "";

            const date = getValue("date");
            const label = getValue("label");
            const amount = getValue("amount");
            const sourceName = getValue("source");
            const destName = getValue("destination");
            const recurringFlag = getValue("recurring");
            const endDate = getValue("endate");
            const periodicity = getValue("periodicity");
            const category = getValue("category");

            try {
                const getOrCreateAccountId = (name) => {
                    if (!name || name.toLowerCase() === 'external') return '';
                    const lowerName = name.toLowerCase();
                    if (accountMap[lowerName]) return accountMap[lowerName];
                    
                    // Create new account on the fly if it doesn't exist
                    const newId = `acc_${lowerName.replace(/\s+/g, '_')}`;
                    const newAcc = {
                        id: newId,
                        name: name,
                        initialBalance: 0,
                        initialBalanceDate: date || new Date().toISOString().split('T')[0],
                        isSavings: false
                    };
                    accountsToCreate.push(newAcc);
                    accountMap[lowerName] = newId;
                    return newId;
                };

                if (!sourceName && !destName) {
                    throw new Error(`La transaction "${label}" doit avoir au moins un compte source ou destination.`);
                }

                const source = getOrCreateAccountId(sourceName);
                const destination = getOrCreateAccountId(destName);
                const isRecurring = recurringFlag === '1' || recurringFlag === 'true';
                
                let finalCategory = category || 'Autre';
                const lowerCat = finalCategory.toLowerCase();
                if (!categoryMap[lowerCat]) {
                    const newCat = { id: finalCategory, label: finalCategory, icon: 'fa-tag', color: '#94a3b8' };
                    categoriesToCreate.push(newCat);
                    categoryMap[lowerCat] = finalCategory;
                }

                if (isRecurring) {
                    const identityFields = {
                        date: date,
                        label, 
                        amount: parseFloat(amount), 
                        source, 
                        destination
                    };
                    const templateId = `rec_${generateDeterministicId(identityFields)}`;
                    
                    newTemplates.push({
                        ...identityFields,
                        id: templateId,
                        recurring: true, 
                        endDate: endDate || null, 
                        periodicity: periodicity || 'M', 
                        category: finalCategory 
                    });
                } else {
                    // Per user spec, identity is based on these core fields
                    const identityFields = {
                        date, 
                        label, 
                        amount: parseFloat(amount), 
                        source, 
                        destination, 
                        Model: null 
                    };
                    const txId = `tx_${generateDeterministicId(identityFields)}`;
                    newTransactions.push({ 
                        ...identityFields,
                        id: txId,
                        Category: finalCategory, 
                    });
                }
                importedCount++;
            } catch (err) {
                showNotification(`Erreur d'importation ligne ${i+2} : ${err.message}`, 'error');
                return;
            }
        }

        if (importedCount > 0) {
            try {
                await setUserImportingState(currentUserId, true);

                // DELETE ALL FIRST as per requirement
                await resetDataInFirestore(currentUserId, false, true);

                if (accountsToCreate.length > 0 || categoriesToCreate.length > 0) {
                    await importDataToFirestore(currentUserId, accountsToCreate, null, null, categoriesToCreate);
                }

                const templatePromises = newTemplates.map(tpl => import('./firestore-service.js').then(m => m.addRecurringTemplate(currentUserId, tpl)));
                
                if (newTransactions.length > 0) {
                    await importDataToFirestore(currentUserId, null, newTransactions, null, null);
                }
                
                await Promise.all(templatePromises);
                showNotification(`Importation réussie : "${file.name}" (${importedCount} lignes traitées).`);
            } catch (err) {
                console.error(err);
                showNotification("Erreur lors de l'enregistrement de l'import.", 'error');
            } finally {
                await setUserImportingState(currentUserId, false);
                await markAccountsBalanceDirty(currentUserId);
            }
        }
    };
    reader.onerror = () => showNotification("Erreur lors de la lecture du fichier.", "error");
    reader.readAsText(file);
};

export const exportAccountsCSV = () => {
    let csv = "Account,balance,date,saving\n";
    state.accounts.forEach(acc => {
        csv += `"${acc.name}",${acc.initialBalance},${acc.initialBalanceDate},${acc.isSavings ? 'Yes' : 'No'}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `strady-accounts-export-${new Date().toISOString().split('T')[0]}.csv`);
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
            
            const lowerName = name.toLowerCase();
            if (seenNames.has(lowerName)) {
                showNotification(`Erreur d'importation : le nom de compte "${name}" est utilisé plusieurs fois dans le fichier.`, 'error');
                return;
            }
            seenNames.add(lowerName);

            newAccounts.push({
                id: `acc_${lowerName.replace(/\s+/g, '_')}`,
                name,
                initialBalance,
                initialBalanceDate,
                isSavings
            });
        }

        if (newAccounts.length > 0) {
            try {
                await setUserImportingState(currentUserId, true);
                await resetDataInFirestore(currentUserId, true, false); 
                await importDataToFirestore(currentUserId, newAccounts, null, null);
                showNotification(`Importation réussie : "${file.name}" (${newAccounts.length} comptes).`);
            } catch (err) {
                console.error(err);
                showNotification("Erreur lors de l'enregistrement des comptes.", 'error');
            } finally {
                await setUserImportingState(currentUserId, false);
                await markAccountsBalanceDirty(currentUserId);
            }
        }
    };
    reader.onerror = () => showNotification("Erreur lors de la lecture du fichier.", "error");
    reader.readAsText(file);
};