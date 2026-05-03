import { state, updateState } from '../state.js';
import { router } from '../app-router.js';
import { t } from '../i18n.js';
import { provisionStarterData } from '../firestore-service.js';
import { currentUserId } from '../storage.js';

class TourModule {
    constructor() {
        this.id = 'tour';
        this.hidden = true;
        this.observer = null;
    }

    getTutorialSteps(type) {
        const tutorials = {
            budget: [
                {
                    view: 'categories',
                    target: '#nav-categories',
                    title: t('tour.steps.budget.0.title'),
                    message: t('tour.steps.budget.0.message')
                },
                {
                    view: 'accounts',
                    target: '#nav-accounts',
                    title: t('tour.steps.budget.1.title'),
                    message: t('tour.steps.budget.1.message')
                },
                {
                    view: 'transactions',
                    target: '#nav-transactions',
                    title: t('tour.steps.budget.2.title'),
                    message: t('tour.steps.budget.2.message')
                },
                {
                    view: 'accounts',
                    target: '#btn-transfer-desktop',
                    title: t('tour.steps.budget.3.title'),
                    message: t('tour.steps.budget.3.message')
                },
                {
                    view: 'dashboard',
                    target: '#nav-dashboard',
                    title: t('tour.steps.budget.4.title'),
                    message: t('tour.steps.budget.4.message')
                }
            ],
            wealth: [
                {
                    view: 'wealth',
                    target: '#nav-wealth',
                    title: t('tour.steps.wealth.0.title'),
                    message: t('tour.steps.wealth.0.message')
                },
                {
                    view: 'wealth',
                    target: '#wealth-liabilities-list',
                    title: t('tour.steps.wealth.1.title'),
                    message: t('tour.steps.wealth.1.message')
                },
                {
                    view: 'dashboard',
                    target: '#nav-dashboard',
                    title: t('tour.steps.wealth.2.title'),
                    message: t('tour.steps.wealth.2.message')
                }
            ],
            entities: [
                {
                    view: 'settings',
                    target: '#nav-settings',
                    title: t('tour.steps.entities.0.title'),
                    message: t('tour.steps.entities.0.message')
                },
                {
                    view: 'dashboard',
                    target: '#desktop-switcher',
                    title: t('tour.steps.entities.1.title'),
                    message: t('tour.steps.entities.1.message')
                },
                {
                    view: 'accounts',
                    target: '#nav-accounts',
                    title: t('tour.steps.entities.2.title'),
                    message: t('tour.steps.entities.2.message')
                },
                {
                    view: 'transactions',
                    target: '#nav-transactions',
                    title: t('tour.steps.entities.3.title'),
                    message: t('tour.steps.entities.3.message')
                },
                {
                    view: 'wealth',
                    target: '#nav-wealth',
                    title: t('tour.steps.entities.4.title'),
                    message: t('tour.steps.entities.4.message')
                }
            ],
        };
        return tutorials[type] || [];
    }

    get steps() {
        return this.getTutorialSteps(state.onboarding?.type || 'budget');
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
    }

    async start(type = 'budget') {
        // Provision Alice & Bob scenario if user is empty
        if (state.accounts.length === 0 && currentUserId) {
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

        this.enableOverlay();
        this.renderStep();
    }

    enableOverlay() {
        const overlay = document.getElementById('tour-overlay');
        if (overlay) {
            overlay.classList.remove('pointer-events-none', 'bg-transparent');
            overlay.classList.add('pointer-events-auto');
        }
    }

    disableOverlay() {
        const overlay = document.getElementById('tour-overlay');
        if (overlay) {
            overlay.classList.add('pointer-events-none', 'bg-transparent');
            overlay.classList.remove('pointer-events-auto');
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
        this.cleanup();
    }

    cleanup() {
        const assistant = document.getElementById('tour-assistant');
        if (assistant) {
            assistant.classList.add('translate-y-20', 'opacity-0');
            setTimeout(() => assistant.remove(), 500);
        }

        document.querySelectorAll('.tour-highlight').forEach(el => {
            el.classList.remove('tour-highlight', 'tour-highlight-pulse');
        });

        this.disableOverlay();

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
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

        this.cleanup();
        this.enableOverlay(); // Re-enable after cleanup

        // Target detection
        const mobileSelector = `${step.target}-mobile`;

        this.waitForAnyElement([step.target, mobileSelector]).then(el => {
            if (!el) {
                console.warn(`[Tour] Target not found: ${step.target}`);
            } else {
                this.highlightTarget(el);
            }
            this.createAssistant(step);
        });
    }

    waitForAnyElement(selectors, timeout = 3000) {
        return new Promise((resolve) => {
            const check = () => {
                for (const selector of selectors) {
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

    createAssistant(step) {
        let assistant = document.getElementById('tour-assistant');
        if (!assistant) {
            assistant = document.createElement('div');
            assistant.id = 'tour-assistant';
            assistant.className = 'fixed bottom-6 right-6 z-[130] w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-indigo-100 dark:border-slate-800 overflow-hidden transform transition-all duration-500 translate-y-20 opacity-0'; 
            document.body.appendChild(assistant);
        }

        setTimeout(() => {
            assistant.classList.remove('translate-y-20', 'opacity-0');
        }, 50);

        const currentStep = (state.onboarding?.currentStep ?? 0) + 1;
        const totalSteps = this.steps.length;
        const progress = (currentStep / totalSteps) * 100;
        const label = t('tour.assistant_label', { current: currentStep, total: totalSteps });   
        const nextBtnLabel = currentStep === totalSteps ? t('tour.btn_finish') : t('tour.btn_next');

        assistant.innerHTML = `
            <div class="h-1 bg-slate-100 dark:bg-slate-800 w-full">
                <div class="h-full bg-indigo-600 transition-all duration-500" style="width: ${isNaN(progress) ? 0 : progress}%"></div>
            </div>
            <div class="p-5">
                <div class="flex items-center mb-3">
                    <div class="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center mr-3 tour-assistant-bounce">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div>
                        <h4 class="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">${step.title || t('tour.ui.mission')}</h4>
                        <p class="text-[10px] text-slate-400 font-bold">${label}</p>
                    </div>
                    <button id="tour-close-icon" class="ml-auto text-slate-300 hover:text-slate-500 transition-colors">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
                    ${step.message || ''}
                </p>

                <div class="flex items-center justify-between">
                    <button id="tour-stop" class="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors">
                        ${t('tour.btn_stop')}
                    </button>
                    <button id="tour-next" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg transition-all shadow-md shadow-indigo-200 flex items-center">
                        ${nextBtnLabel}
                        <i class="fa-solid ${currentStep === totalSteps ? 'fa-check' : 'fa-arrow-right'} ml-2"></i>
                    </button>
                </div>
            </div>
        `;

        document.getElementById('tour-next').onclick = () => this.next();
        document.getElementById('tour-close-icon').onclick = () => this.stop();
        document.getElementById('tour-stop').onclick = () => this.stop();
    }
}

export const tourModule = new TourModule();
