import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { userApi } from '../../services/endpoints.js';

// Fallback plan data if the API is unreachable (keeps the marketing page static-safe).
const FALLBACK = [
  { id: 'free', name: 'Free', price: 0, scansPerMonth: 5, features: ['5 scans per month', 'Basic technical analysis', '7-day history retention', 'PDF export'] },
  { id: 'pro', name: 'Pro', price: 29, scansPerMonth: 100, features: ['100 scans per month', 'Advanced SMC analysis', 'Unlimited history', 'PDF + CSV export', 'Priority support', 'Email alerts'] },
  { id: 'premium', name: 'Premium', price: 99, scansPerMonth: -1, features: ['Unlimited scans', 'Everything in Pro', 'API access', 'Real-time analysis', '24/7 support', 'Custom reports'] },
];

/** Pricing section — pulls the live plan catalog, falls back to static data. */
export default function Pricing() {
  const [plans, setPlans] = useState(FALLBACK);

  useEffect(() => {
    userApi
      .plans()
      .then(({ data }) => setPlans(data.data.plans))
      .catch(() => setPlans(FALLBACK));
  }, []);

  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Simple, transparent pricing</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Start free. Upgrade when you need more scans.</p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const highlighted = plan.id === 'pro';
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`card relative flex flex-col p-8 ${
                  highlighted ? 'ring-2 ring-brand-500 lg:-translate-y-4 lg:scale-105' : ''
                }`}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-600 to-accent-600 px-3 py-1 text-xs font-bold text-white">
                    MOST POPULAR
                  </span>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">${plan.price}</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {plan.scansPerMonth === -1 ? 'Unlimited scans' : `${plan.scansPerMonth} scans / month`}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span className="text-gray-600 dark:text-gray-300">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className={`mt-8 text-center ${highlighted ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {plan.price === 0 ? 'Start free' : `Get ${plan.name}`}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
