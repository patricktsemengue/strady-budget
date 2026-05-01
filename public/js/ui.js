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
        this.container = document.getElementById(containerId);
        this.options = {
            threshold: 40,
            snapWidth: 80,
            itemSelector: '.swipe-item',
            contentSelector: '.swipe-content',
            onSwipeLeft: null,  // Usually Delete
            onSwipeRight: null, // Usually Edit
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

        if (this.container) {
            this.init();
        }
    }

    init() {
        this.container.addEventListener('touchstart', (e) => this.handleStart(e), { passive: true });
        this.container.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        this.container.addEventListener('touchend', (e) => this.handleEnd(e));
        
        // Close swiped items when clicking elsewhere
        document.addEventListener('touchstart', (e) => {
            if (this.activeContent && !this.activeContent.contains(e.target)) {
                this.resetItem(this.activeContent);
            }
        }, { passive: true });
    }

    handleStart(e) {
        // If touching a button that is NOT inside the content layer, it's an action button
        // We should let the browser handle it and skip swipe logic.
        if (e.target.closest('button') && !e.target.closest(this.options.contentSelector)) {
            return;
        }

        const item = e.target.closest(this.options.itemSelector);
        if (!item) return;

        const content = item.querySelector(this.options.contentSelector);
        if (!content) return;

        // Reset previous swiped items if it's a different one
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
        this.currentX = this.getTranslateX(this.activeContent);
        
        this.activeContent.style.transition = 'none';
    }

    handleMove(e) {
        if (!this.activeContent) return;

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - this.startX;
        const deltaY = touchY - this.startY;

        if (!this.isSwiping) {
            // Determine if it's a horizontal swipe or vertical scroll
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                this.isSwiping = true;
            } else if (Math.abs(deltaY) > 10) {
                this.activeContent = null;
                return;
            }
        }

        if (this.isSwiping) {
            e.preventDefault();
            this.isMoving = true;
            // Add some resistance to swiping
            let newX = this.currentX + deltaX;
            
            // Limit the swipe range
            if (newX > this.options.snapWidth) newX = this.options.snapWidth + (newX - this.options.snapWidth) * 0.3;
            if (newX < -this.options.snapWidth) newX = -this.options.snapWidth + (newX + this.options.snapWidth) * 0.3;

            this.activeContent.style.transform = `translateX(${newX}px)`;
        }
    }

    handleEnd(e) {
        if (!this.activeContent) return;

        const duration = Date.now() - this.startTime;
        const deltaX = e.changedTouches[0].clientX - this.startX;

        // Handle Tap
        if (!this.isMoving && duration < 250 && Math.abs(deltaX) < 10) {
            if (this.options.onTap) {
                this.options.onTap(this.activeItem.dataset.id);
            }
            this.resetItem(this.activeContent);
            return;
        }

        if (!this.isSwiping) return;

        this.activeContent.style.transition = 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
        
        const finalX = this.getTranslateX(this.activeContent);

        if (finalX < -this.options.threshold) {
            // Snap Left (Reveals Right Action)
            this.activeContent.style.transform = `translateX(-${this.options.snapWidth}px)`;
        } else if (finalX > this.options.threshold) {
            // Snap Right (Reveals Left Action)
            this.activeContent.style.transform = `translateX(${this.options.snapWidth}px)`;
            // If onSwipeRight is provided, trigger it and reset
            if (this.options.onSwipeRight) {
                setTimeout(() => {
                    this.options.onSwipeRight(this.activeItem.dataset.id);
                    this.resetItem(this.activeContent);
                }, 200);
            }
        } else {
            this.resetItem(this.activeContent);
        }

        this.isSwiping = false;
        this.isMoving = false;
    }

    getTranslateX(el) {
        const style = window.getComputedStyle(el);
        const matrix = new WebKitCSSMatrix(style.transform);
        return matrix.m41;
    }

    resetItem(el) {
        if (!el) return;
        el.style.transition = 'transform 0.3s ease';
        el.style.transform = 'translateX(0)';
        if (el === this.activeContent) {
            this.activeContent = null;
            this.activeItem = null;
        }
    }
}

