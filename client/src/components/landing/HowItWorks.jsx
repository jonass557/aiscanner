import { motion } from 'framer-motion';
import { Upload, ScanLine, FileCheck } from 'lucide-react';

const STEPS = [
  {
    icon: Upload,
    title: 'Upload your chart',
    desc: 'Drag & drop, paste from clipboard, or select a screenshot. PNG, JPG, JPEG, or WEBP.',
  },
  {
    icon: ScanLine,
    title: 'AI scans it',
    desc: 'Our vision AI recognizes the symbol, timeframe and market, then runs a full SMC + technical analysis.',
  },
  {
    icon: FileCheck,
    title: 'Get your plan',
    desc: 'Receive a clear decision, confidence score, complete trade plan and a detailed reasoning report.',
  },
];

/** Three-step "how it works" section. */
export default function HowItWorks() {
  return (
    <section id="how" className="bg-gray-100/60 py-24 dark:bg-gray-900/40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Three steps to a full analysis</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-300">From screenshot to trade plan in under a minute.</p>
        </div>

        <div className="relative mt-16 grid gap-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg dark:bg-gray-800">
                <s.icon className="h-7 w-7 text-brand-600" />
              </div>
              <span className="mt-4 inline-block text-sm font-bold text-brand-500">Step {i + 1}</span>
              <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
