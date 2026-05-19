import { state, updateState } from './state.js';
import { markAccountsBalanceDirty } from './firestore-service.js';
import { currentUserId } from './storage.js';
import { t } from './i18n.js';

class AppRouter {
    constructor() {
        this.modules = {};
        this.currentModule = null;
        this.currentAppId = null; // New: track the active mini-app
        this.navContainer = null;
        this.mobileNavContainer = null;
    }

    setNavContainers(desktopId, mobileId) {
        this.navContainer = document.getElementById(desktopId);
        this.mobileNavContainer = document.getElementById(mobileId);
    }

    register(module) {
        this.modules[module.id] = module;
        if (module.init) {
            module.init();
        }
    }

    switchApp(appId) {
        this.currentAppId = appId;
        this.updateNav();
        
        // Find default module for this app
        const defaultModule = Object.values(this.modules)
            .filter(m => m.appId === appId)
            .sort((a, b) => (a.order || 0) - (b.order || 0))[0];
            
        if (defaultModule) {
            this.setView(defaultModule.id);
        } else if (appId === 'hub') {
            this.setView('hub');
        }
    }

    updateNav() {
        if (!this.navContainer) return;

        // Only show modules belonging to the current app
        const currentAppModules = Object.values(this.modules)
            .filter(m => !m.hidden && (m.appId === this.currentAppId || m.id === 'settings'))
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const buildDesktopNav = () => {
            if (this.currentAppId === 'hub') return ''; // No nav on hub

            let html = '';
            currentAppModules.filter(m => m.id !== 'settings').forEach(m => {
                const id = `nav-${m.id}`;
                const accent = m.accentColor || 'indigo';
                html += `
                    <button id="${id}" class="nav-tab group flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest transition-all relative">
                        <i class="fa-solid ${m.icon} text-slate-400 group-hover:text-${accent}-500 transition-colors"></i>
                        <span class="text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">${m.label}</span>
                        <div class="nav-tab-indicator absolute bottom-0 left-0 right-0 h-1 bg-${accent}-500 scale-x-0 transition-transform origin-center"></div>
                    </button>
                `;
            });
            return html;
        };

        const buildMobileNav = () => {
            if (this.currentAppId === 'hub') return '';

            let html = '';
            const modulesByGroup = {};
            currentAppModules.forEach(m => {
                const group = m.group || 'AUTRES';
                if (!modulesByGroup[group]) modulesByGroup[group] = [];
                modulesByGroup[group].push(m);
            });

            Object.entries(modulesByGroup).forEach(([groupName, items]) => {
                // Section Header for Mobile
                html += `<div class="px-4 pt-4 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">${groupName}</div>`;
                
                items.forEach(m => {
                    const id = `nav-${m.id}-mobile`;
                    html += `<button id="${id}" class="w-full text-left py-3.5 px-4 text-sm hover:bg-indigo-50 flex items-center text-slate-700 font-bold transition-colors">
                        <i class="fa-solid ${m.icon} mr-4 text-indigo-400 w-5 text-center"></i>${m.label}
                    </button>`;
                });
            });
            return html;
        };

        this.navContainer.innerHTML = buildDesktopNav();
        if (this.mobileNavContainer) {
            this.mobileNavContainer.innerHTML = buildMobileNav();
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

        const targetModule = this.modules[viewId];
        
        // If switching to a view in a different app, update currentAppId
        if (targetModule.appId && targetModule.appId !== this.currentAppId) {
            this.currentAppId = targetModule.appId;
            this.updateNav();
        } else if (viewId === 'hub') {
            this.currentAppId = 'hub';
            this.updateNav();
        }

        // Trigger balance refresh when navigating to the accounts view if any are dirty
        if (viewId === 'accounts' && currentUserId) {
            const hasDirtyAccounts = state.accounts.some(acc => acc.balanceDirty !== false);
            if (hasDirtyAccounts) {
                markAccountsBalanceDirty(currentUserId);
            }
        }

        this.currentModule = targetModule;
        updateState({ currentView: viewId });
        window.location.hash = viewId;
        
        this.render();
    }

    render() {
        if (!this.currentModule) return;

        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        // Update Global Branding/Shell based on current app
        this.updateGlobalShell();

        // Sub-Header Visibility (Desktop Only)
        const subHeader = document.getElementById('sub-header');
        if (subHeader) {
            if (this.currentAppId === 'hub' || this.currentModule.id === 'settings') {
                subHeader.classList.add('hidden');
            } else {
                subHeader.classList.remove('hidden');
            }
        }

        // Update Nav Active State
        Object.values(this.modules).forEach(m => {
            const btns = [
                document.getElementById(`nav-${m.id}`), 
                document.getElementById(`nav-${m.id}-mobile`)
            ];
            
            // Handle explicit settings buttons if they are not in the main lists
            if (m.id === 'settings') {
                const explicitBtn = document.getElementById('nav-settings');
                if (explicitBtn) btns.push(explicitBtn);
                const explicitMobileBtn = document.getElementById('nav-settings-mobile');
                if (explicitMobileBtn) btns.push(explicitMobileBtn);
            }

            const accent = m.accentColor || 'indigo';
            
            btns.forEach(btn => {
                if (!btn) return;
                const isActive = m.id === this.currentModule.id;
                const isMobile = btn.id.endsWith('-mobile');
                const isTab = btn.classList.contains('nav-tab');
                
                // Reset common classes
                const colors = ['indigo', 'emerald', 'rose', 'amber', 'slate', 'violet', 'blue'];
                colors.forEach(c => {
                    btn.classList.remove(
                        `text-${c}-600`, `border-${c}-600`, `bg-${c}-50/50`, 
                        `dark:text-${c}-400`, `dark:border-${c}-400`, `dark:bg-${c}-400/10`,
                        `border-l-4`, `border-b-2`
                    );
                });

                if (isTab) {
                    const indicator = btn.querySelector('.nav-tab-indicator');
                    const text = btn.querySelector('span');
                    const icon = btn.querySelector('i');
                    if (isActive) {
                        if (indicator) indicator.classList.remove('scale-x-0');
                        if (indicator) indicator.classList.add('scale-x-100');
                        if (text) text.className = `font-black text-slate-900 dark:text-white transition-colors`;
                        if (icon) icon.className = `fa-solid ${m.icon} text-${accent}-500 transition-colors`;
                    } else {
                        if (indicator) indicator.classList.add('scale-x-0');
                        if (indicator) indicator.classList.remove('scale-x-100');
                        if (text) text.className = `text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors`;
                        if (icon) icon.className = `fa-solid ${m.icon} text-slate-400 group-hover:text-${accent}-500 transition-colors`;
                    }
                } else if (isActive) {
                    if (isMobile) {
                        btn.classList.add(`text-${accent}-600`, `bg-${accent}-50/50`, `dark:text-${accent}-400`, `dark:bg-${accent}-400/10`);
                    } else {
                        // Desktop Sidebar (Deprecated/Fallback): Left border highlight
                        btn.classList.add(`text-${accent}-600`, `bg-${accent}-50/50`, `border-l-4`, `border-${accent}-600`, `dark:text-${accent}-400`, `dark:bg-${accent}-400/10`);
                    }
                }
            });
        });

        // Show/Hide Mobile FAB
        const mobileFab = document.getElementById('mobile-fab');
        if (mobileFab) {
            if (this.currentModule.getFabConfig) {
                const config = this.currentModule.getFabConfig();
                if (config) {
                    mobileFab.classList.remove('hidden');
                    mobileFab.className = `md:hidden fixed bottom-24 right-4 w-14 h-14 ${config.color || 'bg-slate-800'} text-white rounded-full shadow-2xl flex items-center justify-center z-40 transition-all active:scale-95`;
                    mobileFab.innerHTML = `<i class="fa-solid ${config.icon || 'fa-plus'} text-xl"></i>`;
                    mobileFab.onclick = config.action;
                } else {
                    mobileFab.classList.add('hidden');
                }
            } else if (this.currentModule.showMobileFab && this.currentModule.showMobileFab()) {
                mobileFab.classList.remove('hidden');
                mobileFab.className = `md:hidden fixed bottom-24 right-4 bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center z-40 transition-all active:scale-95`;
                mobileFab.innerHTML = `<i class="fa-solid fa-plus text-xl"></i>`;
                mobileFab.onclick = () => window.app.openTransactionModal();
            } else {
                mobileFab.classList.add('hidden');
            }
        }

        // Help Card Modal Logic
        const helpId = `help_dismissed_${this.currentModule.id}`;
        const isDismissed = localStorage.getItem(helpId) === 'true';
        const helpContent = this.currentModule.getHelpContent ? this.currentModule.getHelpContent() : null;
        const currentAccent = this.currentModule.accentColor || 'indigo';
        
        let helpHtml = '';
        if (helpContent && !isDismissed) {
            helpHtml = `
                <div id="help-modal-overlay" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fadeIn">
                    <div id="screen-help-card" class="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border-l-8 border-${currentAccent}-600 relative overflow-hidden animate-slideUp">
                        <button onclick="window.app.dismissHelp('${this.currentModule.id}')" class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all z-20">
                            <i class="fa-solid fa-xmark text-xl"></i>
                        </button>

                        <div class="p-8">
                            <div class="flex items-center gap-4 mb-6">
                                <div class="w-12 h-12 rounded-2xl bg-${currentAccent}-50 dark:bg-${currentAccent}-900/20 text-${currentAccent}-600 flex items-center justify-center text-xl shrink-0">
                                    <i class="fa-solid fa-circle-question"></i>
                                </div>
                                <div>
                                    <div class="help-badge bg-${currentAccent}-50 text-${currentAccent}-700 !mb-0">${t('help_cards.badge')}</div>
                                    <h2 class="text-2xl font-black text-slate-800 dark:text-white">${helpContent.title}</h2>
                                </div>
                            </div>

                            <p class="text-slate-600 dark:text-slate-400 leading-relaxed mb-8 text-lg">${helpContent.purpose}</p>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 dark:border-slate-800 pt-8">
                                ${helpContent.actions.map(action => `
                                    <div class="flex items-start gap-4">
                                        <div class="mt-1 w-8 h-8 rounded-xl bg-${currentAccent}-50 dark:bg-${currentAccent}-900/20 text-${currentAccent}-600 flex items-center justify-center shrink-0">
                                            <i class="fa-solid ${action.icon} text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="font-bold text-slate-700 dark:text-slate-200">${action.label}</p>
                                            <p class="text-xs text-slate-400 dark:text-slate-500 font-medium leading-relaxed">${action.desc}</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>

                            <div class="mt-10 flex justify-center">
                                <button onclick="window.app.dismissHelp('${this.currentModule.id}')" class="px-10 py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all active:scale-95">
                                    ${t('common.understood') || 'J\'ai compris'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Render Module Template
        appContent.innerHTML = helpHtml + this.currentModule.getTemplate();
        
        // Call Module Render logic
        try {
            this.currentModule.render();
            if (this.onRender) {
                this.onRender(this.currentModule.id);
            }
        } catch (renderErr) {
            console.error(`[Router] Render failed for ${this.currentModule.id}:`, renderErr);
        }
    }

    updateGlobalShell() {
        const header = document.querySelector('header');
        const puck = document.getElementById('mobile-nav-puck');
        const appTitle = document.getElementById('current-app-title');
        const breadcrumbContainer = document.getElementById('current-app-breadcrumb');
        const breadcrumbSeparator = document.getElementById('breadcrumb-separator');

        if (this.currentAppId === 'hub') {
            if (breadcrumbContainer) breadcrumbContainer.classList.add('hidden');
            if (breadcrumbSeparator) breadcrumbSeparator.classList.add('hidden');
            if (header) {
                // Professional Mitigation: Make header transparent instead of hiding to prevent layout jump
                header.classList.add('opacity-0', 'pointer-events-none');
                header.classList.remove('border-indigo-500', 'border-amber-500', 'border-emerald-500');
            }
            if (puck) {
                puck.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
                puck.classList.remove('animate-puck-entry');
            }
        } else {
            if (breadcrumbContainer) breadcrumbContainer.classList.remove('hidden');
            if (breadcrumbSeparator) breadcrumbSeparator.classList.remove('hidden', 'md:flex');
            if (breadcrumbSeparator) breadcrumbSeparator.style.display = 'flex'; // Ensure it shows
            
            if (header) {
                header.classList.remove('opacity-0', 'pointer-events-none');
            }
            if (puck) {
                puck.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
            }

            const appNames = {
                'ledger': t('apps.ledger.name') || 'The Daily Ledger',
                'wealth': t('apps.wealth.name') || 'The Wealth Vault',
                'dashboard': t('apps.dashboard.name') || 'Dashboard',
                'philosophy': t('apps.philosophy.name') || 'Philosophy & Guide'
            };

            const appColors = {
                'ledger': 'indigo-500',
                'wealth': 'amber-500',
                'dashboard': 'emerald-500',
                'philosophy': 'violet-500'
            };

            if (appTitle) appTitle.textContent = appNames[this.currentAppId] || 'Strady';
            
            if (header) {
                header.classList.remove('border-slate-200', 'dark:border-slate-800', 'border-indigo-500', 'border-amber-500', 'border-emerald-500');
                const color = appColors[this.currentAppId] || 'slate-200';
                header.classList.add(`border-${color}`);
            }
        }
    }

    dismissHelp(moduleId) {
        localStorage.setItem(`help_dismissed_${moduleId}`, 'true');
        this.render();
    }

    showHelp(moduleId) {
        localStorage.removeItem(`help_dismissed_${moduleId}`);
        this.render();
    }
}

export const router = new AppRouter();
