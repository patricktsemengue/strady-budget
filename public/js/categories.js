import { state } from './state.js';
import { generateId } from './utils.js';
import { currentUserId } from './storage.js';
import { addCategoryToFirestore, updateCategoryInFirestore, deleteCategoryFromFirestore, updateTransactionInFirestore } from './firestore-service.js';
import { showNotification, render } from './ui.js';

export const renderCategoriesList = () => {
    const container = document.getElementById('mgmt-categories-list');
    container.innerHTML = state.categories.map(cat => `
        <li class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group">
            <div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full flex items-center justify-center text-white" style="background-color: ${cat.color}"><i class="fa-solid ${cat.icon}"></i></div><span class="font-medium">${cat.label}</span></div>
            <div class="opacity-0 group-hover:opacity-100"><button onclick="window.app.openEditCategory('${cat.id}')" class="p-1"><i class="fa-solid fa-pen"></i></button><button onclick="window.app.deleteCategory('${cat.id}')" class="p-1"><i class="fa-solid fa-trash-can"></i></button></div>
        </li>`).join('');
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
    const newCategory = { id, label: name, icon, color };
    
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

    try {
        await updateCategoryInFirestore(currentUserId, { id, label: name, icon, color });
        closeCategoryDrawer();
        showNotification('Catégorie mise à jour !');
    } catch (err) {
        showNotification('Erreur de mise à jour', 'error');
    }
};

export const deleteCategory = async (id) => {
    if (id === 'Autre') {
        alert("La catégorie 'Autre' ne peut pas être supprimée.");
        return;
    }
    if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ? Les transactions associées seront déplacées vers la catégorie "Autre".')) {
        try {
            await deleteCategoryFromFirestore(currentUserId, id);
            
            // Re-assign transactions asynchronously (could use a batch in the future)
            const updates = [];
            Object.values(state.records).forEach(monthData => {
                monthData.items.forEach(item => {
                    if (item.Category === id || item.category === id) {
                        updates.push(updateTransactionInFirestore(currentUserId, { ...item, Category: 'Autre' }));
                    }
                });
            });
            await Promise.all(updates);
            
            showNotification('Catégorie supprimée.');
        } catch (err) {
            showNotification('Erreur de suppression', 'error');
        }
    }
};
