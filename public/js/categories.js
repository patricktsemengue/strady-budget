import { state } from './state.js';
import { generateId, generateDeterministicUUID } from './utils.js';
import { currentUserId } from './storage.js';
import { addCategoryToFirestore, updateCategoryInFirestore, deleteCategoryFromFirestore, updateCategoryOrderInFirestore } from './firestore-service.js';
import { showNotification, SwipeManager } from './ui.js';
import { router } from './app-router.js';
import { t } from './i18n.js';

let sortableInstance = null;

const friendlyColors = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#6366f1', // indigo-500
    '#8b5cf6', // violet-500
    '#f59e0b', // amber-500
    '#f43f5e', // rose-500
    '#06b6d4', // cyan-500
    '#14b8a6', // teal-500
    '#f97316', // orange-500
    '#ec4899', // pink-500
    '#84cc16'  // lime-500
];

const assignRandomColor = (elementId) => {
    const randomColor = friendlyColors[Math.floor(Math.random() * friendlyColors.length)];
    const colorInput = document.getElementById(elementId);
    if (colorInput) {
        colorInput.value = randomColor;
    }
};

export const initCategoryEvents = () => {
    const catIconSelect = document.getElementById('cat-icon');
    const editCatIconSelect = document.getElementById('edit-cat-icon');
    const catNatureSelect = document.getElementById('cat-nature');
    const editCatNatureSelect = document.getElementById('edit-cat-nature');

    if (catIconSelect) {
        catIconSelect.addEventListener('change', () => assignRandomColor('cat-color'));
    }
    if (editCatIconSelect) {
        editCatIconSelect.addEventListener('change', () => assignRandomColor('edit-cat-color'));
    }

    // Toggle Passive wrapper based on Nature
    const togglePassiveUI = (natureSelect, wrapperId) => {
        const wrapper = document.getElementById(wrapperId);
        if (wrapper) {
            wrapper.classList.toggle('hidden', natureSelect.value !== 'REVENU');
        }
    };

    if (catNatureSelect) {
        catNatureSelect.addEventListener('change', () => togglePassiveUI(catNatureSelect, 'cat-passive-wrapper'));
    }
    if (editCatNatureSelect) {
        editCatNatureSelect.addEventListener('change', () => togglePassiveUI(editCatNatureSelect, 'edit-cat-passive-wrapper'));
    }
};

export const initSortableCategories = () => {
    const groups = document.querySelectorAll('.sortable-group');
    if (groups.length === 0 || !window.Sortable) return;

    groups.forEach(groupEl => {
        Sortable.create(groupEl, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'bg-indigo-50',
            group: 'categories', // Allows moving between nature groups
            onEnd: async (evt) => {
                // When an item is dropped, we re-calculate the global index-order
                // based on the visual sequence of all groups and items.
                const allItems = document.querySelectorAll('[data-id]');
                const updates = [];
                
                allItems.forEach((item, idx) => {
                    const id = item.dataset.id;
                    const newIndexOrder = idx + 1;
                    
                    // Also check if the item moved to a new nature group
                    const newNature = item.closest('.sortable-group').dataset.nature;
                    const cat = state.categories.find(c => c.id === id);
                    
                    const updateObj = { id, 'index-order': newIndexOrder };
                    if (cat && cat.nature !== newNature) {
                        updateObj.nature = newNature;
                    }
                    
                    updates.push(updateObj);
                });
                
                try {
                    await updateCategoryOrderInFirestore(currentUserId, updates);
                    showNotification('Ordre et natures mis à jour.');
                } catch (err) {
                    console.error(err);
                    showNotification("Erreur lors de la mise à jour.", 'error');
                    renderCategoriesList(); // Revert UI
                }
            }
        });
    });
};

export const renderCategoriesList = () => {
    const list = document.getElementById('mgmt-categories-list');
    if (!list || !state.transactions) return;

    const usedCategoryIds = new Set();
    (state.transactions || []).forEach(tx => {
        if (tx.Category) usedCategoryIds.add(tx.Category);
    });
    (state.recurringTemplates || []).forEach(tpl => {
        if (tpl.category) usedCategoryIds.add(tpl.category);
    });

    const natureLabels = {
        'REVENU': 'REVENUS (Entrées)',
        'EPARGNE': 'ÉPARGNE & INVEST. (Futur)',
        'FIXE': 'CHARGES FIXES (Contraint)',
        'QUOTIDIEN': 'VIE COURANTE (Lifestyle)',
        'LOISIR': 'LOISIRS (Discrétionnaire)'
    };

    const natureOrder = ['REVENU', 'EPARGNE', 'FIXE', 'QUOTIDIEN', 'LOISIR'];

    // Grouping
    const groups = {};
    state.categories.forEach(cat => {
        const nature = cat.nature || 'QUOTIDIEN';
        if (!groups[nature]) groups[nature] = [];
        groups[nature].push(cat);
    });

    // Sort within groups by index-order
    Object.keys(groups).forEach(nature => {
        groups[nature].sort((a, b) => {
            const orderA = a['index-order'] !== undefined ? a['index-order'] : Infinity;
            const orderB = b['index-order'] !== undefined ? b['index-order'] : Infinity;
            if (orderA === orderB) return a.label.localeCompare(b.label);
            return orderA - orderB;
        });
    });

    const renderGroup = (nature) => {
        const categories = groups[nature] || [];
        if (categories.length === 0) return '';

        const headerHtml = `
            <div class="mt-8 mb-4 border-b border-slate-100 pb-2 flex items-center justify-between">
                <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${natureLabels[nature]}</h4>
                <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">${categories.length} postes</span>
            </div>
        `;

        const itemsHtml = categories.map((cat, idx) => {
            const isUsed = usedCategoryIds.has(cat.id);
            const isDefaultOther = cat.label === 'Autre';
            const isDisabled = isUsed || isDefaultOther;

            return `
                <div data-id="${cat.id}" class="swipe-item relative overflow-hidden rounded-xl group">
                    <!-- Action Layers -->
                    <div class="absolute inset-0 bg-blue-600 flex justify-start items-center px-6 text-white">
                        <div class="flex flex-col items-center gap-1">
                            <i class="fa-solid fa-pen-to-square text-lg"></i>
                            <span class="text-[8px] font-bold uppercase tracking-tighter">Modifier</span>
                        </div>
                    </div>
                    <div class="absolute inset-0 bg-rose-600 flex justify-end items-center px-6 text-white">
                        <button onclick="window.app.deleteCategory('${cat.id}')" class="flex flex-col items-center gap-1 ${isDisabled ? 'opacity-30' : ''}" ${isDisabled ? 'disabled' : ''}>
                            <i class="fa-solid fa-trash-can text-lg"></i>
                            <span class="text-[8px] font-bold uppercase tracking-tighter">Supprimer</span>
                        </button>
                    </div>

                    <!-- Content Layer -->
                    <div class="swipe-content relative bg-white border border-slate-100 p-4 flex items-center justify-between gap-4 transition-all duration-200 hover:border-indigo-200">
                        <div class="flex items-center gap-4 flex-grow truncate">
                            <div class="drag-handle cursor-move text-slate-200 p-1 hover:text-indigo-400"><i class="fa-solid fa-grip-vertical"></i></div>
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 text-xs shadow-sm" style="background-color: ${cat.color}"><i class="fa-solid ${cat.icon}"></i></div>
                            <div class="flex flex-col truncate">
                                <span class="font-bold text-slate-800 truncate">${cat.label}</span>
                                <span class="text-[9px] font-black text-slate-300 uppercase tracking-tighter">Priorité #${cat['index-order'] || (idx + 1)}</span>
                            </div>
                        </div>
                        <div class="hidden md:flex items-center gap-1">
                            <button onclick="window.app.openEditCategory('${cat.id}')" class="ghost-action-btn p-2 text-slate-300 hover:text-blue-600 transition-all">
                                <i class="fa-solid fa-pen text-xs"></i>
                            </button>
                            <button onclick="window.app.deleteCategory('${cat.id}')" class="ghost-action-btn p-2 text-slate-300 hover:text-rose-600 transition-all ${isDisabled ? 'opacity-20' : ''}" ${isDisabled ? 'disabled' : ''}>
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="category-nature-group" id="group-${nature}">
                ${headerHtml}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sortable-group" data-nature="${nature}">
                    ${itemsHtml}
                </div>
            </div>`;
    };

    list.innerHTML = natureOrder.map(nature => renderGroup(nature)).join('');
    
    // Initialize SwipeManager for mobile
    if (window.innerWidth < 768) {
        new SwipeManager('mgmt-categories-list', {
            onSwipeRight: (id) => openEditCategory(id),
            onTap: (id) => openEditCategory(id)
        });
    }

    initSortableCategories();
};


let currentCategoryActionId = null;

export const openCategoryActions = (id) => {
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;

    const isUsedInTransactions = state.transactions.some(tx => tx.Category === id);
    const isUsedInTemplates = state.recurringTemplates.some(tpl => tpl.category === id);
    const isDefaultOther = cat.label === 'Autre';
    const isDisabled = isUsedInTransactions || isUsedInTemplates || isDefaultOther;

    currentCategoryActionId = id;
    const modal = document.getElementById('category-actions-modal');
    const content = document.getElementById('category-actions-content');
    const title = document.getElementById('category-actions-title');
    const deleteBtn = document.getElementById('category-action-delete');

    title.textContent = cat.label;
    
    // Update Delete button UI
    if (isDisabled) {
        deleteBtn.disabled = true;
        deleteBtn.classList.add('opacity-50', 'grayscale');
        deleteBtn.classList.remove('hover:bg-red-50');
    } else {
        deleteBtn.disabled = false;
        deleteBtn.classList.remove('opacity-50', 'grayscale');
        deleteBtn.classList.add('hover:bg-red-50');
    }

    modal.classList.remove('hidden');
    
    setTimeout(() => {
        content.style.transform = 'translateY(0)';
    }, 10);

    const setupAction = (btnId, actionFn) => {
        const btn = document.getElementById(btnId);
        btn.onclick = () => {
            if (btn.disabled) return;
            closeCategoryActions();
            actionFn(currentCategoryActionId);
        };
    };

    setupAction('category-action-edit', openEditCategory);
    setupAction('category-action-delete', deleteCategory);

    modal.onclick = (e) => {
        if (e.target === modal) closeCategoryActions();
    };
};

export const closeCategoryActions = () => {
    const modal = document.getElementById('category-actions-modal');
    const content = document.getElementById('category-actions-content');
    
    content.style.transform = 'translateY(100%)';
    setTimeout(() => {
        modal.classList.add('hidden');
        currentCategoryActionId = null;
    }, 300);
};

export const openAddCategoryDrawer = () => {
    document.getElementById('add-category-form').reset();
    
    // Assign an initial random color
    assignRandomColor('cat-color');
    
    // Pre-fill for interactive setup
    if (state.onboarding?.active && state.onboarding?.type === 'interactive_setup' && state.onboarding?.currentStep === 0) {
        document.getElementById('cat-name').value = 'Housing';
        document.getElementById('cat-nature').value = 'FIXE';
        document.getElementById('cat-icon').value = 'house';
        assignRandomColor('cat-color');
    }

    document.getElementById('drawer-overlay').classList.add('active');
    document.getElementById('category-add-drawer').classList.add('active');
};

export const closeAddCategoryDrawer = () => {
    document.getElementById('drawer-overlay').classList.remove('active');
    document.getElementById('category-add-drawer').classList.remove('active');
    document.getElementById('add-category-form').reset();
};

export const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = document.getElementById('cat-name').value.trim();
    const nature = document.getElementById('cat-nature').value;
    let iconValue = document.getElementById('cat-icon').value;
    const color = document.getElementById('cat-color').value;
    
    if (!name) return;
    if (!iconValue) iconValue = 'tag';
    const icon = iconValue.startsWith('fa-') ? iconValue : 'fa-' + iconValue;

    if (state.categories.find(c => c.label.toLowerCase() === name.toLowerCase())) {
        showNotification('Une catégorie avec ce nom existe déjà.', 'error');
        return;
    }

    const id = await generateDeterministicUUID(name);
    const maxIndex = Math.max(0, ...state.categories.map(c => c['index-order'] || 0));
    const newCategory = { id, label: name, nature, icon, color, 'index-order': maxIndex + 1 };
    
    try {
        await addCategoryToFirestore(currentUserId, newCategory);
        closeAddCategoryDrawer();
        showNotification('Catégorie ajoutée !');
        if (window.app.onTourAction) window.app.onTourAction('category_created');
    } catch (err) {
        showNotification("Erreur lors de l'ajout", 'error');
    }
};

export const openEditCategory = (id) => {
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('edit-cat-id', cat.id);
    setVal('edit-cat-name', cat.label);
    setVal('edit-cat-nature', cat.nature || 'QUOTIDIEN');
    
    const iconValue = cat.icon ? cat.icon.replace('fa-', '') : 'tag';
    setVal('edit-cat-icon', iconValue);
    setVal('edit-cat-color', cat.color || '#94a3b8');
    
    document.getElementById('drawer-overlay').classList.add('active');
    document.getElementById('category-edit-drawer').classList.add('active');
};

export const closeCategoryDrawer = () => {
    document.getElementById('drawer-overlay').classList.remove('active');
    document.getElementById('category-edit-drawer').classList.remove('active');
    document.getElementById('edit-category-form').reset();
};

export const handleUpdateCategory = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-cat-id').value;
    const name = document.getElementById('edit-cat-name').value.trim();
    const nature = document.getElementById('edit-cat-nature').value;
    const iconValue = document.getElementById('edit-cat-icon').value;
    const color = document.getElementById('edit-cat-color').value;

    const icon = iconValue.startsWith('fa-') ? iconValue : 'fa-' + iconValue;

    const existingCategory = state.categories.find(c => c.id === id);
    if (!existingCategory) return;

    if (state.categories.find(c => c.id !== id && c.label.toLowerCase() === name.toLowerCase())) {
        showNotification('Une autre catégorie avec ce nom existe déjà.', 'error');
        return;
    }

    try {
        await updateCategoryInFirestore(currentUserId, { id, label: name, nature, icon, color, 'index-order': existingCategory['index-order'] });
        closeCategoryDrawer();
        showNotification('Catégorie mise à jour !');
    } catch (err) {
        showNotification('Erreur de mise à jour', 'error');
    }
};

export const deleteCategory = async (id) => {
    // Double-check in case the UI is out of sync
    const isUsedInTransactions = state.transactions.some(tx => tx.Category === id);
    const isUsedInTemplates = state.recurringTemplates.some(tpl => tpl.category === id);

    if (isUsedInTransactions || isUsedInTemplates) {
        showNotification("Impossible de supprimer une catégorie actuellement utilisée.", "error");
        router.render(); // Re-render to fix the UI
        return;
    }

    if (confirm(t('confirm.delete_cat'))) {
        try {
            await deleteCategoryFromFirestore(currentUserId, id);
            showNotification('Catégorie supprimée.');
        } catch (err) {
            showNotification('Erreur de suppression', 'error');
        }
    }
};
