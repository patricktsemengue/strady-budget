import { t } from './i18n.js';

/**
 * Story-Driven Tutorial (The "Golden Path")
 * Based on the Alice & Bob Starter Pack scenario.
 * Focuses on the "Safe-to-Spend" value proposition.
 */
export const tutorials = {
    story: [
        {
            // Step 0: Welcome
            view: 'dashboard',
            desktopTarget: '#dashboard-title',
            mobileTarget: '#dashboard-title',
            title: "Meet Alice & Bob 👫",
            message: "We've set up a typical Belgian family scenario for you. Alice & Bob earn €4,830/month. Let's see how they keep their peace of mind.",
            placement: 'bottom',
            nonBlocking: true
        },
        {
            // Step 1: The KPI
            view: 'dashboard',
            desktopTarget: '#kpi-safe-to-spend',
            mobileTarget: '#kpi-safe-to-spend',
            title: "The Magic Number ✨",
            message: "This is their **Safe-to-Spend**. It's what's left for fun AFTER all bills, savings, and future needs are secured. No more mental math!",
            placement: 'bottom',
            nonBlocking: true
        },
        {
            // Step 2: The Action
            view: 'dashboard',
            desktopTarget: '#nav-transactions',
            mobileTarget: '#mobile-fab',
            title: "Life Happens ☕",
            message: "Alice just bought a €45 surprise gift. **Click the '+' button** (on mobile) or head to **Cash-Flow** (on desktop) to add this expense.",
            placement: 'top',
            autoAdvanceOn: '#mobile-fab', 
            simulation: {
                label: "Cadeau Surprise Alice 🎁",
                amount: -45,
                Category: "cat_leisure",
                source: "acc_joint",
                entityId: "ent_family"
            },
            nonBlocking: false 
        },
        {
            // Step 3: Result
            view: 'dashboard',
            desktopTarget: '#kpi-safe-to-spend',
            mobileTarget: '#kpi-safe-to-spend',
            title: "Instant Update ⚡",
            message: "See that? The Safe-to-Spend adjusted instantly. They are still 'In the Green'. They can enjoy that gift without any guilt!",
            placement: 'bottom',
            nonBlocking: true
        },
        {
            // Step 4: Outro
            view: 'dashboard',
            desktopTarget: '#entity-switcher-desktop',
            mobileTarget: '#entity-switcher-desktop',
            title: "You're the Pilot! ✈️",
            message: "You've mastered the basics. Explore Alice & Bob's world, or head to Settings to clear this data and start your own journey.",
            placement: 'bottom',
            nonBlocking: true
        }
    ],
    budget: [ // Trajectory Pilot (Classic)
        {
            view: 'categories',
            desktopTarget: '#btn-add-category-desktop',
            mobileTarget: '#mobile-fab',
            title: t('tour.steps.budget.0.title'),
            message: t('tour.steps.budget.0.message'),
            placement: 'right'
        },
        // ... (rest of budget steps)
    ],
    // ... (rest of missions)
};
