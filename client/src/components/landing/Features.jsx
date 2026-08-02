import { motion } from 'framer-motion';
import {
  Brain, Target, Layers, TrendingUp, ShieldCheck, Clock,
  FileText, Gauge, Boxes,
} from 'lucide-react';

const FEATURES = [
  { icon: Brain, title: 'Smart Money Concepts', desc: 'Detects BOS, CHoCH, MSS, order blocks, FVGs, breaker & mitigation blocks — the full ICT toolkit.' },
  { icon: Target, title: 'Clear decisions', desc: 'Every scan returns exactly one verdict: BUY, SELL, or NO TRADE. No ambiguity, no noise.' },
  { icon: Gauge, title: 'Confidence scoring', desc: 'A 0–100 score based only on real detected confluences. Below 70? It recommends no trade.' },
  { icon: Layers, title: 'Liquidity mapping', desc: 'Equal highs/lows, buy-side & sell-side liquidity, premium and discount zones.' },
  { icon: FileText, title: 'Full trade plan', desc: 'Entry, stop loss, three take-profits, risk/reward, estimated duration and probability.' },
  { icon: TrendingUp, title: 'All markets', desc: 'Forex, Crypto, Indices, Commodities, and Deriv Synthetic Indices — auto-recognized.' },
  { icon: Boxes, title: 'Structure & momentum', desc: 'Trendlines, consolidations, breakouts, fake breakouts, volatility and momentum read.' },
  { icon: Clock, title: 'History & exports', desc: 'Every analysis saved. Search, filter, and export to PDF or CSV anytime.' },
  { icon: ShieldCheck, title: 'Secure & private', desc: 'Your charts and data are encrypted and never shared. Delete anytime.' },
];

/** Feature grid section. */
export default function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Everything a pro analyst does — automated</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            Institutional-grade technical analysis, distilled into one click.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.08 }}
              className="card p-6 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
