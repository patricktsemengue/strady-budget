import { state, updateState } from './state.js';
import { currentUserId } from './storage.js';
import { resetDataInFirestore, importDataToFirestore, setUserImportingState, markAccountsBalanceDirty, provisionStarterData } from './firestore-service.js';
import { showNotification, setLoadingState } from './ui.js';
import { router } from './app-router.js';
import { generateId, generateDeterministicId, generateDeterministicUUID, getMonthFromDate } from './utils.js';

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
            setLoadingState(true, 'Suppression...', 'Nettoyage de vos données en cours.');
            await resetDataInFirestore(currentUserId, deleteAccounts, deleteAccounts || deleteTransactions);
            showNotification('Données réinitialisées avec succès.');
            txCheckbox.checked = false;
            accCheckbox.checked = false;
            window.location.reload();
        } catch (err) {
            showNotification('Erreur lors de la réinitialisation.', 'error');
        } finally {
            setLoadingState(false);
        }
    }
};

export const handleFactoryReset = async () => {
    if (confirm("ATTENTION : Cette action supprimera TOUTES vos données (comptes, transactions, catégories, budgets) et réinstalle le 'Starter Pack'. Êtes-vous sûr ?")) {
        try {
            setLoadingState(true, 'Réinitialisation...', 'Restauration du Starter Pack en cours.');
            
            // 1. Wipe everything (including categories)
            await resetDataInFirestore(currentUserId, true, true);

            // 2. Reprovision Starter Pack
            await provisionStarterData(currentUserId);

            showNotification("L'application a été réinitialisée avec succès !");
            window.location.hash = '#dashboard';
            window.location.reload(); // Force reload to ensure clean state
            
        } catch (err) {
            console.error(err);
            showNotification("Erreur lors de la réinitialisation", "error");
        } finally {
            setLoadingState(false);
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

        const categoryMap = {}; // label.toLowerCase() -> id
        state.categories.forEach(cat => {
            categoryMap[cat.label.toLowerCase()] = cat.id;
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
                    
                    const newId = `acc_${generateId()}`;
                    // Create new account on the fly if it doesn't exist
                    const newAcc = {
                        id: newId,
                        name: name,
                        createDate: date || new Date().toISOString().split('T')[0],
                        initialBalance: 0, 
                        isSaving: false
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
                    const newCatId = `cat_${generateId()}`;
                    const newCat = { id: newCatId, label: finalCategory, icon: 'fa-tag', color: '#94a3b8' };
                    categoriesToCreate.push(newCat);
                    categoryMap[lowerCat] = newCatId;
                }
                const categoryId = categoryMap[lowerCat];

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
                        category: categoryId 
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
                        Category: categoryId, 
                    });
                }
                importedCount++;
            } catch (err) {
                console.warn(`[Import] Saut de ligne ${i+2}: ${err.message}`);
            }
        }

        if (importedCount > 0) {
            try {
                // Set importing state
                await setUserImportingState(currentUserId, true);

                if (accountsToCreate.length > 0 || categoriesToCreate.length > 0) {
                    await importDataToFirestore(currentUserId, accountsToCreate, null, null, categoriesToCreate);
                }
                
                if (newTransactions.length > 0 || newTemplates.length > 0) {
                    await importDataToFirestore(currentUserId, null, newTransactions, newTemplates, null);
                }
                
                showNotification(`Importation réussie : "${file.name}" (${importedCount} transactions).`);
                
                await markAccountsBalanceDirty(currentUserId);
                
                setLoadingState(false);
            } catch (err) {
                console.error(err);
                showNotification("Erreur lors de l'enregistrement des données.", 'error');
            } finally {
                // 1. Clear importing state first and WAIT for it
                await setUserImportingState(currentUserId, false);
                setLoadingState(false);
            }
        } else {
            showNotification("Aucune donnée valide n'a été trouvée dans le fichier.", 'error');
        }
    };
    reader.onerror = () => showNotification("Erreur lors de la lecture du fichier.", "error");
    reader.readAsText(file);
};

export const exportAccountsCSV = () => {
    let csv = "Nom du compte,Solde Initial,Date Solde Initial,Épargne\n";
    state.accounts.forEach(acc => {
        csv += `"${acc.name}",${acc.initialBalance || 0},${acc.createDate},${acc.isSaving ? 'Yes' : 'No'}\n`;
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
        const newAccounts = [];

        // Maps to track existing entities to ensure uniqueness by name
        const accountMap = {}; 
        state.accounts.forEach(acc => {
            accountMap[acc.name.toLowerCase()] = acc.id;
        });

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line || line.trim() === "") continue;

            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/"/g, '').replace(/'/g, '').trim());
            if (parts.length < 3) continue;

            const name = parts[0];
            const initialBalance = parseFloat(parts[1]);
            const initialBalanceDate = parts[2].trim();
            const isSaving = parts[3] ? parts[3].toLowerCase() === 'yes' || parts[3] === '1' : false;

            if (!name || isNaN(initialBalance) || !initialBalanceDate) continue;

            const lowerName = name.toLowerCase();
            if (accountMap[lowerName]) continue; // Skip existing

            const newId = `acc_${generateId()}`;
            newAccounts.push({
                id: newId,
                name,
                initialBalance,
                createDate: initialBalanceDate,
                isSaving
            });
            accountMap[lowerName] = newId;
        }

        if (newAccounts.length > 0) {
            try {
                setLoadingState(true, 'Importation des comptes...', `Traitement de ${newAccounts.length} comptes en cours.`);
                await importDataToFirestore(currentUserId, newAccounts, null, null);
                showNotification(`Importation réussie : "${file.name}" (${newAccounts.length} comptes).`);
                await markAccountsBalanceDirty(currentUserId);
            } catch (err) {
                console.error(err);
                showNotification("Erreur lors de l'importation des comptes.", 'error');
            } finally {
                setLoadingState(false);
            }
        }
    };
    reader.onerror = () => showNotification("Erreur lors de la lecture du fichier.", "error");
    reader.readAsText(file);
};
