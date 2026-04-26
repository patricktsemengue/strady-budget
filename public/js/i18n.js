/**
 * Strady i18n Service
 * Manages multi-language support using i18next.
 */

const resources = {
    fr: {
        translation: null // Will be loaded via fetch
    },
    en: {
        translation: null
    }
};

export const initI18n = async () => {
    const frData = await fetch('./locales/fr.json').then(res => res.json());
    const enData = await fetch('./locales/en.json').then(res => res.json());

    const savedLng = localStorage.getItem('strady_language') || navigator.language.split('-')[0] || 'fr';
    const lng = ['fr', 'en'].includes(savedLng) ? savedLng : 'fr';

    await i18next.init({
        lng: lng,
        fallbackLng: 'fr',
        debug: false,
        resources: {
            fr: { translation: frData },
            en: { translation: enData }
        }
    });

    console.log(`[i18n] Initialized with language: ${i18next.language}`);
};

export const t = (key, options) => i18next.t(key, options);

export const changeLanguage = async (lng) => {
    await i18next.changeLanguage(lng);
    localStorage.setItem('strady_language', lng);
    // Refresh the UI
    window.location.reload(); 
};

export const getCurrentLanguage = () => i18next.language;
