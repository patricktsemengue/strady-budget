import { renderStrategicDashboard } from '../dashboard-new.js';
import { renderTimeline } from '../dashboard.js';

export default {
    id: 'dashboard',
    label: 'Pilotage (CFO)',
    icon: 'fa-gauge-high',
    order: 1,
    showMonthSelection: true,
    getTemplate: () => `
        <div id="view-dashboard" class="space-y-6 max-w-6xl mx-auto px-4 pb-20">
            <div class="flex justify-between items-center mb-4">
                <h1 class="text-2xl font-bold text-slate-800">Pilotage Stratégique</h1>
                <div class="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                    <i class="fa-solid fa-gem text-indigo-600"></i>
                    <span class="text-xs font-bold text-indigo-800 uppercase tracking-wider">Mode Wealth Manager</span>
                </div>
            </div>
            
            <div id="strategic-dashboard-content">
                <!-- Strategic Dashboard Injected Here -->
                <div class="p-20 text-center text-slate-400 italic">Chargement des indicateurs stratégiques...</div>
            </div>
        </div>
    `,
    render: () => {
        renderTimeline();
        renderStrategicDashboard();
    },
    init: () => {
        // Shared listeners already in main.js or other modules
    }
};
