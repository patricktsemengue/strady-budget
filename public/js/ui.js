import { updateState } from './state.js';

export const showNotification = (message, type = 'success') => {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notif = document.createElement('div');
    const isSuccess = type === 'success';
    const isError = type === 'error';

    let bgColor = 'bg-blue-50';
    let borderColor = 'border-blue-400';
    let textColor = 'text-blue-800';
    let icon = 'fa-circle-info';

    if (isSuccess) {
        bgColor = 'bg-green-50';
        borderColor = 'border-green-400';
        textColor = 'text-green-800';
        icon = 'fa-circle-check';
    } else if (isError) {
        bgColor = 'bg-red-50';
        borderColor = 'border-red-400';
        textColor = 'text-red-800';
        icon = 'fa-circle-exclamation';
    }

    notif.className = `flex items-center p-4 rounded-lg shadow-lg border-l-4 ${bgColor} ${borderColor} ${textColor} pointer-events-auto transition-all duration-500 opacity-0 transform translate-x-8`;
    notif.style.minWidth = '300px';
    
    notif.innerHTML = `
        <i class="fa-solid ${icon} mr-3 text-lg"></i>
        <div class="flex-1 font-medium">${message}</div>
        <button class="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(notif);

    // Animate in
    setTimeout(() => {
        notif.classList.remove('opacity-0', 'translate-x-8');
    }, 10);

    const closeNotif = () => {
        notif.classList.add('opacity-0', 'translate-x-8');
        setTimeout(() => notif.remove(), 500);
    };

    notif.querySelector('button').addEventListener('click', closeNotif);

    setTimeout(closeNotif, 5000);
};

export const setDataStatusIndicator = (status) => {
    const indicator = document.getElementById('data-status-indicator');
    if (!indicator) return;

    if (status === 'cached') {
        indicator.textContent = 'Données en cache';
        indicator.className = 'fixed top-[68px] md:top-[100px] left-1/2 -translate-x-1/2 z-40 px-3 py-1 text-xs font-semibold rounded-full shadow-md transition-all duration-300 bg-amber-100 text-amber-800';
        indicator.classList.remove('hidden');
    } else if (status === 'live') {
        indicator.textContent = 'Données à jour';
        indicator.className = 'fixed top-[68px] md:top-[100px] left-1/2 -translate-x-1/2 z-40 px-3 py-1 text-xs font-semibold rounded-full shadow-md transition-all duration-300 bg-green-100 text-green-800';
        indicator.classList.remove('hidden');
        setTimeout(() => {
            indicator.classList.add('opacity-0');
        }, 2000);
        setTimeout(() => {
            indicator.classList.add('hidden');
            indicator.classList.remove('opacity-0');
        }, 2500);
    } else {
        indicator.classList.add('hidden');
    }
};

export const showTourSelectionModal = () => {
    const existing = document.getElementById('tour-selection-modal');
    if (existing) return;

    const modal = document.createElement('div');
    modal.id = 'tour-selection-modal';
    modal.className = 'fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300';
    
    modal.innerHTML = `
        <div class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all duration-300 scale-95 opacity-0">
            <div class="p-8 text-center">
                <div class="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl shadow-lg shadow-indigo-200">
                    <i class="fa-solid fa-robot"></i>
                </div>
                
                <h2 class="text-2xl font-black text-slate-800 mb-2">${t('onboarding.title')}</h2>
                <p class="text-slate-500 mb-10 font-medium italic">${t('onboarding.subtitle')}</p>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                    <!-- Track 1: Budget -->
                    <button onclick="window.app.startTour('budget'); document.getElementById('tour-selection-modal').remove();" class="group p-6 bg-slate-50 hover:bg-emerald-50 border-2 border-transparent hover:border-emerald-500 rounded-2xl transition-all">
                        <div class="w-12 h-12 bg-white text-emerald-600 rounded-xl flex items-center justify-center mb-4 text-xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <i class="fa-solid fa-rocket"></i>
                        </div>
                        <h3 class="font-black text-slate-800 text-sm mb-1">${t('onboarding.track_budget')}</h3>
                        <p class="text-[10px] text-slate-500 font-bold leading-relaxed">${t('mastery.mission1_desc')}</p>
                    </button>
                    
                    <!-- Track 2: Wealth -->
                    <button onclick="window.app.startTour('wealth'); document.getElementById('tour-selection-modal').remove();" class="group p-6 bg-slate-50 hover:bg-indigo-50 border-2 border-transparent hover:border-indigo-500 rounded-2xl transition-all">
                        <div class="w-12 h-12 bg-white text-indigo-600 rounded-xl flex items-center justify-center mb-4 text-xl shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <i class="fa-solid fa-gem"></i>
                        </div>
                        <h3 class="font-black text-slate-800 text-sm mb-1">${t('onboarding.track_wealth')}</h3>
                        <p class="text-[10px] text-slate-500 font-bold leading-relaxed">${t('mastery.mission2_desc')}</p>
                    </button>

                    <!-- Track 3: Entities -->
                    <button onclick="window.app.startTour('entities'); document.getElementById('tour-selection-modal').remove();" class="group p-6 bg-slate-50 hover:bg-violet-50 border-2 border-transparent hover:border-violet-500 rounded-2xl transition-all">
                        <div class="w-12 h-12 bg-white text-violet-600 rounded-xl flex items-center justify-center mb-4 text-xl shadow-sm group-hover:bg-violet-600 group-hover:text-white transition-colors">
                            <i class="fa-solid fa-building-user"></i>
                        </div>
                        <h3 class="font-black text-slate-800 text-sm mb-1">${t('onboarding.track_entities')}</h3>
                        <p class="text-[10px] text-slate-500 font-bold leading-relaxed">${t('mastery.mission3_desc')}</p>
                    </button>
                </div>

                <div class="mt-10">
                    <button onclick="document.getElementById('tour-selection-modal').remove()" class="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
                        ${t('onboarding.btn_skip')}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    setTimeout(() => {
        const content = modal.querySelector('div');
        content.classList.remove('scale-95', 'opacity-0');
    }, 10);
};

export const setLoadingState = (isLoading, title = 'Chargement...', subtitle = 'Veuillez patienter un instant') => {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    
    if (isLoading) {
        const titleEl = document.getElementById('loading-overlay-title');
        const subtitleEl = document.getElementById('loading-overlay-subtitle');
        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = subtitle;
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
};

export const setView = (view, isInitial = false) => {
    window.location.hash = view;
};

export const showOnboardingModal = (onChoice) => {
    const existing = document.getElementById('onboarding-modal');
    if (existing) return;

    const modal = document.createElement('div');
    modal.id = 'onboarding-modal';
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all duration-300 scale-95 opacity-0">
            <div class="p-8 text-center">
                <div class="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    <i class="fa-solid fa-rocket"></i>
                </div>
                
                <h2 class="text-2xl font-bold text-slate-800 mb-2">Bienvenue sur Strady Budget !</h2>
                <p class="text-slate-600 mb-8">Pour vous aider à démarrer, nous vous suggérons d'initialiser votre espace avec notre pack de démarrage.</p>
                
                <div class="space-y-4 text-left">
                    <button id="btn-starter-pack" class="group w-full p-4 border-2 border-blue-100 hover:border-blue-500 rounded-xl transition-all hover:bg-blue-50 relative">
                        <div class="absolute -top-3 right-4 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Recommandé</div>
                        <div class="flex items-center">
                            <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-slate-800">Pack de Démarrage Familial</h3>
                                <p class="text-xs text-slate-500">Comptes (1200€ & 3000€), catégories (Salaire, Loyer, Courses) et factures récurrentes.</p>
                            </div>
                        </div>
                    </button>
                    
                    <button id="btn-scratch-pack" class="group w-full p-4 border-2 border-slate-100 hover:border-slate-300 rounded-xl transition-all hover:bg-slate-50">
                        <div class="flex items-center">
                            <div class="w-12 h-12 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center mr-4 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                                <i class="fa-solid fa-leaf"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-slate-800">Partir de zéro</h3>
                                <p class="text-xs text-slate-500">Commencez avec un budget vide et créez vos propres comptes et catégories.</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
            
            <div class="p-4 bg-slate-50 text-center">
                <p class="text-[11px] text-slate-400 italic">Vous pourrez modifier ou supprimer toutes les données par la suite.</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const content = modal.querySelector('div');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
    }, 10);

    const close = (choice) => {
        content.classList.add('scale-95', 'opacity-0');
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.remove();
            onChoice(choice);
        }, 300);
    };

    document.getElementById('btn-starter-pack').onclick = () => close('starter');
    document.getElementById('btn-scratch-pack').onclick = () => close('scratch');
};

/**
 * Global SwipeManager to handle touch gestures on list items.
 * Reveals action layers behind the content layer.
 */
export class SwipeManager {
    constructor(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Prevent double initialization
        if (container.dataset.swipeInitialized === 'true') return;
        container.dataset.swipeInitialized = 'true';

        this.container = container;
        this.options = {
            threshold: 40,
            snapWidth: 80,
            itemSelector: '.swipe-item',
            contentSelector: '.swipe-content',
            onSwipeLeft: null,
            onSwipeRight: null,
            onTap: null,
            ...options
        };

        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.activeItem = null;
        this.activeContent = null;
        this.isSwiping = false;
        this.isMoving = false;
        this.startTime = 0;

        this.init();
    }

    init() {
        // Use { passive: false } to allow preventDefault during swiping
        this.container.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
        this.container.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        this.container.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
        
        // Close swiped items when clicking elsewhere
        document.addEventListener('touchstart', (e) => {
            if (this.activeContent && !this.activeContent.contains(e.target)) {
                this.resetItem(this.activeContent);
            }
        }, { passive: true });
    }

    handleStart(e) {
        const item = e.target.closest(this.options.itemSelector);
        if (!item) return;

        // If touching an ignore-able element (like a button inside content)
        if (e.target.closest('button')) {
            // If it's a desktop button or action button, let it be.
            // But if it's the content itself, we want to allow swiping.
            if (!e.target.closest(this.options.contentSelector)) return;
        }

        const content = item.querySelector(this.options.contentSelector);
        if (!content) return;

        // Reset previous swiped items
        if (this.activeContent && this.activeContent !== content) {
            this.resetItem(this.activeContent);
        }

        this.activeItem = item;
        this.activeContent = content;
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.startTime = Date.now();
        this.isSwiping = false;
        this.isMoving = false;
        
        const currentTransform = window.getComputedStyle(this.activeContent).transform;
        this.currentX = this.parseTranslateX(currentTransform);
        
        this.activeContent.style.transition = 'none';
    }

    handleMove(e) {
        if (!this.activeContent) return;

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - this.startX;
        const deltaY = touchY - this.startY;

        if (!this.isSwiping) {
            // Threshold for horizontal swipe vs vertical scroll
            const horizontalWeight = Math.abs(deltaX);
            const verticalWeight = Math.abs(deltaY);
            
            if (horizontalWeight > 10 && horizontalWeight > verticalWeight) {
                this.isSwiping = true;
            } else if (verticalWeight > 10) {
                // It's a vertical scroll, abort swipe tracking
                this.activeContent = null;
                return;
            }
        }

        if (this.isSwiping) {
            // Block page scrolling once we are certain it's a horizontal swipe
            if (e.cancelable) e.preventDefault();
            
            this.isMoving = true;
            let newX = this.currentX + deltaX;
            
            // Limit and add resistance
            if (newX > this.options.snapWidth) newX = this.options.snapWidth + (newX - this.options.snapWidth) * 0.2;
            if (newX < -this.options.snapWidth) newX = -this.options.snapWidth + (newX + this.options.snapWidth) * 0.2;

            this.activeContent.style.transform = `translateX(${newX}px)`;
        }
    }

    handleEnd(e) {
        if (!this.activeContent) return;

        const duration = Date.now() - this.startTime;
        const deltaX = e.changedTouches[0].clientX - this.startX;

        // Handle Tap (only if no movement occurred)
        if (!this.isMoving && duration < 300 && Math.abs(deltaX) < 8) {
            if (this.options.onTap) {
                this.options.onTap(this.activeItem.dataset.id);
            }
            this.resetItem(this.activeContent);
            return;
        }

        if (!this.isSwiping) return;

        this.activeContent.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        
        const finalX = this.parseTranslateX(this.activeContent.style.transform);

        if (finalX < -this.options.threshold) {
            // Snap Left (Reveals Right Action)
            this.activeContent.style.transform = `translateX(-${this.options.snapWidth}px)`;
        } else if (finalX > this.options.threshold) {
            // Snap Right (Reveals Left Action)
            this.activeContent.style.transform = `translateX(${this.options.snapWidth}px)`;
            if (this.options.onSwipeRight) {
                this.options.onSwipeRight(this.activeItem.dataset.id);
                setTimeout(() => this.resetItem(this.activeContent), 300);
            }
        } else {
            this.resetItem(this.activeContent);
        }

        this.isSwiping = false;
        this.isMoving = false;
    }

    parseTranslateX(transformStr) {
        if (!transformStr || transformStr === 'none') return 0;
        // Handle both matrix() and direct translateX()
        const matrix = transformStr.match(/matrix\((.+)\)/);
        if (matrix) {
            return parseFloat(matrix[1].split(',')[4]);
        }
        const translate = transformStr.match(/translateX\((.+)px\)/);
        if (translate) {
            return parseFloat(translate[1]);
        }
        return 0;
    }

    resetItem(el) {
        if (!el) return;
        el.style.transition = 'transform 0.3s ease';
        el.style.transform = 'translateX(0)';
        // Cleanup after transition
        setTimeout(() => {
            if (el.style.transform === 'translateX(0px)') {
                el.style.transition = '';
            }
        }, 300);
        
        if (el === this.activeContent) {
            this.activeContent = null;
            this.activeItem = null;
        }
    }
}
