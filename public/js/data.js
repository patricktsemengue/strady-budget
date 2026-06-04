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
                // 2. Mark onboarding for Story Mode (Alice & Bob)
                await updateSettingsInFirestore(currentUserId, 'onboarding', { 
                    starterPackApplied: false, 
                    onboardingComplete: false,
                    type: 'story',
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
                sessionStorage.setItem('strady_trigger_tour', 'true');
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
    // Universal CSV Header (17 columns)
    const header = "Type,Date,Label,Quantity,Value,Source,Destination,Category,Icon,Color,Periodicity,EndDate,IsSaving,IsInvestment,Nature,IsPassive,Entity";
    const col = (name) => header.split(',').indexOf(name);
    let csv = header + "\n";
    
    // 0. Entities
    (state.entities || []).forEach(ent => {
        const row = Array(17).fill("");
        row[col("Type")] = "ENTITY";
        row[col("Label")] = `"${ent.name}"`;
        row[col("Nature")] = `"${ent.type || 'PRIVATE'}"`;
        csv += row.join(',') + "\n";
    });

    // 1. Accounts
    (state.accounts || []).forEach(acc => {
        const entName = state.entities.find(e => e.id === acc.entityId)?.name || '';
        const row = Array(17).fill("");
        row[col("Type")] = "ACCOUNT";
        row[col("Date")] = acc.createDate;
        row[col("Label")] = `"${acc.name}"`;
        row[col("Value")] = acc.initialBalance || 0;
        row[col("IsSaving")] = acc.isSaving ? 1 : 0;
        row[col("IsInvestment")] = acc.isInvestmentAccount ? 1 : 0;
        row[col("Entity")] = `"${entName}"`;
        csv += row.join(',') + "\n";
    });

    // 2. Categories
    (state.categories || []).forEach(cat => {
        const row = Array(17).fill("");
        row[col("Type")] = "CATEGORY";
        row[col("Label")] = `"${cat.label}"`;
        row[col("Icon")] = `"${cat.icon}"`;
        row[col("Color")] = `"${cat.color}"`;
        row[col("Nature")] = `"${cat.nature || ''}"`;
        row[col("IsPassive")] = cat.isPassive ? 1 : 0;
        csv += row.join(',') + "\n";
    });

    // 3. Recurring Templates
    (state.recurringTemplates || []).forEach(tpl => {
        const sourceName = tpl.source === 'external' ? 'external' : (state.accounts.find(a => a.id === tpl.source)?.name || 'external');
        const destName = tpl.destination === 'external' ? 'external' : (state.accounts.find(a => a.id === tpl.destination)?.name || 'external');
        const catName = state.categories.find(c => c.id === tpl.category)?.label || '';
        
        const row = Array(17).fill("");
        row[col("Type")] = "RECURRING_TEMPLATE";
        row[col("Date")] = tpl.date;
        row[col("Label")] = `"${tpl.label}"`;
        row[col("Quantity")] = null; // Quantity doesn't apply to templates
        row[col("Value")] = tpl.amount;
        row[col("Source")] = `"${sourceName}"`;
        row[col("Destination")] = `"${destName}"`;
        row[col("Category")] = `"${catName}"`;
        row[col("Icon")] = null; 
        row[col("Color")] = null; 
        row[col("Periodicity")] = tpl.periodicity;
        row[col("EndDate")] = tpl.endDate || '';
        row[col("Entity")] = ""; // Removed for templates
        csv += row.join(',') + "\n";
    });

    // 4. Standalone Transactions
    (state.transactions || []).forEach(tx => {
        if (!tx.Model) {
            const sourceName = tx.source === 'external' ? 'external' : (state.accounts.find(a => a.id === tx.source)?.name || 'external');
            const destName = tx.destination === 'external' ? 'external' : (state.accounts.find(a => a.id === tx.destination)?.name || 'external');
            const catName = state.categories.find(c => c.id === (tx.Category || tx.category))?.label || '';
            
            const row = Array(17).fill("");
            row[col("Type")] = "TRANSACTION";
            row[col("Date")] = tx.date;
            row[col("Label")] = `"${tx.label}"`;
            row[col("Value")] = tx.amount;
            row[col("Source")] = `"${sourceName}"`;
            row[col("Destination")] = `"${destName}"`;
            row[col("Category")] = `"${catName}"`;
            row[col("Entity")] = ""; // Removed for transactions
            csv += row.join(',') + "\n";
        }
    });

    // 5. Assets & Values
    (state.assets || []).forEach(ast => {
        const entName = state.entities.find(e => e.id === ast.entityId)?.name || '';
        const rowA = Array(17).fill("");
        rowA[col("Type")] = "ASSET";
        rowA[col("Label")] = `"${ast.name}"`;
        rowA[col("Entity")] = `"${entName}"`;
        csv += rowA.join(',') + "\n";

        const values = (state.assetValues || []).filter(v => v.asset_id === ast.id);
        values.forEach(v => {
            const rowV = Array(17).fill("");
            rowV[col("Type")] = "ASSET_VALUE";
            rowV[col("Date")] = v.date;
            rowV[col("Label")] = `"${ast.name}"`;
            rowV[col("Quantity")] = `"${v.quantity}"`;
            rowV[col("Value")] = v.value;
            csv += rowV.join(',') + "\n";
        });
    });

    // 6. Liabilities & Values
    (state.liabilities || []).forEach(lia => {
        const entName = state.entities.find(e => e.id === lia.entityId)?.name || '';
        const rowL = Array(17).fill("");
        rowL[col("Type")] = "LIABILITY";
        rowL[col("Label")] = `"${lia.name}"`;
        rowL[col("Entity")] = `"${entName}"`;
        csv += rowL.join(',') + "\n";

        const values = (state.liabilityValues || []).filter(v => v.liability_id === lia.id);
        values.forEach(v => {
            const rowV = Array(17).fill("");
            rowV[col("Type")] = "LIABILITY_VALUE";
            rowV[col("Date")] = v.date;
            rowV[col("Label")] = `"${lia.name}"`;
            rowV[col("Quantity")] = "1";
            rowV[col("Value")] = v.value;
            csv += rowV.join(',') + "\n";
        });
    });

    const blob = new Blob(["\ufeff", csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `strady-full-backup-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Helper to parse a single CSV line with respect to quoted commas.
 */
const parseCSVLine = (line, colIdx) => {
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => 
        p.replace(/"/g, '').replace(/'/g, '').trim()
    );
    return (colName) => parts[colIdx[colName.toLowerCase()]] || "";
};

/**
 * Resolves an entity ID by name, creating it if it doesn't exist.
 */
const resolveEntityId = async (name, results, entityMap) => {
    const finalName = name || 'Privé';
    const lower = finalName.toLowerCase();
    if (entityMap[lower]) return entityMap[lower];
    
    const id = `ent_${await generateDeterministicUUID(finalName)}`;
    const newEnt = { id, name: finalName, type: 'PRIVATE' };
    results.entities.push(newEnt);
    entityMap[lower] = id;
    return id;
};

/**
 * Resolves a category ID by name, creating it if it doesn't exist.
 */
const resolveCategoryId = async (name, results, categoryMap) => {
    const finalName = name || 'Autre';
    const lower = finalName.toLowerCase();
    if (categoryMap[lower]) return categoryMap[lower];
    
    const id = `cat_${await generateDeterministicUUID(finalName)}`;
    const newCat = { id, label: finalName, icon: 'fa-tag', color: '#94a3b8', nature: 'QUOTIDIEN' };
    results.categories.push(newCat);
    categoryMap[lower] = id;
    return id;
};

export const importFullBackupCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        let text = e.target.result;
        if (text.startsWith('\ufeff')) text = text.substring(1);
        
        const lines = text.split('\n').filter(l => l.trim() !== "");
        if (lines.length < 2) return;

        const headerRaw = lines[0].trim().toLowerCase().replace(/"/g, '');
        const colIdx = {};
        headerRaw.split(',').forEach((col, idx) => colIdx[col.trim()] = idx);

        if (colIdx['type'] === undefined || colIdx['label'] === undefined) {
            showNotification(`Structure CSV invalide.`, 'error');
            return;
        }

        const results = {
            accounts: [], categories: [], transactions: [], templates: [],
            assets: [], assetValues: [], liabilities: [], liabilityValues: [], entities: [],
            duplicates: { accounts: 0, categories: 0, transactions: 0, templates: 0, assets: 0, liabilities: 0, entities: 0 },
            ignored: { transactions: 0, templates: 0, details: [] },
            errors: []
        };

        // Maps for resolution
        const accountMap = {}; 
        const accountEntityMap = {};
        state.accounts.forEach(acc => {
            accountMap[acc.name.toLowerCase()] = acc.id;
            accountEntityMap[acc.id] = acc.entityId;
        });
        
        const categoryMap = {};
        state.categories.forEach(cat => categoryMap[cat.label.toLowerCase()] = cat.id);

        const assetMap = {};
        state.assets.forEach(ast => assetMap[ast.name.toLowerCase()] = ast.id);

        const liabilityMap = {};
        state.liabilities.forEach(lia => liabilityMap[lia.name.toLowerCase()] = lia.id);

        const entityMap = {};
        state.entities.forEach(ent => entityMap[ent.name.toLowerCase()] = ent.id);

        const existingTxIds = new Set(state.transactions.map(t => t.id));
        const existingTplIds = new Set(state.recurringTemplates.map(t => t.id));

        const dataLines = lines.slice(1);

        // --- Pass 1: Structural Entities (Entities, Categories, Accounts, Assets, Liabilities) ---
        for (const line of dataLines) {
            const getValue = parseCSVLine(line, colIdx);
            const type = getValue("Type").toUpperCase();
            const label = getValue("Label");
            if (!type || !label) continue;

            if (type === 'ENTITY') {
                const lowerName = label.toLowerCase();
                if (!entityMap[lowerName]) {
                    const id = `ent_${await generateDeterministicUUID(label)}`;
                    results.entities.push({ id, name: label, type: getValue("Nature") || 'PRIVATE' });
                    entityMap[lowerName] = id;
                }
            } else if (type === 'CATEGORY') {
                const lowerLabel = label.toLowerCase();
                if (categoryMap[lowerLabel]) {
                    results.duplicates.categories++;
                } else {
                    const id = `cat_${await generateDeterministicUUID(label)}`;
                    results.categories.push({
                        id, label,
                        nature: getValue("Nature") || 'QUOTIDIEN',
                        icon: getValue("Icon") || 'fa-tag',
                        color: getValue("Color") || '#94a3b8',
                        isPassive: getValue("IsPassive") === '1'
                    });
                    categoryMap[lowerLabel] = id;
                }
            } else if (type === 'ACCOUNT') {
                const lowerName = label.toLowerCase();
                if (accountMap[lowerName]) {
                    results.duplicates.accounts++;
                } else {
                    const entId = await resolveEntityId(getValue("Entity"), results, entityMap);
                    const id = `acc_${await generateDeterministicUUID(label)}`;
                    const accData = {
                        id, name: label,
                        createDate: getValue("Date") || new Date().toISOString().split('T')[0],
                        initialBalance: parseFloat(getValue("Value")) || 0,
                        isSaving: getValue("IsSaving") === '1',
                        isInvestmentAccount: getValue("IsInvestment") === '1' || getValue("isInvestmentAccount") === '1',
                        entityId: entId
                    };
                    results.accounts.push(accData);
                    accountMap[lowerName] = id;
                    accountEntityMap[id] = entId;
                }
            } else if (type === 'ASSET' || type === 'LIABILITY') {
                const lowerName = label.toLowerCase();
                const isAsset = type === 'ASSET';
                const targetMap = isAsset ? assetMap : liabilityMap;
                const targetResults = isAsset ? results.assets : results.liabilities;

                if (!targetMap[lowerName]) {
                    const id = await generateDeterministicUUID(label);
                    const entId = await resolveEntityId(getValue("Entity"), results, entityMap);
                    targetResults.push({ id, name: label, entityId: entId });
                    targetMap[lowerName] = id;
                }
            }
        }

        // --- Pass 2: Linked Data (Transactions, Templates, Values) ---
        for (let i = 0; i < dataLines.length; i++) {
            const getValue = parseCSVLine(dataLines[i], colIdx);
            const type = getValue("Type").toUpperCase();
            const label = getValue("Label");
            if (!type || !label) continue;

            if (type === 'TRANSACTION' || type === 'RECURRING_TEMPLATE') {
                const sourceName = getValue("Source");
                const destName = getValue("Destination");
                const isSrcExt = !sourceName || sourceName.toLowerCase() === 'external';
                const isDstExt = !destName || destName.toLowerCase() === 'external';

                if (isSrcExt && isDstExt) {
                    results.ignored.details.push(`Ligne ${i + 2}: Ignoré - Source et Destination sont "external".`);
                    type === 'TRANSACTION' ? results.ignored.transactions++ : results.ignored.templates++;
                    continue;
                }

                const sourceId = isSrcExt ? 'external' : accountMap[sourceName.toLowerCase()];
                const destId = isDstExt ? 'external' : accountMap[destName.toLowerCase()];

                if ((!isSrcExt && !sourceId) || (!isDstExt && !destId)) {
                    results.ignored.details.push(`Ligne ${i + 2}: Ignoré - Compte inconnu.`);
                    type === 'TRANSACTION' ? results.ignored.transactions++ : results.ignored.templates++;
                    continue;
                }

                const catId = await resolveCategoryId(getValue("Category"), results, categoryMap);
                const entId = accountEntityMap[sourceId] || accountEntityMap[destId] || null;
                const common = { 
                    label, date: getValue("Date"), amount: parseFloat(getValue("Value")) || 0,
                    source: sourceId, destination: destId, entityId: entId 
                };

                if (type === 'TRANSACTION') {
                    const txData = { ...common, Category: catId, Model: null };
                    const id = generateDeterministicTransactionId(txData);
                    if (existingTxIds.has(id)) results.duplicates.transactions++;
                    else results.transactions.push({ id, ...txData });
                } else {
                    const tplData = { ...common, category: catId, periodicity: getValue("Periodicity") || 'M', endDate: getValue("EndDate") || null };
                    const id = generateDeterministicTemplateId(tplData);
                    if (existingTplIds.has(id)) results.duplicates.templates++;
                    else results.templates.push({ id, ...tplData });
                }
            } else if (type === 'ASSET_VALUE' || type === 'LIABILITY_VALUE') {
                const isAssetVal = type === 'ASSET_VALUE';
                const parentId = (isAssetVal ? assetMap : liabilityMap)[label.toLowerCase()];
                if (parentId) {
                    const valData = {
                        date: getValue("Date"), 
                        value: parseFloat(getValue("Value")) || 0,
                        quantity: parseFloat(getValue("Quantity")) || 1
                    };
                    isAssetVal ? results.assetValues.push({ asset_id: parentId, ...valData }) 
                               : results.liabilityValues.push({ liability_id: parentId, ...valData });
                }
            }
        }
        showImportSummaryModal(results);
    };
    reader.readAsText(file);
};

const showImportSummaryModal = (results) => {
    const totalNew = results.accounts.length + results.categories.length + results.transactions.length + results.templates.length + results.assets.length + results.liabilities.length + results.entities.length;
    const totalDups = results.duplicates.accounts + results.duplicates.categories + results.duplicates.transactions + results.duplicates.templates + results.duplicates.assets + results.duplicates.liabilities + results.duplicates.entities;
    const totalIgnored = results.ignored.transactions + results.ignored.templates;

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

                <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
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

                    ${totalIgnored > 0 ? `
                        <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <h4 class="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                <i class="fa-solid fa-eye-slash"></i> Flux ignorés (${totalIgnored})
                            </h4>
                            <div class="max-h-32 overflow-y-auto text-[10px] text-slate-500 font-mono divide-y divide-slate-100">
                                ${results.ignored.details.map(d => `<div class="py-1">${d}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${results.errors.length > 0 ? `
                        <div class="p-4 bg-red-50 border border-red-100 rounded-xl space-y-2">
                            <h4 class="text-xs font-bold text-red-600 uppercase tracking-widest flex items-center gap-2">
                                <i class="fa-solid fa-triangle-exclamation"></i> Données corrompues (${results.errors.length})
                            </h4>
                            <div class="max-h-32 overflow-y-auto text-[10px] text-red-500 font-mono divide-y divide-red-100">
                                ${results.errors.map(err => `<div class="py-1">${err}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div class="space-y-3">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Détails des nouveaux éléments</h4>
                        <div class="divide-y divide-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                            <div class="p-3 flex justify-between items-center text-sm">
                                <span class="text-slate-600 flex items-center gap-2"><i class="fa-solid fa-building-user text-slate-400"></i> Entités</span>
                                <span class="font-bold text-slate-800">${results.entities.length}</span>
                            </div>
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
        console.log("[Import] User confirmed import. Starting process...");
        closeModal();
        try {
            setLoadingState(true, 'Importation...', 'Traitement de votre sauvegarde complète en cours.');
            await setUserImportingState(currentUserId, true);
            
            console.log("[Import] Payload summary:", {
                accounts: results.accounts.length,
                transactions: results.transactions.length,
                templates: results.templates.length,
                categories: results.categories.length,
                assets: results.assets.length,
                liabilities: results.liabilities.length,
                entities: results.entities.length
            });

            await importDataToFirestore(
                currentUserId, 
                results.accounts, 
                results.transactions, 
                results.templates, 
                results.categories,
                results.assets,
                results.assetValues,
                results.liabilities,
                results.liabilityValues,
                results.entities
            );
            
            console.log("[Import] Firestore import completed successfully.");
            showNotification(`Importation réussie : ${totalNew} nouveaux éléments ajoutés.`);
        } catch (err) {
            console.error("[Import] CRITICAL FAILURE during import:", err);
            showNotification("Erreur lors de l'importation.", 'error');
        } finally {
            await setUserImportingState(currentUserId, false);
            setLoadingState(false);
            console.log("[Import] Process finished. Reloading window...");
            window.location.reload();
        }
    };
};
