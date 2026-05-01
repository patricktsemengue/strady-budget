import { state } from './state.js';
import { currentUserId } from './storage.js';
import { t } from './i18n.js';
import { 
    addAssetToFirestore, deleteAssetFromFirestore, addAssetValueToFirestore, deleteAssetValueFromFirestore,
    addLiabilityToFirestore, deleteLiabilityFromFirestore, addLiabilityValueToFirestore, deleteLiabilityValueFromFirestore
} from './firestore-service.js';
import { showNotification, SwipeManager } from './ui.js';
import { formatCurrency, formatSpecificCurrency, convertToAppCurrency, generateDeterministicUUID } from './utils.js';

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
        const convertedValue = convertToAppCurrency(latest.value, asset.currency);
        totalAssets += convertedValue;
        
        return `
            <div data-id="${asset.id}" class="swipe-item relative overflow-hidden rounded-2xl group shadow-sm mb-4">
                <!-- Action Layers -->
                <div class="absolute inset-0 flex justify-between items-center text-white overflow-hidden rounded-2xl">
                    <div class="w-1/2 h-full bg-rose-600 flex justify-start items-center px-6">
                        <button onclick="window.app.deleteWealthEntityById('${asset.id}', 'asset')" class="flex flex-col items-center gap-1">
                            <i class="fa-solid fa-trash-can text-lg"></i>
                            <span class="text-[8px] font-bold uppercase tracking-tighter">Supprimer</span>
                        </button>
                    </div>
                    <div class="w-1/2 h-full bg-blue-600 flex justify-end items-center px-6">
                        <button onclick="window.app.openWealthDetails('${asset.id}', 'asset')" class="flex flex-col items-center gap-1">
                            <i class="fa-solid fa-pen-to-square text-lg"></i>
                            <span class="text-[8px] font-bold uppercase tracking-tighter">Détails</span>
                        </button>
                    </div>
                </div>

                <!-- Content Layer -->
                <div class="swipe-content relative bg-white border border-slate-100 p-5 flex items-center justify-between gap-4 transition-all duration-200 hover:border-indigo-200 cursor-pointer">
                    <div class="flex items-center gap-4 flex-grow truncate">
                        <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                            <i class="fa-solid fa-gem text-lg"></i>
                        </div>
                        <div class="truncate">
                            <h4 class="font-bold text-slate-800 leading-tight truncate">${asset.name}</h4>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                ${asset.currency && asset.currency !== state.displayCurrency ? `${asset.currency} • ` : ''}${t('wealth.asset_type_help')}
                            </p>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <p class="text-lg font-black text-slate-900 leading-none">${formatCurrency(convertedValue)}</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase mt-1">
                            ${asset.currency && asset.currency !== state.displayCurrency ? `${formatSpecificCurrency(latest.value, asset.currency)} • ` : ''}${t('wealth.estimation_at', { date: latest.date })}
                        </p>
                    </div>
                    <div class="hidden md:flex w-24 justify-end items-center gap-1 ml-4 border-l border-slate-50 pl-2">
                        <button onclick="window.app.openWealthDetails('${asset.id}', 'asset')" class="ghost-action-btn p-2 text-slate-300 hover:text-blue-600 transition-all">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onclick="window.app.deleteWealthEntityById('${asset.id}', 'asset')" class="ghost-action-btn p-2 text-slate-300 hover:text-rose-600 transition-all">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('') || `<div class="p-8 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">${t('wealth.no_assets')}</div>`;

    // Render Liabilities
    liabilityList.innerHTML = state.liabilities.map(liability => {
        const latest = getLatestValue(liability.id, false);
        const convertedValue = convertToAppCurrency(latest.value, liability.currency);
        totalLiabilities += convertedValue;

        return `
            <div data-id="${liability.id}" class="swipe-item relative overflow-hidden rounded-2xl group shadow-sm mb-4">
                <!-- Action Layers -->
                <div class="absolute inset-0 bg-rose-600 flex justify-start items-center px-6 text-white">
                    <button onclick="window.app.deleteWealthEntityById('${liability.id}', 'liability')" class="flex flex-col items-center gap-1">
                        <i class="fa-solid fa-trash-can text-lg"></i>
                        <span class="text-[8px] font-bold uppercase tracking-tighter">Supprimer</span>
                    </button>
                </div>
                <div class="absolute inset-0 bg-blue-600 flex justify-end items-center px-6 text-white">
                    <div class="flex flex-col items-center gap-1">
                        <i class="fa-solid fa-pen-to-square text-lg"></i>
                        <span class="text-[8px] font-bold uppercase tracking-tighter">Détails</span>
                    </div>
                </div>

                <!-- Content Layer -->
                <div class="swipe-content relative bg-white border border-slate-100 p-5 flex items-center justify-between gap-4 transition-all duration-200 hover:border-rose-200">
                    <div class="flex items-center gap-4 flex-grow truncate">
                        <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm">
                            <i class="fa-solid fa-hand-holding-dollar text-lg"></i>
                        </div>
                        <div class="truncate">
                            <h4 class="font-bold text-slate-800 leading-tight truncate">${liability.name}</h4>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                ${liability.currency && liability.currency !== state.displayCurrency ? `${liability.currency} • ` : ''}${t('wealth.liability_type_help')}
                            </p>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <p class="text-lg font-black text-rose-600 leading-none">${formatCurrency(convertedValue)}</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase mt-1">
                            ${liability.currency && liability.currency !== state.displayCurrency ? `${formatSpecificCurrency(latest.value, liability.currency)} • ` : ''}${t('wealth.balance_at', { date: latest.date })}
                        </p>
                    </div>
                    <div class="hidden md:flex w-24 justify-end items-center gap-1 ml-4 border-l border-slate-50 pl-2">
                        <button onclick="window.app.openWealthDetails('${liability.id}', 'liability')" class="ghost-action-btn p-2 text-slate-300 hover:text-blue-600 transition-all">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onclick="window.app.deleteWealthEntityById('${liability.id}', 'liability')" class="ghost-action-btn p-2 text-slate-300 hover:text-rose-600 transition-all">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('') || `<div class="p-8 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">${t('wealth.no_liabilities')}</div>`;

    // Initialize SwipeManager for mobile
    if (window.innerWidth < 768) {
        new SwipeManager('wealth-assets-list', {
            onTap: (id) => openWealthDetails(id, 'asset')
        });
        new SwipeManager('wealth-liabilities-list', {
            onTap: (id) => openWealthDetails(id, 'liability')
        });
    }

    // Update Totals and Summary
    const netWorth = totalAssets - totalLiabilities;
    if (assetsLabel) assetsLabel.textContent = formatCurrency(totalAssets);
    if (liabilitiesLabel) liabilitiesLabel.textContent = formatCurrency(totalLiabilities);

    const wStatAssets = document.getElementById('wealth-stat-assets');
    const wStatLiabilities = document.getElementById('wealth-stat-liabilities');
    const wStatNet = document.getElementById('wealth-stat-net');
    if (wStatAssets) wStatAssets.textContent = formatCurrency(totalAssets);
    if (wStatLiabilities) wStatLiabilities.textContent = formatCurrency(totalLiabilities);
    if (wStatNet) wStatNet.textContent = formatCurrency(netWorth);
};

export const handleAddWealthEntity = async (e) => {
    e.preventDefault();
    const type = document.getElementById('wealth-entity-type').value;
    const name = document.getElementById('wealth-entity-name').value.trim();
    const value = parseFloat(document.getElementById('wealth-entity-value').value);
    const date = document.getElementById('wealth-entity-date').value;
    const quantity = parseFloat(document.getElementById('wealth-entity-quantity').value || 1);
    const currency = document.getElementById('wealth-entity-currency').value;

    if (!name || isNaN(value) || !date) {
        showNotification(t('wealth.fill_required'), 'error');
        return;
    }

    try {
        const id = await generateDeterministicUUID(name);
        if (type === 'asset') {
            await addAssetToFirestore(currentUserId, { id, name, currency });
            await addAssetValueToFirestore(currentUserId, { asset_id: id, value, date, quantity });
        } else {
            await addLiabilityToFirestore(currentUserId, { id, name, currency });
            await addLiabilityValueToFirestore(currentUserId, { liability_id: id, value, date, quantity });
        }
        
        closeWealthDrawer();
        showNotification(t('wealth.save_success'));
    } catch (err) {
        console.error(err);
        showNotification(t('wealth.save_error'), 'error');
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
                <p class="font-bold text-slate-700">${formatSpecificCurrency(v.value, entity.currency)}</p>
                <p class="text-[10px] text-slate-400 font-bold">${v.date} ${type === 'asset' ? `• Qté: ${v.quantity}` : ''}</p>
            </div>
            <button onclick="window.app.deleteWealthValue('${v.id}')" class="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
        </div>
    `).join('') || `<p class="text-center text-slate-400 italic py-4">${t('wealth.history_empty')}</p>`;

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
        // Re-render modal list
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
        showNotification(t('wealth.delete_success'));
    } catch (err) {
        console.error(err);
    }
};

export const deleteWealthEntityById = async (id, type) => {
    const entity = type === 'asset' 
        ? state.assets.find(a => a.id === id)
        : state.liabilities.find(l => l.id === id);
    
    if (!entity) return;

    if (!confirm(t('confirm.delete_wealth', { label: entity.name }))) return;
    
    try {
        if (type === 'asset') {
            await deleteAssetFromFirestore(currentUserId, id);
        } else {
            await deleteLiabilityFromFirestore(currentUserId, id);
        }
        showNotification(t('wealth.delete_success'));
    } catch (err) {
        console.error(err);
    }
};
