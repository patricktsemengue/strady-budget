import { state, updateState } from './state.js';

class AppRouter {
    constructor() {
        this.modules = {};
        this.currentModule = null;
        this.navContainer = null;
        this.mobileNavContainer = null;
    }

    setNavContainers(desktopId, mobileId) {
        this.navContainer = document.getElementById(desktopId);
        this.mobileNavContainer = document.getElementById(mobileId);
    }

    register(module) {
        this.modules[module.id] = module;
        this.updateNav();
        if (module.init) {
            module.init();
        }
    }

    updateNav() {
        if (!this.navContainer) return;

        const buildNavHtml = (isMobile) => {
            return Object.values(this.modules)
                .filter(m => !m.hidden)
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(m => {
                    const id = isMobile ? `nav-${m.id}-mobile` : `nav-${m.id}`;
                    if (isMobile) {
                        return `<button id="${id}" class="w-full text-left py-3 px-4 text-sm hover:bg-slate-50 flex items-center text-slate-700">
                            <i class="fa-solid ${m.icon} mr-3 text-slate-400"></i>${m.label}
                        </button>`;
                    } else {
                        return `<button id="${id}" class="px-4 h-full border-b-2 border-transparent flex items-center text-sm font-medium transition-colors hover:text-blue-600">
                            <i class="fa-solid ${m.icon} mr-2"></i>${m.label}
                        </button>`;
                    }
                }).join('');
        };

        this.navContainer.innerHTML = buildNavHtml(false);
        if (this.mobileNavContainer) {
            this.mobileNavContainer.innerHTML = buildNavHtml(true);
        }

        // Re-attach listeners
        Object.values(this.modules).forEach(m => {
            const btn = document.getElementById(`nav-${m.id}`);
            if (btn) btn.onclick = () => this.setView(m.id);
            
            const mobileBtn = document.getElementById(`nav-${m.id}-mobile`);
            if (mobileBtn) mobileBtn.onclick = () => {
                this.setView(m.id);
                const mobileMenu = document.querySelector('.mobile-menu');
                if (mobileMenu) mobileMenu.classList.add('hidden');
            };
        });
    }

    setView(viewId) {
        if (!this.modules[viewId]) {
            console.error(`Module not found: ${viewId}`);
            return;
        }

        this.currentModule = this.modules[viewId];
        updateState({ currentView: viewId });
        window.location.hash = viewId;
        
        this.render();
    }

    render() {
        if (!this.currentModule) return;

        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        // Show/Hide Shared Month Selection
        const sharedMonthSelection = document.getElementById('shared-month-selection');
        if (sharedMonthSelection) {
            if (this.currentModule.showMonthSelection) {
                sharedMonthSelection.classList.remove('hidden');
            } else {
                sharedMonthSelection.classList.add('hidden');
            }
        }

        // Update Nav Active State
        Object.values(this.modules).forEach(m => {
            const btns = [document.getElementById(`nav-${m.id}`), document.getElementById(`nav-${m.id}-mobile`)];
            btns.forEach(btn => {
                if (!btn) return;
                if (m.id === this.currentModule.id) {
                    btn.classList.add('text-blue-600', 'border-blue-600');
                } else {
                    btn.classList.remove('text-blue-600', 'border-blue-600');
                }
            });
        });

        // Show/Hide Mobile FAB
        const mobileFab = document.getElementById('mobile-fab');
        if (mobileFab) {
            if (this.currentModule.showMobileFab && this.currentModule.showMobileFab()) {
                mobileFab.classList.remove('hidden');
            } else {
                mobileFab.classList.add('hidden');
            }
        }

        // Render Module Template
        appContent.innerHTML = this.currentModule.getTemplate();
        
        // Call Module Render logic
        this.currentModule.render();
    }
}

export const router = new AppRouter();
