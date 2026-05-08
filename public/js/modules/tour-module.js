import { state, updateState, rebuildRecords } from '../state.js';
import { router } from '../app-router.js';
import { t } from '../i18n.js';
import { provisionStarterData } from '../firestore-service.js';
import { currentUserId } from '../storage.js';
import { tutorials } from '../tour-definitions.js';
import { showNotification, updateSandboxUI } from '../ui.js';

class TourModule {
    constructor() {
        this.id = 'tour';
        this.hidden = true;
        this.observer = null;
        this._realStateBackup = null;
        this._currentTrigger = null;
    }

    get steps() {
        return tutorials[state.onboarding?.type || 'budget'] || [];
    }

    init() {
        router.onRender = (viewId) => {
            if (state.onboarding?.active) {
                const step = this.steps[state.onboarding.currentStep];
                if (step && step.view === viewId) {
                    this.renderStep();
                }
            }
        };

        if (!document.getElementById('tour-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'tour-overlay';
            overlay.className = 'fixed inset-0 z-[115] bg-transparent pointer-events-none transition-all duration-300';
            document.body.appendChild(overlay);
        }

        window.addEventListener('resize', () => {
            if (state.onboarding?.active) {
                this.repositionAssistant();
            }
        });
    }

    async start(type = 'story', useSandbox = false) {
        // If sandbox, backup real data and load Alice & Bob locally
        if (useSandbox) {
            this._realStateBackup = { ...state };
            try {
                const response = await fetch('/data/starter-data.json');
                if (!response.ok) throw new Error('Failed to load starter data');
                const data = await response.json();
                
                // Map starter data to local state structure (Simplified for Sandbox)
                const now = new Date();
                const currentMonthStr = now.toISOString().split('T')[0].substring(0, 7);
                
                const mappedAccounts = data.accounts.map(acc => ({
                    ...acc,
                    createDate: `${currentMonthStr}-01`,
                    balanceDirty: false
                }));

                const mappedBalances = {};
                data.accounts.forEach(acc => {
                    mappedBalances[acc.id] = acc.initialBalance;
                });

                // Map past transactions to current month
                const mappedTransactions = (data.pastTransactions || []).map(tx => {
                    const date = new Date();
                    date.setDate(date.getDate() - (tx.daysAgo || 0));
                    return {
                        ...tx,
                        id: `sandbox_past_${Math.random().toString(36).substr(2, 9)}`,
                        date: date.toISOString().split('T')[0],
                        amount: parseFloat(tx.amount)
                    };
                });

                // Expand templates for current month to provide a "live" dashboard
                const expandedTemplates = (data.templates || []).map(tpl => {
                    const date = new Date();
                    date.setDate(tpl.day || 1);
                    return {
                        id: `sandbox_tpl_${tpl.id}_${currentMonthStr}`,
                        label: tpl.label,
                        amount: parseFloat(tpl.amount),
                        date: date.toISOString().split('T')[0],
                        Category: tpl.category,
                        source: tpl.source,
                        destination: tpl.destination,
                        entityId: tpl.entityId,
                        Model: tpl.id // Mark as recurring for Safe-to-Spend logic
                    };
                });

                const allSandboxTx = [...mappedTransactions, ...expandedTemplates];

                updateState({
                    isSandbox: true,
                    accounts: mappedAccounts,
                    entities: data.entities || [],
                    categories: data.categories || [],
                    recurringTemplates: data.templates || [],
                    assets: data.assets || [],
                    liabilities: data.liabilities || [],
                    accountBalances: mappedBalances,
                    transactions: allSandboxTx,
                    allTransactions: allSandboxTx
                });

                rebuildRecords(allSandboxTx, {});
                updateSandboxUI(true);
                router.render();
            } catch (err) {
                console.error("[Tour] Sandbox initialization failed:", err);
                return;
            }
        } else if (state.accounts.length === 0 && currentUserId) {
            // Regular provisioning for new users
            try {
                await provisionStarterData(currentUserId);
            } catch (err) {
                console.error("[Tour] Failed to provision scenario data:", err);
            }
        }

        updateState({
            onboarding: {
                ...state.onboarding,
                active: true,
                currentStep: 0,
                type: type
            }
        });

        this.renderStep();
    }

    renderStep() {
        const onboarding = state.onboarding || {};
        const stepIndex = onboarding.currentStep ?? 0;
        const steps = this.steps;
        const step = steps[stepIndex];

        if (!step) {
            this.finish();
            return;
        }

        // Ensure we are on the right view
        if (state.currentView !== step.view) {
            router.setView(step.view);
            return;
        }

        this.cleanup(true);
        this.enableOverlay(step.nonBlocking); 

        const isMobile = window.innerWidth <= 768;
        const selector = isMobile ? step.mobileTarget : step.desktopTarget;

        this.waitForAnyElement([selector]).then(el => {
            if (el) {
                this.highlightTarget(el);

                // Simulation or Auto-advance logic
                const triggerSelector = step.simulation ? selector : step.autoAdvanceOn;
                
                if (triggerSelector) {
                    const triggerEl = document.querySelector(triggerSelector);
                    if (triggerEl) {
                        const triggerHandler = (e) => {
                            // If it's a simulation, we intercept the click and add data
                            if (step.simulation && state.isSandbox) {
                                e.preventDefault();
                                e.stopPropagation();

                                const tx = {
                                    ...step.simulation,
                                    id: `sim_${Date.now()}`,
                                    date: new Date().toISOString().split('T')[0]
                                };

                                const newAllTx = [tx, ...(state.allTransactions || [])];
                                updateState({
                                    transactions: [tx, ...(state.transactions || [])],
                                    allTransactions: newAllTx
                                });

                                rebuildRecords(newAllTx, {});
                                showNotification(t('notifications.transaction_added') || "Flux ajouté au scénario !");
                                router.render();
                            }

                            triggerEl.removeEventListener('click', triggerHandler);
                            this.next();
                        };
                        triggerEl.addEventListener('click', triggerHandler, { once: true });
                        this._currentTrigger = { el: triggerEl, handler: triggerHandler };
                    }
                }
            }
            this.createAssistant(step, el);
        });
    }

    enableOverlay(isNonBlocking = false) {
        const overlay = document.getElementById('tour-overlay');
        if (overlay) {
            const isDark = document.documentElement.classList.contains('dark');
            overlay.classList.remove('pointer-events-none', 'bg-transparent', 'pointer-events-auto');
            
            if (isNonBlocking) {
                overlay.classList.add('pointer-events-none');
                overlay.style.backgroundColor = 'transparent';
            } else {
                overlay.classList.add('pointer-events-auto');
                overlay.style.backgroundColor = isDark ? 'rgba(2, 6, 23, 0.8)' : 'rgba(15, 23, 42, 0.7)';
            }
        }
    }

    disableOverlay() {
        const overlay = document.getElementById('tour-overlay');
        if (overlay) {
            overlay.classList.add('pointer-events-none', 'bg-transparent');
            overlay.classList.remove('pointer-events-auto');
            overlay.style.backgroundColor = 'transparent';
        }
    }

    next() {
        const nextStep = (state.onboarding?.currentStep ?? 0) + 1;
        if (nextStep < this.steps.length) {
            updateState({
                onboarding: {
                    ...state.onboarding,
                    currentStep: nextStep
                }
            });
            this.renderStep();
        } else {
            this.finish();
        }
    }

    stop() {
        this.finish();
    }

    finish() {
        updateState({
            onboarding: {
                ...state.onboarding,
                active: false,
                completed: true
            }
        });
        
        // Restore real data if we were in sandbox
        if (state.isSandbox && this._realStateBackup) {
            updateState({
                ...this._realStateBackup,
                isSandbox: false
            });
            this._realStateBackup = null;
            updateSandboxUI(false);
            rebuildRecords(state.allTransactions, state.months);
            router.render();
        }

        this.cleanup();
    }

    cleanup(immediate = false) {
        // Remove active triggers
        if (this._currentTrigger) {
            const { el, handler } = this._currentTrigger;
            el.removeEventListener('click', handler);
            this._currentTrigger = null;
        }

        const assistant = document.getElementById('tour-assistant');
        if (assistant) {
            if (immediate) {
                assistant.classList.add('opacity-0');
            } else {
                assistant.classList.add('opacity-0');
                assistant.style.transform = 'scale(0.95) translateY(10px)';
                setTimeout(() => {
                    const currentAssistant = document.getElementById('tour-assistant');
                    if (currentAssistant === assistant && !state.onboarding?.active) {
                        assistant.remove();
                    }
                }, 400);
            }
        }

        if (!immediate) {
            this.disableOverlay();
        }

        document.querySelectorAll('.tour-highlight').forEach(el => {
            el.classList.remove('tour-highlight', 'tour-highlight-pulse');
        });
    }

    waitForAnyElement(selectors, timeout = 3000) {
        return new Promise((resolve) => {
            const check = () => {
                for (const selector of selectors) {
                    if (!selector) continue;
                    const el = document.querySelector(selector);
                    if (el) return el;
                }
                return null;
            };

            const existing = check();
            if (existing) return resolve(existing);

            if (this.observer) this.observer.disconnect();

            const observer = new MutationObserver(() => {
                const el = check();
                if (el) {
                    observer.disconnect();
                    this.observer = null;
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
            this.observer = observer;

            setTimeout(() => {
                if (this.observer === observer) {
                    observer.disconnect();
                    this.observer = null;
                    resolve(check());
                }
            }, timeout);
        });
    }

    highlightTarget(target) {
        if (!target) return;
        target.classList.add('tour-highlight');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    createAssistant(step, targetEl) {
        let assistant = document.getElementById('tour-assistant');
        if (!assistant) {
            assistant = document.createElement('div');
            assistant.id = 'tour-assistant';
            assistant.className = 'opacity-0 scale-95';
            document.body.appendChild(assistant);
        }

        const currentStep = (state.onboarding?.currentStep ?? 0) + 1;
        const totalSteps = this.steps.length;
        const progress = (currentStep / totalSteps) * 100;
        const label = t('tour.assistant_label', { current: currentStep, total: totalSteps }) || `Mission ${currentStep}/${totalSteps}`;   
        const nextBtnLabel = currentStep === totalSteps ? (t('tour.btn_finish') || 'FINISH') : (t('tour.btn_next') || 'NEXT');

        const isMobile = window.innerWidth <= 768;

        assistant.innerHTML = `
            <div class="h-1 bg-slate-100 dark:bg-slate-800 w-full rounded-t-lg overflow-hidden">
                <div class="h-full bg-indigo-600 transition-all duration-500" style="width: ${isNaN(progress) ? 0 : progress}%"></div>
            </div>
            <div class="p-5">
                <div class="flex items-center mb-3">
                    <div class="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center mr-3 tour-assistant-bounce">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div>
                        <h4 class="text-xs font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">${step.title || t('tour.ui.mission') || 'MISSION'}</h4>
                        <p class="text-[10px] text-slate-400 font-bold">${label}</p>
                    </div>
                    <button id="tour-close-icon" class="ml-auto text-slate-300 hover:text-slate-500 transition-colors">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
                    ${step.message || ''}
                </p>

                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <button id="tour-stop" class="${isMobile ? 'px-3 py-2' : ''} text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors">
                            ${t('tour.btn_stop') || 'STOP'}
                        </button>
                        <button id="tour-skip" class="${isMobile ? 'px-3 py-2' : ''} text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors">
                            ${t('tour.btn_skip') || 'SKIP'}
                        </button>
                    </div>
                    <button id="tour-next" class="${isMobile ? 'px-6 py-3' : 'px-5 py-2'} bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-md shadow-indigo-200 flex items-center">
                        ${nextBtnLabel}
                        <i class="fa-solid ${currentStep === totalSteps ? 'fa-check' : 'fa-arrow-right'} ml-2"></i>
                    </button>
                </div>
            </div>
        `;

        document.getElementById('tour-next').onclick = () => this.next();
        document.getElementById('tour-close-icon').onclick = () => this.stop();
        document.getElementById('tour-stop').onclick = () => this.stop();
        document.getElementById('tour-skip').onclick = () => this.stop();

        this.repositionAssistant(targetEl, step.placement);
    }

    repositionAssistant(targetEl, preferredPlacement = 'right') {
        const assistant = document.getElementById('tour-assistant');
        if (!assistant) return;

        // Reset styles
        assistant.style.right = '';
        assistant.style.bottom = '';
        assistant.style.width = '20rem';
        
        // Mobile Refinement: Clear the header
        if (window.innerWidth <= 768) {
            assistant.classList.remove('opacity-0', 'scale-95');
            assistant.style.top = '80px'; 
            assistant.style.left = '10px';
            assistant.style.right = '10px';
            assistant.style.width = 'calc(100% - 20px)';
            assistant.style.transform = 'none';
            return;
        }

        const currentStep = state.onboarding?.currentStep ?? 0;
        const step = this.steps[currentStep];
        const target = targetEl || document.querySelector(step?.desktopTarget);

        if (!target) {
            assistant.style.top = '50%';
            assistant.style.left = '50%';
            assistant.style.transform = 'translate(-50%, -50%) scale(1)';
            assistant.classList.remove('opacity-0', 'scale-95');
            return;
        }

        assistant.classList.remove('opacity-0', 'scale-95');
        assistant.style.transform = 'scale(1)';
        
        requestAnimationFrame(() => {
            const rect = target.getBoundingClientRect();
            const popoverRect = assistant.getBoundingClientRect();
            const offset = 20;

            let top = 0;
            let left = 0;
            let placement = preferredPlacement;

            if (placement === 'right') {
                top = rect.top + (rect.height / 2) - (popoverRect.height / 2);
                left = rect.right + offset;
            } else if (placement === 'left') {
                top = rect.top + (rect.height / 2) - (popoverRect.height / 2);
                left = rect.left - popoverRect.width - offset;
            } else if (placement === 'top') {
                top = rect.top - popoverRect.height - offset;
                left = rect.left + (rect.width / 2) - (popoverRect.width / 2);
            } else if (placement === 'bottom') {
                top = rect.bottom + offset;
                left = rect.left + (rect.width / 2) - (popoverRect.width / 2);
            }

            if (left < 10) left = 10;
            if (left + popoverRect.width > window.innerWidth - 10) left = window.innerWidth - popoverRect.width - 10;
            if (top < 10) top = 10;
            if (top + popoverRect.height > window.innerHeight - 10) top = window.innerHeight - popoverRect.height - 10;

            assistant.style.top = `${top}px`;
            assistant.style.left = `${left}px`;
            assistant.setAttribute('data-placement', placement);
        });
    }
}

export const tourModule = new TourModule();
