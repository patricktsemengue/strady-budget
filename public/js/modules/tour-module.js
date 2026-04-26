import { state, updateState } from '../state.js';
import { router } from '../app-router.js';

class TourModule {
    constructor() {
        this.id = 'tour';
        this.hidden = true;
        this.steps = [
            {
                view: 'accounts',
                target: '#nav-accounts',
                title: 'Vos Comptes',
                message: 'Bienvenue ! Nous avons configuré vos comptes principaux. Le **Compte Joint** pour le quotidien et une **Épargne de Sécurité** pour vos projets.',
                position: 'bottom'
            },
            {
                view: 'categories',
                target: '#nav-categories',
                title: 'Catégories & Classification',
                message: 'Les catégories permettent de classer vos flux par nature : **Revenu**, **Fixe** (factures), **Quotidien** ou **Loisir**. C\'est la base de votre analyse.',
                position: 'bottom'
            },
            {
                view: 'transactions',
                target: '#nav-transactions',
                title: 'Moteur de Prévision',
                message: 'C\'est ici que la magie opère ! Vos revenus et factures sont des **modèles**. Strady les utilise pour projeter votre solde sur 36 mois.',
                position: 'bottom'
            },
            {
                view: 'wealth',
                target: '#nav-wealth',
                title: 'Patrimoine Global',
                message: 'Au-delà du budget, suivez vos actifs (maison, crypto) et passifs (emprunts). Votre **Richesse Nette** est calculée automatiquement.',
                position: 'bottom'
            },
            {
                view: 'dashboard',
                target: '#nav-dashboard',
                title: 'Le Tableau de Bord',
                message: 'Terminons ici ! Le "Safe-to-Spend" vous indique exactement ce que vous pouvez dépenser sans compromettre vos objectifs.',
                position: 'bottom'
            }
        ];
    }

    init() {
        // No-op for router registration
    }

    start() {
        updateState({ 
            onboarding: { 
                ...state.onboarding, 
                active: true, 
                currentStep: 0 
            } 
        });
        this.renderStep();
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
        if (assistant) assistant.remove();
        
        document.querySelectorAll('.tour-highlight').forEach(el => {
            el.classList.remove('tour-highlight');
        });
    }

    renderStep() {
        const stepIndex = state.onboarding?.currentStep ?? 0;
        const step = this.steps[stepIndex];

        // Ensure we are on the right view
        if (state.currentView !== step.view) {
            router.setView(step.view);
            // Re-render after view change to ensure DOM elements exist
            setTimeout(() => this.renderStep(), 100);
            return;
        }

        this.cleanup();
        this.createAssistant(step);
        this.highlightTarget(step.target);
    }

    highlightTarget(selector) {
        // Desktop nav
        const el = document.querySelector(selector);
        if (el) el.classList.add('tour-highlight');
        
        // Also highlight mobile nav if visible
        const mobileEl = document.querySelector(`${selector}-mobile`);
        if (mobileEl) mobileEl.classList.add('tour-highlight');
    }

    createAssistant(step) {
        let assistant = document.getElementById('tour-assistant');
        if (!assistant) {
            assistant = document.createElement('div');
            assistant.id = 'tour-assistant';
            assistant.className = 'fixed bottom-6 right-6 z-[110] w-80 bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden transform transition-all duration-500 translate-y-20 opacity-0';
            document.body.appendChild(assistant);
            
            // Trigger animation
            setTimeout(() => {
                assistant.classList.remove('translate-y-20', 'opacity-0');
            }, 50);
        }

        const progress = ((state.onboarding.currentStep + 1) / this.steps.length) * 100;

        assistant.innerHTML = `
            <div class="h-1 bg-slate-100 w-full">
                <div class="h-full bg-indigo-600 transition-all duration-500" style="width: ${progress}%"></div>
            </div>
            <div class="p-5">
                <div class="flex items-center mb-3">
                    <div class="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center mr-3 tour-assistant-bounce">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div>
                        <h4 class="text-sm font-black uppercase tracking-tight text-slate-800">${step.title}</h4>
                        <p class="text-[10px] text-slate-400 font-bold">GUIDE STRADY • ÉTAPE ${state.onboarding.currentStep + 1}/${this.steps.length}</p>
                    </div>
                    <button id="tour-close" class="ml-auto text-slate-300 hover:text-slate-500 transition-colors">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                
                <p class="text-sm text-slate-600 leading-relaxed mb-5">
                    ${step.message}
                </p>
                
                <div class="flex items-center justify-between">
                    <button id="tour-skip" class="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                        Passer le tour
                    </button>
                    <button id="tour-next" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg transition-all shadow-md shadow-indigo-200 flex items-center">
                        ${state.onboarding.currentStep === this.steps.length - 1 ? 'Terminer' : 'Suivant'}
                        <i class="fa-solid fa-arrow-right ml-2"></i>
                    </button>
                </div>
            </div>
        `;

        document.getElementById('tour-next').onclick = () => this.next();
        document.getElementById('tour-skip').onclick = () => this.finish();
        document.getElementById('tour-close').onclick = () => this.finish();
    }
}

export const tourModule = new TourModule();
