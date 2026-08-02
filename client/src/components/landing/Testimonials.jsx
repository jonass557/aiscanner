import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const REVIEWS = [
  {
    name: 'Marcus T.',
    role: 'Day Trader',
    text: 'It catches order blocks and FVGs I would have missed. The confidence score keeps me disciplined — if it says no trade, I sit on my hands.',
  },
  {
    name: 'Aïcha D.',
    role: 'Swing Trader',
    text: 'I scan my setups before entering and the trade plan (entry, SL, 3 TPs) is exactly how I structure my risk. Huge time saver.',
  },
  {
    name: 'Liam O.',
    role: 'Prop Firm Analyst',
    text: 'The SMC read is genuinely solid. MSS, liquidity zones, premium/discount — it reasons like a junior analyst on my desk.',
  },
  {
    name: 'Sophie R.',
    role: 'Crypto Trader',
    text: 'Works great on BTC and alt charts. Auto-detects the pair and timeframe every time. The PDF reports are perfect for my journal.',
  },
  {
    name: 'David K.',
    role: 'Deriv Trader',
    text: 'Finally a tool that understands synthetic indices. Volatility 75 analysis has sharpened my entries a lot.',
  },
  {
    name: 'Elena M.',
    role: 'Part-time Trader',
    text: 'As someone still learning SMC, the detailed reports are like having a mentor explain every setup. Worth every penny.',
  },
];

/** Testimonial cards section. */
export default function Testimonials() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Traders trust AI Chart Scanner</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Join thousands sharpening their edge.</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {REVIEWS.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.1 }}
              className="card p-6"
            >
              <div className="flex gap-0.5 text-yellow-400">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">“{r.text}”</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 font-bold text-white">
                  {r.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
