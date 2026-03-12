import { renderCategoriesList } from './categories.js';
import { renderAccountsList } from './accounts.js';

export const renderSettings = () => {
    console.log("Rendering Settings View");
    renderCategoriesList();
    renderAccountsList();
};
