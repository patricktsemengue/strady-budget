/**
 * Strady i18n Service
 * Manages multi-language support using i18next.
 */

export const initI18n = async () => {
    let frData = {};
    let enData = {};

    try {
        frData = await fetch('./locales/fr.json').then(res => res.ok ? res.json() : {});
        enData = await fetch('./locales/en.json').then(res => res.ok ? res.json() : {});
    } catch (err) {
        console.warn('[i18n] Failed to load locale files, falling back to keys:', err);
    }

    const savedLng = localStorage.getItem('strady_language') || navigator.language?.split('-')[0] || 'fr';
    const lng = ['fr', 'en'].includes(savedLng) ? savedLng : 'fr';

    if (typeof i18next === 'undefined') {
        console.error('[i18n] i18next library not found. Ensure script is loaded in index.html');
        // Provide a dummy t function if library is missing to avoid total crash
        window.t = (key) => key;
        return;
    }

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

export const t = (key, options) => {
    if (typeof i18next === 'undefined' || !i18next.t) return key;
    return i18next.t(key, options);
};

export const translatePage = () => {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const attrValue = el.getAttribute('data-i18n');
        
        // Support [attr]key syntax (e.g., [placeholder]common.label)
        if (attrValue.startsWith('[')) {
            const parts = attrValue.split(']');
            const attrName = parts[0].substring(1);
            const key = parts[1];
            el.setAttribute(attrName, t(key));
        } else {
            el.innerHTML = t(attrValue);
        }
    });
};

export const changeLanguage = async (lng) => {
    if (typeof i18next === 'undefined') return;
    await i18next.changeLanguage(lng);
    localStorage.setItem('strady_language', lng);
};

export const getCurrentLanguage = () => {
    if (typeof i18next === 'undefined') return 'fr';
    return i18next.language;
};
