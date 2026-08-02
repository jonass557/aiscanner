import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, TrendingUp, ShieldCheck, Zap } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

/** Hero section: headline, sub-copy, CTAs, and a floating mock analysis card. */
export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-36 pb-24">
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-20 right-1/4 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl" />

      <div className="mx-auto max-w-6xl px-6 text-center">
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-300">
            <Sparkles className="h-4 w-4" /> Powered by advanced vision AI
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
        >
          Analyze any trading chart <span className="gradient-text">in seconds</span> with institutional-grade AI
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
          className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-gray-300"
        >
          Upload a screenshot of your Forex, Crypto, Indices, or Deriv Synthetics chart. Get a complete
          Smart Money Concepts analysis, a clear BUY / SELL / NO-TRADE decision, and a full trade plan.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link to="/register" className="btn-primary px-7 py-3 text-base">
            Start scanning free <ArrowRight className="h-5 w-5" />
          </Link>
          <a href="#how" className="btn-secondary px-7 py-3 text-base">See how it works</a>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-500"
        >
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-green-500" /> No credit card required</span>
          <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-yellow-500" /> 5 free scans / month</span>
          <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-brand-500" /> All markets supported</span>
        </motion.div>

        {/* Floating preview card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.7 }}
          className="mx-auto mt-16 max-w-3xl"
        >
          <div className="card overflow-hidden p-2 shadow-2xl">
            <div className="rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-left">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">EURUSD · H1 · Forex</p>
                  <p className="text-2xl font-bold text-white">1.0865</p>
                </div>
                <span className="rounded-full bg-green-500 px-4 py-1.5 text-sm font-bold text-white">BUY · 78%</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  ['Entry', '1.0848'],
                  ['Stop Loss', '1.0825'],
                  ['Take Profit', '1.0940'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/5 p-3">
                    <p className="text-xs text-gray-400">{k}</p>
                    <p className="font-semibold text-white">{v}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-gray-400">
                MSS + demand order block in discount zone, targeting buy-side liquidity above equal highs.
                Risk/Reward 1:3.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
