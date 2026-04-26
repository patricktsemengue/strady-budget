import { state } from './state.js';
import { currentUserId } from './storage.js';
import { t } from './i18n.js';
import { 
    addAssetToFirestore, deleteAssetFromFirestore, addAssetValueToFirestore, deleteAssetValueFromFirestore,
    addLiabilityToFirestore, deleteLiabilityFromFirestore, addLiabilityValueToFirestore, deleteLiabilityValueFromFirestore
} from './firestore-service.js';
import { showNotification } from './ui.js';
import { formatCurrency, generateDeterministicUUID } from './utils.js';

export const renderWealthList = () => {
    const assetList = document.getElementById('wealth-assets-list');
    const liabilityList = document.getElementById('wealth-liabilities-list');
    const summary = document.getElementById('wealth-summary');
    const assetsLabel = document.getElementById('total-assets-label');
    const liabilitiesLabel = document.getElementById('total-liabilities-label');
    
    if (!assetList || !liabilityList) return;

    // Helper to get latest value BEFORE or ON the viewDate
    const getLatestValue = (entityId, isAsset = true) => {
        // Last day of the selected month
        const lastDayOfMonth = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 0);
        const viewDateStr = lastDayOfMonth.toISOString().split('T')[0];

        const values = isAsset 
            ? state.assetValues.filter(v => v.asset_id === entityId && v.date <= viewDateStr)
            : state.liabilityValues.filter(v => v.liability_id === entityId && v.date <= viewDateStr);
        
        if (values.length === 0) return { value: 0, date: '-', quantity: 0 };
        
        return values.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    };

    let totalAssets = 0;
    let totalLiabilities = 0;

    // Render Assets
    assetList.innerHTML = state.assets.map(asset => {
        const latest = getLatestValue(asset.id, true);
        totalAssets += latest.value;
        return `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:border-indigo-200 transition-all cursor-pointer group relative overflow-hidden" onclick="window.app.openWealthDetails('${asset.id}', 'asset')">
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                            <i class="fa-solid fa-gem text-lg"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 leading-tight">${asset.name}</h4>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Actif Immobilier/Valorisé</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-black text-slate-900 leading-none">${formatCurrency(latest.value)}</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase mt-1">Estimation au ${latest.date}</p>
                    </div>
                </div>
                <div class="absolute bottom-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i class="fa-solid fa-chevron-right text-[10px] text-indigo-400"></i>
                </div>
            </div>
        `;
    }).join('') || '<div class="p-8 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">Aucun actif enregistré pour cette période.</div>';

    // Render Liabilities
    liabilityList.innerHTML = state.liabilities.map(liability => {
        const latest = getLatestValue(liability.id, false);
        totalLiabilities += latest.value;
        return `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:border-rose-200 transition-all cursor-pointer group relative overflow-hidden" onclick="window.app.openWealthDetails('${liability.id}', 'liability')">
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm">
                            <i class="fa-solid fa-hand-holding-dollar text-lg"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 leading-tight">${liability.name}</h4>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Dette / Emprunt Bancaire</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-black text-rose-600 leading-none">${formatCurrency(latest.value)}</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase mt-1">Solde au ${latest.date}</p>
                    </div>
                </div>
                <div class="absolute bottom-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i class="fa-solid fa-chevron-right text-[10px] text-rose-400"></i>
                </div>
            </div>
        `;
    }).join('') || '<div class="p-8 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">Aucun passif enregistré pour cette période.</div>';

    // Update Totals and Summary
    const netWorth = totalAssets - totalLiabilities;
    if (assetsLabel) assetsLabel.textContent = formatCurrency(totalAssets);
    if (liabilitiesLabel) liabilitiesLabel.textContent = formatCurrency(totalLiabilities);

    if (summary) {
        summary.innerHTML = `
            <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total des Actifs</p>
                <p class="text-2xl font-black text-slate-800">${formatCurrency(totalAssets)}</p>
                <div class="mt-2 h-1 w-12 bg-emerald-500 rounded-full"></div>
            </div>
            <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total des Dettes</p>
                <p class="text-2xl font-black text-rose-600">${formatCurrency(totalLiabilities)}</p>
                <div class="mt-2 h-1 w-12 bg-rose-500 rounded-full"></div>
            </div>
            <div class="bg-slate-900 p-6 rounded-2xl shadow-xl transition-all hover:scale-[1.02]">
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Patrimoine Net (Equity)</p>
                <p class="text-2xl font-black text-white">${formatCurrency(netWorth)}</p>
                <p class="text-[10px] font-bold text-slate-400 mt-2 italic">Valeur nette à cette période</p>
            </div>
        `;
    }
};

export const handleAddWealthEntity = async (e) => {
    e.preventDefault();
    const type = document.getElementById('wealth-entity-type').value;
    const name = document.getElementById('wealth-entity-name').value.trim();
    const value = parseFloat(document.getElementById('wealth-entity-value').value);
    const date = document.getElementById('wealth-entity-date').value;
    const quantity = parseFloat(document.getElementById('wealth-entity-quantity').value || 1);

    if (!name || isNaN(value) || !date) {
        showNotification('Veuillez remplir tous les champs obligatoires.', 'error');
        return;
    }

    try {
        const id = await generateDeterministicUUID(name);
        if (type === 'asset') {
            await addAssetToFirestore(currentUserId, { id, name });
            await addAssetValueToFirestore(currentUserId, { asset_id: id, value, date, quantity });
        } else {
            await addLiabilityToFirestore(currentUserId, { id, name });
            await addLiabilityValueToFirestore(currentUserId, { liability_id: id, value, date, quantity });
        }
        
        closeWealthDrawer();
        showNotification('Enregistré avec succès !');
    } catch (err) {
        console.error(err);
        showNotification('Erreur lors de l\'enregistrement', 'error');
    }
};

export const openWealthDrawer = () => {
    document.getElementById('wealth-add-form').reset();
    document.getElementById('wealth-entity-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('drawer-overlay').classList.add('active');
    document.getElementById('wealth-add-drawer').classList.add('active');
};

export const closeWealthDrawer = () => {
    document.getElementById('drawer-overlay').classList.remove('active');
    document.getElementById('wealth-add-drawer').classList.remove('active');
};

let currentWealthEntityId = null;
let currentWealthEntityType = null;

export const openWealthDetails = (id, type) => {
    currentWealthEntityId = id;
    currentWealthEntityType = type;
    
    const entity = type === 'asset' 
        ? state.assets.find(a => a.id === id)
        : state.liabilities.find(l => l.id === id);
    
    if (!entity) return;

    const modal = document.getElementById('wealth-details-modal');
    const title = document.getElementById('wealth-details-title');
    const historyList = document.getElementById('wealth-history-list');
    
    title.textContent = entity.name;
    
    const values = type === 'asset'
        ? state.assetValues.filter(v => v.asset_id === id)
        : state.liabilityValues.filter(v => v.liability_id === id);
    
    values.sort((a, b) => new Date(b.date) - new Date(a.date));

    historyList.innerHTML = values.map(v => `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div>
                <p class="font-bold text-slate-700">${formatCurrency(v.value)}</p>
                <p class="text-[10px] text-slate-400 font-bold">${v.date} ${type === 'asset' ? `• Qté: ${v.quantity}` : ''}</p>
            </div>
            <button onclick="window.app.deleteWealthValue('${v.id}')" class="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
        </div>
    `).join('') || '<p class="text-center text-slate-400 italic py-4">Aucun historique de valeur.</p>';

    modal.classList.remove('hidden');
};

export const closeWealthDetails = () => {
    document.getElementById('wealth-details-modal').classList.add('hidden');
    currentWealthEntityId = null;
    currentWealthEntityType = null;
};

export const handleAddValueSnapshot = async (e) => {
    e.preventDefault();
    const value = parseFloat(document.getElementById('new-snapshot-value').value);
    const date = document.getElementById('new-snapshot-date').value;
    const quantity = parseFloat(document.getElementById('new-snapshot-quantity').value || 1);

    if (isNaN(value) || !date) return;

    try {
        if (currentWealthEntityType === 'asset') {
            await addAssetValueToFirestore(currentUserId, { asset_id: currentWealthEntityId, value, date, quantity });
        } else {
            await addLiabilityValueToFirestore(currentUserId, { liability_id: currentWealthEntityId, value, date, quantity });
        }
        document.getElementById('wealth-snapshot-form').reset();
        document.getElementById('new-snapshot-date').value = new Date().toISOString().split('T')[0];
        // Re-render modal list (handled by state change listener in main.js usually, but we call it manually for immediate feedback if needed)
        openWealthDetails(currentWealthEntityId, currentWealthEntityType);
    } catch (err) {
        console.error(err);
    }
};

export const deleteWealthValue = async (valId) => {
    if (!confirm(t('confirm.delete_record'))) return;
    try {
        if (currentWealthEntityType === 'asset') {
            await deleteAssetValueFromFirestore(currentUserId, valId);
        } else {
            await deleteLiabilityValueFromFirestore(currentUserId, valId);
        }
        openWealthDetails(currentWealthEntityId, currentWealthEntityType);
    } catch (err) {
        console.error(err);
    }
};

export const deleteWealthEntity = async () => {
    const ast = state.assets.find(a => a.id === currentWealthEntityId);
    const lia = state.liabilities.find(l => l.id === currentWealthEntityId);
    const label = ast ? ast.name : (lia ? lia.name : (currentWealthEntityType === 'asset' ? t('common.asset') : t('common.liability')));

    if (!confirm(t('confirm.delete_wealth', { label }))) return;
    
    try {
        if (currentWealthEntityType === 'asset') {
            await deleteAssetFromFirestore(currentUserId, currentWealthEntityId);
        } else {
            await deleteLiabilityFromFirestore(currentUserId, currentWealthEntityId);
        }
        closeWealthDetails();
        showNotification('Supprimé.');
    } catch (err) {
        console.error(err);
    }
};
