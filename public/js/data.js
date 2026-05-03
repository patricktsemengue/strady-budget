import { state } from './state.js';
import { currentUserId } from './storage.js';
import { t } from './i18n.js';
import { 
    resetDataInFirestore, 
    importDataToFirestore, 
    setUserImportingState, 
    markAccountsBalanceDirty, 
    provisionStarterData,
    updateSettingsInFirestore 
} from './firestore-service.js';
import { showNotification, setLoadingState } from './ui.js';
import { router } from './app-router.js';
import { generateDeterministicId, generateDeterministicUUID, getMonthFromDate, generateDeterministicTransactionId, generateDeterministicTemplateId } from './utils.js';
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

export const handleFactoryReset = async (mode = 'starter') => {
    const isStarter = mode === 'starter';
    const confirmMessage = isStarter 
        ? "ATTENTION : Cette action supprimera TOUTES vos données actuelles pour réinstaller le Starter Pack. Êtes-vous sûr ?"
        : "ACTION IRRÉVERSIBLE : Cette action supprimera DEFINITIVEMENT toutes vos données (Comptes, Transactions, Catégories). Vous repartirez d'une page blanche. Êtes-vous sûr ?";

    if (confirm(confirmMessage)) {
        try {
            const loadingTitle = isStarter ? 'Restauration...' : 'Nettoyage...';
            const loadingSubtitle = isStarter ? 'Réinstallation du Starter Pack en cours.' : 'Suppression de toutes vos données en cours.';
            
            setLoadingState(true, loadingTitle, loadingSubtitle);
            
            // 1. Wipe everything
            await resetDataInFirestore(currentUserId, true, true);

            if (isStarter) {
                // 2. Mark onboarding for Interactive Setup
                await updateSettingsInFirestore(currentUserId, 'onboarding', { 
                    starterPackApplied: false, 
                    onboardingComplete: false,
                    type: 'interactive_setup',
                    updated_at: serverTimestamp() 
                });
            } else {
                // 2. Mark onboarding as complete but with no starter pack
                await updateSettingsInFirestore(currentUserId, 'onboarding', { 
                    starterPackApplied: false, 
                    onboardingComplete: true,
                    updated_at: serverTimestamp() 
                });
            }

            showNotification(isStarter ? "Espace prêt pour votre configuration !" : "Espace vidé avec succès !");
            
            if (isStarter) {
                sessionStorage.setItem('strady_trigger_interactive_setup', 'true');
            }

            window.location.hash = '#dashboard';
            window.location.reload(); 
            
        } catch (err) {
            console.error(err);
            showNotification("Erreur lors de la réinitialisation", "error");
        } finally {
            setLoadingState(false);
        }
    }
};

export const exportFullBackupCSV = () => {
    // Universal CSV Header
    let csv = "Type,Date,Label,Value,Source,Destination,Category,Icon,Color,Periodicity,EndDate,IsSaving,IsInvestment,Nature,IsPassive\n";
    
    // 1. Accounts
    (state.accounts || []).forEach(acc => {
        csv += `ACCOUNT,${acc.createDate},"${acc.name}",${acc.initialBalance || 0},,,,,,${acc.isSaving ? 1 : 0},${acc.isInvestmentAccount ? 1 : 0},,\n`;
    });

    // 2. Categories
    (state.categories || []).forEach(cat => {
        csv += `CATEGORY,,"${cat.label}",,,,,"${cat.icon}","${cat.color}",,,,,"${cat.nature || ''}",${cat.isPassive ? 1 : 0}\n`;
    });

    // 3. Recurring Templates
    (state.recurringTemplates || []).forEach(tpl => {
        const sourceName = tpl.source === 'external' ? 'external' : (state.accounts.find(a => a.id === tpl.source)?.name || 'external');
        const destName = tpl.destination === 'external' ? 'external' : (state.accounts.find(a => a.id === tpl.destination)?.name || 'external');
        const catName = state.categories.find(c => c.id === tpl.category)?.label || '';
        
        csv += `RECURRING_TEMPLATE,${tpl.date},"${tpl.label}",${tpl.amount},"${sourceName}","${destName}","${catName}",,,${tpl.periodicity},${tpl.endDate || ''},,,\n`;
    });

    // 4. Standalone Transactions
    (state.transactions || []).forEach(tx => {
        if (!tx.Model) {
            const sourceName = tx.source === 'external' ? 'external' : (state.accounts.find(a => a.id === tx.source)?.name || 'external');
            const destName = tx.destination === 'external' ? 'external' : (state.accounts.find(a => a.id === tx.destination)?.name || 'external');
            const catName = state.categories.find(c => c.id === (tx.Category || tx.category))?.label || '';
            
            csv += `TRANSACTION,${tx.date},"${tx.label}",${tx.amount},"${sourceName}","${destName}","${catName}",,,,,,\n`;
        }
    });

    // 5. Assets & Values
    (state.assets || []).forEach(ast => {
        csv += `ASSET,,"${ast.name}",,,,,,,,,,\n`;
        const values = (state.assetValues || []).filter(v => v.asset_id === ast.id);
        values.forEach(v => {
            csv += `ASSET_VALUE,${v.date},"${v.quantity}",${v.value},,,${ast.name},,,,,,\n`;
        });
    });

    // 6. Liabilities & Values
    (state.liabilities || []).forEach(lia => {
        csv += `LIABILITY,,"${lia.name}",,,,,,,,,,\n`;
        const values = (state.liabilityValues || []).filter(v => v.liability_id === lia.id);
        values.forEach(v => {
            csv += `LIABILITY_VALUE,${v.date},,${v.value},,,${lia.name},,,,,,\n`;
        });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `strady-full-backup-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const importFullBackupCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        const header = lines[0] ? lines[0].trim().toLowerCase().replace(/"/g, '') : "";
        
        const colIdx = {};
        header.split(',').forEach((col, idx) => colIdx[col.trim()] = idx);

        const dataLines = lines.slice(1);
        
        // Results objects
        const results = {
            accounts: [],
            categories: [],
            transactions: [],
            templates: [],
            assets: [],
            assetValues: [],
            liabilities: [],
            liabilityValues: [],
            duplicates: { accounts: 0, categories: 0, transactions: 0, templates: 0, assets: 0, liabilities: 0 }
        };

        // Maps for resolution
        const accountMap = {}; 
        state.accounts.forEach(acc => accountMap[acc.name.toLowerCase()] = acc.id);
        
        const categoryMap = {};
        state.categories.forEach(cat => categoryMap[cat.label.toLowerCase()] = cat.id);

        const assetMap = {};
        state.assets.forEach(ast => assetMap[ast.name.toLowerCase()] = ast.id);

        const liabilityMap = {};
        state.liabilities.forEach(lia => liabilityMap[lia.name.toLowerCase()] = lia.id);

        const existingTxIds = new Set(state.transactions.map(t => t.id));
        const existingTplIds = new Set(state.recurringTemplates.map(t => t.id));

        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            if (!line || line.trim() === "") continue;

            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/"/g, '').replace(/'/g, '').trim());
            const getValue = (colName) => parts[colIdx[colName.toLowerCase()]] || "";

            const type = getValue("Type").toUpperCase();
            const date = getValue("Date");
            const label = getValue("Label");
            const rawValue = getValue("Value");
            const value = isNaN(parseFloat(rawValue)) ? 0 : parseFloat(rawValue);

            if (type === 'ACCOUNT') {
                const lowerName = label.toLowerCase();
                const deterministicId = `acc_${await generateDeterministicUUID(label)}`;
                if (accountMap[lowerName]) {
                    results.duplicates.accounts++;
                } else {
                    const acc = {
                        id: deterministicId,
                        name: label,
                        createDate: date || new Date().toISOString().split('T')[0],
                        initialBalance: value,
                        isSaving: getValue("IsSaving") === '1',
                        isInvestmentAccount: getValue("IsInvestment") === '1' || getValue("isInvestmentAccount") === '1'
                    };
                    results.accounts.push(acc);
                    accountMap[lowerName] = deterministicId;
                }
            } else if (type === 'CATEGORY') {
                const lowerLabel = label.toLowerCase();
                const deterministicId = `cat_${await generateDeterministicUUID(label)}`;
                if (categoryMap[lowerLabel]) {
                    results.duplicates.categories++;
                } else {
                    const cat = {
                        id: deterministicId,
                        label: label,
                        nature: getValue("Nature") || 'QUOTIDIEN',
                        icon: getValue("Icon") || 'fa-tag',
                        color: getValue("Color") || '#94a3b8',
                        isPassive: getValue("IsPassive") === '1'
                    };
                    results.categories.push(cat);
                    categoryMap[lowerLabel] = deterministicId;
                }
            } else if (type === 'ASSET') {
                const lowerName = label.toLowerCase();
                const id = await generateDeterministicUUID(label);
                if (assetMap[lowerName]) {
                    results.duplicates.assets++;
                } else {
                    results.assets.push({ id, name: label });
                    assetMap[lowerName] = id;
                }
            } else if (type === 'LIABILITY') {
                const lowerName = label.toLowerCase();
                const id = await generateDeterministicUUID(label);
                if (liabilityMap[lowerName]) {
                    results.duplicates.liabilities++;
                } else {
                    results.liabilities.push({ id, name: label });
                    liabilityMap[lowerName] = id;
                }
            } else if (type === 'ASSET_VALUE') {
                const assetName = getValue("Category"); // We use Category col for parent name in export
                const assetId = assetMap[assetName.toLowerCase()];
                if (assetId) {
                    results.assetValues.push({ asset_id: assetId, value, date, quantity: parseFloat(label) || 1 });
                }
            } else if (type === 'LIABILITY_VALUE') {
                const liaName = getValue("Category");
                const liaId = liabilityMap[liaName.toLowerCase()];
                if (liaId) {
                    results.liabilityValues.push({ liability_id: liaId, value, date, quantity: 1 });
                }
            } else if (type === 'TRANSACTION' || type === 'RECURRING_TEMPLATE') {
                const sourceName = getValue("Source");
                const destName = getValue("Destination");
                const categoryName = getValue("Category");

                const getOrCreateAcc = async (name) => {
                    if (!name || name.toLowerCase() === 'external') return 'external';
                    const lower = name.toLowerCase();
                    if (accountMap[lower]) return accountMap[lower];
                    
                    const id = `acc_${await generateDeterministicUUID(name)}`;
                    const newAcc = { 
                        id, 
                        name, 
                        createDate: date || new Date().toISOString().split('T')[0], 
                        initialBalance: 0, 
                        isSaving: false,
                        isInvestmentAccount: false 
                    };
                    results.accounts.push(newAcc);
                    accountMap[lower] = id;
                    return id;
                };

                const getOrCreateCat = async (name) => {
                    const finalName = name || 'Autre';
                    const lower = finalName.toLowerCase();
                    if (categoryMap[lower]) return categoryMap[lower];
                    
                    const id = `cat_${await generateDeterministicUUID(finalName)}`;
                    const newCat = { id, label: finalName, icon: 'fa-tag', color: '#94a3b8' };
                    results.categories.push(newCat);
                    categoryMap[lower] = id;
                    return id;
                };

                const sourceId = await getOrCreateAcc(sourceName);
                const destId = await getOrCreateAcc(destName);
                const catId = await getOrCreateCat(categoryName);

                if (type === 'TRANSACTION') {
                    const txData = { date, label, amount: value, source: sourceId, destination: destId, Category: catId, Model: null };
                    const id = generateDeterministicTransactionId(txData);
                    if (existingTxIds.has(id)) {
                        results.duplicates.transactions++;
                    } else {
                        results.transactions.push({ id, ...txData });
                    }
                } else {
                    const tplData = { 
                        date, label, amount: value, source: sourceId, destination: destId, 
                        category: catId, periodicity: getValue("Periodicity") || 'M', 
                        endDate: getValue("EndDate") || null 
                    };
                    const id = generateDeterministicTemplateId(tplData);
                    if (existingTplIds.has(id)) {
                        results.duplicates.templates++;
                    } else {
                        results.templates.push({ id, ...tplData });
                    }
                }
            }
        }

        showImportSummaryModal(results);
    };
    reader.readAsText(file);
};

const showImportSummaryModal = (results) => {
    const totalNew = results.accounts.length + results.categories.length + results.transactions.length + results.templates.length + results.assets.length + results.liabilities.length;
    const totalDups = results.duplicates.accounts + results.duplicates.categories + results.duplicates.transactions + results.duplicates.templates + results.duplicates.assets + results.duplicates.liabilities;

    const modalHtml = `
        <div id="import-summary-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                <div class="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50">
                    <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-list-check text-xl"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-xl text-slate-800">Résumé de l'importation</h3>
                        <p class="text-sm text-slate-500">Vérifiez les données avant confirmation.</p>
                    </div>
                </div>

                <div class="p-6 space-y-6">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="p-4 rounded-xl bg-green-50 border border-green-100">
                            <div class="text-2xl font-bold text-green-700">${totalNew}</div>
                            <div class="text-xs font-bold text-green-600 uppercase tracking-wider">Nouveaux éléments</div>
                        </div>
                        <div class="p-4 rounded-xl bg-amber-50 border border-amber-100">
                            <div class="text-2xl font-bold text-amber-700">${totalDups}</div>
                            <div class="text-xs font-bold text-amber-600 uppercase tracking-wider">Doublons ignorés</div>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Détails des nouveaux éléments</h4>
                        <div class="divide-y divide-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                            <div class="p-3 flex justify-between items-center text-sm">
                                <span class="text-slate-600 flex items-center gap-2"><i class="fa-solid fa-wallet text-slate-400"></i> Trésorerie</span>
                                <span class="font-bold text-slate-800">${results.accounts.length}</span>
                            </div>
                            <div class="p-3 flex justify-between items-center text-sm">
                                <span class="text-slate-600 flex items-center gap-2"><i class="fa-solid fa-gem text-slate-400"></i> Patrimoine (Actifs)</span>
                                <span class="font-bold text-slate-800">${results.assets.length}</span>
                            </div>
                            <div class="p-3 flex justify-between items-center text-sm">
                                <span class="text-slate-600 flex items-center gap-2"><i class="fa-solid fa-hand-holding-dollar text-slate-400"></i> Dettes</span>
                                <span class="font-bold text-slate-800">${results.liabilities.length}</span>
                            </div>
                            <div class="p-3 flex justify-between items-center text-sm">
                                <span class="text-slate-600 flex items-center gap-2"><i class="fa-solid fa-tags text-slate-400"></i> Analyses (Postes)</span>
                                <span class="font-bold text-slate-800">${results.categories.length}</span>
                            </div>
                            <div class="p-3 flex justify-between items-center text-sm">
                                <span class="text-slate-600 flex items-center gap-2"><i class="fa-solid fa-receipt text-slate-400"></i> Flux & Prévisions</span>
                                <span class="font-bold text-slate-800">${results.transactions.length + results.templates.length}</span>
                            </div>
                        </div>
                    </div>

                    ${totalDups > 0 ? `
                        <div class="p-3 bg-slate-50 rounded-lg flex items-center gap-3">
                            <input type="checkbox" id="skip-duplicates-checkbox" checked class="h-4 w-4 text-blue-600 border-slate-300 rounded">
                            <label for="skip-duplicates-checkbox" class="text-xs text-slate-600 font-medium">Ignorer automatiquement les ${totalDups} doublons détectés</label>
                        </div>
                    ` : ''}
                </div>

                <div class="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button id="btn-cancel-import" class="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors">Annuler</button>
                    <button id="btn-confirm-import" class="flex-1 px-4 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-lg">Confirmer l'importation</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const closeModal = () => {
        const modal = document.getElementById('import-summary-modal');
        if (modal) modal.remove();
    };

    document.getElementById('btn-cancel-import').onclick = closeModal;
    document.getElementById('btn-confirm-import').onclick = async () => {
        closeModal();
        try {
            setLoadingState(true, 'Importation...', 'Traitement de votre sauvegarde complète en cours.');
            await setUserImportingState(currentUserId, true);
            
            await importDataToFirestore(
                currentUserId, 
                results.accounts, 
                results.transactions, 
                results.templates, 
                results.categories,
                results.assets,
                results.assetValues,
                results.liabilities,
                results.liabilityValues
            );
            
            showNotification(`Importation réussie : ${totalNew} nouveaux éléments ajoutés.`);
        } catch (err) {
            console.error(err);
            showNotification("Erreur lors de l'importation.", 'error');
        } finally {
            await setUserImportingState(currentUserId, false);
            setLoadingState(false);
            // Reload to ensure all states are correctly synced
            window.location.reload();
        }
    };
};
