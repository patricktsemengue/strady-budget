import { state } from './state.js';
import { generateId, generateDeterministicUUID } from './utils.js';
import { currentUserId } from './storage.js';
import { addCategoryToFirestore, updateCategoryInFirestore, deleteCategoryFromFirestore, updateCategoryOrderInFirestore } from './firestore-service.js';
import { showNotification } from './ui.js';
import { router } from './app-router.js';

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

    if (catIconSelect) {
        catIconSelect.addEventListener('change', () => assignRandomColor('cat-color'));
    }
    if (editCatIconSelect) {
        editCatIconSelect.addEventListener('change', () => assignRandomColor('edit-cat-color'));
    }
};

export const initSortableCategories = () => {
    const list = document.getElementById('mgmt-categories-list');
    if (list && window.Sortable) {
        if (sortableInstance) {
            sortableInstance.destroy();
        }
        sortableInstance = Sortable.create(list, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: async (evt) => {
                const items = evt.target.children;
                const updates = [];
                for (let i = 0; i < items.length; i++) {
                    const id = items[i].dataset.id;
                    const newIndexOrder = i + 1;
                    updates.push({ id, 'index-order': newIndexOrder });
                }
                
                try {
                    await updateCategoryOrderInFirestore(currentUserId, updates);
                    showNotification('Ordre des catégories mis à jour.');
                } catch (err) {
                    showNotification("Erreur lors de la mise à jour de l'ordre.", 'error');
                    router.render(); // Re-render to revert optimistic UI change
                }
            }
        });
    }
};

export const renderCategoriesList = () => {
    const list = document.getElementById('mgmt-categories-list');
    const tableBody = document.getElementById('mgmt-categories-table-body');
    if ((!list && !tableBody) || !state.transactions) return;

    const usedCategoryIds = new Set();
    state.transactions.forEach(tx => {
        if (tx.Category) usedCategoryIds.add(tx.Category);
    });
    state.recurringTemplates.forEach(tpl => {
        if (tpl.category) usedCategoryIds.add(tpl.category);
    });

    const sortedCategories = [...state.categories].sort((a, b) => {
        const orderA = a['index-order'] !== undefined ? a['index-order'] : Infinity;
        const orderB = b['index-order'] !== undefined ? b['index-order'] : Infinity;
        if (orderA === orderB) return a.label.localeCompare(b.label);
        return orderA - orderB;
    });

    const renderActions = (cat, isDisabled, disabledTitle, isMobile = false) => {
        if (isMobile) {
            // Always show the ellipsis button on mobile so user can open the modal
            return `<button onclick="window.app.openCategoryActions('${cat.id}')" class="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Actions"><i class="fa-solid fa-ellipsis-vertical"></i></button>`;
        }
        return `
            <div class="flex items-center justify-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="window.app.openEditCategory('${cat.id}')" class="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Modifier"><i class="fa-solid fa-pen text-xs"></i></button>
                <button onclick="window.app.deleteCategory('${cat.id}')" class="p-2 text-slate-400 hover:text-red-600 transition-colors disabled:text-slate-200" ${isDisabled ? `disabled title="${disabledTitle}"` : 'title="Supprimer"'}><i class="fa-solid fa-trash-can text-xs"></i></button>
            </div>`;
    };

    // Render mobile cards
    if (list) {
        list.innerHTML = sortedCategories.map(cat => {
            const isUsed = usedCategoryIds.has(cat.id);
            const isDefaultOther = cat.label === 'Autre';
            const isDisabled = isUsed || isDefaultOther;
            const disabledTitle = isDefaultOther ? "Catégorie système" : "Catégorie utilisée";

            return `
                <li data-id="${cat.id}" class="p-4 flex items-center justify-between gap-4 group">
                    <div class="flex items-center gap-4 flex-grow truncate">
                        <div class="drag-handle cursor-move text-slate-300 p-1 hover:text-slate-500"><i class="fa-solid fa-grip-vertical"></i></div>
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background-color: ${cat.color}"><i class="fa-solid ${cat.icon}"></i></div>
                        <span class="font-semibold text-slate-800 truncate">${cat.label}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${renderActions(cat, isDisabled, disabledTitle, true)}
                    </div>
                </li>`;
        }).join('');
    }

    // Render desktop table
    if (tableBody) {
        tableBody.innerHTML = sortedCategories.map(cat => {
            const isUsed = usedCategoryIds.has(cat.id);
            const isDefaultOther = cat.label === 'Autre';
            const isDisabled = isUsed || isDefaultOther;
            const disabledTitle = isDefaultOther ? "Cette catégorie par défaut ne peut pas être supprimée." : "Catégorie utilisée par des transactions.";

            return `
                <tr data-id="${cat.id}" class="group hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4">
                        <div class="drag-handle cursor-move text-slate-300 hover:text-slate-500 transition-colors">
                            <i class="fa-solid fa-grip-vertical"></i>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs" style="background-color: ${cat.color}">
                            <i class="fa-solid ${cat.icon}"></i>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-slate-700">${cat.label}</td>
                    <td class="px-6 py-4">
                        ${renderActions(cat, isDisabled, disabledTitle, false)}
                    </td>
                </tr>`;
        }).join('');
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
    const newCategory = { id, label: name, icon, color, 'index-order': maxIndex + 1 };
    
    try {
        await addCategoryToFirestore(currentUserId, newCategory);
        closeAddCategoryDrawer();
        showNotification('Catégorie ajoutée !');
    } catch (err) {
        showNotification("Erreur lors de l'ajout", 'error');
    }
};

export const openEditCategory = (id) => {
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;

    document.getElementById('edit-cat-id').value = cat.id;
    document.getElementById('edit-cat-name').value = cat.label;
    
    const iconValue = cat.icon ? cat.icon.replace('fa-', '') : 'tag';
    document.getElementById('edit-cat-icon').value = iconValue;
    document.getElementById('edit-cat-color').value = cat.color || '#94a3b8';
    
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
        await updateCategoryInFirestore(currentUserId, { id, label: name, icon, color, 'index-order': existingCategory['index-order'] });
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

    if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
        try {
            await deleteCategoryFromFirestore(currentUserId, id);
            showNotification('Catégorie supprimée.');
        } catch (err) {
            showNotification('Erreur de suppression', 'error');
        }
    }
};
