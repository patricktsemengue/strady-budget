import { state } from './state.js';
import { generateId } from './utils.js';
import { currentUserId } from './storage.js';
import { addCategoryToFirestore, updateCategoryInFirestore, deleteCategoryFromFirestore, updateTransactionInFirestore, updateCategoryOrderInFirestore } from './firestore-service.js';
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
    const container = document.getElementById('mgmt-categories-list');
    const usedCategoryIds = new Set();
    Object.values(state.records).forEach(monthData => {
        monthData.items.forEach(item => {
            if (item.Category) usedCategoryIds.add(item.Category);
        });
    });

    const sortedCategories = [...state.categories].sort((a, b) => {
        const orderA = a['index-order'] ?? Infinity;
        const orderB = b['index-order'] ?? Infinity;
        if (orderA === orderB) return a.label.localeCompare(b.label);
        return orderA - orderB;
    });
    container.innerHTML = sortedCategories.map(cat => {
        const isUsed = usedCategoryIds.has(cat.id);
        const isDefaultOther = cat.id === 'Autre';
        const isDisabled = isUsed || isDefaultOther;
        const disabledTitle = isDefaultOther ? "Cette catégorie par défaut ne peut pas être supprimée." : "Catégorie utilisée par des transactions.";

        return `
            <li data-id="${cat.id}" class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                <div class="flex items-center gap-3">
                    <div class="drag-handle cursor-move text-slate-400 p-1" title="Glisser pour réorganiser"><i class="fa-solid fa-grip-vertical"></i></div>
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-white" style="background-color: ${cat.color}"><i class="fa-solid ${cat.icon}"></i></div><span class="font-medium">${cat.label}</span></div>
                <div class="opacity-0 group-hover:opacity-100"><button onclick="window.app.openEditCategory('${cat.id}')" class="p-1 text-slate-500 hover:text-blue-600"><i class="fa-solid fa-pen"></i></button><button onclick="window.app.deleteCategory('${cat.id}')" class="p-1 text-slate-500 hover:text-red-600 disabled:text-slate-300 disabled:cursor-not-allowed" ${isDisabled ? `disabled title="${disabledTitle}"` : 'title="Supprimer la catégorie"'}><i class="fa-solid fa-trash-can"></i></button></div>
            </li>`;
    }).join('');
    
    initSortableCategories();
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
    if (id === 'Autre') {
        showNotification("La catégorie 'Autre' ne peut pas être supprimée.", 'error');
        return;
    }

    // Double-check in case the UI is out of sync
    const isUsed = Object.values(state.records).some(month => month.items.some(tx => tx.Category === id));
    if (isUsed) {
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
