export type PlanId = 'observer' | 'desk' | 'institution';

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceMonthlyUsd: number;
  stripePriceEnv: 'STRIPE_PRICE_DESK' | 'STRIPE_PRICE_INSTITUTION' | null;
  summary: string;
  features: string[];
};

export const PLANS: PlanDefinition[] = [
  {
    id: 'observer',
    name: 'Observer',
    priceMonthlyUsd: 0,
    stripePriceEnv: null,
    summary: 'Paper ledger, quote logs, and the desk UI for one workspace.',
    features: [
      'One workspace',
      'Scanner ingestion key',
      'Phoenix-day hypothetical P&L',
      'CSV export of stored paper trades',
      'Aave liquidation pages (empty until a monitor posts)',
    ],
  },
  {
    id: 'desk',
    name: 'Desk',
    priceMonthlyUsd: 79,
    stripePriceEnv: 'STRIPE_PRICE_DESK',
    summary: 'Placeholder seat for a staffed desk. Checkout does nothing until Stripe price ids are set.',
    features: [
      'Everything in Observer',
      'Stripe Checkout session ready for STRIPE_PRICE_DESK',
      'No execution add-on — paper and read-only only',
    ],
  },
  {
    id: 'institution',
    name: 'Institution',
    priceMonthlyUsd: 299,
    stripePriceEnv: 'STRIPE_PRICE_INSTITUTION',
    summary: 'Placeholder for a later Aave V3 read-only monitor across four L2s.',
    features: [
      'Everything in Desk',
      'Schema reserved for Arbitrum, Base, Optimism, and Polygon',
      'Billing webhook can set this plan when Stripe is configured',
    ],
  },
];

export function planById(id: string): PlanDefinition | undefined {
  return PLANS.find((plan) => plan.id === id);
}

export function stripeConfigured(plan: PlanDefinition): boolean {
  if (!plan.stripePriceEnv) return false;
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env[plan.stripePriceEnv]);
}
