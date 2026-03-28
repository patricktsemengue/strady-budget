import { state } from './state.js';
import { generateId } from './utils.js';
import { currentUserId } from './storage.js';
import { addCategoryToFirestore, updateCategoryInFirestore, deleteCategoryFromFirestore, updateCategoryOrderInFirestore } from './firestore-service.js';
import { showNotification, render } from './ui.js';

let sortableInstance = null;

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
                    render(); // Re-render to revert optimistic UI change
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
            if (isDisabled) return '';
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
            const isDefaultOther = cat.id === 'Autre';
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
            const isDefaultOther = cat.id === 'Autre';
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

    currentCategoryActionId = id;
    const modal = document.getElementById('category-actions-modal');
    const content = document.getElementById('category-actions-content');
    const title = document.getElementById('category-actions-title');

    title.textContent = cat.label;
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        content.style.transform = 'translateY(0)';
    }, 10);

    const setupAction = (btnId, actionFn) => {
        const btn = document.getElementById(btnId);
        btn.onclick = () => {
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
    let icon = document.getElementById('cat-icon').value.trim();
    const color = document.getElementById('cat-color').value;
    
    if (!name) return;
    if (!icon) icon = 'fa-tag';
    if (!icon.startsWith('fa-')) icon = 'fa-' + icon;

    if (state.categories.find(c => c.label === name)) {
        alert('Une catégorie avec ce nom existe déjà.');
        return;
    }

    const id = generateId();
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
    document.getElementById('edit-cat-icon').value = cat.icon.replace('fa-', '');
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
    let icon = document.getElementById('edit-cat-icon').value.trim();
    const color = document.getElementById('edit-cat-color').value;

    if (!icon) icon = 'fa-tag';
    if (!icon.startsWith('fa-')) icon = 'fa-' + icon;

    const existingCategory = state.categories.find(c => c.id === id);
    if (!existingCategory) return;

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
        render(); // Re-render to fix the UI
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
