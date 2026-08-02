import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'How accurate is the AI analysis?',
    a: 'The AI applies institutional Smart Money Concepts and classic technical analysis to what is visibly present in your chart. It reports a confidence score and only recommends a trade above 70% confidence. It is a decision-support tool, not a guarantee — always apply your own risk management.',
  },
  {
    q: 'Which markets and chart types are supported?',
    a: 'Forex, Crypto, Indices, Commodities, and Deriv Synthetic Indices. Upload a screenshot from any platform (MT4/MT5, TradingView, Deriv, etc.). The AI auto-recognizes the symbol, timeframe, and market.',
  },
  {
    q: 'What image formats can I upload?',
    a: 'PNG, JPEG, JPG, and WEBP up to 10 MB. You can drag & drop, paste from your clipboard, or select a file.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Your uploaded charts and analyses are private to your account, encrypted in transit, and you can delete any analysis at any time.',
  },
  {
    q: 'Can I cancel or change my plan?',
    a: 'Absolutely. You can upgrade, downgrade, or cancel from your dashboard at any time. Free forever includes 5 scans per month.',
  },
  {
    q: 'Is this financial advice?',
    a: 'No. AI Chart Scanner is an educational and analytical tool. Nothing it produces is financial advice. You are solely responsible for your trading decisions.',
  },
];

/** Accordion FAQ section. */
export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="bg-gray-100/60 py-24 dark:bg-gray-900/40">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Frequently asked questions</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Everything you need to know before you start.</p>
        </div>

        <div className="mt-12 space-y-3">
          {FAQS.map((item, i) => (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between p-5 text-left font-medium"
              >
                {item.q}
                <ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition ${open === i ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm text-gray-600 dark:text-gray-400">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
