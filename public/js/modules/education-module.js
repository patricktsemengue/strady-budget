import { router } from '../app-router.js';
import { t } from '../i18n.js';

export default {
    id: 'education',
    get label() { return t('nav.education'); },
    get group() { return t('nav.groups.strategy'); },
    icon: 'fa-graduation-cap',
    order: 3,
    showMonthSelection: false,
    getTemplate: () => `
        <div id="view-education" class="max-w-4xl mx-auto px-4 pb-20">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 class="text-3xl font-black text-slate-800">Philosophie Financière</h1>
                    <p class="text-slate-500 font-medium italic">Devenir le CFO de sa propre vie.</p>
                </div>
                <div class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
                    ${t('education.badge')}
                </div>
            </div>

            <!-- Manual Restart Tour -->
            <div class="mb-10 bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex items-center justify-between">
                <div>
                    <h4 class="text-indigo-900 font-bold text-sm">${t('education.tour.title')}</h4>
                    <p class="text-indigo-700 text-xs mt-1">${t('education.tour.subtitle')}</p>
                </div>
                <button onclick="window.app.startTour()" class="bg-white text-indigo-600 px-6 py-2.5 rounded-xl text-xs font-black shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center gap-2">
                    <i class="fa-solid fa-play"></i>
                    ${t('education.tour.button')}
                </button>
            </div>

            <!-- Concepts Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <!-- Concept 1: Pay Yourself First -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6 text-xl">
                        <i class="fa-solid fa-piggy-bank"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 mb-3">Pay Yourself First</h3>
                    <p class="text-sm text-slate-600 leading-relaxed mb-4">
                        Ne considérez pas l'épargne comme "ce qu'il reste à la fin du mois". L'épargne est votre **première facture**. 
                    </p>
                    <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <p class="text-xs font-bold text-emerald-800 uppercase mb-2">Application Strady :</p>
                        <p class="text-xs text-emerald-700 leading-relaxed italic">
                            Créez un **Modèle Récurrent** de virement vers votre compte épargne programmé le **2 du mois**.
                        </p>
                    </div>
                </div>

                <!-- Concept 2: 70/20/10 Rule -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6 text-xl">
                        <i class="fa-solid fa-chart-pie"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 mb-3">La Règle 70/20/10</h3>
                    <p class="text-sm text-slate-600 leading-relaxed mb-4">
                        Une structure saine pour répartir vos revenus nets :
                    </p>
                    <ul class="space-y-2 mb-4">
                        <li class="flex items-center text-xs font-bold text-slate-700">
                            <span class="w-8 text-indigo-500">70%</span> Besoins (Fixes + Quotidien)
                        </li>
                        <li class="flex items-center text-xs font-bold text-slate-700">
                            <span class="w-8 text-amber-500">20%</span> Envies (Loisirs & Sorties)
                        </li>
                        <li class="flex items-center text-xs font-bold text-slate-700">
                            <span class="w-8 text-emerald-500">10%</span> Épargne & Investissement
                        </li>
                    </ul>
                    <div class="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <p class="text-xs font-bold text-indigo-800 uppercase mb-2">Application Strady :</p>
                        <p class="text-xs text-indigo-700 leading-relaxed italic">
                            Suivez la jauge de **Santé Budgétaire** sur votre tableau de bord stratégique.
                        </p>
                    </div>
                </div>

                <!-- Concept 3: Emergency Fund -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div class="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-6 text-xl">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 mb-3">Le Filet de Sécurité</h3>
                    <p class="text-sm text-slate-600 leading-relaxed mb-4">
                        Avant d'investir, construisez une réserve de **3 à 6 mois de dépenses**. C'est votre "F*ck You Money" qui protège votre sérénité.
                    </p>
                    <div class="bg-rose-50 p-4 rounded-xl border border-rose-100">
                        <p class="text-xs font-bold text-rose-800 uppercase mb-2">Application Strady :</p>
                        <p class="text-xs text-rose-700 leading-relaxed italic">
                            Strady calcule votre **Runway** en temps réel basé sur votre rythme de vie réel (Burn Rate).
                        </p>
                    </div>
                </div>

                <!-- Concept 4: Cash Drag -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-6 text-xl">
                        <i class="fa-solid fa-bolt-lightning"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 mb-3">Éviter le Cash Drag</h3>
                    <p class="text-sm text-slate-600 leading-relaxed mb-4">
                        L'argent qui dort sur un compte courant perd de la valeur (inflation). Tout euro au-dessus de votre filet de sécurité doit être investi.
                    </p>
                    <div class="bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <p class="text-xs font-bold text-amber-800 uppercase mb-2">Application Strady :</p>
                        <p class="text-xs text-amber-700 leading-relaxed italic">
                            Consultez l'alerte **Opportunité CFO** quand vos comptes opérationnels sont trop pleins.
                        </p>
                    </div>
                </div>

                <!-- Concept 5: Indice de Souveraineté (FFI) -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow md:col-span-2">
                    <div class="flex flex-col md:flex-row gap-8 items-center">
                        <div class="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg shadow-indigo-200">
                            <i class="fa-solid fa-crown"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-slate-800 mb-2">L'Indice de Souveraineté (FFI)</h3>
                            <p class="text-sm text-slate-600 leading-relaxed mb-4">
                                Le **Financial Independence Index** mesure votre liberté. Il représente le pourcentage de vos **Charges Fixes** (Loyer, Factures) couvert par vos **Revenus Passifs** (Dividendes, Loyers perçus). 
                                À 100%, vous êtes souverain : vos actifs paient vos factures vitales, même si vous cessez de travailler.
                            </p>
                            <div class="flex gap-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                <div>
                                    <p class="text-[10px] font-black text-indigo-800 uppercase mb-1">Cible : 100%</p>
                                    <p class="text-xs text-indigo-700 italic">Identifiez vos revenus comme "Passifs" dans l'onglet Catégories pour activer ce KPI.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- User Manual Section -->
            <div class="bg-slate-900 text-white rounded-3xl p-10 shadow-2xl overflow-hidden relative">
                <div class="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl"></div>
                <div class="relative">
                    <h2 class="text-2xl font-black mb-8 border-b border-white/10 pb-4 flex items-center gap-3">
                        <i class="fa-solid fa-book-open text-indigo-400"></i>
                        Guide de l'Utilisateur
                    </h2>
                    
                    <div class="space-y-10">
                        <div>
                            <h4 class="text-indigo-400 font-black uppercase text-xs tracking-widest mb-4">1. Configuration Initiale</h4>
                            <p class="text-slate-300 text-sm leading-relaxed">
                                Commencez par créer vos <b>Comptes</b> réels. Pour chaque compte, spécifiez s'il s'agit d'un compte d'épargne (pour le calcul du Runway).
                            </p>
                        </div>
                        
                        <div>
                            <h4 class="text-indigo-400 font-black uppercase text-xs tracking-widest mb-4">2. Le Moteur de Prévision</h4>
                            <p class="text-slate-300 text-sm leading-relaxed">
                                Dans l'onglet <b>Flux</b>, créez vos <b>Modèles</b>. Salaire, Loyer, Internet... Strady générera automatiquement ces flux pour les 36 prochains mois. Votre futur financier devient visible immédiatement.
                            </p>
                        </div>

                        <div>
                            <h4 class="text-indigo-400 font-black uppercase text-xs tracking-widest mb-4">3. Réconciliation Hebdomadaire</h4>
                            <p class="text-slate-300 text-sm leading-relaxed">
                                Une fois par semaine, comparez votre solde Strady avec votre application bancaire. Utilisez le bouton <b>"Ajuster le solde"</b> dans l'onglet Comptes pour corriger les écarts (cafés, imprévus).
                            </p>
                        </div>

                        <div>
                            <h4 class="text-indigo-400 font-black uppercase text-xs tracking-widest mb-4">4. Clôture de Mois</h4>
                            <p class="text-slate-300 text-sm leading-relaxed">
                                Le dernier jour du mois, cliquez sur <b>"Clôturer le mois"</b>. Strady figera les données et reportera vos soldes exacts comme nouveau point de départ pour le mois suivant.
                            </p>
                        </div>
                    </div>

                    <div class="mt-12 pt-8 border-t border-white/10 text-center">
                        <button onclick="window.location.hash = 'dashboard'" class="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black transition-all shadow-lg shadow-indigo-900/40">
                            Prêt à piloter mon budget !
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    render: () => {
        // Static content, no complex logic needed here
    },
    init: () => {}
};
